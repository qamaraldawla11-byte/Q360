import { eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:business-ownership');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'business-ownership-verification-secret';
process.env.NODE_ENV = 'test';

const { db, closeDatabase } = await import('../db/client.js');
const { businesses, staffMembers, users } = await import('../db/schema.js');
const { resolveEffectiveBusinessRole } = await import('../services/businessOwnership.js');
const suffix = Date.now();
const businessIds = [`biz_verify_owner_${suffix}`, `biz_verify_staff_${suffix}`];
const userIds = [`usr_verify_owner_${suffix}`, `usr_verify_staff_${suffix}`];

const cleanup = async () => {
    await db.delete(staffMembers).where(inArray(staffMembers.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
};

try {
    await cleanup();
    await db.insert(businesses).values([
        { id: businessIds[0], name: 'Legacy Creator', type: 'restaurant' },
        { id: businessIds[1], name: 'Invited Staff Business', type: 'restaurant' },
    ]);
    await db.insert(users).values(userIds.map((id, index) => ({
        id,
        email: `${id}@example.com`,
        role: 'user',
        businessId: businessIds[index],
        userType: 'sme' as const,
        segment: 'restaurant' as const,
        onboardingCompleted: true,
        primaryWorkspace: '/app/restaurant',
    })));
    await db.insert(staffMembers).values({
        id: `staff_verify_${suffix}`,
        businessId: businessIds[1],
        userId: userIds[1],
        name: 'Invited Staff',
        email: `${userIds[1]}@example.com`,
        role: 'staff',
        moduleAccess: ['dashboard'],
    });

    const ownerRole = await resolveEffectiveBusinessRole({ userId: userIds[0], businessId: businessIds[0], tokenRole: 'user' });
    const staffRole = await resolveEffectiveBusinessRole({ userId: userIds[1], businessId: businessIds[1], tokenRole: 'user' });
    const owner = await db.select().from(users).where(eq(users.id, userIds[0]));
    const ownerBusiness = await db.select().from(businesses).where(eq(businesses.id, businessIds[0]));
    const staffBusiness = await db.select().from(businesses).where(eq(businesses.id, businessIds[1]));
    if (ownerRole !== 'owner' || owner[0]?.role !== 'owner' || ownerBusiness[0]?.ownerUserId !== userIds[0]) throw new Error('Legacy creator was not promoted to owner');
    if (staffRole !== 'user' || staffBusiness[0]?.ownerUserId) throw new Error('Invited staff account was allowed to claim ownership');
    console.log(JSON.stringify({ creatorPromoted: true, ownershipPersisted: true, invitedStaffProtected: true }, null, 2));
} catch (error) {
    console.error('Business ownership verification failed:', error);
    process.exitCode = 1;
} finally {
    await cleanup();
    await closeDatabase();
}
