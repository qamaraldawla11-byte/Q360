/**
 * Q Guest Brief dependency factory — fail-closed feature gating.
 *
 * This is the ONLY module in the guest-brief graph that reads environment
 * variables. It lives outside the routers so both the authenticated router
 * (routes/qGuestBriefs.ts) and the public router (routes/public.ts) can gate
 * on it without a route-to-route import cycle.
 *
 * FAIL-CLOSED RULE: unless Q_GUEST_BRIEF_ENABLED === 'true' AND
 * Q_GUEST_BRIEF_TOKEN_SECRET encodes to at least BRIEF_SECRET_MIN_BYTES bytes,
 * this returns null — callers must respond 404 and skip mounting. A weak or
 * missing secret can never produce a partially working feature.
 *
 * The onEvent hook emits structured, payload-free, token-free lifecycle
 * telemetry only (event type + brief id + user id).
 */

import { BRIEF_SECRET_MIN_BYTES } from './qGuestBrief.js';
import type { QGuestBriefEvent, QGuestBriefServiceDeps } from './qGuestBriefService.js';

export const getQGuestBriefDeps = (): QGuestBriefServiceDeps | null => {
    if (process.env.Q_GUEST_BRIEF_ENABLED !== 'true') return null;
    const tokenSecret = process.env.Q_GUEST_BRIEF_TOKEN_SECRET;
    if (!tokenSecret || Buffer.byteLength(tokenSecret, 'utf8') < BRIEF_SECRET_MIN_BYTES) return null;
    return {
        tokenSecret,
        onEvent: (event: QGuestBriefEvent) => {
            console.log(JSON.stringify({ event: event.type, briefId: event.briefId, userId: event.userId }));
        },
    };
};
