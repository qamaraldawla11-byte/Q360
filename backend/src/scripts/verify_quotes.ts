import { Hono } from 'hono';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requireDatabaseUrl } from '../utils/env.js';

requireDatabaseUrl();

process.env.JWT_SECRET ||= 'quotes-verification-secret-with-sufficient-length';
process.env.NODE_ENV = 'test';

const { default: quotesRoutes } = await import('../routes/quotes.js');
const { generateToken } = await import('../middleware/auth.js');
const { db, closeDatabase, first } = await import('../db/client.js');
const { auditLogs, businesses, businessModules, customers, inventoryItems, orders, products, quoteItems, quotes, users } = await import('../db/schema.js');

type QuoteResponse = {
    id: string;
    businessId: string;
    customerId: string;
    status: string;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    currency: string;
    notes?: string | null;
    items: {
        id: string;
        businessId: string;
        quoteId: string;
        productId?: string | null;
        description: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
    }[];
};

const app = new Hono();
app.route('/api/quotes', quotesRoutes);

const runId = Date.now();
const businessAId = `biz_verify_quotes_a_${runId}`;
const businessBId = `biz_verify_quotes_b_${runId}`;
const customerAId = `cust_verify_quotes_a_${runId}`;
const customerBId = `cust_verify_quotes_b_${runId}`;
const customerAArchivedId = `cust_verify_quotes_archived_${runId}`;
const customerAArchiveAfterQuoteId = `cust_verify_quotes_archive_after_${runId}`;
const productAId = `prod_verify_quotes_a_${runId}`;
const productBId = `prod_verify_quotes_b_${runId}`;
const staffQuotesId = `staff_quotes_${runId}`;
const moduleRowId = (workspaceKey: string, businessId: string) => `bmod_${workspaceKey}_${businessId}`;

const setModuleRow = async (businessId: string, workspaceKey: string, moduleKey: string, enabled: boolean) => {
    const id = moduleRowId(workspaceKey, businessId);
    const existing = await first(db.select().from(businessModules).where(eq(businessModules.id, id)));
    if (existing) {
        await db.update(businessModules).set({ enabled, updatedAt: new Date() }).where(eq(businessModules.id, id));
    } else {
        await db.insert(businessModules).values({ id, businessId, workspaceKey, moduleKey, enabled, updatedAt: new Date() });
    }
};

const tokenFor = async (businessId: string, primaryWorkspace = `/workspace/${businessId}`) => generateToken({
    sub: `user_${businessId}`,
    email: `${businessId}@example.com`,
    role: 'owner',
    businessId,
    primaryWorkspace,
});

const requestJson = async <T>(path: string, init: RequestInit = {}, businessId = businessAId, primaryWorkspace?: string) => {
    const token = await tokenFor(businessId, primaryWorkspace);
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
    if (actual !== expected) {
        throw new Error(`${message}; expected ${expected}, got ${actual}`);
    }
};

const createQuoteFixture = async (customerId: string, description: string, unitPrice = 10) => {
    const result = await requestJson<QuoteResponse>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId,
            items: [{ description, quantity: 1, unitPrice }],
        }),
    });
    assertStatus(result.response.status, 201, `Lifecycle fixture creation failed: ${description}`);
    return result.body;
};

const transitionStatus = async (quoteId: string, status: string, expectedStatus: number, message: string) => {
    const result = await requestJson<{ error?: string }>(`/api/quotes/${quoteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    assertStatus(result.response.status, expectedStatus, message);
    return result.body;
};

try {
    await db.delete(quoteItems).where(inArray(quoteItems.businessId, [businessAId, businessBId]));
    await db.delete(quotes).where(inArray(quotes.businessId, [businessAId, businessBId]));
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, [businessAId, businessBId]));
    await db.delete(customers).where(inArray(customers.businessId, [businessAId, businessBId]));
    await db.delete(products).where(inArray(products.businessId, [businessAId, businessBId]));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, [businessAId, businessBId]));
    await db.delete(businessModules).where(inArray(businessModules.businessId, [businessAId, businessBId]));
    await db.delete(users).where(inArray(users.id, [`user_${businessAId}`, `user_${businessBId}`, staffQuotesId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));

    await db.insert(businesses).values([
        { id: businessAId, name: 'Quotes Verification A', type: 'services', status: 'active' },
        { id: businessBId, name: 'Quotes Verification B', type: 'services', status: 'active' },
    ]);
    // Owner/staff fixtures: authMiddleware enforces account existence per request.
    await db.insert(users).values([
        { id: `user_${businessAId}`, email: `${businessAId}@example.com`, role: 'owner', status: 'active', businessId: businessAId },
        { id: `user_${businessBId}`, email: `${businessBId}@example.com`, role: 'owner', status: 'active', businessId: businessBId },
        { id: staffQuotesId, email: `${staffQuotesId}@example.com`, role: 'staff', status: 'active', businessId: businessAId, moduleAccess: ['quotes'] },
    ]);
    await db.insert(customers).values([
        { id: customerAId, businessId: businessAId, name: 'Tenant A Customer' },
        { id: customerBId, businessId: businessBId, name: 'Tenant B Customer' },
        { id: customerAArchivedId, businessId: businessAId, name: 'Tenant A Archived Customer', status: 'archived', archivedAt: new Date() },
        { id: customerAArchiveAfterQuoteId, businessId: businessAId, name: 'Tenant A To Archive Customer' },
    ]);
    await db.insert(products).values([
        { id: productAId, businessId: businessAId, name: 'Tenant A Product', barcode: `qa-${runId}`, price: 12.5, category: 'verify' },
        { id: productBId, businessId: businessBId, name: 'Tenant B Product', barcode: `qb-${runId}`, price: 99, category: 'verify' },
    ]);
    await db.insert(inventoryItems).values({
        id: productAId,
        businessId: businessAId,
        name: 'Tenant A Product',
        current: 25,
        min: 2,
        max: 50,
        unit: 'each',
        barcode: `qa-${runId}`,
        category: 'verify',
        status: 'ok',
        price: 12.5,
    });

    const missingCustomer = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: [{ description: 'Discovery', quantity: 1, unitPrice: 40 }],
        }),
    });
    assertStatus(missingCustomer.response.status, 400, 'Missing customer was not rejected');
    if (!missingCustomer.body.error?.includes('customerId is required')) {
        throw new Error('Missing customer did not return the expected error');
    }

    const invalidCustomer = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: `cust_missing_${runId}`,
            items: [{ description: 'Discovery', quantity: 1, unitPrice: 40 }],
        }),
    });
    assertStatus(invalidCustomer.response.status, 404, 'Invalid customer was not rejected');

    const crossTenantCustomer = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: customerBId,
            items: [{ description: 'Discovery', quantity: 1, unitPrice: 40 }],
        }),
    });
    assertStatus(crossTenantCustomer.response.status, 404, 'Cross-tenant customer was not rejected');

    const invalidQuantity = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: customerAId,
            items: [{ description: 'Discovery', quantity: 0, unitPrice: 40 }],
        }),
    });
    assertStatus(invalidQuantity.response.status, 400, 'Invalid item quantity was not rejected');

    const invalidPrice = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: customerAId,
            items: [{ description: 'Discovery', quantity: 1, unitPrice: -1 }],
        }),
    });
    assertStatus(invalidPrice.response.status, 400, 'Invalid item price was not rejected');

    const invalidName = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: customerAId,
            items: [{ description: '   ', quantity: 1, unitPrice: 40 }],
        }),
    });
    assertStatus(invalidName.response.status, 400, 'Invalid item name was not rejected');

    const crossTenantProduct = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: customerAId,
            items: [{ productId: productBId, quantity: 1 }],
        }),
    });
    assertStatus(crossTenantProduct.response.status, 404, 'Cross-tenant product was not rejected');

    const create = await requestJson<QuoteResponse>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            businessId: businessBId,
            customerId: customerAId,
            subtotal: 1,
            taxTotal: 1,
            total: 2,
            currency: 'usd',
            notes: 'Initial quote',
            items: [
                { productId: productAId, quantity: 2, unitPrice: 15 },
                { description: 'Implementation', quantity: 3, unitPrice: 20 },
            ],
        }),
    }, businessAId, businessBId);
    assertStatus(create.response.status, 201, 'Valid same-tenant quote creation failed');
    if (create.body.businessId !== businessAId || create.body.customerId !== customerAId) {
        throw new Error('Created quote was not scoped to authenticated businessId');
    }
    if (create.body.subtotal !== 90 || create.body.discountTotal !== 0 || create.body.taxTotal !== 0 || create.body.total !== 90) {
        throw new Error(`Server-side total calculation failed: ${JSON.stringify({
            subtotal: create.body.subtotal,
            discountTotal: create.body.discountTotal,
            taxTotal: create.body.taxTotal,
            total: create.body.total,
        })}`);
    }
    if (create.body.items.length !== 2 || create.body.items[0].businessId !== businessAId || create.body.items[0].lineTotal !== 30) {
        throw new Error('Created quote items were not persisted with expected tenant and line totals');
    }

    // ── CORE-M2: archived customer protection ────────────────────────────
    const archivedCustomerCreate = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: customerAArchivedId,
            items: [{ description: 'Archived customer work', quantity: 1, unitPrice: 100 }],
        }),
    });
    assertStatus(archivedCustomerCreate.response.status, 400, 'Archived customer quote creation was not rejected');
    if (!archivedCustomerCreate.body.error?.includes('archived')) {
        throw new Error(`Archived customer rejection did not mention archived status: ${archivedCustomerCreate.body.error}`);
    }

    // Existing quote with archived customer remains visible.
    const quoteForArchivedCustomer = await requestJson<QuoteResponse>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId: customerAArchiveAfterQuoteId,
            items: [{ description: 'Pre-archive work', quantity: 1, unitPrice: 50 }],
        }),
    });
    assertStatus(quoteForArchivedCustomer.response.status, 201, 'Quote for active customer failed');
    await db.update(customers)
        .set({ status: 'archived', archivedAt: new Date() })
        .where(and(eq(customers.id, customerAArchiveAfterQuoteId), eq(customers.businessId, businessAId)));
    const visibleAfterArchive = await requestJson<QuoteResponse>(`/api/quotes/${quoteForArchivedCustomer.body.id}`);
    assertStatus(visibleAfterArchive.response.status, 200, 'Quote with archived customer was not visible');
    if (visibleAfterArchive.body.customerId !== customerAArchiveAfterQuoteId) {
        throw new Error('Archived customer quote detail returned wrong customer');
    }

    // PATCH cannot move a draft quote to an archived customer.
    const patchToArchivedCustomer = await requestJson<{ error?: string }>(`/api/quotes/${create.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerAArchivedId }),
    });
    assertStatus(patchToArchivedCustomer.response.status, 400, 'PATCH to archived customer was not rejected');

    const listA = await requestJson<QuoteResponse[]>('/api/quotes');
    assertStatus(listA.response.status, 200, 'List quotes failed');
    if (!listA.body.some(quote => quote.id === create.body.id) || !listA.body.every(quote => quote.businessId === businessAId)) {
        throw new Error('Business A quote list did not stay tenant-scoped');
    }

    const detailA = await requestJson<QuoteResponse>(`/api/quotes/${create.body.id}`);
    assertStatus(detailA.response.status, 200, 'Quote detail failed');
    if (detailA.body.items.length !== 2 || detailA.body.items.some(item => item.quoteId !== create.body.id)) {
        throw new Error('Quote detail did not include persisted items');
    }

    const listB = await requestJson<QuoteResponse[]>('/api/quotes', {}, businessBId);
    assertStatus(listB.response.status, 200, 'Business B quote list failed');
    if (listB.body.some(quote => quote.id === create.body.id)) {
        throw new Error('Business B could list Business A quote');
    }

    const detailB = await requestJson<{ error?: string }>(`/api/quotes/${create.body.id}`, {}, businessBId);
    assertStatus(detailB.response.status, 404, 'Cross-tenant quote detail was not hidden');

    const updateB = await requestJson<{ error?: string }>(`/api/quotes/${create.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Tenant B takeover attempt' }),
    }, businessBId);
    assertStatus(updateB.response.status, 404, 'Cross-tenant quote update was not hidden');

    const updateA = await requestJson<QuoteResponse>(`/api/quotes/${create.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            total: 1,
            notes: 'Updated quote',
            items: [{ description: 'Revised implementation', quantity: 4, unitPrice: 25 }],
        }),
    });
    assertStatus(updateA.response.status, 200, 'Draft quote update failed');
    if (updateA.body.total !== 100 || updateA.body.subtotal !== 100 || updateA.body.items.length !== 1 || updateA.body.items[0].lineTotal !== 100) {
        throw new Error('Draft quote update did not recalculate totals and replace items');
    }

    await db.update(quotes)
        .set({ status: 'sent' })
        .where(and(eq(quotes.id, create.body.id), eq(quotes.businessId, businessAId)));
    const nonDraftUpdate = await requestJson<{ error?: string }>(`/api/quotes/${create.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Should fail' }),
    });
    assertStatus(nonDraftUpdate.response.status, 400, 'Non-draft quote update was not rejected');

    // ── CORE-M2: quote lifecycle foundation ──────────────────────────────
    // Allowed transitions.
    const lifecycleDraft = await createQuoteFixture(customerAId, 'Lifecycle draft', 20);
    await transitionStatus(lifecycleDraft.id, 'sent', 200, 'draft -> sent failed');
    const sentToAccepted = await createQuoteFixture(customerAId, 'Lifecycle sent accepted', 21);
    await transitionStatus(sentToAccepted.id, 'sent', 200, 'sent setup failed');
    await transitionStatus(sentToAccepted.id, 'accepted', 200, 'sent -> accepted failed');
    const sentToRejected = await createQuoteFixture(customerAId, 'Lifecycle sent rejected', 22);
    await transitionStatus(sentToRejected.id, 'sent', 200, 'sent setup failed');
    await transitionStatus(sentToRejected.id, 'rejected', 200, 'sent -> rejected failed');
    const sentToExpired = await createQuoteFixture(customerAId, 'Lifecycle sent expired', 23);
    await transitionStatus(sentToExpired.id, 'sent', 200, 'sent setup failed');
    await transitionStatus(sentToExpired.id, 'expired', 200, 'sent -> expired failed');

    // Blocked reverse transitions.
    const blockedAccepted = await createQuoteFixture(customerAId, 'Blocked accepted draft', 24);
    await transitionStatus(blockedAccepted.id, 'sent', 200, 'blocked accepted setup failed');
    await transitionStatus(blockedAccepted.id, 'accepted', 200, 'blocked accepted setup failed');
    await transitionStatus(blockedAccepted.id, 'draft', 400, 'accepted -> draft was not rejected');

    const blockedRejected = await createQuoteFixture(customerAId, 'Blocked rejected draft', 25);
    await transitionStatus(blockedRejected.id, 'sent', 200, 'blocked rejected setup failed');
    await transitionStatus(blockedRejected.id, 'rejected', 200, 'blocked rejected setup failed');
    await transitionStatus(blockedRejected.id, 'draft', 400, 'rejected -> draft was not rejected');

    const blockedExpired = await createQuoteFixture(customerAId, 'Blocked expired draft', 26);
    await transitionStatus(blockedExpired.id, 'sent', 200, 'blocked expired setup failed');
    await transitionStatus(blockedExpired.id, 'expired', 200, 'blocked expired setup failed');
    await transitionStatus(blockedExpired.id, 'draft', 400, 'expired -> draft was not rejected');

    // Invalid transitions not explicitly allowed.
    const invalidDraftAccepted = await createQuoteFixture(customerAId, 'Invalid draft accepted', 27);
    await transitionStatus(invalidDraftAccepted.id, 'accepted', 400, 'draft -> accepted was not rejected');

    const routeTenantToken = await tokenFor('/app/restaurant');
    const routeTenantResponse = await app.request('/api/quotes', {
        headers: { Authorization: `Bearer ${routeTenantToken}` },
    });
    assertStatus(routeTenantResponse.status, 401, 'Workspace route tenant was not rejected');

    const dbQuote = await first(db.select()
        .from(quotes)
        .where(and(eq(quotes.id, create.body.id), eq(quotes.businessId, businessAId)))
    );
    if (!dbQuote || dbQuote.businessId !== businessAId || dbQuote.total !== 100) {
        throw new Error('Quote was not persisted under stable authenticated businessId with recalculated total');
    }

    const tenantBQuote = await first(db.select()
        .from(quotes)
        .where(and(eq(quotes.id, create.body.id), eq(quotes.businessId, businessBId)))
    );
    if (tenantBQuote) {
        throw new Error('Quote was incorrectly persisted under primaryWorkspace or request body tenant');
    }

    const orderRows = await db.select().from(orders).where(eq(orders.businessId, businessAId));
    if (orderRows.length !== 0) {
        throw new Error('Quote CRUD created an order unexpectedly');
    }

    const inventoryItem = await first(db.select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.id, productAId), eq(inventoryItems.businessId, businessAId)))
    );
    if (!inventoryItem || inventoryItem.current !== 25) {
        throw new Error('Quote CRUD changed inventory unexpectedly');
    }

    // ── CORE-M1: shared quotes entitlement ───────────────────────────────
    // State so far: NO module rows exist for Business A → the canonical
    // shared/quotes row is absent and the approved defaultEnabled=true applied
    // (all CRUD checks above passed in this state).

    const staffQuotesToken = await generateToken({
        sub: staffQuotesId,
        email: `${staffQuotesId}@example.com`,
        role: 'staff',
        businessId: businessAId,
    });
    const staffRequest = (path: string, init: RequestInit = {}) => app.request(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: `Bearer ${staffQuotesToken}` },
    });

    // 1. Explicit shared enabled → permitted for owner and staff-with-access.
    await setModuleRow(businessAId, 'shared', 'quotes', true);
    const sharedEnabledOwner = await requestJson('/api/quotes');
    assertStatus(sharedEnabledOwner.response.status, 200, 'Shared enabled quotes must permit the owner');
    const sharedEnabledStaff = await staffRequest('/api/quotes');
    assertStatus(sharedEnabledStaff.status, 200, 'Shared enabled quotes must permit staff with quotes access');

    // 2. Explicit shared disabled blocks ALL roles (owner included) — the
    //    business entitlement precedes any role or module-access check.
    await setModuleRow(businessAId, 'shared', 'quotes', false);
    const sharedDisabledOwner = await requestJson<{ error?: string }>('/api/quotes');
    assertStatus(sharedDisabledOwner.response.status, 409, 'Shared disabled quotes must block the owner');
    if (!sharedDisabledOwner.body.error?.includes("Module 'quotes' is disabled")) {
        throw new Error('Shared disabled did not return the business-module-disabled response');
    }
    const sharedDisabledOwnerWrite = await requestJson<{ error?: string }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerAId, items: [{ description: 'Blocked', quantity: 1, unitPrice: 1 }] }),
    });
    assertStatus(sharedDisabledOwnerWrite.response.status, 409, 'Shared disabled quotes must block owner writes');
    const sharedDisabledStaff = await staffRequest('/api/quotes');
    assertStatus(sharedDisabledStaff.status, 409, 'Shared disabled quotes must block staff before access checks');

    // 3. Staff without quotes module-access is denied (403) once entitled.
    await setModuleRow(businessAId, 'shared', 'quotes', true);
    await db.update(users).set({ moduleAccess: ['pos'] }).where(eq(users.id, staffQuotesId));
    const staffDenied = await staffRequest('/api/quotes');
    assertStatus(staffDenied.status, 403, 'Staff without quotes moduleAccess must be denied');
    await db.update(users).set({ moduleAccess: null }).where(eq(users.id, staffQuotesId));
    const staffLegacyNull = await staffRequest('/api/quotes');
    assertStatus(staffLegacyNull.status, 200, 'Staff with legacy-null moduleAccess must be allowed');
    await db.update(users).set({ moduleAccess: ['quotes'] }).where(eq(users.id, staffQuotesId));

    // 4. No legacy workspace fallback: a 'restaurant/quotes' row has no effect
    //    (shared policies never resolve under workspace-specific scopes, and
    //    quotes has no legacy fallback — shared row absent → defaultEnabled).
    await db.delete(businessModules).where(eq(businessModules.id, moduleRowId('shared', businessAId)));
    await setModuleRow(businessAId, 'restaurant', 'quotes', false);
    const legacyRowIgnored = await requestJson('/api/quotes');
    assertStatus(legacyRowIgnored.response.status, 200, 'A restaurant-scope quotes row must not disable shared quotes');
    await db.delete(businessModules).where(eq(businessModules.id, moduleRowId('restaurant', businessAId)));

    // 5. Cross-tenant isolation: Business B shared disabled blocks only B.
    await setModuleRow(businessBId, 'shared', 'quotes', false);
    const tenantBBlocked = await requestJson<{ error?: string }>('/api/quotes', {}, businessBId);
    assertStatus(tenantBBlocked.response.status, 409, 'Business B shared disabled must block Business B');
    const tenantAUnaffected = await requestJson('/api/quotes');
    assertStatus(tenantAUnaffected.response.status, 200, 'Business B module state must not affect Business A');

    // 6. primaryWorkspace has no authorization effect.
    const tenantBCrossWorkspaceToken = await tokenFor(businessBId, `/workspace/${businessAId}`);
    const tenantBPrimaryWorkspace = await app.request('/api/quotes', {
        headers: { Authorization: `Bearer ${tenantBCrossWorkspaceToken}` },
    });
    assertStatus(tenantBPrimaryWorkspace.status, 409, 'primaryWorkspace must not bypass a disabled shared module');

    // ── CORE-M2: quote number safety investigation ───────────────────────
    const totalQuotes = await db.execute<{ total: number }>(sql`SELECT COUNT(*)::int AS total FROM quotes`);
    const nullQuotes = await db.execute<{ null_count: number }>(sql`SELECT COUNT(*)::int AS null_count FROM quotes WHERE quote_number IS NULL`);
    const duplicateQuotes = await db.execute<{ quote_number: string; count: number }>(
        sql`SELECT quote_number, COUNT(*)::int AS count FROM quotes GROUP BY quote_number HAVING COUNT(*) > 1`
    );
    const sampleQuotes = await db.execute<{ quote_number: string }>(
        sql`SELECT quote_number FROM quotes ORDER BY created_at DESC LIMIT 5`
    );

    const quoteNumberReport = {
        totalQuotes: totalQuotes[0]?.total ?? 0,
        nullQuoteNumbers: nullQuotes[0]?.null_count ?? 0,
        duplicateQuoteNumberGroups: duplicateQuotes.length,
        duplicateQuoteNumbers: duplicateQuotes.map((row) => ({ quoteNumber: row.quote_number, count: row.count })),
        recentFormats: [...new Set(sampleQuotes.map((row) => row.quote_number))],
    };

    console.log('Quote number safety investigation:', JSON.stringify(quoteNumberReport, null, 2));

    if (quoteNumberReport.nullQuoteNumbers > 0) {
        throw new Error(`Found ${quoteNumberReport.nullQuoteNumbers} quotes with null quoteNumber; schema safety review required`);
    }

    console.log('Quotes verification passed: create/list/detail/update, server-side totals, validation, draft-only updates, archived customer protection, lifecycle transitions, tenant isolation, primaryWorkspace rejection, and shared entitlement (default-enabled, explicit enable/disable for all roles, staff access layering, no legacy fallback, cross-tenant isolation).');
} catch (error) {
    console.error('Quotes verification failed:', error);
    process.exitCode = 1;
} finally {
    await db.delete(quoteItems).where(inArray(quoteItems.businessId, [businessAId, businessBId]));
    await db.delete(quotes).where(inArray(quotes.businessId, [businessAId, businessBId]));
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, [businessAId, businessBId]));
    await db.delete(customers).where(inArray(customers.businessId, [businessAId, businessBId]));
    await db.delete(products).where(inArray(products.businessId, [businessAId, businessBId]));
    await db.delete(inventoryItems).where(inArray(inventoryItems.businessId, [businessAId, businessBId]));
    await db.delete(businessModules).where(inArray(businessModules.businessId, [businessAId, businessBId]));
    await db.delete(users).where(inArray(users.id, [`user_${businessAId}`, `user_${businessBId}`, staffQuotesId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));
    await closeDatabase();
}
