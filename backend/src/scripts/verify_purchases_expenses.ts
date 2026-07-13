import { createHmac, randomUUID } from 'crypto';
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:purchases-expenses');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'purchases-expenses-verification-secret';
process.env.NODE_ENV = 'test';

const { db, closeDatabase } = await import('../db/client.js');
const { auditLogs, businesses, inventoryItems, purchaseExpenseRecords, restaurantPayments, users } = await import('../db/schema.js');
const { default: routes } = await import('../routes/purchasesExpenses.js');
const app = new Hono(); app.route('/api/purchases-expenses', routes);
const runId = Date.now();
const businessIds = [`biz_verify_cost_a_${runId}`, `biz_verify_cost_b_${runId}`];
const userIds = [`usr_verify_cost_a_${runId}`, `usr_verify_cost_b_${runId}`];
const token = (userId: string, businessId: string, role = 'admin') => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000), header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({ sub: userId, email: `${userId}@example.com`, role, businessId, iat: now, exp: now + 3600 });
    const signature = createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
};
const request = (auth: string, path: string, init?: RequestInit) => app.request(path, { ...init, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', ...init?.headers } });

try {
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds));
    await db.delete(purchaseExpenseRecords).where(inArray(purchaseExpenseRecords.businessId, businessIds));
    await db.delete(restaurantPayments).where(inArray(restaurantPayments.businessId, businessIds));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await db.insert(businesses).values(businessIds.map((id, index) => ({ id, name: `Finance Test ${index}`, type: 'restaurant', currency: 'USD' })));
    await db.insert(users).values(userIds.map((id, index) => ({ id, email: `${id}@example.com`, role: 'admin', businessId: businessIds[index] })));
    await db.insert(inventoryItems).values({ id: randomUUID(), businessId: businessIds[0], name: 'Safety Stock', current: 12, min: 2, unit: 'kg', price: 1 });
    await db.insert(restaurantPayments).values({ id: randomUUID(), businessId: businessIds[0], orderId: `order_finance_${runId}`, method: 'cash', amount: 25, status: 'completed', paidAt: new Date() });
    const adminA = token(userIds[0], businessIds[0]), adminB = token(userIds[1], businessIds[1]), managerA = token('manager_finance', businessIds[0], 'manager');
    const inventoryBefore = await db.select().from(inventoryItems).where(eq(inventoryItems.businessId, businessIds[0]));
    const paymentsBefore = await db.select().from(restaurantPayments).where(eq(restaurantPayments.businessId, businessIds[0]));
    const payload = { recordType: 'expense', supplierName: 'Electric Company', category: 'Utilities', amountMinor: 1000, currency: 'USD', recordDate: new Date().toISOString().slice(0, 10), reference: '' };
    const create = await request(adminA, '/api/purchases-expenses', { method: 'POST', body: JSON.stringify({ ...payload, businessId: businessIds[1] }) });
    if (create.status !== 201) throw new Error(`Create failed ${create.status}: ${await create.text()}`);
    const created = await create.json() as { id: string; businessId: string; reference: string | null };
    if (created.businessId !== businessIds[0]) throw new Error('Payload businessId overrode JWT tenant');
    if (!created.reference || !/^EXP-\d{8}-[A-F0-9]{8}$/.test(created.reference)) throw new Error('Missing automatic expense reference');
    const duplicate = await request(adminA, '/api/purchases-expenses', { method: 'POST', body: JSON.stringify(payload) });
    if (duplicate.status !== 409) throw new Error(`Duplicate was not held for confirmation: ${duplicate.status}`);
    const confirmed = await request(adminA, '/api/purchases-expenses', { method: 'POST', body: JSON.stringify({ ...payload, confirmDuplicate: true }) });
    if (confirmed.status !== 201) throw new Error(`Confirmed duplicate failed: ${confirmed.status}`);
    const listA = await request(adminA, `/api/purchases-expenses?from=${payload.recordDate}&to=${payload.recordDate}`);
    const resultA = await listA.json() as { records: { id: string; businessId: string }[]; summary: { revenueMinor: number; expensesMinor: number; netProfitMinor: number } };
    if (listA.status !== 200 || resultA.records.length !== 2 || resultA.records.some(record => record.businessId !== businessIds[0]) || resultA.summary.revenueMinor !== 2500 || resultA.summary.expensesMinor !== 2000 || resultA.summary.netProfitMinor !== 500) throw new Error('Tenant A list or cash summary failed');
    const listB = await request(adminB, '/api/purchases-expenses');
    const resultB = await listB.json() as { records: { id: string }[] };
    if (listB.status !== 200 || resultB.records.some(record => record.id === created.id)) throw new Error('Cross-tenant list isolation failed');
    const detailB = await request(adminB, `/api/purchases-expenses/${created.id}`);
    if (detailB.status !== 404) throw new Error(`Cross-tenant detail returned ${detailB.status}`);
    const manager = await request(managerA, '/api/purchases-expenses');
    if (manager.status !== 403) throw new Error(`Manager access returned ${manager.status}`);
    const voided = await request(adminA, `/api/purchases-expenses/${created.id}/void`, { method: 'POST', body: '{}' });
    if (voided.status !== 200) throw new Error(`Void failed ${voided.status}`);
    const inventoryAfter = await db.select().from(inventoryItems).where(eq(inventoryItems.businessId, businessIds[0]));
    const paymentsAfter = await db.select().from(restaurantPayments).where(eq(restaurantPayments.businessId, businessIds[0]));
    if (inventoryAfter[0]?.current !== inventoryBefore[0]?.current || paymentsAfter.length !== paymentsBefore.length) throw new Error('Finance record changed inventory or payments');
    const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.businessId, businessIds[0]), eq(auditLogs.entity, 'PURCHASE_EXPENSE')));
    if (!audits.some(row => row.action === 'PURCHASE_EXPENSE_CREATED') || !audits.some(row => row.action === 'PURCHASE_EXPENSE_VOIDED')) throw new Error('Expected audit records missing');
    console.log(JSON.stringify({ jwtTenantDerived: true, ownerAdminProtected: true, automaticReference: true, duplicateConfirmation: true, tenantIsolation: true, paidRevenueSummary: true, inventoryUnchanged: true, paymentsUnchanged: true, auditLogged: true }, null, 2));
} catch (error) {
    console.error('Purchases/expenses verification failed:', error); process.exitCode = 1;
} finally {
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds));
    await db.delete(purchaseExpenseRecords).where(inArray(purchaseExpenseRecords.businessId, businessIds));
    await db.delete(restaurantPayments).where(inArray(restaurantPayments.businessId, businessIds));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, businessIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await closeDatabase();
}
