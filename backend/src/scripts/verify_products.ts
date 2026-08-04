import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl } from '../utils/env.js';

requireDatabaseUrl();

process.env.JWT_SECRET ||= 'products-verification-secret-with-sufficient-length';
process.env.NODE_ENV = 'test';

const { default: productsRoutes } = await import('../routes/products.js');
const { default: ordersRoutes } = await import('../routes/orders.js');
const { generateToken } = await import('../middleware/auth.js');
const { db, closeDatabase, first } = await import('../db/client.js');
const { businesses, businessModules, products, users, inventoryItems } = await import('../db/schema.js');

const app = new Hono();
app.route('/api', ordersRoutes); // /api/products/search compatibility
app.route('/api/products', productsRoutes);

const runId = Date.now();
const businessAId = `biz_verify_products_a_${runId}`;
const businessBId = `biz_verify_products_b_${runId}`;
const staffAllowId = `staff_allow_${runId}`;
const staffDenyId = `staff_deny_${runId}`;
const staffNullId = `staff_null_${runId}`;
const moduleRowId = (workspaceKey: string, businessId: string) => `bmod_${workspaceKey}_${businessId}`;

const tokenFor = async (businessId: string) => generateToken({
    sub: `user_${businessId}`,
    email: `${businessId}@example.com`,
    role: 'owner',
    businessId,
});

const staffTokenFor = async (userId: string, businessId: string) => generateToken({
    sub: userId,
    email: `${userId}@example.com`,
    role: 'staff',
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

const requestWithToken = async <T>(token: string, path: string, init: RequestInit = {}) => {
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

const assertStatus = (actual: number, expected: number, message: string) => {
    if (actual !== expected) throw new Error(`${message}; expected ${expected}, got ${actual}`);
};

type ProductResponse = { id?: string; businessId?: string; name?: string; status?: string; defaultPriceAmountMinor?: number | null; currency?: string; error?: string };

const createProduct = async (body: Record<string, unknown>, businessId = businessAId) =>
    requestJson<ProductResponse>('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }, businessId);

const setModuleRow = async (businessId: string, workspaceKey: string, moduleKey: string, enabled: boolean) => {
    const id = moduleRowId(workspaceKey, businessId);
    const existing = await first(db.select().from(businessModules).where(eq(businessModules.id, id)));
    if (existing) {
        await db.update(businessModules).set({ enabled, updatedAt: new Date() }).where(eq(businessModules.id, id));
    } else {
        await db.insert(businessModules).values({ id, businessId, workspaceKey, moduleKey, enabled, updatedAt: new Date() });
    }
};

try {
    await db.delete(products).where(inArray(products.businessId, [businessAId, businessBId]));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, [businessAId, businessBId]));
    await db.delete(businessModules).where(inArray(businessModules.businessId, [businessAId, businessBId]));
    await db.delete(users).where(inArray(users.id, [`user_${businessAId}`, `user_${businessBId}`, staffAllowId, staffDenyId, staffNullId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));

    await db.insert(businesses).values([
        { id: businessAId, name: 'Products Verification A', type: 'retail', status: 'active' },
        { id: businessBId, name: 'Products Verification B', type: 'retail', status: 'active' },
    ]);
    await db.insert(users).values([
        { id: `user_${businessAId}`, email: `${businessAId}@example.com`, role: 'owner', status: 'active', businessId: businessAId },
        { id: `user_${businessBId}`, email: `${businessBId}@example.com`, role: 'owner', status: 'active', businessId: businessBId },
    ]);
    await db.insert(users).values([
        { id: staffAllowId, email: `${staffAllowId}@example.com`, role: 'staff', status: 'active', businessId: businessAId, moduleAccess: ['products'] },
        { id: staffDenyId, email: `${staffDenyId}@example.com`, role: 'staff', status: 'active', businessId: businessAId, moduleAccess: ['pos'] },
        { id: staffNullId, email: `${staffNullId}@example.com`, role: 'staff', status: 'active', businessId: businessAId },
    ]);

    // ── Validation ───────────────────────────────────────────────────────
    const missingName = await createProduct({ defaultPriceAmountMinor: 1000, currency: 'USD' });
    assertStatus(missingName.response.status, 400, 'Missing name must be rejected');
    if (!missingName.body.error?.includes('name is required')) throw new Error('Missing name error message mismatch');

    const negativePrice = await createProduct({ name: 'Negative Price', defaultPriceAmountMinor: -100, currency: 'USD' });
    assertStatus(negativePrice.response.status, 400, 'Negative price must be rejected');
    if (!negativePrice.body.error?.includes('non-negative')) throw new Error('Negative price error message mismatch');

    const invalidCurrency = await createProduct({ name: 'Bad Currency', defaultPriceAmountMinor: 100, currency: 'XYZ' });
    assertStatus(invalidCurrency.response.status, 400, 'Unsupported currency must be rejected');
    if (!invalidCurrency.body.error?.includes('not supported')) throw new Error('Invalid currency error message mismatch');

    const fractionalPrice = await createProduct({ name: 'Fractional Price', defaultPriceAmountMinor: 10.5, currency: 'USD' });
    assertStatus(fractionalPrice.response.status, 400, 'Fractional price must be rejected');

    // ── Product CRUD ─────────────────────────────────────────────────────
    const created = await createProduct({
        name: 'Tenant A Widget',
        description: 'A shared product',
        sku: 'WIDGET-A',
        barcode: '123456789012',
        unit: 'piece',
        defaultPriceAmountMinor: 2500,
        currency: 'USD',
        category: 'widgets',
    });
    assertStatus(created.response.status, 201, 'Create product must succeed');
    if (created.body.businessId !== businessAId) throw new Error('Created product assigned to wrong business');
    if (created.body.status !== 'active') throw new Error('New product default status must be active');
    if (created.body.defaultPriceAmountMinor !== 2500) throw new Error('New product price mismatch');
    if (created.body.currency !== 'USD') throw new Error('New product currency mismatch');

    const listA = await requestJson<{ id: string; businessId: string; status: string }[]>('/api/products');
    assertStatus(listA.response.status, 200, 'List products must succeed');
    if (!listA.body.some(p => p.id === created.body.id)) throw new Error('Active list must include created product');
    if (!listA.body.every(p => p.businessId === businessAId)) throw new Error('Tenant isolation violation in list');

    const detailA = await requestJson<{ id?: string; businessId?: string }>(`/api/products/${created.body.id}`);
    assertStatus(detailA.response.status, 200, 'Read product must succeed');
    if (detailA.body.businessId !== businessAId) throw new Error('Read product belongs to wrong business');

    const detailB = await requestJson<{ error?: string }>(`/api/products/${created.body.id}`, {}, businessBId);
    assertStatus(detailB.response.status, 404, 'Business B must not read Business A product');

    const updated = await requestJson<{ id?: string; name?: string; defaultPriceAmountMinor?: number; currency?: string }>(`/api/products/${created.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tenant A Widget Updated', defaultPriceAmountMinor: 3000, currency: 'EUR' }),
    });
    assertStatus(updated.response.status, 200, 'Update product must succeed');
    if (updated.body.name !== 'Tenant A Widget Updated') throw new Error('Update did not persist name');
    if (updated.body.defaultPriceAmountMinor !== 3000) throw new Error('Update did not persist price');
    if (updated.body.currency !== 'EUR') throw new Error('Update did not persist currency');

    const crossTenantUpdate = await requestJson<{ error?: string }>(`/api/products/${created.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tenant B Takeover' }),
    }, businessBId);
    assertStatus(crossTenantUpdate.response.status, 404, 'Business B must not update Business A product');

    // ── Lifecycle / archive ──────────────────────────────────────────────
    const archived = await requestJson<{ id?: string; status?: string }>(`/api/products/${created.body.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    assertStatus(archived.response.status, 200, 'Archive product must succeed');
    if (archived.body.status !== 'archived') throw new Error('Archive must set status=archived');

    const activeListAfterArchive = await requestJson<{ id: string }[]>('/api/products');
    assertStatus(activeListAfterArchive.response.status, 200, 'Active list after archive must succeed');
    if (activeListAfterArchive.body.some(p => p.id === created.body.id)) throw new Error('Active list must exclude archived product');

    const archivedList = await requestJson<{ id: string; status: string }[]>('/api/products?includeArchived=true');
    assertStatus(archivedList.response.status, 200, 'Archived-inclusive list must succeed');
    if (!archivedList.body.some(p => p.id === created.body.id && p.status === 'archived')) throw new Error('includeArchived=true must return archived product');

    const crossTenantArchive = await requestJson<{ error?: string }>(`/api/products/${created.body.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    }, businessBId);
    assertStatus(crossTenantArchive.response.status, 404, 'Business B must not archive Business A product');

    // ── SKU / Barcode handling ───────────────────────────────────────────
    const noBarcode = await createProduct({ name: 'No Barcode', sku: 'NOBAR-A', defaultPriceAmountMinor: 500, currency: 'USD' });
    assertStatus(noBarcode.response.status, 201, 'Product without barcode must be allowed');

    const noSku = await createProduct({ name: 'No SKU', barcode: '999888777666', defaultPriceAmountMinor: 500, currency: 'USD' });
    assertStatus(noSku.response.status, 201, 'Product without SKU must be allowed');

    const duplicateSku = await createProduct({ name: 'Duplicate SKU', sku: 'WIDGET-A', defaultPriceAmountMinor: 100, currency: 'USD' });
    assertStatus(duplicateSku.response.status, 409, 'Duplicate tenant SKU must be rejected');

    const duplicateBarcode = await createProduct({ name: 'Duplicate Barcode', barcode: '123456789012', defaultPriceAmountMinor: 100, currency: 'USD' });
    assertStatus(duplicateBarcode.response.status, 409, 'Duplicate tenant barcode must be rejected');

    const duplicateSkuUpdate = await requestJson<{ error?: string }>(`/api/products/${noBarcode.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'WIDGET-A' }),
    });
    assertStatus(duplicateSkuUpdate.response.status, 409, 'Duplicate tenant SKU on update must be rejected');

    const duplicateBarcodeUpdate = await requestJson<{ error?: string }>(`/api/products/${noSku.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: '123456789012' }),
    });
    assertStatus(duplicateBarcodeUpdate.response.status, 409, 'Duplicate tenant barcode on update must be rejected');

    const sameSkuOtherTenant = await createProduct({ name: 'Same SKU Other Tenant', sku: 'WIDGET-A', defaultPriceAmountMinor: 100, currency: 'USD' }, businessBId);
    assertStatus(sameSkuOtherTenant.response.status, 201, 'Same SKU in different tenant must be allowed');

    const sameBarcodeOtherTenant = await createProduct({ name: 'Same Barcode Other Tenant', barcode: '123456789012', defaultPriceAmountMinor: 100, currency: 'USD' }, businessBId);
    assertStatus(sameBarcodeOtherTenant.response.status, 201, 'Same barcode in different tenant must be allowed');

    // ── Search / filters ─────────────────────────────────────────────────
    const searchByName = await requestJson<{ id: string }[]>('/api/products?search=Widget%20Updated&includeArchived=true');
    assertStatus(searchByName.response.status, 200, 'Search by name must succeed');
    if (!searchByName.body.some(p => p.id === created.body.id)) throw new Error('Search must find updated product');

    const filterBySku = await requestJson<{ id: string }[]>('/api/products?sku=WIDGET-A&includeArchived=true');
    assertStatus(filterBySku.response.status, 200, 'Filter by SKU must succeed');
    if (!filterBySku.body.some(p => p.id === created.body.id)) throw new Error('SKU filter must find product');

    const filterByBarcode = await requestJson<{ id: string }[]>('/api/products?barcode=123456789012&includeArchived=true');
    assertStatus(filterByBarcode.response.status, 200, 'Filter by barcode must succeed');
    if (!filterByBarcode.body.some(p => p.id === created.body.id)) throw new Error('Barcode filter must find product');

    // ── Authorization ────────────────────────────────────────────────────
    // Default module state: shared/products defaultEnabled=true → permitted.
    const staffAllowToken = await staffTokenFor(staffAllowId, businessAId);
    const staffDenyToken = await staffTokenFor(staffDenyId, businessAId);
    const staffNullToken = await staffTokenFor(staffNullId, businessAId);

    const staffAllow = await requestWithToken(staffAllowToken, '/api/products');
    assertStatus(staffAllow.response.status, 200, 'Staff with products moduleAccess must be allowed');

    const staffDeny = await requestWithToken<{ error?: string }>(staffDenyToken, '/api/products');
    assertStatus(staffDeny.response.status, 403, 'Staff without products moduleAccess must be denied');

    const staffNull = await requestWithToken(staffNullToken, '/api/products');
    assertStatus(staffNull.response.status, 200, 'Staff with legacy-null moduleAccess must be allowed');

    const staffWrite = await requestWithToken<{ error?: string }>(staffAllowToken, '/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Staff Write Attempt', defaultPriceAmountMinor: 100, currency: 'USD' }),
    });
    assertStatus(staffWrite.response.status, 403, 'Staff write must stay role-blocked after entitlement');

    // Disabled module blocks access.
    await setModuleRow(businessAId, 'shared', 'products', false);
    const moduleDisabled = await requestJson<{ error?: string }>('/api/products');
    assertStatus(moduleDisabled.response.status, 409, 'Disabled products module must block access');
    await setModuleRow(businessAId, 'shared', 'products', true);

    // ── Compatibility: existing barcode lookup (/api/products/search) ─────
    // Re-create an active product with a barcode for the legacy lookup.
    const compatProduct = await createProduct({
        name: 'Compatibility Product',
        barcode: 'COMP-LOOKUP-001',
        defaultPriceAmountMinor: 999,
        currency: 'USD',
    });
    assertStatus(compatProduct.response.status, 201, 'Compatibility product create must succeed');

    const barcodeSearch = await requestJson<{ id?: string; barcode?: string | null; price?: number }>('/api/products/search?barcode=COMP-LOOKUP-001');
    assertStatus(barcodeSearch.response.status, 200, 'Existing barcode lookup must succeed');
    if (barcodeSearch.body?.id !== compatProduct.body.id) throw new Error('Barcode lookup did not return the expected product');

    const barcodeSearchMissing = await requestJson<null>('/api/products/search?barcode=NONEXISTENT');
    assertStatus(barcodeSearchMissing.response.status, 200, 'Barcode lookup for missing barcode must succeed');
    if (barcodeSearchMissing.body !== null) throw new Error('Missing barcode lookup must return null');

    console.log('Products verification passed: validation, CRUD, tenant isolation, archive lifecycle, SKU/barcode uniqueness, cross-tenant SKU/barcode sharing, search/filters, module authorization, staff role/moduleAccess layering, and existing barcode-lookup compatibility.');
} catch (error) {
    console.error('Products verification failed:', error);
    process.exitCode = 1;
} finally {
    await db.delete(products).where(inArray(products.businessId, [businessAId, businessBId]));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, [businessAId, businessBId]));
    await db.delete(businessModules).where(inArray(businessModules.businessId, [businessAId, businessBId]));
    await db.delete(users).where(inArray(users.id, [`user_${businessAId}`, `user_${businessBId}`, staffAllowId, staffDenyId, staffNullId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));
    await closeDatabase();
}
