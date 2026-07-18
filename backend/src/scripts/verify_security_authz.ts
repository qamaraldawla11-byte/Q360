import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:security-authz');
requireDatabaseUrl();

process.env.JWT_SECRET ||= 'security-authz-verification-secret';
delete process.env.RESEND_API_KEY;
process.env.NODE_ENV = 'test';

const { db, first, closeDatabase } = await import('../db/client.js');
const {
    businesses,
    customers,
    menuCategories,
    menuItems,
    otpCodes,
    quoteItems,
    quotes,
    restaurantTables,
    users,
} = await import('../db/schema.js');
const { eq } = await import('drizzle-orm');
const { default: authRoutes } = await import('../routes/auth.js');
const { default: adminRoutes } = await import('../routes/admin.js');
const { default: quotesRoutes } = await import('../routes/quotes.js');
const { default: restaurantRoutes } = await import('../routes/restaurant.js');
const { default: userRoutes } = await import('../routes/user.js');

const app = new Hono();
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/quotes', quotesRoutes);
app.route('/api/restaurant', restaurantRoutes);
app.route('/api/user', userRoutes);

const suffix = Date.now().toString(36);
const businessId = `biz_secz_${suffix}`;
const otherBusinessId = `biz_secz_other_${suffix}`;
const legacyUserId = `usr_secz_legacy_${suffix}`;
const nullTenantUserId = `usr_secz_null_${suffix}`;
const nullTenantEmail = `secz-null-${suffix}@example.com`;
const controlUserId = `usr_secz_control_${suffix}`;
const controlEmail = `secz-control-${suffix}@example.com`;
const wsUserAId = `usr_secz_wsa_${suffix}`;
const wsUserAEmail = `secz-wsa-${suffix}@example.com`;
const wsUserBId = `usr_secz_wsb_${suffix}`;
const wsUserBEmail = `secz-wsb-${suffix}@example.com`;
const adminCreatedEmail = `secz-admin-${suffix}@example.com`;
const staffCreatedEmail = `secz-staff-${suffix}@example.com`;
const categoryId = `secz_cat_${suffix}`;
const itemId = `secz_item_${suffix}`;
const tableId = `secz_table_${suffix}`;
const customerId = `cust_secz_${suffix}`;
const migratedBusinessIds = new Set<string>();

let failures = 0;
const check = (name: string, condition: boolean, detail?: unknown) => {
    if (condition) {
        console.log(`PASS ${name}`);
        return;
    }
    failures += 1;
    console.error(`FAIL ${name}${detail === undefined ? '' : ` :: ${JSON.stringify(detail)}`}`);
};

const signToken = (payload: Record<string, unknown>) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode({ iat: now, exp: now + 3600, ...payload });
    const signature = createHmac('sha256', process.env.JWT_SECRET!)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${signature}`;
};

const createRoleToken = (role: string, sub = `usr_secz_${role}_${suffix}`, biz = businessId) =>
    signToken({ sub, email: `${sub}@example.com`, role, businessId: biz });

// Legacy token shape: predates the businessId claim entirely.
const createLegacyToken = (sub: string, role = 'owner') =>
    signToken({ sub, email: `${sub}@example.com`, role });

const api = (token: string, path: string, init?: RequestInit) =>
    app.request(path, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...init?.headers,
        },
    });

const json = (value: unknown) => JSON.stringify(value);

const requestOtp = async (email: string) => {
    let otpOutput = '';
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
        otpOutput += `${args.map(String).join(' ')}\n`;
    };
    try {
        const loginResponse = await app.request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: json({ email }),
        });
        if (loginResponse.status !== 200) {
            throw new Error(`OTP request failed: ${loginResponse.status} ${await loginResponse.text()}`);
        }
        const code = otpOutput.match(new RegExp(`\\[DEV OTP\\] Code for ${email}: (\\d{6})`))?.[1];
        if (!code) throw new Error('OTP code was not captured from development output');
        return code;
    } finally {
        console.log = originalLog;
    }
};

const verifyOtp = (email: string, code: string) =>
    app.request('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json({ email, code }),
    });

const TENANT_ERROR = { error: 'TENANT_IDENTITY_REQUIRED', message: 'A stable business identity is required.' };

try {
    // --- Fixtures -----------------------------------------------------------
    await db.insert(businesses).values([
        { id: businessId, name: `SecZ ${suffix}`, type: 'restaurant', status: 'active' },
        { id: otherBusinessId, name: `SecZ Other ${suffix}`, type: 'retail', status: 'active' },
    ]);
    await db.insert(users).values({
        id: legacyUserId,
        email: `secz-legacy-${suffix}@example.com`,
        name: 'SecZ Legacy Owner',
        role: 'user',
        userType: 'sme',
        segment: 'restaurant',
        onboardingCompleted: true,
        primaryWorkspace: '/app/restaurant',
        businessId,
    });
    await db.insert(users).values({
        id: nullTenantUserId,
        email: nullTenantEmail,
        name: 'SecZ Null Tenant',
        role: 'user',
        status: 'active',
        isLocked: false,
        onboardingCompleted: false,
        primaryWorkspace: 'biz_main',
        businessId: null,
    });
    await db.insert(users).values({
        id: controlUserId,
        email: controlEmail,
        name: 'SecZ Control',
        role: 'owner',
        status: 'active',
        businessId,
    });
    // Pre-tenant legacy accounts: workspace route stored where a stable tenant id belongs.
    await db.insert(users).values({
        id: wsUserAId,
        email: wsUserAEmail,
        name: 'SecZ WS A',
        role: 'owner',
        status: 'active',
        userType: 'sme',
        segment: 'restaurant',
        businessId: '/app/restaurant',
    });
    await db.insert(users).values({
        id: wsUserBId,
        email: wsUserBEmail,
        name: 'SecZ WS B',
        role: 'owner',
        status: 'active',
        userType: 'sme',
        segment: 'restaurant',
        businessId: '/app/restaurant',
    });
    await db.insert(menuCategories).values({
        id: categoryId, businessId, menuId: `secz_menu_${suffix}`, name: 'SecZ Mains', sortOrder: 0,
    });
    await db.insert(menuItems).values({
        id: itemId, businessId, categoryId, name: 'SecZ Soup', price: 500, isAvailable: true, prepTimeMinutes: 5,
    });
    await db.insert(restaurantTables).values({
        id: tableId, businessId, label: 'SZ1', capacity: 2, status: 'available',
    });
    await db.insert(customers).values({ id: customerId, businessId, name: 'SecZ Customer' });

    const waiter = createRoleToken('waiter');
    const kitchen = createRoleToken('kitchen');
    const staff = createRoleToken('staff');
    const owner = createRoleToken('owner');
    const manager = createRoleToken('manager');
    const admin = createRoleToken('admin');

    // --- 1. Restaurant authorization ---------------------------------------
    const waiterCatCreate = await api(waiter, '/api/restaurant/menu/categories', { method: 'POST', body: json({ name: 'Nope' }) });
    check('waiter cannot create menu category', waiterCatCreate.status === 403, waiterCatCreate.status);

    const waiterCatPatch = await api(waiter, `/api/restaurant/menu/categories/${categoryId}`, { method: 'PATCH', body: json({ name: 'Nope' }) });
    check('waiter cannot update menu category', waiterCatPatch.status === 403, waiterCatPatch.status);

    const waiterCatDelete = await api(waiter, `/api/restaurant/menu/categories/${categoryId}`, { method: 'DELETE' });
    check('waiter cannot delete menu category', waiterCatDelete.status === 403, waiterCatDelete.status);

    const waiterItemCreate = await api(waiter, '/api/restaurant/menu/items', { method: 'POST', body: json({ name: 'Nope', price: 1, categoryId }) });
    check('waiter cannot create menu item', waiterItemCreate.status === 403, waiterItemCreate.status);

    const waiterItemPatch = await api(waiter, `/api/restaurant/menu/items/${itemId}`, { method: 'PATCH', body: json({ price: 1 }) });
    check('waiter cannot update menu item', waiterItemPatch.status === 403, waiterItemPatch.status);

    const form = new FormData();
    form.append('image', new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' }));
    const waiterImage = await api(waiter, `/api/restaurant/menu/items/${itemId}/image`, { method: 'POST', body: form });
    check('waiter cannot update menu item image', waiterImage.status === 403, waiterImage.status);

    const waiterTableCreate = await api(waiter, '/api/restaurant/tables', { method: 'POST', body: json({ label: 'NOPE', capacity: 2 }) });
    check('waiter cannot create table', waiterTableCreate.status === 403, waiterTableCreate.status);

    const waiterTableStatus = await api(waiter, `/api/restaurant/tables/${tableId}/status`, { method: 'PATCH', body: json({ status: 'occupied' }) });
    check('waiter CAN update table status (FloorView operational route)', waiterTableStatus.status === 200, waiterTableStatus.status);

    const kitchenItemPatch = await api(kitchen, `/api/restaurant/menu/items/${itemId}`, { method: 'PATCH', body: json({ isAvailable: false }) });
    check('kitchen cannot update menu item (no 86 permission in M3)', kitchenItemPatch.status === 403, kitchenItemPatch.status);

    const staffItemCreate = await api(staff, '/api/restaurant/menu/items', { method: 'POST', body: json({ name: 'Nope', price: 1, categoryId }) });
    check('ordinary staff cannot create menu item', staffItemCreate.status === 403, staffItemCreate.status);

    const staffTableCreate = await api(staff, '/api/restaurant/tables', { method: 'POST', body: json({ label: 'NOPE2', capacity: 2 }) });
    check('ordinary staff cannot create table', staffTableCreate.status === 403, staffTableCreate.status);

    const ownerCatCreate = await api(owner, '/api/restaurant/menu/categories', { method: 'POST', body: json({ name: `Owner Cat ${suffix}` }) });
    check('owner can create menu category', ownerCatCreate.status === 201, ownerCatCreate.status);

    const managerTableCreate = await api(manager, '/api/restaurant/tables', { method: 'POST', body: json({ label: `MGR${suffix}`.slice(0, 20), capacity: 4 }) });
    check('manager can create table', managerTableCreate.status === 201, managerTableCreate.status);

    const legacyToken = createRoleToken('user', legacyUserId);
    const legacyCatCreate = await api(legacyToken, '/api/restaurant/menu/categories', { method: 'POST', body: json({ name: `Legacy Cat ${suffix}` }) });
    check('legacy owner-compatible creator still works', legacyCatCreate.status === 201, legacyCatCreate.status);

    const waiterMenuRead = await api(waiter, '/api/restaurant/menu');
    check('waiter can still READ menu (POS/KDS preserved)', waiterMenuRead.status === 200, waiterMenuRead.status);

    // --- 2. Quote authorization ---------------------------------------------
    const quoteBody = json({ customerId, items: [{ description: 'Svc', quantity: 1, unitPrice: 10 }] });

    const staffQuoteCreate = await api(staff, '/api/quotes', { method: 'POST', body: quoteBody });
    check('staff cannot create quote', staffQuoteCreate.status === 403, staffQuoteCreate.status);

    const managerQuoteCreate = await api(manager, '/api/quotes', { method: 'POST', body: quoteBody });
    check('manager can create quote', managerQuoteCreate.status === 201, managerQuoteCreate.status);
    const createdQuote = managerQuoteCreate.status === 201
        ? await managerQuoteCreate.json() as { id: string }
        : undefined;

    if (createdQuote) {
        const staffQuotePatch = await api(staff, `/api/quotes/${createdQuote.id}`, { method: 'PATCH', body: json({ notes: 'nope' }) });
        check('staff cannot update quote', staffQuotePatch.status === 403, staffQuotePatch.status);

        const ownerQuotePatch = await api(owner, `/api/quotes/${createdQuote.id}`, { method: 'PATCH', body: json({ notes: 'ok' }) });
        check('owner can update quote', ownerQuotePatch.status === 200, ownerQuotePatch.status);
    } else {
        check('staff cannot update quote', false, 'quote fixture missing');
        check('owner can update quote', false, 'quote fixture missing');
    }

    const staffQuoteRead = await api(staff, '/api/quotes');
    check('staff can still READ quotes (read behavior preserved)', staffQuoteRead.status === 200, staffQuoteRead.status);

    // --- 3. Admin user creation ----------------------------------------------
    const createNoBiz = await api(admin, '/api/admin/users', { method: 'POST', body: json({ email: adminCreatedEmail, role: 'user' }) });
    check('admin create without businessId is rejected', createNoBiz.status === 400, createNoBiz.status);

    const createBadBiz = await api(admin, '/api/admin/users', { method: 'POST', body: json({ email: adminCreatedEmail, role: 'user', businessId: 'biz_does_not_exist' }) });
    check('admin create with nonexistent businessId is rejected', createBadBiz.status === 400, createBadBiz.status);

    const createNoRole = await api(admin, '/api/admin/users', { method: 'POST', body: json({ email: adminCreatedEmail, businessId: otherBusinessId }) });
    check('admin create without role is rejected', createNoRole.status === 400, createNoRole.status);

    const createCashier = await api(admin, '/api/admin/users', { method: 'POST', body: json({ email: adminCreatedEmail, role: 'cashier', businessId: otherBusinessId }) });
    check('admin create with operational role (cashier) is rejected', createCashier.status === 400, createCashier.status);

    const createSuperadmin = await api(admin, '/api/admin/users', { method: 'POST', body: json({ email: adminCreatedEmail, role: 'superadmin', businessId: otherBusinessId }) });
    check('admin create with unknown role is rejected', createSuperadmin.status === 400, createSuperadmin.status);

    const createStaff = await api(admin, '/api/admin/users', { method: 'POST', body: json({ email: staffCreatedEmail, role: 'staff', businessId: otherBusinessId }) });
    check('admin create with supported role (staff) succeeds', createStaff.status === 201, createStaff.status);

    const createOk = await api(admin, '/api/admin/users', { method: 'POST', body: json({ email: adminCreatedEmail, name: 'SecZ Admin Created', role: 'manager', businessId: otherBusinessId }) });
    check('admin create with valid businessId succeeds', createOk.status === 201, createOk.status);
    const adminCreatedUser = await first(db.select().from(users).where(eq(users.email, adminCreatedEmail)));
    check(
        'admin-created user receives intended stable businessId',
        adminCreatedUser?.businessId === otherBusinessId,
        adminCreatedUser?.businessId,
    );
    check(
        'admin-created user is NOT silently placed in biz_main',
        adminCreatedUser?.businessId !== null && adminCreatedUser?.businessId !== 'biz_main',
        adminCreatedUser?.businessId,
    );

    const ownerAdminCreate = await api(owner, '/api/admin/users', { method: 'POST', body: json({ email: `secz-x-${suffix}@example.com`, role: 'user', businessId }) });
    check('non-admin cannot use admin create route (guard preserved)', ownerAdminCreate.status === 403, ownerAdminCreate.status);

    // --- 3b. Admin-created user completes the real login flow ------------------
    if (adminCreatedUser) {
        const createdCode = await requestOtp(adminCreatedEmail);
        const createdLogin = await verifyOtp(adminCreatedEmail, createdCode);
        const createdLoginBody = await createdLogin.json() as { token?: string; user?: { primaryWorkspace?: string | null; onboardingCompleted?: boolean } };
        check('admin-created user can complete OTP login', createdLogin.status === 200 && Boolean(createdLoginBody.token), createdLogin.status);

        if (createdLoginBody.token) {
            const payload = JSON.parse(Buffer.from(createdLoginBody.token.split('.')[1], 'base64url').toString('utf8')) as { businessId?: string };
            check('admin-created user JWT carries the intended businessId', payload.businessId === otherBusinessId, payload.businessId);
            check('admin-created user JWT is NOT biz_main', payload.businessId !== 'biz_main', payload.businessId);

            const session = await api(createdLoginBody.token, '/api/auth/session');
            const sessionBody = await session.json() as { primaryWorkspace?: string | null; role?: string };
            check('session restoration works for admin-created user', session.status === 200 && sessionBody.role === 'manager', { status: session.status, body: sessionBody });
            check(
                'primaryWorkspace stays semantically separate (null, same shape as self-signup)',
                sessionBody.primaryWorkspace === null,
                sessionBody.primaryWorkspace,
            );
        }
    }

    // --- 4. Admin user update allowlist ---------------------------------------
    if (adminCreatedUser) {
        const protectedOnly = await api(admin, `/api/admin/users/${adminCreatedUser.id}`, {
            method: 'PATCH',
            body: json({ id: 'usr_hijack', email: 'evil@example.com', businessId: 'biz_main', primaryWorkspace: '/app/restaurant', createdAt: new Date(0).toISOString() }),
        });
        check('PATCH with only protected fields is rejected (400)', protectedOnly.status === 400, protectedOnly.status);

        const legit = await api(admin, `/api/admin/users/${adminCreatedUser.id}`, {
            method: 'PATCH',
            body: json({ name: 'SecZ Updated', email: 'evil@example.com', businessId: 'biz_main', role: 'staff' }),
        });
        check('PATCH mixing one legitimate + protected fields succeeds', legit.status === 200, legit.status);

        const afterPatch = await first(db.select().from(users).where(eq(users.id, adminCreatedUser.id)));
        check('legitimate field (name) was updated', afterPatch?.name === 'SecZ Updated', afterPatch?.name);
        check('legitimate field (role) was updated', afterPatch?.role === 'staff', afterPatch?.role);
        check('protected field (email) is unchanged', afterPatch?.email === adminCreatedEmail, afterPatch?.email);
        check('protected field (businessId) is unchanged', afterPatch?.businessId === otherBusinessId, afterPatch?.businessId);

        const badRole = await api(admin, `/api/admin/users/${adminCreatedUser.id}`, { method: 'PATCH', body: json({ role: 'kitchen' }) });
        check('operational role via admin PATCH is rejected', badRole.status === 400, badRole.status);
    } else {
        failures += 6;
        console.error('FAIL admin update tests skipped: admin-created user fixture missing');
    }

    // --- 5. Tenant identity fail-safe (OTP layer) ------------------------------
    const nullCode = await requestOtp(nullTenantEmail);
    const wrongCode = nullCode === '000000' ? '000001' : '000000';
    const wrongAttempt = await verifyOtp(nullTenantEmail, wrongCode);
    const wrongBody = await wrongAttempt.json() as { error?: string };
    check(
        'control: wrong OTP code produces its own distinct error',
        wrongAttempt.status === 400 && wrongBody.error === 'Invalid sign-in code',
        { status: wrongAttempt.status, body: wrongBody },
    );

    const nullAttempt = await verifyOtp(nullTenantEmail, nullCode);
    const nullBody = await nullAttempt.json() as { error?: string; message?: string; token?: string };
    check('missing stable businessId is rejected with HTTP 400', nullAttempt.status === 400, nullAttempt.status);
    check(
        'error body is exactly the TENANT_IDENTITY_REQUIRED contract',
        nullBody.error === TENANT_ERROR.error && nullBody.message === TENANT_ERROR.message,
        nullBody,
    );
    check('no JWT is issued', !nullBody.token, Object.keys(nullBody));
    const nullUserAfter = await first(db.select().from(users).where(eq(users.id, nullTenantUserId)));
    check('biz_main is NOT persisted to the user', nullUserAfter?.businessId === null, nullUserAfter?.businessId);

    const controlCode = await requestOtp(controlEmail);
    const controlAttempt = await verifyOtp(controlEmail, controlCode);
    const controlBody = await controlAttempt.json() as { token?: string };
    check('control: user WITH stable businessId authenticates', controlAttempt.status === 200 && Boolean(controlBody.token), controlAttempt.status);
    if (controlBody.token) {
        const payload = JSON.parse(Buffer.from(controlBody.token.split('.')[1], 'base64url').toString('utf8')) as { businessId?: string };
        check('control token carries the stable businessId', payload.businessId === businessId, payload.businessId);
    }

    // --- 6. Middleware fallback boundary ---------------------------------------
    const forged = `${owner.slice(0, -6)}AAAAAA`;
    const forgedResponse = await api(forged, '/api/restaurant/menu');
    check('forged signature is rejected before tenant resolution (401)', forgedResponse.status === 401, forgedResponse.status);

    const workspaceClaimToken = signToken({ sub: `usr_secz_ws_${suffix}`, email: 'ws@example.com', role: 'owner', businessId: '/app/restaurant' });
    const workspaceClaimResponse = await api(workspaceClaimToken, '/api/restaurant/menu');
    check('workspace-route claim is rejected (401), never resolved to a tenant', workspaceClaimResponse.status === 401, workspaceClaimResponse.status);

    // A/B: validly signed legacy token (no businessId claim), user WITH stable tenant.
    const legacyControlToken = createLegacyToken(controlUserId);
    const legacyControlResponse = await api(legacyControlToken, '/api/restaurant/menu');
    check('legacy token + verified user with stable businessId succeeds in own tenant', legacyControlResponse.status === 200, legacyControlResponse.status);

    // D: legacy token, user with NULL businessId — must not reach biz_main.
    const legacyNullToken = createLegacyToken(nullTenantUserId, 'user');
    const legacyNullResponse = await api(legacyNullToken, '/api/restaurant/menu');
    const legacyNullBody = await legacyNullResponse.json() as { error?: string; message?: string };
    check('legacy token + NULL-identity user is rejected with HTTP 400', legacyNullResponse.status === 400, legacyNullResponse.status);
    check(
        'legacy token rejection uses the TENANT_IDENTITY_REQUIRED contract',
        legacyNullBody.error === TENANT_ERROR.error && legacyNullBody.message === TENANT_ERROR.message,
        legacyNullBody,
    );

    // C: legacy token, user whose DB identity is still a workspace route — no access until re-login migrates.
    const legacyWsToken = createLegacyToken(wsUserAId);
    const legacyWsResponse = await api(legacyWsToken, '/api/restaurant/menu');
    check('legacy token + workspace-route DB identity is rejected (no biz_main default)', legacyWsResponse.status === 400, legacyWsResponse.status);

    // --- 7. ensureUserBusiness (profile layer) ---------------------------------
    const profileBody = json({ userType: 'sme', segment: 'restaurant', businessName: 'SecZ Profile', country: 'FR', currency: 'EUR' });

    const nullProfileToken = createRoleToken('owner', nullTenantUserId);
    const nullProfileResponse = await api(nullProfileToken, '/api/user/profile', { method: 'PUT', body: profileBody });
    const nullProfileBody = await nullProfileResponse.json() as { error?: string; message?: string };
    check('profile setup with NULL DB identity is rejected with HTTP 400', nullProfileResponse.status === 400, nullProfileResponse.status);
    check(
        'profile rejection uses the TENANT_IDENTITY_REQUIRED contract',
        nullProfileBody.error === TENANT_ERROR.error && nullProfileBody.message === TENANT_ERROR.message,
        nullProfileBody,
    );
    const nullUserAfterProfile = await first(db.select().from(users).where(eq(users.id, nullTenantUserId)));
    check('profile rejection persists nothing (businessId still NULL)', nullUserAfterProfile?.businessId === null, nullUserAfterProfile?.businessId);

    const wsAProfileToken = createRoleToken('owner', wsUserAId);
    const wsAProfileResponse = await api(wsAProfileToken, '/api/user/profile', { method: 'PUT', body: profileBody });
    check('legacy workspace-route user can complete profile setup', wsAProfileResponse.status === 200, wsAProfileResponse.status);
    const wsAAfter = await first(db.select().from(users).where(eq(users.id, wsUserAId)));
    const wsAFreshBiz = wsAAfter?.businessId ?? '';
    if (wsAFreshBiz) migratedBusinessIds.add(wsAFreshBiz);
    check(
        'profile migration issues a FRESH tenant, not biz_main',
        wsAFreshBiz.startsWith('biz_') && wsAFreshBiz !== 'biz_main',
        wsAFreshBiz,
    );
    const wsABusiness = wsAFreshBiz
        ? await first(db.select().from(businesses).where(eq(businesses.id, wsAFreshBiz)))
        : undefined;
    check('profile-migrated tenant is owned by the migrating user', wsABusiness?.ownerUserId === wsUserAId, wsABusiness?.ownerUserId);

    // After migration, the same legacy token resolves through the verified record.
    const legacyWsAfter = await api(createLegacyToken(wsUserAId), '/api/restaurant/menu');
    check('post-migration legacy token resolves to the user-owned tenant (200)', legacyWsAfter.status === 200, legacyWsAfter.status);

    // --- 8. OTP legacy migration (auth layer) -----------------------------------
    const wsBCode = await requestOtp(wsUserBEmail);
    const wsBLogin = await verifyOtp(wsUserBEmail, wsBCode);
    const wsBBody = await wsBLogin.json() as { token?: string };
    check('legacy workspace-route user can still log in (migration preserved)', wsBLogin.status === 200 && Boolean(wsBBody.token), wsBLogin.status);
    if (wsBBody.token) {
        const payload = JSON.parse(Buffer.from(wsBBody.token.split('.')[1], 'base64url').toString('utf8')) as { businessId?: string };
        check(
            'OTP migration JWT carries a FRESH tenant, not biz_main',
            typeof payload.businessId === 'string' && payload.businessId.startsWith('biz_') && payload.businessId !== 'biz_main',
            payload.businessId,
        );
        const wsBAfter = await first(db.select().from(users).where(eq(users.id, wsUserBId)));
        check('OTP migration persists the fresh tenant id', wsBAfter?.businessId === payload.businessId, wsBAfter?.businessId);
        if (payload.businessId) migratedBusinessIds.add(payload.businessId);
        const wsBBusiness = payload.businessId
            ? await first(db.select().from(businesses).where(eq(businesses.id, payload.businessId)))
            : undefined;
        check('OTP-migrated tenant is owned by the migrating user', wsBBusiness?.ownerUserId === wsUserBId, wsBBusiness?.ownerUserId);
    }
} finally {
    // --- Cleanup --------------------------------------------------------------
    await db.delete(quoteItems).where(eq(quoteItems.businessId, businessId));
    await db.delete(quotes).where(eq(quotes.businessId, businessId));
    await db.delete(customers).where(eq(customers.businessId, businessId));
    await db.delete(menuItems).where(eq(menuItems.businessId, businessId));
    await db.delete(menuCategories).where(eq(menuCategories.businessId, businessId));
    await db.delete(restaurantTables).where(eq(restaurantTables.businessId, businessId));
    for (const email of [nullTenantEmail, controlEmail, wsUserBEmail, adminCreatedEmail]) {
        await db.delete(otpCodes).where(eq(otpCodes.email, email));
    }
    await db.delete(users).where(eq(users.email, adminCreatedEmail));
    await db.delete(users).where(eq(users.email, staffCreatedEmail));
    for (const id of [legacyUserId, nullTenantUserId, controlUserId, wsUserAId, wsUserBId]) {
        await db.delete(users).where(eq(users.id, id));
    }
    await db.delete(businesses).where(eq(businesses.id, businessId));
    await db.delete(businesses).where(eq(businesses.id, otherBusinessId));
    for (const id of migratedBusinessIds) {
        await db.delete(businesses).where(eq(businesses.id, id));
    }
    await closeDatabase();
}

if (failures > 0) {
    console.error(`security-authz verification FAILED with ${failures} failure(s)`);
    process.exit(1);
}
console.log('security-authz verification passed');
