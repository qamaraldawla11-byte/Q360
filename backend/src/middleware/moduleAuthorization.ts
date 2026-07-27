import { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { users } from '../db/schema.js';
import { isBusinessModuleEnabled } from '../services/businessModules.js';
import { decideModuleAccess, MODULE_MANAGEMENT_ROLES } from '../services/moduleAccessControl.js';
import type { AppEnv } from '../types/app.js';

/**
 * M5.8 — Unified module authorization middleware.
 *
 * Enforcement layers, in order:
 *   1. Business module activation (isBusinessModuleEnabled) → 409 when disabled.
 *   2. Management-role bypass (owner/admin/manager) → no DB query needed.
 *   3. users.moduleAccess contract → 403 when explicitly denied:
 *        null/undefined = legacy unrestricted (allow)
 *        []             = explicit deny-all
 *        string[]       = allow only listed modules
 *
 * Mount AFTER authMiddleware (requires userId/businessId/userRole in context).
 */
export const requireModule = (moduleKey: string, workspaceKey = 'restaurant') => {
    return async (c: Context<AppEnv>, next: Next) => {
        const businessId = c.get('businessId');

        if (!await isBusinessModuleEnabled(businessId, workspaceKey, moduleKey)) {
            return c.json({ error: `Module '${moduleKey}' is disabled for this business` }, 409);
        }

        const role = c.get('userRole');
        if (typeof role === 'string' && MODULE_MANAGEMENT_ROLES.has(role)) {
            await next();
            return;
        }

        const user = await first(db.select({ moduleAccess: users.moduleAccess })
            .from(users)
            .where(eq(users.id, c.get('userId'))));

        const decision = decideModuleAccess(role, user?.moduleAccess ?? null, moduleKey);
        if (!decision.allowed) {
            return c.json({ error: `Forbidden: No access to module '${moduleKey}'` }, 403);
        }

        await next();
    };
};
