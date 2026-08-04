import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { buildFounderDailyBrief, FOUNDER_BRIEF_SOURCE_CATEGORIES } from '../services/founderBrief.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';

// Q360-QB-M4-S2: Founder Daily Brief.
// The founder authorization chain is frozen: authMiddleware -> requireRole(['owner']).
// owner is allowed; admin, manager, staff and every other role receive 403;
// unauthenticated or invalid tokens receive 401 from authMiddleware.
const founder = new Hono<AppEnv>();

founder.use('*', authMiddleware);
founder.use('*', requireRole(['owner']));

// GET /api/founder/daily-brief
// Read-only and deterministic. No request body or query parameter is read:
// the tenant scope is derived exclusively from the authenticated context, so a
// client-supplied businessId can never alter the scope. No AI-provider call.
founder.get('/daily-brief', async (c) => {
    try {
        const businessId = c.get('businessId');
        const brief = await buildFounderDailyBrief(businessId);
        // Safe metadata only: never the brief body, facts, evidence, or PII.
        await logAudit(c, 'FOUNDER_DAILY_BRIEF_VIEWED', 'FOUNDER_BRIEF', null, {
            sourceCategories: [...FOUNDER_BRIEF_SOURCE_CATEGORIES],
            success: true,
        });
        return c.json(brief);
    } catch (error) {
        console.error('[FOUNDER] Daily brief generation failed:', error);
        // logAudit never throws; audit failure cannot break the error response.
        await logAudit(c, 'FOUNDER_DAILY_BRIEF_VIEWED', 'FOUNDER_BRIEF', null, {
            sourceCategories: [...FOUNDER_BRIEF_SOURCE_CATEGORIES],
            success: false,
        });
        return c.json({ error: 'Unable to generate Founder Daily Brief' }, 500);
    }
});

export default founder;
