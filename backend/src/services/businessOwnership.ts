import { and, eq, isNull } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businesses, staffMembers, users } from '../db/schema.js';

type OwnershipContext = {
    userId: string;
    businessId: string;
    tokenRole?: string | null;
};

const isLegacyRestaurantCreator = (user: typeof users.$inferSelect) => (
    user.role === 'user' &&
    user.userType === 'sme' &&
    user.segment === 'restaurant' &&
    user.onboardingCompleted === true &&
    user.primaryWorkspace === '/app/restaurant'
);

// Safely upgrades creator accounts that pre-date explicit business ownership.
// An invited employee can never claim ownership because staff membership wins.
export const resolveEffectiveBusinessRole = async ({ userId, businessId, tokenRole }: OwnershipContext) => {
    if (tokenRole !== 'user') return tokenRole || 'user';

    const user = await first(db.select().from(users).where(and(eq(users.id, userId), eq(users.businessId, businessId))));
    if (!user) return tokenRole || 'user';
    if (user.role !== 'user') return user.role || 'user';

    const business = await first(db.select().from(businesses).where(eq(businesses.id, businessId)));
    if (!business) return 'user';
    if (business.ownerUserId === userId) {
        await db.update(users).set({ role: 'owner' }).where(eq(users.id, userId));
        return 'owner';
    }
    if (business.ownerUserId || !isLegacyRestaurantCreator(user)) return 'user';

    const staffMembership = await first(db.select({ id: staffMembers.id }).from(staffMembers).where(and(
        eq(staffMembers.businessId, businessId),
        eq(staffMembers.userId, userId),
    )));
    if (staffMembership) return 'user';

    const claimed = await db.update(businesses)
        .set({ ownerUserId: userId, updatedAt: new Date() })
        .where(and(eq(businesses.id, businessId), isNull(businesses.ownerUserId)))
        .returning({ id: businesses.id });
    if (!claimed.length) return 'user';

    await db.update(users).set({ role: 'owner' }).where(and(eq(users.id, userId), eq(users.businessId, businessId)));
    return 'owner';
};
