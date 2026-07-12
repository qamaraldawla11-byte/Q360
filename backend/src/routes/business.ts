import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, first, supabase } from '../db/client.js';
import { businesses, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';

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
const publicLogoUrl = (path: string | null) => {
    if (!path || !supabase) return null;
    return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
};

const serializeBusiness = (business: typeof businesses.$inferSelect) => ({
    id: business.id,
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
    logoUrl: publicLogoUrl(business.logoPath),
    updatedAt: business.updatedAt,
});

businessRoutes.get('/profile', async (c) => {
    const business = await first(db.select().from(businesses)
        .where(eq(businesses.id, c.get('businessId'))));
    if (!business) return c.json({ error: 'Business not found' }, 404);
    return c.json(serializeBusiness(business));
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
    return c.json(serializeBusiness(updated[0]));
});

businessRoutes.post('/logo', async (c) => {
    if (!canEdit(c.get('userRole'))) return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
    if (!supabase) return c.json({ error: 'Logo storage is not configured' }, 503);

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

    const bucketCheck = await supabase.storage.getBucket(LOGO_BUCKET);
    if (bucketCheck.error) {
        const created = await supabase.storage.createBucket(LOGO_BUCKET, {
            public: true,
            fileSizeLimit: MAX_LOGO_BYTES,
            allowedMimeTypes: Object.keys(LOGO_TYPES),
        });
        if (created.error && !created.error.message.toLowerCase().includes('already exists')) {
            console.error('[Business Logo] Bucket error:', created.error.message);
            return c.json({ error: 'Unable to prepare logo storage' }, 503);
        }
    }

    const businessId = c.get('businessId');
    const path = `${businessId}/logo.${extension}`;
    const upload = await supabase.storage.from(LOGO_BUCKET).upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600',
    });
    if (upload.error) {
        console.error('[Business Logo] Upload error:', upload.error.message);
        return c.json({ error: 'Unable to upload logo' }, 503);
    }

    const updated = await db.update(businesses).set({ logoPath: path, updatedAt: new Date() })
        .where(eq(businesses.id, businessId)).returning();
    if (!updated.length) return c.json({ error: 'Business not found' }, 404);
    await logAudit(c, 'BUSINESS_LOGO_UPDATED', 'BUSINESS', businessId, { contentType: file.type, size: file.size });
    return c.json(serializeBusiness(updated[0]));
});

export default businessRoutes;
