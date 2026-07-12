import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:business-settings');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'business-settings-verification-secret';
process.env.NODE_ENV = 'test';

const { db, closeDatabase } = await import('../db/client.js');
const { auditLogs, businesses, users } = await import('../db/schema.js');
const { default: businessRoutes } = await import('../routes/business.js');

const businessIds = ['biz_verify_settings_a', 'biz_verify_settings_b'];
const userIds = ['usr_verify_settings_a', 'usr_verify_settings_b'];
const app = new Hono();
app.route('/api/business', businessRoutes);

const token = (userId: string, email: string, role: string, businessId: string) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({ sub: userId, email, role, businessId, iat: now, exp: now + 3600 });
    const signature = createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
};

const request = (authToken: string, path: string, init?: RequestInit) => app.request(path, {
    ...init,
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json', ...init?.headers },
});

try {
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await db.insert(businesses).values([
        { id: businessIds[0], name: 'Settings A', type: 'restaurant' },
        { id: businessIds[1], name: 'Settings B', type: 'restaurant' },
    ]);
    await db.insert(users).values([
        { id: userIds[0], email: 'settings-a@example.com', role: 'admin', businessId: businessIds[0] },
        { id: userIds[1], email: 'settings-b@example.com', role: 'admin', businessId: businessIds[1] },
    ]);

    const tokenA = token(userIds[0], 'settings-a@example.com', 'admin', businessIds[0]);
    const tokenB = token(userIds[1], 'settings-b@example.com', 'admin', businessIds[1]);
    const update = await request(tokenA, '/api/business/profile', {
        method: 'PATCH',
        body: JSON.stringify({
            name: 'Settings A Updated', country: 'United Kingdom', city: 'London', address: '1 Test Street',
            phone: '+44 20 0000 0000', email: 'hello@settings-a.example', currency: 'GBP', timezone: 'Europe/London',
            taxIdentifier: 'GB-TEST', restaurantType: 'takeaway',
        }),
    });
    if (update.status !== 200) throw new Error(`Valid update failed: ${update.status} ${await update.text()}`);

    const missingCountry = await request(tokenA, '/api/business/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Invalid', country: '', currency: 'GBP', timezone: 'Europe/London', restaurantType: 'both' }),
    });
    if (missingCountry.status !== 400) throw new Error(`Missing country returned ${missingCountry.status}`);

    const profileAResponse = await request(tokenA, '/api/business/profile');
    const profileBResponse = await request(tokenB, '/api/business/profile');
    const profileA = await profileAResponse.json() as { name: string; country: string; currency: string; restaurantType: string };
    const profileB = await profileBResponse.json() as { name: string; country: string | null };
    if (profileA.name !== 'Settings A Updated' || profileA.country !== 'United Kingdom' || profileA.currency !== 'GBP' || profileA.restaurantType !== 'takeaway') {
        throw new Error(`Profile did not persist: ${JSON.stringify(profileA)}`);
    }
    if (profileB.name !== 'Settings B' || profileB.country !== null) throw new Error('Tenant B observed tenant A profile data');

    const viewer = token(userIds[0], 'settings-a@example.com', 'viewer', businessIds[0]);
    const forbidden = await request(viewer, '/api/business/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Forbidden', country: 'US', currency: 'USD', timezone: 'UTC', restaurantType: 'both' }),
    });
    if (forbidden.status !== 403) throw new Error(`Viewer update returned ${forbidden.status}`);

    console.log(JSON.stringify({ persisted: true, requiredCountry: true, tenantIsolation: true, viewerForbidden: true }, null, 2));
} catch (error) {
    console.error('Business settings verification failed:', error);
    process.exitCode = 1;
} finally {
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await closeDatabase();
}
