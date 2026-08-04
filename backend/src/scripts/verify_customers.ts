import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl } from '../utils/env.js';

requireDatabaseUrl();

process.env.JWT_SECRET ||= 'customers-verification-secret-with-sufficient-length';
process.env.NODE_ENV = 'test';

const { default: customersRoutes } = await import('../routes/customers.js');
const { default: businessRoutes } = await import('../routes/business.js');
const { generateToken } = await import('../middleware/auth.js');
const { db, closeDatabase, first } = await import('../db/client.js');
const { businesses, businessModules, customers, users } = await import('../db/schema.js');

const app = new Hono();
app.route('/api/customers', customersRoutes);
app.route('/api/business', businessRoutes);

const runId = Date.now();
const businessAId = `biz_verify_customers_a_${runId}`;
const businessBId = `biz_verify_customers_b_${runId}`;
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

const staffTokenFor = async (userId: string, businessId: string, primaryWorkspace?: string) => generateToken({
    sub: userId,
    email: `${userId}@example.com`,
    role: 'staff',
    businessId,
    ...(primaryWorkspace ? { primaryWorkspace } : {}),
});

const setModuleRow = async (businessId: string, workspaceKey: string, moduleKey: string, enabled: boolean) => {
    const id = moduleRowId(workspaceKey, businessId);
    const existing = await first(db.select().from(businessModules).where(eq(businessModules.id, id)));
    if (existing) {
        await db.update(businessModules).set({ enabled, updatedAt: new Date() }).where(eq(businessModules.id, id));
    } else {
        await db.insert(businessModules).values({ id, businessId, workspaceKey, moduleKey, enabled, updatedAt: new Date() });
    }
};

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

try {
    await db.delete(customers).where(inArray(customers.businessId, [businessAId, businessBId]));
    await db.delete(businessModules).where(inArray(businessModules.businessId, [businessAId, businessBId]));
    await db.delete(users).where(inArray(users.id, [`user_${businessAId}`, `user_${businessBId}`, staffAllowId, staffDenyId, staffNullId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));

    await db.insert(businesses).values([
        { id: businessAId, name: 'Customers Verification A', type: 'retail', status: 'active' },
        { id: businessBId, name: 'Customers Verification B', type: 'retail', status: 'active' },
    ]);
    // Owner fixtures: authMiddleware enforces account existence per request.
    await db.insert(users).values([
        { id: `user_${businessAId}`, email: `${businessAId}@example.com`, role: 'owner', status: 'active', businessId: businessAId },
        { id: `user_${businessBId}`, email: `${businessBId}@example.com`, role: 'owner', status: 'active', businessId: businessBId },
    ]);
    // Staff fixtures for module-access-layer checks (Business A).
    await db.insert(users).values([
        { id: staffAllowId, email: `${staffAllowId}@example.com`, role: 'staff', status: 'active', businessId: businessAId, moduleAccess: ['customers'] },
        { id: staffDenyId, email: `${staffDenyId}@example.com`, role: 'staff', status: 'active', businessId: businessAId, moduleAccess: ['pos'] },
        { id: staffNullId, email: `${staffNullId}@example.com`, role: 'staff', status: 'active', businessId: businessAId },
    ]);

    const missingName = await requestJson<{ error?: string }>('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+15550000000' }),
    });
    if (missingName.response.status !== 400 || !missingName.body.error?.includes('name is required')) {
        throw new Error(`Missing name check failed with status ${missingName.response.status}`);
    }

    const emptyCreateName = await requestJson<{ error?: string }>('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
    });
    if (emptyCreateName.response.status !== 400 || !emptyCreateName.body.error?.includes('name is required')) {
        throw new Error(`Empty create name check failed with status ${emptyCreateName.response.status}`);
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

    const detailA = await requestJson<{ id?: string; businessId?: string; name?: string; phone?: string | null }>(`/api/customers/${created.body.id}`);
    if (detailA.response.status !== 200 || detailA.body.id !== created.body.id || detailA.body.businessId !== businessAId) {
        throw new Error(`Business A detail lookup failed with status ${detailA.response.status}`);
    }

    const emptyUpdateName = await requestJson<{ error?: string }>(`/api/customers/${created.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
    });
    if (emptyUpdateName.response.status !== 400 || !emptyUpdateName.body.error?.includes('name must be a non-empty string')) {
        throw new Error(`Empty update name check failed with status ${emptyUpdateName.response.status}`);
    }

    const crossTenantUpdate = await requestJson<{ error?: string }>(`/api/customers/${created.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tenant B Takeover Attempt' }),
    }, businessBId);
    if (crossTenantUpdate.response.status !== 404) {
        throw new Error(`Business B update returned status ${crossTenantUpdate.response.status}`);
    }

    const updated = await requestJson<{ id?: string; businessId?: string; name?: string; phone?: string | null; email?: string | null; companyName?: string | null }>(`/api/customers/${created.body.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Tenant A Customer Updated',
            phone: '',
            email: 'updated@example.com',
            companyName: 'Updated Co',
            unsupportedField: 'ignored',
        }),
    });
    if (
        updated.response.status !== 200 ||
        updated.body.id !== created.body.id ||
        updated.body.businessId !== businessAId ||
        updated.body.name !== 'Tenant A Customer Updated' ||
        updated.body.phone !== null ||
        updated.body.email !== 'updated@example.com' ||
        updated.body.companyName !== 'Updated Co'
    ) {
        throw new Error(`Update customer failed with status ${updated.response.status}`);
    }

    const routeTenantToken = await tokenFor('/app/restaurant');
    const routeTenantResponse = await app.request('/api/customers', {
        headers: { Authorization: `Bearer ${routeTenantToken}` },
    });
    if (routeTenantResponse.status !== 401) {
        throw new Error(`Workspace route tenant was not rejected; status ${routeTenantResponse.status}`);
    }

    const routeTenantPatchResponse = await app.request(`/api/customers/${created.body.id}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${routeTenantToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Workspace Route Update Attempt' }),
    });
    if (routeTenantPatchResponse.status !== 401) {
        throw new Error(`Workspace route tenant update was not rejected; status ${routeTenantPatchResponse.status}`);
    }

    const dbRows = await db.select().from(customers)
        .where(and(eq(customers.id, created.body.id), eq(customers.businessId, businessAId)));
    if (dbRows.length !== 1 || dbRows[0].name !== 'Tenant A Customer Updated') {
        throw new Error('Updated customer was not persisted under Business A');
    }

    // ── CORE-M1-S2: customer lifecycle, archive, search, and filtering ───
    const lifecycleCustomer = await requestJson<{ id?: string; status?: string; archivedAt?: string | null }>('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lifecycle Customer', phone: '+15550999001', email: 'lifecycle@example.com', companyName: 'Lifecycle Co', notes: 'archive me' }),
    });
    assertStatus(lifecycleCustomer.response.status, 201, 'Lifecycle customer create must succeed');
    if (lifecycleCustomer.body.status !== 'active') {
        throw new Error(`New customer default status must be active, got ${lifecycleCustomer.body.status}`);
    }

    const activeList = await requestJson<{ id: string; status: string }[]>('/api/customers');
    assertStatus(activeList.response.status, 200, 'Active customer list must succeed');
    if (!activeList.body.some(customer => customer.id === lifecycleCustomer.body.id)) {
        throw new Error('Active list must include newly created active customer');
    }

    const archived = await requestJson<{ id?: string; status?: string; archivedAt?: string | null }>(`/api/customers/${lifecycleCustomer.body.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    assertStatus(archived.response.status, 200, 'Archive customer must succeed');
    if (archived.body.status !== 'archived' || !archived.body.archivedAt) {
        throw new Error(`Archive must set status=archived and archivedAt; got status=${archived.body.status}, archivedAt=${archived.body.archivedAt}`);
    }

    const archivedAgain = await requestJson<{ id?: string; status?: string; archivedAt?: string | null }>(`/api/customers/${lifecycleCustomer.body.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    assertStatus(archivedAgain.response.status, 200, 'Repeat archive must be idempotent');
    if (archivedAgain.body.status !== 'archived') {
        throw new Error(`Idempotent archive must keep status=archived, got ${archivedAgain.body.status}`);
    }

    const activeListAfterArchive = await requestJson<{ id: string; status: string }[]>('/api/customers');
    assertStatus(activeListAfterArchive.response.status, 200, 'Active customer list after archive must succeed');
    if (activeListAfterArchive.body.some(customer => customer.id === lifecycleCustomer.body.id)) {
        throw new Error('Active list must exclude archived customer by default');
    }

    const archivedList = await requestJson<{ id: string; status: string }[]>('/api/customers?includeArchived=true');
    assertStatus(archivedList.response.status, 200, 'Archived-inclusive list must succeed');
    if (!archivedList.body.some(customer => customer.id === lifecycleCustomer.body.id && customer.status === 'archived')) {
        throw new Error('includeArchived=true must return the archived customer');
    }

    const searchByName = await requestJson<{ id: string }[]>('/api/customers?search=Lifecycle');
    assertStatus(searchByName.response.status, 200, 'Search by name must succeed');
    if (searchByName.body.some(customer => customer.id === lifecycleCustomer.body.id)) {
        throw new Error('Search by default must exclude archived customer');
    }

    const searchArchived = await requestJson<{ id: string }[]>('/api/customers?search=Lifecycle&includeArchived=true');
    assertStatus(searchArchived.response.status, 200, 'Search archived must succeed');
    if (!searchArchived.body.some(customer => customer.id === lifecycleCustomer.body.id)) {
        throw new Error('Search with includeArchived=true must find archived customer');
    }

    const searchPhone = await requestJson<{ id: string }[]>('/api/customers?search=+15550999001');
    assertStatus(searchPhone.response.status, 200, 'Search by phone must succeed');
    if (searchPhone.body.some(customer => customer.id === lifecycleCustomer.body.id)) {
        throw new Error('Search by phone must exclude archived customer by default');
    }

    const crossTenantArchive = await requestJson<{ error?: string }>(`/api/customers/${lifecycleCustomer.body.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    }, businessBId);
    assertStatus(crossTenantArchive.response.status, 404, 'Business B must not archive Business A customer');

    const crossTenantSearch = await requestJson<{ id: string }[]>('/api/customers?search=Lifecycle&includeArchived=true', {}, businessBId);
    assertStatus(crossTenantSearch.response.status, 200, 'Cross-tenant search must succeed');
    if (crossTenantSearch.body.some(customer => customer.id === lifecycleCustomer.body.id)) {
        throw new Error('Business B search must not include Business A customer');
    }

    // ── CORE-M1: shared customers entitlement ────────────────────────────
    // State so far: NO module rows exist for Business A (canonical shared row
    // absent, legacy restaurant row absent). The CRUD checks above already
    // passed in this state → shared missing + legacy missing permits.

    // 1. Shared row absent + legacy restaurant/customers disabled → 409
    //    (temporary non-destructive legacy fallback preserved).
    await setModuleRow(businessAId, 'restaurant', 'customers', false);
    const legacyDisabled = await requestJson<{ error?: string }>('/api/customers');
    assertStatus(legacyDisabled.response.status, 409, 'Legacy disabled customers must block');
    if (!legacyDisabled.body.error?.includes("Module 'customers' is disabled")) {
        throw new Error('Legacy disabled did not return the business-module-disabled response');
    }

    // 2. Shared row absent + legacy enabled → permitted.
    await setModuleRow(businessAId, 'restaurant', 'customers', true);
    const legacyEnabled = await requestJson('/api/customers');
    assertStatus(legacyEnabled.response.status, 200, 'Legacy enabled customers must permit');

    // 3. Canonical shared DISABLED overrides legacy ENABLED → 409, including
    //    for management roles (business entitlement precedes role bypass).
    await setModuleRow(businessAId, 'shared', 'customers', false);
    const sharedDisabledOverrides = await requestJson<{ error?: string }>('/api/customers');
    assertStatus(sharedDisabledOverrides.response.status, 409, 'Shared disabled must override legacy enabled');

    // 4. Canonical shared ENABLED is authoritative over legacy DISABLED → 200
    //    (no legacy fallback once the shared row exists).
    await setModuleRow(businessAId, 'restaurant', 'customers', false);
    await setModuleRow(businessAId, 'shared', 'customers', true);
    const sharedEnabledOverrides = await requestJson('/api/customers');
    assertStatus(sharedEnabledOverrides.response.status, 200, 'Shared enabled must override legacy disabled');

    // 5. Role and user module-access checks apply only after entitlement.
    const staffAllowToken = await staffTokenFor(staffAllowId, businessAId);
    const staffDenyToken = await staffTokenFor(staffDenyId, businessAId);
    const staffNullToken = await staffTokenFor(staffNullId, businessAId);
    const staffAllow = await requestWithToken(staffAllowToken, '/api/customers');
    assertStatus(staffAllow.response.status, 200, 'Staff with customers moduleAccess must be allowed');
    const staffDeny = await requestWithToken<{ error?: string }>(staffDenyToken, '/api/customers');
    assertStatus(staffDeny.response.status, 403, 'Staff without customers moduleAccess must be denied');
    const staffNull = await requestWithToken(staffNullToken, '/api/customers');
    assertStatus(staffNull.response.status, 200, 'Staff with legacy-null moduleAccess must be allowed');
    const staffWrite = await requestWithToken<{ error?: string }>(staffAllowToken, '/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Staff Write Attempt' }),
    });
    assertStatus(staffWrite.response.status, 403, 'Staff write must stay role-blocked after entitlement');

    // 6. Disabled business module blocks staff BEFORE module-access checks.
    await setModuleRow(businessAId, 'shared', 'customers', false);
    const staffBlockedByModule = await requestWithToken<{ error?: string }>(staffAllowToken, '/api/customers');
    assertStatus(staffBlockedByModule.response.status, 409, 'Disabled module must block staff before access checks');
    await setModuleRow(businessAId, 'shared', 'customers', true);

    // 7. Module-settings scope validation (fail closed).
    const ownerAToken = await tokenFor(businessAId);
    const legacyWriteAttempt = await requestWithToken<{ error?: string }>(ownerAToken, '/api/business/modules/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceKey: 'restaurant', enabled: false }),
    });
    assertStatus(legacyWriteAttempt.response.status, 400, 'Shared-managed module write under restaurant scope must be rejected');
    const legacyRowAfter = await first(db.select().from(businessModules)
        .where(eq(businessModules.id, moduleRowId('restaurant', businessAId))));
    if (!legacyRowAfter || legacyRowAfter.enabled !== false) {
        throw new Error('Rejected restaurant-scope write mutated the legacy row');
    }
    const quotesUnderRestaurant = await requestWithToken<{ error?: string }>(ownerAToken, '/api/business/modules/quotes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceKey: 'restaurant', enabled: false }),
    });
    assertStatus(quotesUnderRestaurant.response.status, 400, 'Quotes write under restaurant scope must be rejected');
    const customersUnderRetail = await requestWithToken<{ error?: string }>(ownerAToken, '/api/business/modules/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceKey: 'retail', enabled: false }),
    });
    assertStatus(customersUnderRetail.response.status, 400, 'Shared-managed module write under other workspace scopes must be rejected');
    const unknownSharedModule = await requestWithToken<{ error?: string }>(ownerAToken, '/api/business/modules/pos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceKey: 'shared', enabled: false }),
    });
    assertStatus(unknownSharedModule.response.status, 404, 'Unknown shared module combination must fail closed');
    const sharedWrite = await requestWithToken<{ workspaceKey?: string; enabled?: boolean }>(ownerAToken, '/api/business/modules/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceKey: 'shared', enabled: true }),
    });
    assertStatus(sharedWrite.response.status, 200, 'Canonical shared customers write must succeed');
    if (sharedWrite.body.workspaceKey !== 'shared') {
        throw new Error('Shared customers write did not persist under the canonical shared scope');
    }

    // 8. Module listings: shared section lists customers+quotes exactly once;
    //    restaurant section no longer lists customers (no duplicate settings).
    const sharedList = await requestWithToken<{ modules: { moduleKey: string; enabled: boolean }[] }>(ownerAToken, '/api/business/modules?workspace=shared');
    assertStatus(sharedList.response.status, 200, 'Shared module listing must succeed');
    const sharedKeys = sharedList.body.modules.map(module => module.moduleKey);
    const expectedSharedKeys = ['customers', 'quotes', 'products'];
    const sharedKeyCounts = new Map<string, number>();
    for (const key of sharedKeys) {
        sharedKeyCounts.set(key, (sharedKeyCounts.get(key) ?? 0) + 1);
    }
    const missing = expectedSharedKeys.filter(key => sharedKeyCounts.get(key) !== 1);
    const duplicates = [...sharedKeyCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
    const unexpected = sharedKeys.filter(key => !expectedSharedKeys.includes(key));
    if (missing.length > 0 || duplicates.length > 0 || unexpected.length > 0) {
        throw new Error(`Shared listing must contain exactly customers, quotes, products once each; got [${sharedKeys.join(',')}]; missing=[${missing.join(',')}], duplicates=[${duplicates.join(',')}], unexpected=[${unexpected.join(',')}]`);
    }
    const restaurantList = await requestWithToken<{ modules: { moduleKey: string }[] }>(ownerAToken, '/api/business/modules?workspace=restaurant');
    assertStatus(restaurantList.response.status, 200, 'Restaurant module listing must succeed');
    if (restaurantList.body.modules.some(module => module.moduleKey === 'customers')) {
        throw new Error('Customers must not appear in the restaurant workspace section');
    }
    const unsupportedList = await requestWithToken<{ error?: string }>(ownerAToken, '/api/business/modules?workspace=unknown');
    assertStatus(unsupportedList.response.status, 400, 'Unsupported workspace listing must be rejected');

    // 9. Cross-tenant isolation: Business B shared disabled blocks only B.
    await setModuleRow(businessBId, 'shared', 'customers', false);
    const tenantBBlocked = await requestJson<{ error?: string }>('/api/customers', {}, businessBId);
    assertStatus(tenantBBlocked.response.status, 409, 'Business B shared disabled must block Business B');
    const tenantAUnaffected = await requestJson('/api/customers');
    assertStatus(tenantAUnaffected.response.status, 200, 'Business B module state must not affect Business A');
    const tenantBModuleList = await requestWithToken<{ modules: { moduleKey: string; enabled: boolean }[] }>(await tokenFor(businessBId), '/api/business/modules?workspace=shared');
    if (tenantBModuleList.body.modules.find(module => module.moduleKey === 'customers')?.enabled !== false) {
        throw new Error('Business B shared listing must reflect its own disabled state');
    }

    // 10. primaryWorkspace has no authorization effect: it cannot grant access
    //     to a disabled module, nor revoke access to an enabled one.
    const tenantBCrossWorkspaceToken = await generateToken({
        sub: `user_${businessBId}`,
        email: `${businessBId}@example.com`,
        role: 'owner',
        businessId: businessBId,
        primaryWorkspace: `/workspace/${businessAId}`,
    });
    const tenantBPrimaryWorkspace = await requestWithToken<{ error?: string }>(tenantBCrossWorkspaceToken, '/api/customers');
    assertStatus(tenantBPrimaryWorkspace.response.status, 409, 'primaryWorkspace must not bypass a disabled shared module');
    const tenantAStaffPrimaryWorkspace = await requestWithToken(await staffTokenFor(staffAllowId, businessAId, '/app/retail'), '/api/customers');
    assertStatus(tenantAStaffPrimaryWorkspace.response.status, 200, 'primaryWorkspace must not change staff authorization');

    console.log('Customers verification passed: create, list, detail, update, missing/empty-name rejection, cross-tenant update isolation, workspace-route tenant rejection, shared/legacy entitlement resolution, staff module-access layering, module-settings scope validation, single shared listing, primaryWorkspace neutrality, customer lifecycle defaults, archive idempotency, archived filtering, tenant-scoped search, and cross-tenant archive isolation.');
} catch (error) {
    console.error('Customers verification failed:', error);
    process.exitCode = 1;
} finally {
    await db.delete(customers).where(inArray(customers.businessId, [businessAId, businessBId]));
    await db.delete(businessModules).where(inArray(businessModules.businessId, [businessAId, businessBId]));
    await db.delete(users).where(inArray(users.id, [`user_${businessAId}`, `user_${businessBId}`, staffAllowId, staffDenyId, staffNullId]));
    await db.delete(businesses).where(inArray(businesses.id, [businessAId, businessBId]));
    await closeDatabase();
}
