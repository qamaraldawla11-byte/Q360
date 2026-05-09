import { Hono } from 'hono';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const auth = new Hono();

// POST /api/auth/login
auth.post('/login', async (c) => {
    const body = await c.req.json<{ email: string }>();

    if (!body.email) {
        return c.json({ error: 'Email is required' }, 400);
    }

    // Find or create user
    let user = db.select().from(users).where(eq(users.email, body.email)).get();

    if (!user) {
        // Create new user
        const newUserId = `usr_${Date.now()}`;
        db.insert(users).values({
            id: newUserId,
            email: body.email,
            name: body.email.split('@')[0],
            role: 'user',
            onboardingCompleted: false,
            primaryWorkspace: 'biz_main', // Default workspace
        }).run();

        user = db.select().from(users).where(eq(users.id, newUserId)).get();
    }

    if (!user) {
        return c.json({ error: 'Failed to create user' }, 500);
    }

    // Generate JWT
    const token = await generateToken({
        sub: user.id,
        email: user.email,
        role: user.role || 'user',
        businessId: user.primaryWorkspace || 'biz_main',
    });

    return c.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            onboardingCompleted: user.onboardingCompleted,
            primaryWorkspace: user.primaryWorkspace,
            workspaces: [], // TODO: Implement workspace relation
        },
    });
});

// POST /api/auth/logout
auth.post('/logout', (c) => {
    // JWT is stateless, so logout is handled client-side
    // This endpoint exists for API contract consistency
    return c.json({ success: true });
});

// GET /api/auth/session (protected)
auth.get('/session', authMiddleware, async (c) => {
    // Explicitly cast keys because Hono Context variables aren't globally typed yet
    const userId = c.get('userId' as any) as string;

    const user = db.select().from(users).where(eq(users.id, userId)).get();

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        primaryWorkspace: user.primaryWorkspace,
        workspaces: [],
    });
});

export default auth;
