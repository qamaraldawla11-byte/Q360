import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { businessAssets, businesses, menuCategories, menuItemAssets, menuItems } from '../db/schema.js';
import { db, first, supabase } from '../db/client.js';
import { answerPublicConcierge } from '../services/qPublicConcierge.js';
import { generateBriefToken, validateGuestBriefPayload } from '../services/qGuestBrief.js';
import { getQGuestBriefDeps } from '../services/qGuestBriefDeps.js';
import { takeGuestBriefRateToken } from '../services/qGuestBriefRateLimit.js';
import { createGuestBrief } from '../services/qGuestBriefService.js';
import { APPROVED_MODULES } from '../services/qOrchestration.js';

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

const GUEST_BRIEF_CREATE_RATE_LIMIT_PER_HOUR = 5;

/** Trusted-layer fields a guest brief request must never carry (A1/A2.1). */
const FORBIDDEN_BRIEF_REQUEST_FIELDS = [
    'businessId', 'tenantId', 'tenant', 'userId', 'ownerId', 'role', 'permissions',
    'jwt', 'token', 'destination', 'route', 'path', 'url', 'success', 'executed', 'enabledModules',
] as const;

const cleanBriefList = (value: unknown, itemMax: number, maxItems: number): string[] =>
    (Array.isArray(value) ? value : [])
        .map(item => (typeof item === 'string' ? item.trim().slice(0, itemMax) : ''))
        .filter(Boolean)
        .slice(0, maxItems);

publicRoutes.post('/q-concierge/brief', async (c) => {
    // Fail closed BEFORE any DB work: flag + ≥32-byte token secret required.
    const deps = getQGuestBriefDeps();
    if (!deps) return c.json({ error: 'not_found' }, 404);

    const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const visitorKey = c.req.header('x-real-ip') || forwardedFor || c.req.header('user-agent') || 'anonymous';
    const rate = takeGuestBriefRateToken(`create:${visitorKey}`, GUEST_BRIEF_CREATE_RATE_LIMIT_PER_HOUR);
    if (!rate.allowed) {
        return c.json({ error: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds }, 429);
    }

    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    if (FORBIDDEN_BRIEF_REQUEST_FIELDS.some(field => field in body)) {
        return c.json({ error: 'invalid_payload' }, 422);
    }

    const rawBusinessType = typeof body.businessType === 'string' ? body.businessType.trim().toLowerCase() : '';
    const isRestaurantFamily = rawBusinessType === 'restaurant' || rawBusinessType === 'cafe' || rawBusinessType === 'café';
    if (!isRestaurantFamily) {
        return c.json({ error: 'not_implemented', message: 'Only the Restaurant workspace is supported for Q-guided setup right now.' }, 422);
    }
    const normalizedBusinessType = 'restaurant';
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const country = typeof body.country === 'string' ? body.country.trim() : '';
    const currency = typeof body.currency === 'string' ? body.currency.trim() : undefined;
    if (!businessName || businessName.length > 120) return c.json({ error: 'invalid_payload' }, 422);
    if (!country || country.length > 100) return c.json({ error: 'invalid_payload' }, 422);
    if (currency !== undefined && !/^[A-Za-z]{3}$/.test(currency)) return c.json({ error: 'invalid_payload' }, 422);
    const tables = typeof body.tables === 'number' && Number.isSafeInteger(body.tables) ? body.tables : null;
    if (tables === null || tables < 1 || tables > 30) return c.json({ error: 'invalid_payload' }, 422);
    const services = cleanBriefList(body.services, 40, 8);
    if (services.length === 0) return c.json({ error: 'invalid_payload' }, 422);
    const priorities = cleanBriefList(body.priorities, 60, 8);
    const requestedModules = cleanBriefList(body.recommendedModules, 60, 24)
        .filter(moduleKey => (APPROVED_MODULES as readonly string[]).includes(moduleKey));
    const recommendedModules = requestedModules.length > 0 ? [...new Set(requestedModules)] : [...APPROVED_MODULES];

    const prefillCurrency = currency?.toUpperCase() ?? 'USD';
    let businessSummary = `Restaurant "${businessName}" in ${country}(${prefillCurrency}). ${tables} tables. Service: ${services.join(', ')}.`;
    if (priorities.length > 0) businessSummary += ` Priorities: ${priorities.join(', ')}.`;
    businessSummary = businessSummary.slice(0, 2000);

    const payload = {
        version: 1,
        businessSummary,
        recommendation: {
            intent: 'create_workspace',
            businessType: normalizedBusinessType,
            recommendedWorkspace: normalizedBusinessType,
            recommendedModules,
            priorities,
            rationale: 'Owner confirmed restaurant onboarding details in the public Q concierge.',
            requiresApproval: true,
        },
        prefill: { businessName, country, currency: prefillCurrency },
        answers: [
            { question: 'business_type', answer: normalizedBusinessType },
            { question: 'table_count', answer: String(tables) },
            { question: 'service_modes', answer: services.join(', ') },
        ],
        clientMetadata: { createdFrom: 'guest_concierge' as const },
    };
    const validated = validateGuestBriefPayload(payload);
    if (!validated.ok) return c.json({ error: 'invalid_payload' }, 422);

    const rawToken = generateBriefToken();
    const visitorKeyHash = createHmac('sha256', deps.tokenSecret).update(`q-visitor:${visitorKey}`).digest('base64url');
    const created = await createGuestBrief({ rawToken, payload: validated.value, visitorKeyHash }, deps);
    if (!created.ok) return c.json({ error: 'invalid_payload' }, 422);

    // The raw token is returned to the guest exactly once here. It is never
    // logged, never stored, and the derived tokenHash never leaves the server.
    return c.json({ briefToken: rawToken, activeExpiresAt: created.activeExpiresAt }, 201);
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
