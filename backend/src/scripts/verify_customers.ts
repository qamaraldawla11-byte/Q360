import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl } from '../utils/env.js';

requireDatabaseUrl();

process.env.JWT_SECRET ||= 'customers-verification-secret-with-sufficient-length';
process.env.NODE_ENV = 'test';

const { default: customersRoutes } = await import('../routes/customers.js');
const { generateToken } = await import('../middleware/auth.js');
const { db, closeDatabase } = await import('../db/client.js');
const { businesses, customers } = await import('../db/schema.js');

const app = new Hono();
app.route('/api/customers', customersRoutes);

const runId = Date.now();
const businessAId = `biz_verify_customers_a_${runId}`;
const businessBId = `biz_verify_customers_b_${runId}`;

const tokenFor = async (businessId: string) => generateToken({
    sub: `user_${businessId}`,
    email: `${businessId}@example.com`,
    role: 'owner',
    businessId,
});

const requestJson = async <T>(path: string, init: RequestInit = {}, businessId = businessAId) => {
    const token = await tokenFor(businessId);
    const response = await app.request(path, {
        ...init,
        headers: {
            ...(init.headers || {}),
            Authorization: `Bearer ${token}`,
        },
    });
    const body = await response.json() as T;
    return { response, body };
};

try {
    await db.delete(customers).where(inArray(customers.businessId, [businessAId, businessBId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));

    await db.insert(businesses).values([
        { id: businessAId, name: 'Customers Verification A', type: 'retail', status: 'active' },
        { id: businessBId, name: 'Customers Verification B', type: 'retail', status: 'active' },
    ]);

    const missingName = await requestJson<{ error?: string }>('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+15550000000' }),
    });
    if (missingName.response.status !== 400 || !missingName.body.error?.includes('name is required')) {
        throw new Error(`Missing name check failed with status ${missingName.response.status}`);
    }

    const created = await requestJson<{ id?: string; businessId?: string; name?: string }>('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tenant A Customer', phone: '+15550101010' }),
    });
    if (created.response.status !== 201 || !created.body.id || created.body.businessId !== businessAId) {
        throw new Error(`Create customer failed with status ${created.response.status}`);
    }

    const listA = await requestJson<{ id: string; businessId: string }[]>('/api/customers');
    if (listA.response.status !== 200 || !listA.body.some(customer => customer.id === created.body.id)) {
        throw new Error('Business A could not list its created customer');
    }
    if (!listA.body.every(customer => customer.businessId === businessAId)) {
        throw new Error('Business A list included a customer from another business');
    }

    const listB = await requestJson<{ id: string; businessId: string }[]>('/api/customers', {}, businessBId);
    if (listB.response.status !== 200 || listB.body.some(customer => customer.id === created.body.id)) {
        throw new Error('Business B could see Business A customer');
    }
    if (!listB.body.every(customer => customer.businessId === businessBId)) {
        throw new Error('Business B list included a customer from another business');
    }

    const detailB = await requestJson<{ error?: string }>(`/api/customers/${created.body.id}`, {}, businessBId);
    if (detailB.response.status !== 404) {
        throw new Error(`Business B detail lookup returned status ${detailB.response.status}`);
    }

    const routeTenantToken = await tokenFor('/app/restaurant');
    const routeTenantResponse = await app.request('/api/customers', {
        headers: { Authorization: `Bearer ${routeTenantToken}` },
    });
    if (routeTenantResponse.status !== 401) {
        throw new Error(`Workspace route tenant was not rejected; status ${routeTenantResponse.status}`);
    }

    const dbRows = await db.select().from(customers)
        .where(and(eq(customers.id, created.body.id), eq(customers.businessId, businessAId)));
    if (dbRows.length !== 1) {
        throw new Error('Created customer was not persisted under Business A');
    }

    console.log('Customers verification passed: create, list, cross-tenant isolation, missing-name rejection, workspace-route tenant rejection.');
} catch (error) {
    console.error('Customers verification failed:', error);
    process.exitCode = 1;
} finally {
    await db.delete(customers).where(inArray(customers.businessId, [businessAId, businessBId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));
    await closeDatabase();
}
