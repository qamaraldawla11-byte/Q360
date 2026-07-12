import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:business-modules');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'business-modules-verification-secret';
process.env.NODE_ENV = 'test';

const { db, closeDatabase } = await import('../db/client.js');
const { auditLogs, businessModules, businesses, restaurantTables, users } = await import('../db/schema.js');
const { default: businessRoutes } = await import('../routes/business.js');
const { default: restaurantRoutes } = await import('../routes/restaurant.js');
const app = new Hono();
app.route('/api/business', businessRoutes);
app.route('/api/restaurant', restaurantRoutes);

const businessIds = ['biz_verify_modules_a', 'biz_verify_modules_b'];
const userIds = ['usr_verify_modules_a', 'usr_verify_modules_b'];
const tableId = 'tbl_verify_modules_existing';
const token = (userId: string, businessId: string) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({ sub: userId, email: `${userId}@example.com`, role: 'admin', businessId, iat: now, exp: now + 3600 });
    const signature = createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
};
const request = (authToken: string, path: string, init?: RequestInit) => app.request(path, {
    ...init, headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json', ...init?.headers },
});
const modules = async (authToken: string) => {
    const response = await request(authToken, '/api/business/modules?workspace=restaurant');
    if (!response.ok) throw new Error(`Modules list failed: ${response.status}`);
    return (await response.json() as { modules: { moduleKey: string; enabled: boolean }[] }).modules;
};

try {
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds));
    await db.delete(businessModules).where(inArray(businessModules.businessId, businessIds));
    await db.delete(restaurantTables).where(inArray(restaurantTables.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await db.insert(businesses).values(businessIds.map((id, index) => ({ id, name: `Modules ${index}`, type: 'restaurant' })));
    await db.insert(users).values(userIds.map((id, index) => ({ id, email: `${id}@example.com`, role: 'admin', businessId: businessIds[index] })));
    await db.insert(restaurantTables).values({ id: tableId, businessId: businessIds[0], label: 'Existing T1', capacity: 2, status: 'available' });

    const tokenA = token(userIds[0], businessIds[0]);
    const tokenB = token(userIds[1], businessIds[1]);
    const defaultModulesA = await modules(tokenA);
    if (defaultModulesA.find(item => item.moduleKey === 'tables')?.enabled !== true) throw new Error('Tables should be enabled by default');

    const disabled = await request(tokenA, '/api/business/modules/tables', { method: 'PATCH', body: JSON.stringify({ workspaceKey: 'restaurant', enabled: false }) });
    if (disabled.status !== 200) throw new Error(`Disable failed: ${disabled.status} ${await disabled.text()}`);
    const tableCreate = await request(tokenA, '/api/restaurant/tables', { method: 'POST', body: JSON.stringify({ label: 'Blocked', capacity: 2 }) });
    if (tableCreate.status !== 409) throw new Error(`Disabled table creation returned ${tableCreate.status}`);
    const dineIn = await request(tokenA, '/api/restaurant/orders', { method: 'POST', body: JSON.stringify({ orderType: 'dine_in', tableId, items: [{ menuItemId: 'unused', quantity: 1 }] }) });
    if (dineIn.status !== 409) throw new Error(`Disabled dine-in returned ${dineIn.status}`);
    const protectedToggle = await request(tokenA, '/api/business/modules/pos', { method: 'PATCH', body: JSON.stringify({ workspaceKey: 'restaurant', enabled: false }) });
    if (protectedToggle.status !== 409) throw new Error(`Protected POS toggle returned ${protectedToggle.status}`);
    const previewToggle = await request(tokenA, '/api/business/modules/inventory', { method: 'PATCH', body: JSON.stringify({ workspaceKey: 'restaurant', enabled: true }) });
    if (previewToggle.status !== 409) throw new Error(`Preview toggle returned ${previewToggle.status}`);
    const tablesB = await modules(tokenB);
    if (tablesB.find(item => item.moduleKey === 'tables')?.enabled !== true) throw new Error('Tenant A disabled Tenant B tables');
    const existingRows = await db.select().from(restaurantTables).where(inArray(restaurantTables.id, [tableId]));
    if (existingRows.length !== 1) throw new Error('Disabling Tables deleted saved table data');
    const enabled = await request(tokenA, '/api/business/modules/tables', { method: 'PATCH', body: JSON.stringify({ workspaceKey: 'restaurant', enabled: true }) });
    if (enabled.status !== 200) throw new Error(`Re-enable failed: ${enabled.status}`);

    console.log(JSON.stringify({ defaultEnabled: true, disabledEnforced: true, dataPreserved: true, protectedModulesLocked: true, tenantIsolation: true, reEnabled: true }, null, 2));
} catch (error) {
    console.error('Business modules verification failed:', error);
    process.exitCode = 1;
} finally {
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds));
    await db.delete(businessModules).where(inArray(businessModules.businessId, businessIds));
    await db.delete(restaurantTables).where(inArray(restaurantTables.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await closeDatabase();
}
