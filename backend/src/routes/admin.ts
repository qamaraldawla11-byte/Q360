
import { Hono } from 'hono';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { users, businesses, auditLogs, systemSettings, qUsageEvents, NewUser, NewBusiness } from '../db/schema.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import type { AppEnv } from '../types/app.js';
import { getErrorMessage } from '../types/app.js';
import { getQProviderStatus } from '../services/qProviderConfig.js';

const admin = new Hono<AppEnv>();

// Platform administration is separate from ordinary workspace ownership.
admin.use('*', authMiddleware);
admin.use('*', requireRole(['admin']));

// --- Dashboard Stats ---

admin.get('/stats', async (c) => {
    try {
        const totalUsers = await first(db.select({ count: sql<number>`count(*)` }).from(users));
        const totalBusinesses = await first(db.select({ count: sql<number>`count(*)` }).from(businesses));

        // DEFERRED: Phase 3 Migration Required - businesses.status column may not exist
        let activeBusinessesCount = 0;
        try {
            const activeBusinesses = await db.select({ count: sql<number>`count(*)` })
                .from(businesses)
                .where(eq(businesses.status, 'active'))
                .then((rows) => rows[0]);
            activeBusinessesCount = activeBusinesses?.count || 0;
        } catch {
            // Column may not exist yet - gracefully default to total count
            console.warn('[Admin Stats] businesses.status column not available, using total count');
            activeBusinessesCount = totalBusinesses?.count || 0;
        }

        let recentActions: (typeof auditLogs.$inferSelect)[] = [];
        try {
            recentActions = await db.select()
                .from(auditLogs)
                .orderBy(desc(auditLogs.timestamp))
                .limit(10);
        } catch {
            console.warn('[Admin Stats] audit_logs table not available');
        }

        return c.json({
            totalUsers: totalUsers?.count || 0,
            totalBusinesses: totalBusinesses?.count || 0,
            activeBusinesses: activeBusinessesCount,
            recentActions,
            systemHealth: {
                database: 'ok',
                server: 'running',
                lastCheck: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        return c.json({ error: 'Failed to fetch stats' }, 500);
    }
});

// --- Q Usage & Cost Control ---

admin.get('/q-usage', async (c) => {
    try {
        const requestedDays = Number(c.req.query('days') || 30);
        const days = Math.min(90, Math.max(1, Number.isFinite(requestedDays) ? Math.floor(requestedDays) : 30));
        const now = new Date();
        const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const queryStart = periodStart < monthStart ? periodStart : monthStart;

        const [usageRows, businessRows, userRows] = await Promise.all([
            db.select().from(qUsageEvents).where(gte(qUsageEvents.createdAt, queryStart)).orderBy(desc(qUsageEvents.createdAt)),
            db.select({ id: businesses.id, name: businesses.name, status: businesses.status }).from(businesses),
            db.select({ id: users.id, name: users.name, email: users.email, businessId: users.businessId }).from(users),
        ]);

        type UsageRow = typeof usageRows[number];
        const periodRows = usageRows.filter((row) => new Date(row.createdAt).getTime() >= periodStart.getTime());
        const monthRows = usageRows.filter((row) => new Date(row.createdAt).getTime() >= monthStart.getTime());
        const isModelRequest = (row: UsageRow) => row.provider === 'openai';
        const costUsd = (rows: UsageRow[]) => rows.reduce((sum, row) => sum + (row.estimatedCostUsdMicros || 0), 0) / 1_000_000;
        const totalTokens = (rows: UsageRow[]) => rows.reduce((sum, row) => sum + (row.inputTokens || 0) + (row.outputTokens || 0), 0);

        const activeBusinessIds = new Set(periodRows.map((row) => row.businessId));
        const activeUserIds = new Set(periodRows.map((row) => row.userId));
        const modelRequests = periodRows.filter(isModelRequest).length;
        const fallbackRequests = periodRows.length - modelRequests;

        const businessUsage = businessRows
            .map((business) => {
                const rows = periodRows.filter((row) => row.businessId === business.id);
                const businessMonthRows = monthRows.filter((row) => row.businessId === business.id);
                const monthCostUsd = costUsd(businessMonthRows);
                const provider = getQProviderStatus(monthCostUsd);
                return {
                    id: business.id,
                    name: business.name,
                    status: business.status,
                    requests: rows.length,
                    modelRequests: rows.filter(isModelRequest).length,
                    fallbackRequests: rows.filter((row) => !isModelRequest(row)).length,
                    totalTokens: totalTokens(rows),
                    periodCostUsd: costUsd(rows),
                    monthCostUsd,
                    monthlyBudgetUsd: provider.monthlyBudgetUsd,
                    budgetRemainingUsd: provider.budgetRemainingUsd,
                    providerMode: provider.mode,
                };
            })
            .filter((business) => business.requests > 0 || business.monthCostUsd > 0)
            .sort((a, b) => b.periodCostUsd - a.periodCostUsd);

        const userUsage = userRows
            .map((user) => {
                const rows = periodRows.filter((row) => row.userId === user.id);
                return {
                    id: user.id,
                    name: user.name || user.email,
                    email: user.email,
                    businessId: user.businessId,
                    requests: rows.length,
                    modelRequests: rows.filter(isModelRequest).length,
                    totalTokens: totalTokens(rows),
                    estimatedCostUsd: costUsd(rows),
                };
            })
            .filter((user) => user.requests > 0)
            .sort((a, b) => b.requests - a.requests);

        const fallbackCounts = new Map<string, number>();
        periodRows.filter((row) => !isModelRequest(row)).forEach((row) => {
            const metadata = row.metadata || {};
            const reasonValue = metadata.fallbackReason ?? metadata.reason ?? metadata.safeReason;
            const reason = typeof reasonValue === 'string' && reasonValue.trim()
                ? reasonValue
                : row.requestStatus === 'blocked' ? 'Budget or policy guard' : 'Rules-only response';
            fallbackCounts.set(reason, (fallbackCounts.get(reason) || 0) + 1);
        });

        return c.json({
            period: { days, from: periodStart.toISOString(), to: now.toISOString() },
            provider: getQProviderStatus(0),
            summary: {
                requests: periodRows.length,
                completedRequests: periodRows.filter((row) => row.requestStatus === 'completed').length,
                modelRequests,
                fallbackRequests,
                failedRequests: periodRows.filter((row) => row.requestStatus === 'failed').length,
                inputTokens: periodRows.reduce((sum, row) => sum + (row.inputTokens || 0), 0),
                outputTokens: periodRows.reduce((sum, row) => sum + (row.outputTokens || 0), 0),
                totalTokens: totalTokens(periodRows),
                estimatedCostUsd: costUsd(periodRows),
                activeBusinesses: activeBusinessIds.size,
                activeUsers: activeUserIds.size,
                fallbackRate: periodRows.length ? fallbackRequests / periodRows.length : 0,
            },
            businesses: businessUsage,
            users: userUsage,
            fallbackReasons: Array.from(fallbackCounts.entries())
                .map(([reason, count]) => ({ reason, count }))
                .sort((a, b) => b.count - a.count),
        });
    } catch (error) {
        console.error('Q usage admin error:', getErrorMessage(error));
        return c.json({ error: 'Failed to load Q usage controls' }, 500);
    }
});

// --- Users Management ---

// List all users
admin.get('/users', async (c) => {
    try {
        const allUsers = await db.select().from(users);
        return c.json(allUsers);
    } catch {
        return c.json({ error: 'Failed to fetch users' }, 500);
    }
});

// Create User
admin.post('/users', async (c) => {
    try {
        const body = await c.req.json();
        const { email, name, role, businessId } = body;

        if (!email || !role) {
            return c.json({ error: 'Email and Role are required' }, 400);
        }

        const creatableRoles = ['owner', 'admin', 'manager', 'staff', 'user'];
        if (typeof role !== 'string' || !creatableRoles.includes(role)) {
            return c.json({ error: 'Invalid role' }, 400);
        }

        if (typeof businessId !== 'string' || !businessId.trim()) {
            return c.json({ error: 'businessId is required' }, 400);
        }
        const targetBusiness = await first(db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)));
        if (!targetBusiness) {
            return c.json({ error: 'businessId must reference an existing business' }, 400);
        }

        const newUser: NewUser = {
            id: uuidv4(),
            email,
            name,
            role,
            businessId,
            primaryWorkspace: null,
            status: 'active',
            isLocked: false,
            onboardingCompleted: false,
        };

        await db.insert(users).values(newUser);

        await db.insert(auditLogs).values({
            id: uuidv4(),
            userId: c.get('userId'),
            businessId: c.get('businessId'),
            action: 'CREATE',
            entity: 'USER',
            entityId: newUser.id,
            details: JSON.stringify({ email, role }),
        });

        return c.json(newUser, 201);
    } catch {
        return c.json({ error: 'Failed to create user' }, 500);
    }
});

// Update User
admin.patch('/users/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const updates: Record<string, unknown> = {};

        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || !body.name.trim()) {
                return c.json({ error: 'Invalid name' }, 400);
            }
            updates.name = body.name.trim();
        }
        if (body.role !== undefined) {
            const editableRoles = ['owner', 'admin', 'manager', 'staff', 'user'];
            if (typeof body.role !== 'string' || !editableRoles.includes(body.role)) {
                return c.json({ error: 'Invalid role' }, 400);
            }
            updates.role = body.role;
        }
        if (body.status !== undefined) {
            if (body.status !== 'active' && body.status !== 'inactive') {
                return c.json({ error: 'Invalid status' }, 400);
            }
            updates.status = body.status;
        }
        if (body.isLocked !== undefined) {
            if (typeof body.isLocked !== 'boolean') {
                return c.json({ error: 'Invalid isLocked' }, 400);
            }
            updates.isLocked = body.isLocked;
        }
        if (body.moduleAccess !== undefined) {
            if (!Array.isArray(body.moduleAccess) || body.moduleAccess.some((entry: unknown) => typeof entry !== 'string')) {
                return c.json({ error: 'Invalid moduleAccess' }, 400);
            }
            updates.moduleAccess = body.moduleAccess;
        }

        // Protected identity, tenant, and audit fields (id, email, businessId,
        // primaryWorkspace, createdAt, onboarding/segment fields, unknown keys)
        // are intentionally ignored.
        if (Object.keys(updates).length === 0) {
            return c.json({ error: 'No supported fields to update' }, 400);
        }

        await db.update(users).set(updates).where(eq(users.id, id));

        await db.insert(auditLogs).values({
            id: uuidv4(),
            userId: c.get('userId') as string,
            businessId: c.get('businessId') as string,
            action: 'UPDATE',
            entity: 'USER',
            entityId: id,
            details: JSON.stringify(updates),
        });

        return c.json({ message: 'User updated' });
    } catch {
        return c.json({ error: 'Failed to update user' }, 500);
    }
});

// Activate User
// DEFERRED: Phase 3 Migration Required - users.status column
admin.post('/users/:id/activate', async (c) => {
    try {
        const id = c.req.param('id');

        try {
            await db.update(users).set({ status: 'active' }).where(eq(users.id, id));
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            if (message.includes('no such column') || message.includes('status')) {
                console.warn('[Admin] users.status column not available - migration required');
                return c.json({ error: 'Feature requires database migration', code: 'MIGRATION_REQUIRED' }, 400);
            }
            throw error;
        }

        try {
            await db.insert(auditLogs).values({
                id: uuidv4(),
                userId: c.get('userId'),
                businessId: c.get('businessId'),
                action: 'ACTIVATE_USER',
                entity: 'USER',
                entityId: id,
                details: JSON.stringify({ userId: id }),
            });
        } catch {
            console.warn('[Audit] Failed to log activate user action');
        }

        return c.json({ message: 'User activated' });
    } catch (error) {
        console.error('[Admin] Activate user error:', error);
        return c.json({ error: 'Failed to activate user' }, 500);
    }
});

// Deactivate User
// DEFERRED: Phase 3 Migration Required - users.status column
admin.post('/users/:id/deactivate', async (c) => {
    try {
        const id = c.req.param('id');

        try {
            await db.update(users).set({ status: 'inactive' }).where(eq(users.id, id));
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            if (message.includes('no such column') || message.includes('status')) {
                console.warn('[Admin] users.status column not available - migration required');
                return c.json({ error: 'Feature requires database migration', code: 'MIGRATION_REQUIRED' }, 400);
            }
            throw error;
        }

        try {
            await db.insert(auditLogs).values({
                id: uuidv4(),
                userId: c.get('userId'),
                businessId: c.get('businessId'),
                action: 'DEACTIVATE_USER',
                entity: 'USER',
                entityId: id,
                details: JSON.stringify({ userId: id }),
            });
        } catch {
            console.warn('[Audit] Failed to log deactivate user action');
        }

        return c.json({ message: 'User deactivated' });
    } catch (error) {
        console.error('[Admin] Deactivate user error:', error);
        return c.json({ error: 'Failed to deactivate user' }, 500);
    }
});

// Lock User
// DEFERRED: Phase 3 Migration Required - users.is_locked column
admin.post('/users/:id/lock', async (c) => {
    try {
        const id = c.req.param('id');

        try {
            await db.update(users).set({ isLocked: true }).where(eq(users.id, id));
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            if (message.includes('no such column') || message.includes('is_locked')) {
                console.warn('[Admin] users.is_locked column not available - migration required');
                return c.json({ error: 'Feature requires database migration', code: 'MIGRATION_REQUIRED' }, 400);
            }
            throw error;
        }

        try {
            await db.insert(auditLogs).values({
                id: uuidv4(),
                userId: c.get('userId'),
                businessId: c.get('businessId'),
                action: 'LOCK_USER',
                entity: 'USER',
                entityId: id,
                details: JSON.stringify({ userId: id }),
            });
        } catch {
            console.warn('[Audit] Failed to log lock user action');
        }

        return c.json({ message: 'User locked' });
    } catch (error) {
        console.error('[Admin] Lock user error:', error);
        return c.json({ error: 'Failed to lock user' }, 500);
    }
});

// Unlock User
// DEFERRED: Phase 3 Migration Required - users.is_locked column
admin.post('/users/:id/unlock', async (c) => {
    try {
        const id = c.req.param('id');

        try {
            await db.update(users).set({ isLocked: false }).where(eq(users.id, id));
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            if (message.includes('no such column') || message.includes('is_locked')) {
                console.warn('[Admin] users.is_locked column not available - migration required');
                return c.json({ error: 'Feature requires database migration', code: 'MIGRATION_REQUIRED' }, 400);
            }
            throw error;
        }

        try {
            await db.insert(auditLogs).values({
                id: uuidv4(),
                userId: c.get('userId'),
                businessId: c.get('businessId'),
                action: 'UNLOCK_USER',
                entity: 'USER',
                entityId: id,
                details: JSON.stringify({ userId: id }),
            });
        } catch {
            console.warn('[Audit] Failed to log unlock user action');
        }

        return c.json({ message: 'User unlocked' });
    } catch (error) {
        console.error('[Admin] Unlock user error:', error);
        return c.json({ error: 'Failed to unlock user' }, 500);
    }
});

// --- Businesses Management ---

// List Businesses
admin.get('/businesses', async (c) => {
    try {
        const allBiz = await db.select().from(businesses);
        return c.json(allBiz);
    } catch {
        return c.json({ error: 'Failed to fetch businesses' }, 500);
    }
});

// Create Business
admin.post('/businesses', async (c) => {
    try {
        const body = await c.req.json();
        const { name, type } = body;

        if (!name) return c.json({ error: 'Name is required' }, 400);

        const newBiz: NewBusiness = {
            id: uuidv4(),
            name,
            type: type || 'retail',
            status: 'active',
        };

        await db.insert(businesses).values(newBiz);

        await db.insert(auditLogs).values({
            id: uuidv4(),
            userId: c.get('userId') as string,
            businessId: c.get('businessId') as string,
            action: 'CREATE',
            entity: 'BUSINESS',
            entityId: newBiz.id,
            details: JSON.stringify({ name }),
        });

        return c.json(newBiz, 201);
    } catch {
        return c.json({ error: 'Failed to create business' }, 500);
    }
});

// Suspend Business
// DEFERRED: Phase 3 Migration Required - businesses.status and suspension_reason columns
admin.post('/businesses/:id/suspend', async (c) => {
    try {
        const id = c.req.param('id');
        const { reason } = await c.req.json();

        try {
            await db.update(businesses)
                .set({ status: 'suspended', suspensionReason: reason || 'No reason provided' })
                .where(eq(businesses.id, id))
                ;
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            if (message.includes('no such column') || message.includes('status') || message.includes('suspension_reason')) {
                console.warn('[Admin] businesses status/suspension_reason columns not available - migration required');
                return c.json({ error: 'Feature requires database migration', code: 'MIGRATION_REQUIRED' }, 400);
            }
            throw error;
        }

        try {
            await db.insert(auditLogs).values({
                id: uuidv4(),
                userId: c.get('userId'),
                businessId: c.get('businessId'),
                action: 'SUSPEND_BUSINESS',
                entity: 'BUSINESS',
                entityId: id,
                details: JSON.stringify({ businessId: id, reason: reason || 'No reason provided' }),
            });
        } catch {
            console.warn('[Audit] Failed to log suspend business action');
        }

        return c.json({ message: 'Business suspended' });
    } catch (error) {
        console.error('[Admin] Suspend business error:', error);
        return c.json({ error: 'Failed to suspend business' }, 500);
    }
});

// Activate Business
// DEFERRED: Phase 3 Migration Required - businesses.status and suspension_reason columns
admin.post('/businesses/:id/activate', async (c) => {
    try {
        const id = c.req.param('id');

        try {
            await db.update(businesses)
                .set({ status: 'active', suspensionReason: null })
                .where(eq(businesses.id, id))
                ;
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            if (message.includes('no such column') || message.includes('status') || message.includes('suspension_reason')) {
                console.warn('[Admin] businesses status/suspension_reason columns not available - migration required');
                return c.json({ error: 'Feature requires database migration', code: 'MIGRATION_REQUIRED' }, 400);
            }
            throw error;
        }

        try {
            await db.insert(auditLogs).values({
                id: uuidv4(),
                userId: c.get('userId'),
                businessId: c.get('businessId'),
                action: 'ACTIVATE_BUSINESS',
                entity: 'BUSINESS',
                entityId: id,
                details: JSON.stringify({ businessId: id }),
            });
        } catch {
            console.warn('[Audit] Failed to log activate business action');
        }

        return c.json({ message: 'Business activated' });
    } catch (error) {
        console.error('[Admin] Activate business error:', error);
        return c.json({ error: 'Failed to activate business' }, 500);
    }
});

// --- Audit Logs ---

// Get Logs with Filters
admin.get('/audit-logs', async (c) => {
    try {
        const userId = c.req.query('userId');
        const businessId = c.req.query('businessId');
        const action = c.req.query('action');
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');

        // Build dynamic where conditions
        const conditions = [];
        if (userId) conditions.push(eq(auditLogs.userId, userId));
        if (businessId) conditions.push(eq(auditLogs.businessId, businessId));
        if (action) conditions.push(eq(auditLogs.action, action));
        if (startDate) conditions.push(gte(auditLogs.timestamp, new Date(startDate)));
        if (endDate) conditions.push(lte(auditLogs.timestamp, new Date(endDate)));

        let query = db.select().from(auditLogs);

        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as typeof query;
        }

        const logs = await query.orderBy(desc(auditLogs.timestamp)).limit(200);
        return c.json(logs);
    } catch (error) {
        console.error('Audit logs error:', error);
        return c.json({ error: 'Failed to fetch logs' }, 500);
    }
});

// --- Settings ---

// Get Settings
admin.get('/settings', async (c) => {
    try {
        const settings = await db.select().from(systemSettings);
        return c.json(settings);
    } catch {
        return c.json({ error: 'Failed to fetch settings' }, 500);
    }
});

// Update Setting
admin.post('/settings', async (c) => {
    try {
        const { key, value, description } = await c.req.json();

        if (!key || value === undefined) return c.json({ error: 'Key and Value required' }, 400);

        // Upsert
        await db.insert(systemSettings).values({
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            description,
            updatedAt: new Date(),
        })
            .onConflictDoUpdate({
                target: systemSettings.key,
                set: { value: typeof value === 'string' ? value : JSON.stringify(value), updatedAt: new Date() }
            });

        await db.insert(auditLogs).values({
            id: uuidv4(),
            userId: c.get('userId'),
            businessId: c.get('businessId'),
            action: 'UPDATE_SETTING',
            entity: 'SYSTEM_SETTING',
            entityId: key,
            details: JSON.stringify({ key, value }),
        });

        return c.json({ message: 'Setting saved' });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Failed to save setting' }, 500);
    }
});

export default admin;

