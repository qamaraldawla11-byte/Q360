import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, first, supabase } from '../db/client.js';
import { businessAssets, businessModules, businesses, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';
import { getModulePolicy, isBusinessModuleEnabled, restaurantModulePolicies } from '../services/businessModules.js';

const businessRoutes = new Hono<AppEnv>();
const EDIT_ROLES = new Set(['user', 'owner', 'admin', 'manager']);
const RESTAURANT_TYPES = new Set(['dine_in', 'takeaway', 'both']);
const LOGO_BUCKET = 'business-assets';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

businessRoutes.use('*', authMiddleware);

const canEdit = (role: string) => EDIT_ROLES.has(role);
const publicLogoUrl = (path: string | null, publicCode: string | null, origin: string) => {
    if (!path) return null;
    if (path === 'database' && publicCode) return `${origin}/api/public/businesses/${encodeURIComponent(publicCode)}/logo`;
    if (!supabase) return null;
    return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
};

const serializeBusiness = (business: typeof businesses.$inferSelect, origin: string) => ({
    id: business.id,
    publicCode: business.publicCode,
    name: business.name,
    type: business.type,
    country: business.country,
    city: business.city,
    address: business.address,
    phone: business.phone,
    email: business.email,
    currency: business.currency || 'USD',
    timezone: business.timezone || 'UTC',
    taxIdentifier: business.taxIdentifier,
    restaurantType: business.restaurantType || 'both',
    logoUrl: business.logoPath === 'database' && business.publicCode
        ? `${origin}/api/public/businesses/${encodeURIComponent(business.publicCode)}/logo`
        : publicLogoUrl(business.logoPath, business.publicCode, origin),
    publicMenuEnabled: business.publicMenuEnabled,
    updatedAt: business.updatedAt,
});

businessRoutes.get('/profile', async (c) => {
    let business = await first(db.select().from(businesses)
        .where(eq(businesses.id, c.get('businessId'))));
    if (!business) return c.json({ error: 'Business not found' }, 404);
    if (!business.publicCode) {
        const publicCode = `Q360-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        const rows = await db.update(businesses).set({ publicCode, updatedAt: new Date() })
            .where(eq(businesses.id, business.id)).returning();
        business = rows[0] ?? business;
    }
    return c.json(serializeBusiness(business, new URL(c.req.url).origin));
});

businessRoutes.patch('/profile', async (c) => {
    if (!canEdit(c.get('userRole'))) return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
    let body: Record<string, unknown>;
    try {
        body = await c.req.json<Record<string, unknown>>();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const required = (value: unknown) => typeof value === 'string' ? value.trim() : '';
    const optional = (value: unknown) => typeof value === 'string' ? value.trim() || null : null;
    const name = required(body.name);
    const country = required(body.country);
    const currency = required(body.currency).toUpperCase();
    const timezone = required(body.timezone);
    const restaurantType = required(body.restaurantType);
    const email = optional(body.email);

    if (!name || name.length > 120) return c.json({ error: 'Business name is required and must be 120 characters or fewer' }, 400);
    if (!country || country.length > 80) return c.json({ error: 'Country is required and must be 80 characters or fewer' }, 400);
    if (!/^[A-Z]{3}$/.test(currency)) return c.json({ error: 'Currency must be a 3-letter code' }, 400);
    if (!timezone || timezone.length > 80) return c.json({ error: 'Timezone is required' }, 400);
    if (!RESTAURANT_TYPES.has(restaurantType)) return c.json({ error: 'Restaurant type must be dine_in, takeaway, or both' }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Business email is invalid' }, 400);

    const limited = (value: unknown, max: number) => {
        const parsed = optional(value);
        return parsed && parsed.length > max ? undefined : parsed;
    };
    const city = limited(body.city, 100);
    const address = limited(body.address, 240);
    const phone = limited(body.phone, 40);
    const taxIdentifier = limited(body.taxIdentifier, 80);
    if (city === undefined || address === undefined || phone === undefined || taxIdentifier === undefined) {
        return c.json({ error: 'One or more profile fields are too long' }, 400);
    }

    const businessId = c.get('businessId');
    const updated = await db.update(businesses).set({
        name, country, city, address, phone, email, currency, timezone,
        taxIdentifier, restaurantType: restaurantType as 'dine_in' | 'takeaway' | 'both',
        updatedAt: new Date(),
    }).where(eq(businesses.id, businessId)).returning();
    if (!updated.length) return c.json({ error: 'Business not found' }, 404);

    await db.update(users).set({ businessName: name, country, currency })
        .where(eq(users.businessId, businessId));
    await logAudit(c, 'BUSINESS_PROFILE_UPDATED', 'BUSINESS', businessId, { fields: Object.keys(body) });
    return c.json(serializeBusiness(updated[0], new URL(c.req.url).origin));
});

businessRoutes.post('/logo', async (c) => {
    if (!canEdit(c.get('userRole'))) return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
    let form: FormData;
    try {
        form = await c.req.formData();
    } catch {
        return c.json({ error: 'Invalid upload' }, 400);
    }
    const file = form.get('logo');
    if (!(file instanceof File)) return c.json({ error: 'Logo file is required' }, 400);
    const extension = LOGO_TYPES[file.type];
    if (!extension) return c.json({ error: 'Logo must be PNG, JPEG, or WebP' }, 400);
    if (file.size <= 0 || file.size > MAX_LOGO_BYTES) return c.json({ error: 'Logo must be 2 MB or smaller' }, 400);

    const businessId = c.get('businessId');
    const dataBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const existingAsset = await first(db.select().from(businessAssets).where(eq(businessAssets.businessId, businessId)));
    if (existingAsset) {
        await db.update(businessAssets).set({ mimeType: file.type, dataBase64, updatedAt: new Date() })
            .where(eq(businessAssets.businessId, businessId));
    } else {
        await db.insert(businessAssets).values({ businessId, mimeType: file.type, dataBase64 });
    }
    const currentBusiness = await first(db.select().from(businesses).where(eq(businesses.id, businessId)));
    const publicCode = currentBusiness?.publicCode || `Q360-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const updated = await db.update(businesses).set({ logoPath: 'database', publicCode, updatedAt: new Date() })
        .where(eq(businesses.id, businessId)).returning();
    if (!updated.length) return c.json({ error: 'Business not found' }, 404);
    await logAudit(c, 'BUSINESS_LOGO_UPDATED', 'BUSINESS', businessId, { contentType: file.type, size: file.size });
    return c.json(serializeBusiness(updated[0], new URL(c.req.url).origin));
});

businessRoutes.patch('/public-menu', async (c) => {
    if (!canEdit(c.get('userRole'))) return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
    const body = await c.req.json<{ enabled?: unknown }>().catch(() => null);
    if (!body || typeof body.enabled !== 'boolean') return c.json({ error: 'Enabled must be a boolean' }, 400);
    const businessId = c.get('businessId');
    const updated = await db.update(businesses).set({ publicMenuEnabled: body.enabled, updatedAt: new Date() })
        .where(eq(businesses.id, businessId)).returning();
    if (!updated.length) return c.json({ error: 'Business not found' }, 404);
    await logAudit(c, body.enabled ? 'PUBLIC_MENU_ENABLED' : 'PUBLIC_MENU_DISABLED', 'BUSINESS', businessId);
    return c.json(serializeBusiness(updated[0], new URL(c.req.url).origin));
});

businessRoutes.get('/modules', async (c) => {
    const workspaceKey = c.req.query('workspace') || 'restaurant';
    if (workspaceKey !== 'restaurant') return c.json({ error: 'Unsupported workspace' }, 400);
    const businessId = c.get('businessId');
    const modules = await Promise.all(restaurantModulePolicies.map(async policy => ({
        ...policy,
        workspaceKey,
        enabled: await isBusinessModuleEnabled(businessId, workspaceKey, policy.moduleKey),
    })));
    return c.json({ workspaceKey, modules });
});

businessRoutes.patch('/modules/:moduleKey', async (c) => {
    if (!canEdit(c.get('userRole'))) return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
    let body: { workspaceKey?: unknown; enabled?: unknown };
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const workspaceKey = typeof body.workspaceKey === 'string' ? body.workspaceKey : 'restaurant';
    const moduleKey = c.req.param('moduleKey');
    const policy = getModulePolicy(workspaceKey, moduleKey);
    if (!policy) return c.json({ error: 'Unknown module' }, 404);
    if (!policy.configurable) return c.json({ error: policy.availability === 'preview' ? 'Module is not available yet' : 'Protected modules cannot be disabled' }, 409);
    if (typeof body.enabled !== 'boolean') return c.json({ error: 'Enabled must be a boolean' }, 400);

    const businessId = c.get('businessId');
    const now = new Date();
    const existing = await first(db.select().from(businessModules).where(and(
        eq(businessModules.businessId, businessId), eq(businessModules.workspaceKey, workspaceKey), eq(businessModules.moduleKey, moduleKey),
    )));
    if (existing) {
        await db.update(businessModules).set({ enabled: body.enabled, updatedAt: now }).where(eq(businessModules.id, existing.id));
    } else {
        await db.insert(businessModules).values({ id: randomUUID(), businessId, workspaceKey, moduleKey, enabled: body.enabled, updatedAt: now });
    }
    await logAudit(c, body.enabled ? 'BUSINESS_MODULE_ENABLED' : 'BUSINESS_MODULE_DISABLED', 'BUSINESS_MODULE', moduleKey, { workspaceKey });
    return c.json({ ...policy, workspaceKey, enabled: body.enabled });
});

export default businessRoutes;
