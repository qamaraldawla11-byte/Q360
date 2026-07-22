/**
 * Q Guest Brief rate limiting — tiny bounded per-process limiter.
 *
 * Mirrors the shape of the public-concierge limiter (qPublicConcierge.ts):
 * a fixed 1-hour sliding window per key, held in process memory. Two
 * differences are deliberate:
 *   - the limit is supplied by the caller (claim and create have different
 *     approved budgets), and
 *   - the map is HARD-CAPPED at 10_000 keys with oldest-entry eviction on
 *     insert, so unbounded visitor keys cannot exhaust memory.
 *
 * Per-process only: multi-instance deployments need a shared store, which is
 * out of scope for this slice. Fail-open across instances is accepted; each
 * instance still enforces its own bound.
 */

const MAX_TRACKED_KEYS = 10_000;
const WINDOW_MS = 60 * 60 * 1000;

type RateWindow = { count: number; resetAt: number };

const guestBriefWindows = new Map<string, RateWindow>();

/**
 * Take one token for `key` under `limit` tokens per hour. Returns whether the
 * call is allowed and, when denied, the seconds until the window resets.
 */
export const takeGuestBriefRateToken = (
    key: string,
    limit: number,
): { allowed: boolean; retryAfterSeconds: number } => {
    const now = Date.now();
    const current = guestBriefWindows.get(key);

    if (!current || current.resetAt <= now) {
        if (!current && guestBriefWindows.size >= MAX_TRACKED_KEYS) {
            // Map keys iterate in insertion order: the first key is the oldest.
            const oldest = guestBriefWindows.keys().next().value;
            if (oldest !== undefined) guestBriefWindows.delete(oldest);
        }
        guestBriefWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
};
