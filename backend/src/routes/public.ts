import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { businessAssets, businesses, menuCategories, menuItemAssets, menuItems } from '../db/schema.js';
import { db, first, supabase } from '../db/client.js';
import { answerPublicConcierge } from '../services/qPublicConcierge.js';

const publicRoutes = new Hono();

publicRoutes.post('/q-concierge', async (c) => {
  const payload = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const visitorKey = c.req.header('x-real-ip') || forwardedFor || c.req.header('user-agent') || 'anonymous';

  return c.json(await answerPublicConcierge({
    message: payload.message,
    history: payload.history,
    draft: payload.draft,
    visitorKey,
  }));
});
const LOGO_BUCKET = 'business-assets';

publicRoutes.get('/businesses/:publicCode', async (c) => {
    const business = await first(db.select().from(businesses)
        .where(eq(businesses.publicCode, c.req.param('publicCode').toUpperCase())));
    if (!business || business.status !== 'active') return c.json({ error: 'Business not found' }, 404);
    return c.json({
        publicCode: business.publicCode,
        name: business.name,
        type: business.type,
        country: business.country,
        city: business.city,
    });
});

publicRoutes.get('/businesses/:publicCode/logo', async (c) => {
    const business = await first(db.select().from(businesses)
        .where(eq(businesses.publicCode, c.req.param('publicCode').toUpperCase())));
    if (!business || business.status !== 'active' || !business.logoPath) return c.body(null, 404);
    if (business.logoPath !== 'database') {
        if (!supabase) return c.body(null, 404);
        return c.redirect(supabase.storage.from(LOGO_BUCKET).getPublicUrl(business.logoPath).data.publicUrl, 302);
    }
    const asset = await first(db.select().from(businessAssets).where(eq(businessAssets.businessId, business.id)));
    if (!asset) return c.body(null, 404);
    const bytes = Buffer.from(asset.dataBase64, 'base64');
    c.header('Content-Type', asset.mimeType);
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('X-Content-Type-Options', 'nosniff');
    return c.body(bytes);
});

publicRoutes.get('/menu-items/:itemId/image', async (c) => {
    const item = await first(db.select().from(menuItems).where(eq(menuItems.id, c.req.param('itemId'))));
    if (!item || item.imageUrl !== 'database') return c.body(null, 404);
    const business = await first(db.select().from(businesses).where(and(
        eq(businesses.id, item.businessId),
        eq(businesses.status, 'active'),
    )));
    if (!business) return c.body(null, 404);
    const asset = await first(db.select().from(menuItemAssets).where(and(
        eq(menuItemAssets.itemId, item.id),
        eq(menuItemAssets.businessId, item.businessId),
    )));
    if (!asset) return c.body(null, 404);
    c.header('Content-Type', asset.mimeType);
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('X-Content-Type-Options', 'nosniff');
    return c.body(Buffer.from(asset.dataBase64, 'base64'));
});

publicRoutes.get('/businesses/:publicCode/menu', async (c) => {
    const business = await first(db.select().from(businesses)
        .where(and(
            eq(businesses.publicCode, c.req.param('publicCode').toUpperCase()),
            eq(businesses.status, 'active'),
        )));
    if (!business || !business.publicMenuEnabled) return c.json({ error: 'Public menu is not available' }, 404);
    const categories = await db.select().from(menuCategories)
        .where(eq(menuCategories.businessId, business.id))
        .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
    const items = await db.select().from(menuItems)
        .where(and(eq(menuItems.businessId, business.id), eq(menuItems.isAvailable, true)))
        .orderBy(asc(menuItems.name));
    const origin = new URL(c.req.url).origin;
    const logoUrl = business.logoPath === 'database'
        ? `${origin}/api/public/businesses/${encodeURIComponent(business.publicCode!)}/logo`
        : business.logoPath && supabase
            ? supabase.storage.from(LOGO_BUCKET).getPublicUrl(business.logoPath).data.publicUrl
            : null;
    return c.json({
        business: {
            publicCode: business.publicCode,
            name: business.name,
            country: business.country,
            city: business.city,
            currency: business.currency || 'USD',
            logoUrl,
        },
        categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            items: items.filter((item) => item.categoryId === category.id).map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                imageUrl: item.imageUrl === 'database'
                    ? `${origin}/api/public/menu-items/${encodeURIComponent(item.id)}/image`
                    : item.imageUrl,
                price: item.price,
                prepTimeMinutes: item.prepTimeMinutes,
            })),
        })).filter((category) => category.items.length > 0),
    });
});

export default publicRoutes;
