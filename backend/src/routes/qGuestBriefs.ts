/**
 * Q Guest Brief routes — authenticated lifecycle endpoints (A2.2 Slice 2).
 *
 *   POST /api/q/guest-briefs/claim           token → bound brief (atomic)
 *   GET  /api/q/guest-briefs/current         caller's unresolved brief (or null)
 *   POST /api/q/guest-briefs/current/confirm confirm + provision workspace
 *   POST /api/q/guest-briefs/current/dismiss dismiss the unresolved brief
 *
 * Trust rules enforced here:
 *   - userId comes ONLY from the authenticated JWT context, never from input.
 *   - Malformed brief tokens are rejected BEFORE any database operation.
 *   - The router fails closed (404 not_found) when the feature flag/secret is
 *     absent — even if it was mounted by mistake.
 *   - Confirmation is the ONLY path that provisions: it runs the approved
 *     restaurant executor (qGuestBriefProvisioning.ts), then consumes the
 *     brief (R4: consume only after fields are applied). Audit details never
 *     contain the raw token or the raw payload.
 *
 * CONFIRM REPLAY SEMANTICS (D2 at the route boundary):
 *   After a successful confirm the brief is terminal ('consumed'), so the
 *   service can no longer resolve a replay. A repeat confirmation is still
 *   answered idempotently: when the caller's onboarding is already completed,
 *   the caller's latest consumed brief is compared field-for-field — same
 *   acceptedFields reprovisions idempotently and answers 'already_confirmed';
 *   different fields answer 'brief_conflict'. A caller whose onboarding was
 *   completed OUTSIDE this flow (no consumed brief, or a merely-claimed live
 *   brief) gets 'workspace_exists' and the live brief is left untouched.
 */

import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { qGuestBriefs, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';
import { isBriefTokenShape, validateGuestBriefPayload } from '../services/qGuestBrief.js';
import { getQGuestBriefDeps } from '../services/qGuestBriefDeps.js';
import { takeGuestBriefRateToken } from '../services/qGuestBriefRateLimit.js';
import {
    claimGuestBrief,
    confirmGuestBrief,
    consumeGuestBrief,
    dismissGuestBrief,
    getCurrentGuestBriefForUser,
} from '../services/qGuestBriefService.js';
import type { QGuestBriefServiceDeps, QGuestBriefView } from '../services/qGuestBriefService.js';
import { provisionRestaurantWorkspaceFromBrief } from '../services/qGuestBriefProvisioning.js';

export { getQGuestBriefDeps };

const CLAIM_RATE_LIMIT_PER_HOUR = 10;

type ConfirmCorrections = { businessName?: string; country?: string; currency?: string };

const parseCorrections = (value: unknown): { ok: true; value?: ConfirmCorrections } | { ok: false } => {
    if (value === undefined || value === null) return { ok: true };
    if (typeof value !== 'object' || Array.isArray(value)) return { ok: false };
    const record = value as Record<string, unknown>;
    const corrections: ConfirmCorrections = {};
    if (record.businessName !== undefined) {
        if (typeof record.businessName !== 'string') return { ok: false };
        const businessName = record.businessName.trim();
        if (!businessName || businessName.length > 120) return { ok: false };
        corrections.businessName = businessName;
    }
    if (record.country !== undefined) {
        if (typeof record.country !== 'string') return { ok: false };
        const country = record.country.trim();
        if (!country || country.length > 100) return { ok: false };
        corrections.country = country;
    }
    if (record.currency !== undefined) {
        if (typeof record.currency !== 'string' || !/^[A-Za-z]{3}$/.test(record.currency.trim())) return { ok: false };
        corrections.currency = record.currency.trim().toUpperCase();
    }
    return { ok: true, value: corrections };
};

export const qGuestBriefRoutes = new Hono<AppEnv>();

qGuestBriefRoutes.use('/*', authMiddleware);

// ---------------------------------------------------------------------------
// claim
// ---------------------------------------------------------------------------

qGuestBriefRoutes.post('/claim', async (c) => {
    const deps = getQGuestBriefDeps();
    if (!deps) return c.json({ error: 'not_found' }, 404);
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

    // Malformed tokens fail closed BEFORE any rate accounting or DB work.
    if (!isBriefTokenShape(body.briefToken)) {
        return c.json({ error: 'invalid_token' }, 400);
    }
    const rate = takeGuestBriefRateToken(`claim:${userId}`, CLAIM_RATE_LIMIT_PER_HOUR);
    if (!rate.allowed) {
        return c.json({ error: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds }, 429);
    }

    const result = await claimGuestBrief({ rawToken: body.briefToken, userId }, deps);
    if (!result.ok) {
        switch (result.code) {
            case 'brief_not_found': return c.json({ error: 'brief_not_found' }, 404);
            case 'expired': return c.json({ error: 'expired' }, 410);
            case 'conflict': return c.json({ error: 'brief_conflict' }, 409);
            case 'unresolved_exists': return c.json({ error: 'brief_unresolved_exists' }, 409);
            case 'payload_invalid': return c.json({ error: 'payload_invalid' }, 422);
            default: return c.json({ error: result.code }, 400);
        }
    }

    await logAudit(c, 'Q_GUEST_BRIEF_CLAIMED', 'Q_GUEST_BRIEF', result.brief.id, null);
    return c.json({ outcome: result.outcome, brief: result.brief });
});

// ---------------------------------------------------------------------------
// current
// ---------------------------------------------------------------------------

qGuestBriefRoutes.get('/current', async (c) => {
    const deps = getQGuestBriefDeps();
    if (!deps) return c.json({ error: 'not_found' }, 404);
    const brief = await getCurrentGuestBriefForUser(c.get('userId'), deps);
    return c.json({ brief });
});

// ---------------------------------------------------------------------------
// confirm (+ provision + consume)
// ---------------------------------------------------------------------------

const provisionResponse = (
    provisioning: Extract<Awaited<ReturnType<typeof provisionRestaurantWorkspaceFromBrief>>, { ok: true }>,
    outcome: 'confirmed' | 'already_confirmed',
) => ({
    success: true as const,
    outcome,
    workspace: 'restaurant' as const,
    destination: provisioning.destination,
    tablesEnsured: provisioning.tablesEnsured,
    tablesCreated: provisioning.tablesCreated,
});

/** Rebuild the caller's latest consumed brief as a view for idempotent replay. */
const latestConsumedBriefView = async (userId: string): Promise<QGuestBriefView | null> => {
    const row = await first(db.select().from(qGuestBriefs)
        .where(and(eq(qGuestBriefs.claimedByUserId, userId), eq(qGuestBriefs.state, 'consumed')))
        .orderBy(desc(qGuestBriefs.terminalAt)));
    if (!row) return null;
    const parsed = validateGuestBriefPayload(row.payload);
    if (!parsed.ok) return null;
    return {
        id: row.id,
        state: row.state,
        payload: parsed.value,
        claimedByUserId: row.claimedByUserId,
        claimedAt: row.claimedAt,
        confirmedAt: row.confirmedAt,
        confirmedFields: row.confirmedFields,
        activeExpiresAt: row.activeExpiresAt,
        createdAt: row.createdAt,
    };
};

const sameFieldSet = (stored: string[], requested: string[]): boolean =>
    stored.length === requested.length && stored.every(field => requested.includes(field));

qGuestBriefRoutes.post('/current/confirm', async (c) => {
    const deps = getQGuestBriefDeps();
    if (!deps) return c.json({ error: 'not_found' }, 404);
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

    const acceptedFields = body.acceptedFields;
    if (!Array.isArray(acceptedFields) || acceptedFields.length === 0
        || !acceptedFields.every(field => typeof field === 'string')) {
        return c.json({ error: 'invalid_fields' }, 422);
    }
    const corrections = parseCorrections(body.corrections);
    if (!corrections.ok) return c.json({ error: 'invalid_fields' }, 422);

    // Workspace re-entry guard. A caller who already completed onboarding must
    // not be re-provisioned through a fresh brief — with one exception: an
    // idempotent replay of THIS flow (see header). A live merely-claimed brief
    // or no brief history at all means the workspace came from elsewhere.
    const user = await first(db.select().from(users).where(eq(users.id, userId)));
    if (user?.onboardingCompleted && user.segment) {
        const liveBrief = await getCurrentGuestBriefForUser(userId, deps);
        if (liveBrief?.state === 'claimed') {
            return c.json({ error: 'workspace_exists' }, 409); // brief untouched
        }
        if (!liveBrief) {
            const consumedBrief = await latestConsumedBriefView(userId);
            if (!consumedBrief?.confirmedFields) {
                return c.json({ error: 'workspace_exists' }, 409);
            }
            if (!sameFieldSet(consumedBrief.confirmedFields, acceptedFields)) {
                return c.json({ error: 'brief_conflict' }, 409);
            }
            // Idempotent replay: reprovision (no-op on existing state) and
            // answer already_confirmed without new audits or state changes.
            const provisioning = await provisionRestaurantWorkspaceFromBrief({
                userId, brief: consumedBrief, corrections: corrections.value,
            });
            if (!provisioning.ok) {
                return c.json({ error: provisioning.code, message: provisioning.message }, 422);
            }
            return c.json(provisionResponse(provisioning, 'already_confirmed'));
        }
        // liveBrief.state === 'confirmed': a retry between confirm and consume
        // (e.g. a previously failed provisioning) — the service resolves it.
    }

    const confirmed = await confirmGuestBrief({ userId, acceptedFields }, deps);
    if (!confirmed.ok) {
        switch (confirmed.code) {
            case 'invalid_state': return c.json({ error: 'invalid_state' }, 409);
            case 'invalid_fields': return c.json({ error: 'invalid_fields' }, 422);
            case 'expired': return c.json({ error: 'expired' }, 410);
            case 'conflict': return c.json({ error: 'brief_conflict' }, 409);
            case 'payload_invalid': return c.json({ error: 'payload_invalid' }, 422);
            default: return c.json({ error: confirmed.code }, 400);
        }
    }

    const provisioning = await provisionRestaurantWorkspaceFromBrief({
        userId, brief: confirmed.brief, corrections: corrections.value,
    });
    if (!provisioning.ok) {
        return c.json({ error: provisioning.code, message: provisioning.message }, 422);
    }

    // R4: consume only after the approved fields were applied.
    await consumeGuestBrief({ userId }, deps);
    await logAudit(c, 'Q_GUEST_BRIEF_CONFIRMED', 'Q_GUEST_BRIEF', confirmed.brief.id, {
        workspace: 'restaurant', tablesEnsured: provisioning.tablesEnsured,
    });
    await logAudit(c, 'Q_WORKSPACE_PROVISIONED', 'BUSINESS', provisioning.businessId, {
        workspace: 'restaurant', destination: provisioning.destination,
        tablesCreated: provisioning.tablesCreated, tablesEnsured: provisioning.tablesEnsured,
    });
    return c.json(provisionResponse(provisioning, confirmed.outcome === 'already_confirmed' ? 'already_confirmed' : 'confirmed'));
});

// ---------------------------------------------------------------------------
// dismiss
// ---------------------------------------------------------------------------

qGuestBriefRoutes.post('/current/dismiss', async (c) => {
    const deps = getQGuestBriefDeps();
    if (!deps) return c.json({ error: 'not_found' }, 404);
    const userId = c.get('userId');

    const brief = await getCurrentGuestBriefForUser(userId, deps);
    if (!brief) return c.json({ outcome: 'no_active_brief' });

    const dismissed = await dismissGuestBrief({ userId }, deps);
    if (!dismissed.ok) {
        // Raced lazy expiry between read and dismiss: effectively no active brief.
        if (dismissed.code === 'invalid_state') return c.json({ outcome: 'no_active_brief' });
        return c.json({ error: dismissed.code }, 409);
    }
    await logAudit(c, 'Q_GUEST_BRIEF_DISMISSED', 'Q_GUEST_BRIEF', dismissed.briefId, null);
    return c.json({ outcome: 'dismissed' });
});
