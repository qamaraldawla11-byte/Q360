
import { Context, Next } from 'hono';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const LIMIT = 100; // Requests
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export const rateLimiter = async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || 'unknown-ip';
    const key = ip;

    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, lastReset: now };

    if (now - entry.lastReset > WINDOW_MS) {
        entry.count = 0;
        entry.lastReset = now;
    }

    if (entry.count >= LIMIT) {
        return c.json({ error: 'Too Many Requests', retryAfter: Math.ceil((entry.lastReset + WINDOW_MS - now) / 1000) }, 429);
    }

    entry.count++;
    rateLimitMap.set(key, entry);

    await next();
};
