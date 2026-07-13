import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businesses, staffMembers, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AppEnv } from '../types/app.js';
import { ensureUserBusiness } from '../utils/tenant.js';

const userRoutes = new Hono<AppEnv>();

const userTypes = ['sme', 'personal'] as const;
const segments = [
    'restaurant',
    'pharmacy',
    'supermarket',
    'retail',
    'autoparts',
    'clinic',
    'services',
    'other',
    'personal_freelancer',
    'personal_consultant',
    'personal_creative',
] as const;

type UserType = typeof userTypes[number];
type Segment = typeof segments[number];

const workspacePaths: Record<Segment, string> = {
    restaurant: '/app/restaurant',
    pharmacy: '/app/pharmacy',
    supermarket: '/app/supermarket',
    retail: '/app/retail',
    autoparts: '/app/retail', // TODO: Replace with the dedicated auto parts workspace.
    clinic: '/app/pharmacy', // TODO: Replace with the dedicated clinic workspace.
    services: '/app/personal', // TODO: Replace with the dedicated services workspace.
    other: '/app/segments',
    personal_freelancer: '/app/personal',
    personal_consultant: '/app/personal',
    personal_creative: '/app/personal',
};

type ProfileInput = {
    userType?: unknown;
    segment?: unknown;
    businessName?: unknown;
    country?: unknown;
    currency?: unknown;
};

const serializeUser = (user: typeof users.$inferSelect) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    userType: user.userType,
    segment: user.segment,
    businessName: user.businessName,
    country: user.country,
    currency: user.currency,
    onboardingCompleted: user.onboardingCompleted,
    primaryWorkspace: user.primaryWorkspace,
    moduleAccess: user.moduleAccess,
    workspaces: [],
});

userRoutes.use('/profile', authMiddleware);

userRoutes.get('/profile', async (c) => {
    const user = await first(db.select().from(users).where(eq(users.id, c.get('userId'))));

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json(serializeUser(user));
});

userRoutes.put('/profile', async (c) => {
    const body = await c.req.json<ProfileInput>();
    const userType = body.userType as UserType;
    const segment = body.segment as Segment;
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const country = typeof body.country === 'string' ? body.country.trim() : '';
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';

    if (!userTypes.includes(userType)) {
        return c.json({ error: 'Invalid user type' }, 400);
    }
    if (!segments.includes(segment)) {
        return c.json({ error: 'Invalid segment' }, 400);
    }
    if ((userType === 'personal') !== segment.startsWith('personal_')) {
        return c.json({ error: 'Segment does not match user type' }, 400);
    }
    if (!businessName || !country || !/^[A-Z]{3}$/.test(currency)) {
        return c.json({ error: 'Business name, country, and a valid currency are required' }, 400);
    }

    const userId = c.get('userId');
    const businessId = await ensureUserBusiness(userId, { businessName, segment });
    if (!businessId) {
        return c.json({ error: 'User not found' }, 404);
    }

    const currentUser = await first(db.select().from(users).where(eq(users.id, userId)));
    const staffMembership = await first(db.select({ id: staffMembers.id }).from(staffMembers).where(and(
        eq(staffMembers.businessId, businessId), eq(staffMembers.userId, userId),
    )));
    const business = await first(db.select().from(businesses).where(eq(businesses.id, businessId)));
    const creatorRole = currentUser?.role === 'user' || currentUser?.role === 'owner';
    const canClaimOwnership = userType === 'sme' && creatorRole && !staffMembership && (!business?.ownerUserId || business.ownerUserId === userId);
    if (canClaimOwnership && !business?.ownerUserId) {
        await db.update(businesses).set({ ownerUserId: userId, updatedAt: new Date() })
            .where(and(eq(businesses.id, businessId), isNull(businesses.ownerUserId)));
    }

    const result = await db.update(users)
        .set({
            userType,
            segment,
            businessName,
            country,
            currency,
            onboardingCompleted: true,
            businessId,
            primaryWorkspace: workspacePaths[segment],
            role: canClaimOwnership ? 'owner' : currentUser?.role,
        })
        .where(eq(users.id, userId))
        .returning({ id: users.id });

    if (result.length === 0) {
        return c.json({ error: 'User not found' }, 404);
    }

    const updatedUser = await first(db.select().from(users).where(eq(users.id, userId)));
    if (!updatedUser) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json(serializeUser(updatedUser));
});

export default userRoutes;
