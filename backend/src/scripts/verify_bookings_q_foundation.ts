import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:bookings-q-foundation');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'bookings-q-foundation-test-secret';
process.env.NODE_ENV = 'test';

const { closeDatabase, db } = await import('../db/client.js');
const {
    auditLogs,
    businesses,
    qUsageEvents,
    restaurantBookings,
    restaurantTables,
    users,
} = await import('../db/schema.js');
const { default: restaurantRoutes } = await import('../routes/restaurant.js');

const businessA = 'biz_verify_bookings_q_a';
const businessB = 'biz_verify_bookings_q_b';
const userA = 'usr_verify_bookings_q_a';
const userB = 'usr_verify_bookings_q_b';
const businessesUnderTest = [businessA, businessB];
const usersUnderTest = [userA, userB];
const app = new Hono();
app.route('/api/restaurant', restaurantRoutes);

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = (businessId: string, userId: string, role = 'admin') => {
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({ sub: userId, email: `${userId}@example.com`, role, businessId, iat: now, exp: now + 3600 });
    const signature = createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
};
const request = async (businessId: string, userId: string, path: string, method = 'GET', body?: unknown, role = 'admin') => {
    const response = await app.request(path, {
        method,
        headers: { Authorization: `Bearer ${token(businessId, userId, role)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as any : null };
};
const expect = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const reset = async () => {
    await db.delete(restaurantBookings).where(inArray(restaurantBookings.businessId, businessesUnderTest));
    await db.delete(qUsageEvents).where(inArray(qUsageEvents.businessId, businessesUnderTest));
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessesUnderTest));
    await db.delete(restaurantTables).where(inArray(restaurantTables.businessId, businessesUnderTest));
    await db.delete(users).where(inArray(users.id, usersUnderTest));
    await db.delete(businesses).where(inArray(businesses.id, businessesUnderTest));
};
const seed = async (businessId: string, userId: string, prefix: string) => {
    await db.insert(businesses).values({ id: businessId, name: `${prefix} Reservation Cafe`, type: 'restaurant', status: 'active' });
    await db.insert(users).values({ id: userId, email: `${userId}@example.com`, name: `${prefix} owner`, role: 'admin', businessId, onboardingCompleted: true, primaryWorkspace: '/app/restaurant' });
    await db.insert(restaurantTables).values([
        { id: `${prefix}_table_1`, businessId, label: 'T1', capacity: 4, status: 'available' },
        { id: `${prefix}_table_2`, businessId, label: 'T2', capacity: 2, status: 'available' },
    ]);
};

try {
    await reset();
    await seed(businessA, userA, 'alpha');
    await seed(businessB, userB, 'beta');
    const startsAt = new Date(Date.now() + 86_400_000);
    startsAt.setHours(19, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
    const create = await request(businessA, userA, '/api/restaurant/bookings', 'POST', {
        customerName: 'Birthday guest', customerPhone: '+20123456789', partySize: 4,
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), tableIds: ['alpha_table_1'],
        occasion: 'Birthday', notes: 'Cake at 8 pm', depositAmount: 25,
    });
    expect(create.status === 201, `Expected booking create 201, received ${create.status}`);
    expect(create.body.status === 'pending', 'Expected a pending booking');
    const overlap = await request(businessA, userA, '/api/restaurant/bookings', 'POST', {
        customerName: 'Overlap guest', partySize: 2,
        startsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(), endsAt: new Date(endsAt.getTime() + 30 * 60_000).toISOString(),
        tableIds: ['alpha_table_1'],
    });
    expect(overlap.status === 409, `Expected overlap conflict 409, received ${overlap.status}`);
    const adjacent = await request(businessA, userA, '/api/restaurant/bookings', 'POST', {
        customerName: 'Next sitting', partySize: 2, startsAt: endsAt.toISOString(),
        endsAt: new Date(endsAt.getTime() + 60 * 60_000).toISOString(), tableIds: ['alpha_table_1'],
    });
    expect(adjacent.status === 201, `Expected adjacent booking 201, received ${adjacent.status}`);
    const foreign = await request(businessB, userB, '/api/restaurant/bookings', 'GET');
    expect(foreign.status === 200 && Array.isArray(foreign.body) && foreign.body.length === 0, 'Expected booking tenant isolation');
    const staffCreate = await request(businessA, userA, '/api/restaurant/bookings', 'POST', {
        customerName: 'Staff cannot create', partySize: 2, startsAt: new Date(endsAt.getTime() + 90 * 60_000).toISOString(), endsAt: new Date(endsAt.getTime() + 120 * 60_000).toISOString(), tableIds: ['alpha_table_2'],
    }, 'staff');
    expect(staffCreate.status === 403, `Expected staff booking denial, received ${staffCreate.status}`);
    const updated = await request(businessA, userA, `/api/restaurant/bookings/${create.body.id}`, 'PATCH', { status: 'arrived' });
    expect(updated.status === 200 && updated.body.status === 'arrived', 'Expected booking arrival update');
    const pulse = await request(businessA, userA, '/api/restaurant/business-pulse');
    expect(pulse.status === 200, `Expected Q pulse 200, received ${pulse.status}`);
    const usage = await request(businessA, userA, '/api/restaurant/business-pulse/usage');
    expect(usage.status === 200 && usage.body.requests >= 1, 'Expected Q usage ledger entry');
    const staffUsage = await request(businessA, userA, '/api/restaurant/business-pulse/usage', 'GET', undefined, 'staff');
    expect(staffUsage.status === 403, `Expected usage permissions denial, received ${staffUsage.status}`);
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.businessId, businessA), eq(auditLogs.action, 'RESTAURANT_BOOKING_CREATED')));
    expect(audit.length === 2, `Expected two booking audit records, received ${audit.length}`);
    console.log(JSON.stringify({ bookingStatuses: [create.body.status, updated.body.status], overlapStatus: overlap.status, adjacentStatus: adjacent.status, usage: usage.body, staffUsageStatus: staffUsage.status }, null, 2));
} catch (error) {
    console.error('Bookings and Q foundation verification failed:', error);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
