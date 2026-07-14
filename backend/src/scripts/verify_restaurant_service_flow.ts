import { spawn, spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { createServer } from 'net';
import { and, eq, inArray } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import {
    businesses,
    auditLogs,
    kdsTickets,
    menuCategories,
    menuItems,
    restaurantMenus,
    restaurantOrderItems,
    restaurantOrders,
    restaurantPayments,
    restaurantTables,
    users,
} from '../db/schema.js';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:restaurant-service-flow');
requireDatabaseUrl();

const { closeDatabase, db, first } = await import('../db/client.js');
const { ensureRestaurantServiceFlowSchema } = await import('../db/restaurantServiceFlowMigration.js');
const {
    canPerformRestaurantAction,
    getRestaurantNextAllowedActions,
} = await import('../services/restaurantDomain.js');

const businessId = 'biz_verify_restaurant_service_flow';
const businessBId = 'biz_verify_restaurant_service_flow_b';
const userId = 'usr_verify_restaurant_service_flow';
const userBId = 'usr_verify_restaurant_service_flow_b';
const legacyOwnerUserId = 'usr_verify_restaurant_service_flow_legacy_owner';
const genericUserId = 'usr_verify_restaurant_service_flow_generic';
const genericUserBId = 'usr_verify_restaurant_service_flow_generic_b';

const getAvailablePort = () => new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        probe.close(() => {
            if (address && typeof address === 'object') {
                resolve(address.port);
            } else {
                reject(new Error('Unable to allocate verification server port'));
            }
        });
    });
});

const port = await getAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const secret = process.env.JWT_SECRET || 'restaurant-service-flow-test-secret';
const testEnv = { ...process.env, JWT_SECRET: secret, PORT: String(port) };
const tokenCache = new Map<string, string>();
const deliveryPermissionHeaders = { 'x-forwarded-for': 'verify-restaurant-service-flow-delivery' };
const collectionPermissionHeaders = { 'x-forwarded-for': 'verify-restaurant-service-flow-collection' };
const numberingHeaders = { 'x-forwarded-for': 'verify-restaurant-service-flow-numbering' };

const createToken = async (options?: { businessId?: string; userId?: string; role?: string; email?: string }) => {
    const tokenRole = options?.role ?? 'admin';
    const tokenBusinessId = options?.businessId ?? businessId;
    const tokenUserId = options?.userId ?? userId;
    const tokenEmail = options?.email ?? `${tokenRole}-verify-restaurant-service-flow@example.com`;
    const cacheKey = JSON.stringify({ tokenBusinessId, tokenUserId, tokenRole, tokenEmail });
    const cached = tokenCache.get(cacheKey);
    if (cached) return cached;
    const now = Math.floor(Date.now() / 1000);
    const token = await sign({
        sub: tokenUserId,
        email: tokenEmail,
        role: tokenRole,
        businessId: tokenBusinessId,
        iat: now,
        exp: now + 3600,
    }, secret, 'HS256');
    tokenCache.set(cacheKey, token);
    return token;
};

const requestResponse = async (path: string, init?: RequestInit, tokenOptions?: { businessId?: string; userId?: string; role?: string; email?: string }) => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${await createToken(tokenOptions)}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as unknown : null };
};

const request = async <T>(path: string, init?: RequestInit, tokenOptions?: { businessId?: string; userId?: string; role?: string; email?: string }) => {
    const response = await requestResponse(path, init, tokenOptions);
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`${init?.method || 'GET'} ${path} failed: ${response.status} ${JSON.stringify(response.body)}`);
    }
    return response.body as T;
};

const resetFixture = async () => {
    const businessesUnderTest = [businessId, businessBId];
    const existingOrders = await db.select({ id: restaurantOrders.id }).from(restaurantOrders)
        .where(inArray(restaurantOrders.businessId, businessesUnderTest));
    const orderIds = existingOrders.map((order) => order.id);

    await db.delete(restaurantPayments).where(inArray(restaurantPayments.businessId, businessesUnderTest));
    if (orderIds.length > 0) {
        await db.delete(kdsTickets).where(inArray(kdsTickets.businessId, businessesUnderTest));
        await db.delete(restaurantOrderItems).where(inArray(restaurantOrderItems.orderId, orderIds));
        await db.delete(restaurantOrders).where(inArray(restaurantOrders.businessId, businessesUnderTest));
    }
    await db.delete(restaurantTables).where(inArray(restaurantTables.businessId, businessesUnderTest));
    await db.delete(menuItems).where(inArray(menuItems.businessId, businessesUnderTest));
    await db.delete(menuCategories).where(inArray(menuCategories.businessId, businessesUnderTest));
    await db.delete(restaurantMenus).where(inArray(restaurantMenus.businessId, businessesUnderTest));
    await db.delete(users).where(inArray(users.id, [userId, userBId, legacyOwnerUserId, genericUserId, genericUserBId]));
    await db.delete(businesses).where(inArray(businesses.id, businessesUnderTest));

    await db.insert(businesses).values([
        { id: businessId, name: 'Restaurant Service Flow Verification', type: 'restaurant', status: 'active' },
        { id: businessBId, name: 'Restaurant Service Flow Verification B', type: 'restaurant', status: 'active' },
    ]);
    await db.insert(users).values([
        { id: userId, email: 'verify-restaurant-service-flow@example.com', role: 'admin', businessId, onboardingCompleted: true },
        { id: userBId, email: 'verify-restaurant-service-flow-b@example.com', role: 'admin', businessId: businessBId, onboardingCompleted: true },
        { id: genericUserId, email: 'verify-restaurant-service-flow-generic@example.com', role: 'user', businessId, onboardingCompleted: true },
        { id: genericUserBId, email: 'verify-restaurant-service-flow-generic-b@example.com', role: 'user', businessId: businessBId, onboardingCompleted: true },
        {
            id: legacyOwnerUserId,
            email: 'verify-restaurant-service-flow-owner@example.com',
            role: 'user',
            businessId,
            userType: 'sme',
            segment: 'restaurant',
            onboardingCompleted: true,
            primaryWorkspace: '/app/restaurant',
        },
    ]);

    for (const tenantId of businessesUnderTest) {
        const prefix = tenantId === businessId ? 'flow' : 'flow_b';
        const menuId = `${prefix}_menu`;
        const categoryId = `${prefix}_category`;
        await db.insert(restaurantMenus).values({ id: menuId, businessId: tenantId, name: 'Service Flow Menu', isActive: true });
        await db.insert(menuCategories).values({ id: categoryId, businessId: tenantId, menuId, name: 'Mains', sortOrder: 0 });
        await db.insert(menuItems).values([
            { id: `${prefix}_item_1`, businessId: tenantId, categoryId, name: 'Rice Bowl', price: 1100, isAvailable: true, prepTimeMinutes: 0 },
            { id: `${prefix}_item_2`, businessId: tenantId, categoryId, name: 'Fresh Juice', price: 500, isAvailable: true, prepTimeMinutes: 0 },
        ]);
        await db.insert(restaurantTables).values([
            { id: `${prefix}_table_1`, businessId: tenantId, label: 'T1', capacity: 2, status: 'available' },
            { id: `${prefix}_table_2`, businessId: tenantId, label: 'T2', capacity: 4, status: 'available' },
        ]);
    }
};

type FlowOrder = {
    id: string;
    displayOrderNumber: string;
    visibleOrderNumber: number | null;
    orderNumberDate: string | null;
    status: string;
    tableId: string | null;
    total: number;
    orderType: 'dine_in' | 'takeaway';
    serviceStatus: string;
    paymentStatus: string;
    paymentTiming: string;
    cancellationReason: string | null;
    cancelledBy: string | null;
    cancelledAt: string | null;
};

type MatrixActorKey = 'owner' | 'admin' | 'manager' | 'waiter' | 'cashier' | 'kitchen' | 'missing' | 'unknown' | 'genericUser' | 'legacyOwner' | 'legacyOwnerCrossTenant';

const legacyOwnerUser = {
    id: legacyOwnerUserId,
    role: 'user',
    businessId,
    userType: 'sme',
    segment: 'restaurant',
    onboardingCompleted: true,
    primaryWorkspace: '/app/restaurant',
} as const;

const matrixActors = {
    owner: { userId, businessId, role: 'owner', legacyOwnerUser: null },
    admin: { userId, businessId, role: 'admin', legacyOwnerUser: null },
    manager: { userId, businessId, role: 'manager', legacyOwnerUser: null },
    waiter: { userId, businessId, role: 'waiter', legacyOwnerUser: null },
    cashier: { userId, businessId, role: 'cashier', legacyOwnerUser: null },
    kitchen: { userId, businessId, role: 'kitchen', legacyOwnerUser: null },
    missing: { userId, businessId, role: '', legacyOwnerUser: null },
    unknown: { userId, businessId, role: 'chef', legacyOwnerUser: null },
    genericUser: { userId: genericUserId, businessId, role: 'user', legacyOwnerUser: null },
    legacyOwner: { userId: legacyOwnerUserId, businessId, role: 'user', legacyOwnerUser },
    legacyOwnerCrossTenant: { userId: legacyOwnerUserId, businessId: businessBId, role: 'user', legacyOwnerUser },
} as const;

const baseOrder = {
    businessId,
    createdBy: userId,
    tableId: null,
    status: 'pending',
    orderType: 'takeaway',
    serviceStatus: 'pending',
    paymentStatus: 'unpaid',
    paymentTiming: 'pay_after_service',
} as const;

const verifyRestaurantAuthorizationDomain = () => {
    const actorKeys = Object.keys(matrixActors) as MatrixActorKey[];
    const expected: Record<string, MatrixActorKey[]> = {
        create_order_takeaway: ['owner', 'admin', 'manager', 'waiter', 'cashier', 'legacyOwner'],
        create_order_dine_in: ['owner', 'admin', 'manager', 'waiter', 'legacyOwner'],
        create_pay_now_takeaway_order: ['owner', 'admin', 'manager', 'cashier', 'legacyOwner'],
        mark_ready: ['owner', 'admin', 'manager', 'kitchen', 'legacyOwner'],
        mark_delivered: ['owner', 'admin', 'manager', 'waiter', 'legacyOwner'],
        mark_collected: ['owner', 'admin', 'manager', 'cashier', 'legacyOwner'],
        record_payment: ['owner', 'admin', 'manager', 'cashier', 'legacyOwner'],
        cancel_order_takeaway: ['owner', 'admin', 'manager', 'cashier', 'legacyOwner'],
        cancel_order_dine_in: ['owner', 'admin', 'manager', 'waiter', 'legacyOwner'],
    };
    const checks = [
        { key: 'create_order_takeaway', action: 'create_order', order: baseOrder },
        { key: 'create_order_dine_in', action: 'create_order', order: { ...baseOrder, orderType: 'dine_in', tableId: 'table_1' } },
        { key: 'create_pay_now_takeaway_order', action: 'create_pay_now_takeaway_order', order: undefined },
        { key: 'mark_ready', action: 'mark_ready', order: baseOrder },
        { key: 'mark_delivered', action: 'mark_delivered', order: { ...baseOrder, orderType: 'dine_in', tableId: 'table_1', serviceStatus: 'ready' } },
        { key: 'mark_collected', action: 'mark_collected', order: { ...baseOrder, serviceStatus: 'ready' } },
        { key: 'record_payment', action: 'record_payment', order: { ...baseOrder, serviceStatus: 'collected' } },
        { key: 'cancel_order_takeaway', action: 'cancel_order', order: baseOrder },
        { key: 'cancel_order_dine_in', action: 'cancel_order', order: { ...baseOrder, createdBy: userId, orderType: 'dine_in', tableId: 'table_1' } },
    ] as const;

    const matrix: Record<string, Record<MatrixActorKey, boolean>> = {};
    for (const check of checks) {
        matrix[check.key] = {} as Record<MatrixActorKey, boolean>;
        for (const actorKey of actorKeys) {
            const allowed = canPerformRestaurantAction(matrixActors[actorKey], check.action, check.order);
            matrix[check.key][actorKey] = allowed;
            if (allowed !== expected[check.key].includes(actorKey)) {
                throw new Error(`Authorization matrix mismatch for ${check.key}/${actorKey}: ${allowed}`);
            }
        }
    }

    const nextActions = {
        pendingKitchen: getRestaurantNextAllowedActions(matrixActors.kitchen, baseOrder),
        pendingWaiter: getRestaurantNextAllowedActions(matrixActors.waiter, baseOrder),
        readyTakeawayCashier: getRestaurantNextAllowedActions(matrixActors.cashier, { ...baseOrder, serviceStatus: 'ready' }),
        readyDineInWaiter: getRestaurantNextAllowedActions(matrixActors.waiter, { ...baseOrder, orderType: 'dine_in', tableId: 'table_1', serviceStatus: 'ready' }),
        collectedTakeawayCashier: getRestaurantNextAllowedActions(matrixActors.cashier, { ...baseOrder, serviceStatus: 'collected' }),
        deliveredDineInCashier: getRestaurantNextAllowedActions(matrixActors.cashier, { ...baseOrder, orderType: 'dine_in', tableId: 'table_1', serviceStatus: 'delivered' }),
        paid: getRestaurantNextAllowedActions(matrixActors.cashier, { ...baseOrder, serviceStatus: 'closed', paymentStatus: 'paid', status: 'closed' }),
        cancelled: getRestaurantNextAllowedActions(matrixActors.manager, { ...baseOrder, serviceStatus: 'cancelled', status: 'cancelled' }),
    };
    if (
        nextActions.pendingKitchen.join(',') !== 'mark_ready' ||
        nextActions.pendingWaiter.length !== 0 ||
        nextActions.readyTakeawayCashier.join(',') !== 'mark_collected' ||
        nextActions.readyDineInWaiter.join(',') !== 'mark_delivered' ||
        nextActions.collectedTakeawayCashier.join(',') !== 'record_payment' ||
        nextActions.deliveredDineInCashier.join(',') !== 'record_payment' ||
        nextActions.paid.length !== 0 ||
        nextActions.cancelled.length !== 0
    ) {
        throw new Error(`Next-action assertion failed: ${JSON.stringify(nextActions)}`);
    }

    return { matrix, nextActions };
};

type IntegratedPayNowResult = {
    order: FlowOrder & { payments?: unknown[] };
    payment: {
        id: string;
        method: 'cash' | 'card' | 'manual';
        amount: number;
        status: 'completed';
        paidAt: string | null;
        cashReceived?: number;
        changeDue?: number;
    };
    kitchen: {
        ticket: { id: string; order: { id: string } | null } | null;
    };
    visibleOrderNumber: number | null;
    displayOrderNumber: string;
    nextAction: 'sent_to_kitchen';
};

const firstTicketForOrder = async (orderId: string) => {
    const ticket = await first(db.select({ id: kdsTickets.id }).from(kdsTickets)
        .where(and(eq(kdsTickets.businessId, businessId), eq(kdsTickets.orderId, orderId)))
    );
    if (!ticket) throw new Error(`No KDS ticket found for ${orderId}`);
    return {
        id: ticket.id,
        order: { id: orderId, displayOrderNumber: '' },
    };
};

const markReady = async (
    orderId: string,
    tokenOptions?: { businessId?: string; userId?: string; role?: string; email?: string },
) => {
    const ticket = await firstTicketForOrder(orderId);
    const updated = await request<{ id: string; status: string; completedAt: string | null; order: { id: string; displayOrderNumber: string } | null }>(`/api/restaurant/kds/${ticket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, tokenOptions ?? { role: 'kitchen' });
    return { ticket, updated };
};

const collectOrder = async (
    orderId: string,
    tokenOptions?: { businessId?: string; userId?: string; role?: string; email?: string },
) => request<FlowOrder>(`/api/restaurant/orders/${orderId}/deliver`, {
    method: 'POST',
    headers: collectionPermissionHeaders,
    body: JSON.stringify({}),
}, tokenOptions);

const collectOrderResponse = async (
    orderId: string,
    tokenOptions?: { businessId?: string; userId?: string; role?: string; email?: string },
) => requestResponse(`/api/restaurant/orders/${orderId}/deliver`, {
    method: 'POST',
    headers: collectionPermissionHeaders,
    body: JSON.stringify({}),
}, tokenOptions);

const createKitchenReadyFixtureOrder = async (itemId: string, idempotencyKey: string) =>
    request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: idempotencyKey,
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });

const createDirectOrderFixture = async (
    tableId: string | null,
    idempotencyKey: string,
    input: {
        orderType: 'dine_in' | 'takeaway';
        status: FlowOrder['status'];
        serviceStatus: FlowOrder['serviceStatus'];
        paymentStatus?: FlowOrder['paymentStatus'];
    },
) => {
    const id = randomUUID();
    const now = new Date();
    await db.insert(restaurantOrders).values({
        id,
        businessId,
        tableId,
        status: input.status as 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'served' | 'collected' | 'closed' | 'paid' | 'cancelled',
        orderType: input.orderType,
        serviceStatus: input.serviceStatus as 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'collected' | 'closed' | 'cancelled',
        paymentStatus: (input.paymentStatus ?? 'unpaid') as 'unpaid' | 'paid' | 'refunded',
        paymentTiming: 'pay_after_service',
        idempotencyKey,
        createdBy: userId,
        total: 1100,
        createdAt: now,
        updatedAt: now,
    });
    return { id } as FlowOrder;
};

let serverOutput = '';
let server: ReturnType<typeof spawn> | undefined;

try {
    console.log('[verify:restaurant-service-flow] Restaurant domain authorization matrix...');
    const domainAuthorization = verifyRestaurantAuthorizationDomain();

    console.log('[verify:restaurant-service-flow] Ensuring service-flow columns...');
    await ensureRestaurantServiceFlowSchema();

    console.log('[verify:restaurant-service-flow] Seeding database...');
    const seed = spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed.ts'], {
        cwd: process.cwd(),
        env: testEnv,
        encoding: 'utf8',
    });
    if (seed.status !== 0) throw new Error(`Seed failed:\n${seed.stdout}\n${seed.stderr}`);

    console.log('[verify:restaurant-service-flow] Resetting isolated fixture...');
    await resetFixture();

    console.log('[verify:restaurant-service-flow] Starting API server...');
    server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
        cwd: process.cwd(),
        env: testEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', (chunk) => { serverOutput += chunk.toString(); });
    server.stderr?.on('data', (chunk) => { serverOutput += chunk.toString(); });

    let started = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/`);
            if (response.ok) {
                started = true;
                break;
            }
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
    if (!started) throw new Error(`Server did not start:\n${serverOutput}`);

    const menu = await request<{ categories: { items: { id: string }[] }[] }>('/api/restaurant/menu', undefined, { role: 'waiter' });
    const itemId = menu.categories.flatMap((category) => category.items)[0]?.id;
    const menuB = await request<{ categories: { items: { id: string }[] }[] }>('/api/restaurant/menu', undefined, { businessId: businessBId, userId: userBId, role: 'waiter' });
    const itemBId = menuB.categories.flatMap((category) => category.items)[0]?.id;
    const tables = await request<{ id: string; label: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    const table = tables.find((entry) => entry.label === 'T1');
    const table2 = tables.find((entry) => entry.label === 'T2');
    if (!itemId || !itemBId || !table || !table2) throw new Error('Fixture menu or table missing');

    console.log('[verify:restaurant-service-flow] Kitchen Ready permissions...');
    const kitchenReadyOrder = await createKitchenReadyFixtureOrder(itemId, 'flow-ready-kitchen');
    const kitchenReady = await markReady(kitchenReadyOrder.id, { role: 'kitchen' });
    const duplicateKitchenReady = await request<{ id: string; status: string; completedAt: string | null }>(`/api/restaurant/kds/${kitchenReady.ticket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'kitchen' });
    const ownerReadyOrder = await createKitchenReadyFixtureOrder(itemId, 'flow-ready-owner');
    const ownerReady = await markReady(ownerReadyOrder.id, { role: 'owner' });
    const managerReadyOrder = await createKitchenReadyFixtureOrder(itemId, 'flow-ready-manager');
    const managerReady = await markReady(managerReadyOrder.id, { role: 'manager' });
    const adminReadyOrder = await createKitchenReadyFixtureOrder(itemId, 'flow-ready-admin');
    const adminReady = await markReady(adminReadyOrder.id, { role: 'admin' });
    const legacyReadyOrder = await createKitchenReadyFixtureOrder(itemId, 'flow-ready-legacy-owner');
    const legacyOwnerReady = await markReady(legacyReadyOrder.id, {
        userId: legacyOwnerUserId,
        role: 'user',
        email: 'verify-restaurant-service-flow-owner@example.com',
    });
    const rejectedReadyOrder = await createKitchenReadyFixtureOrder(itemId, 'flow-ready-reject-matrix');
    const rejectedReadyTicket = await firstTicketForOrder(rejectedReadyOrder.id);
    const waiterReady = await requestResponse(`/api/restaurant/kds/${rejectedReadyTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'waiter' });
    const cashierReady = await requestResponse(`/api/restaurant/kds/${rejectedReadyTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'cashier' });
    const unknownReady = await requestResponse(`/api/restaurant/kds/${rejectedReadyTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'chef' });
    const missingRoleReady = await requestResponse(`/api/restaurant/kds/${rejectedReadyTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: '' });
    const genericUserReady = await requestResponse(`/api/restaurant/kds/${rejectedReadyTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { businessId: businessBId, userId: userBId, role: 'user' });
    const crossTenantReady = await requestResponse(`/api/restaurant/kds/${rejectedReadyTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { businessId: businessBId, userId: userBId, role: 'manager' });

    console.log('[verify:restaurant-service-flow] Integrated takeaway pay-now flow...');
    const payNowCash = await request<IntegratedPayNowResult>('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 20,
            idempotency_key: 'flow-pay-now-cash',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const payNowCard = await request<IntegratedPayNowResult>('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'card',
            idempotency_key: 'flow-pay-now-card',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const payNowManual = await request<IntegratedPayNowResult>('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'manual',
            idempotency_key: 'flow-pay-now-manual',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const legacyOwnerPayNow = await request<IntegratedPayNowResult>('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 20,
            idempotency_key: 'flow-pay-now-legacy-owner',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });
    const payNowDuplicateFirst = await request<IntegratedPayNowResult>('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 11,
            idempotency_key: 'flow-pay-now-duplicate',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const payNowDuplicateSecond = await request<IntegratedPayNowResult>('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 11,
            idempotency_key: 'flow-pay-now-duplicate',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const shortCashPayNow = await requestResponse('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 1,
            idempotency_key: 'flow-pay-now-short-cash',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const dineInPayNow = await requestResponse('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            table_id: table.id,
            order_type: 'dine_in',
            payment_method: 'cash',
            cash_received: 20,
            idempotency_key: 'flow-pay-now-dine-in',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const craftedDineInPayBefore = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            table_id: table.id,
            order_type: 'dine_in',
            payment_timing: 'pay_before_service',
            idempotency_key: 'flow-crafted-dine-in-pay-before',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const waiterPayNow = await requestResponse('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 20,
            idempotency_key: 'flow-pay-now-waiter',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const kitchenPayNow = await requestResponse('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 20,
            idempotency_key: 'flow-pay-now-kitchen',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'kitchen' });
    const genericUserPayNow = await requestResponse('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 20,
            idempotency_key: 'flow-pay-now-generic-user',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { userId: genericUserId, role: 'user', email: 'verify-restaurant-service-flow-generic@example.com' });
    const legacyOwnerCrossTenantPayNow = await requestResponse('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'cash',
            cash_received: 20,
            idempotency_key: 'flow-pay-now-legacy-owner-cross-tenant',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { businessId: businessBId, userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });
    const crossTenantPayNow = await requestResponse('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'card',
            idempotency_key: 'flow-pay-now-cross-tenant',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { businessId: businessBId, userId: userBId, role: 'cashier' });
    const integratedOrderIds = [payNowCash.order.id, payNowCard.order.id, payNowManual.order.id, legacyOwnerPayNow.order.id, payNowDuplicateFirst.order.id];
    const integratedOrders = await db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.businessId, businessId), inArray(restaurantOrders.id, integratedOrderIds)));
    const integratedPayments = await db.select().from(restaurantPayments)
        .where(and(eq(restaurantPayments.businessId, businessId), inArray(restaurantPayments.orderId, integratedOrderIds)));
    const integratedTickets = await db.select().from(kdsTickets)
        .where(and(eq(kdsTickets.businessId, businessId), inArray(kdsTickets.orderId, integratedOrderIds)));

    console.log('[verify:restaurant-service-flow] POS role permissions...');
    const ownerCreate = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-owner-role-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'owner' });
    const legacyOwnerCreate = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-legacy-owner-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });
    const waiterCreate = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-waiter-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const kitchenCreate = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-kitchen-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'kitchen' });
    const cashierTakeawayCreate = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-cashier-takeaway-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const cashierDineInCreate = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            table_id: table.id,
            order_type: 'dine_in',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-cashier-dine-in-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const unknownRoleCreate = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-unknown-role-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'chef' });
    const missingRoleCreate = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-missing-role-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: '' });
    const crossTenantCreate = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-cross-tenant-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { businessId: businessBId, userId: userBId, role: 'waiter' });
    const cashierCrossTenantCreate = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-cashier-cross-tenant-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { businessId: businessBId, userId: userBId, role: 'cashier' });
    const legacyRoleUserCrossTenantCreate = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-legacy-user-cross-tenant-create',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { businessId: businessBId, userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });

    console.log('[verify:restaurant-service-flow] Cancellation flow...');
    const cancelTakeaway = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-cancel-takeaway',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const cancelledTakeaway = await request<FlowOrder>(`/api/restaurant/orders/${cancelTakeaway.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Customer changed order' }),
    }, { role: 'cashier' });
    const cancelDineIn = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            table_id: table2.id,
            order_type: 'dine_in',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-cancel-dine-in',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const cancelDineInTicket = await firstTicketForOrder(cancelDineIn.id);
    const cancelledDineIn = await request<FlowOrder>(`/api/restaurant/orders/${cancelDineIn.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Guest left before preparation' }),
    }, { role: 'waiter' });
    const tableAfterCancel = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    const readyCancelled = await requestResponse(`/api/restaurant/kds/${cancelDineInTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'kitchen' });
    const deliverCancelled = await requestResponse(`/api/restaurant/orders/${cancelDineIn.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    const payCancelled = await requestResponse(`/api/restaurant/orders/${cancelDineIn.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: cancelDineIn.total / 100 }),
    }, { role: 'cashier' });
    const kitchenCancelOrder = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-kitchen-cannot-cancel',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const kitchenCancel = await requestResponse(`/api/restaurant/orders/${kitchenCancelOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Kitchen cannot cancel' }),
    }, { role: 'kitchen' });
    const crossTenantCancelOrder = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-cross-tenant-cancel',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const crossTenantCancel = await requestResponse(`/api/restaurant/orders/${crossTenantCancelOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Foreign tenant cancel attempt' }),
    }, { businessId: businessBId, userId: userBId, role: 'manager' });
    const legacyCancelOrder = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-legacy-owner-cancel',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const legacyOwnerCancelled = await request<FlowOrder>(`/api/restaurant/orders/${legacyCancelOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Legacy owner can cancel unpaid order' }),
    }, { userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });
    const genericCancelOrder = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-generic-user-cannot-cancel',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const genericUserCancel = await requestResponse(`/api/restaurant/orders/${genericCancelOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Generic user cannot cancel' }),
    }, { userId: genericUserId, role: 'user', email: 'verify-restaurant-service-flow-generic@example.com' });
    const legacyOwnerCrossTenantCancel = await requestResponse(`/api/restaurant/orders/${genericCancelOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cross tenant legacy owner cannot cancel' }),
    }, { businessId: businessBId, userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });
    const cancellationAudit = await db.select().from(auditLogs)
        .where(and(
            eq(auditLogs.businessId, businessId),
            eq(auditLogs.entityId, cancelDineIn.id),
            eq(auditLogs.action, 'RESTAURANT_ORDER_CANCELLED'),
        ));

    console.log('[verify:restaurant-service-flow] Dine-in lifecycle...');
    const dineIn = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            table_id: table.id,
            order_type: 'dine_in',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-dine-in',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const duplicateCreate = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            table_id: table.id,
            order_type: 'dine_in',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-dine-in',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const tableAfterCreate = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    const dineInReadyTicket = await markReady(dineIn.id);
    const duplicateReady = await request<{ id: string; status: string; completedAt: string | null }>(`/api/restaurant/kds/${dineInReadyTicket.ticket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'kitchen' });
    const readyDineIn = (await request<FlowOrder[]>('/api/restaurant/orders', undefined, { role: 'waiter' }))
        .find((order) => order.id === dineIn.id);
    if (!readyDineIn) throw new Error('Ready dine-in order was not returned');
    const invalidEarlyPayment = await requestResponse(`/api/restaurant/orders/${dineIn.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: dineIn.total / 100 }),
    }, { role: 'cashier' });
    const delivered = await request<FlowOrder>(`/api/restaurant/orders/${dineIn.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    const tableAfterDelivered = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    const waiterPayment = await requestResponse(`/api/restaurant/orders/${dineIn.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: dineIn.total / 100 }),
    }, { role: 'waiter' });
    const kitchenPayment = await requestResponse(`/api/restaurant/orders/${dineIn.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: dineIn.total / 100 }),
    }, { role: 'kitchen' });
    const paidDineIn = await request<FlowOrder>(`/api/restaurant/orders/${dineIn.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: dineIn.total / 100 }),
    }, { role: 'cashier' });
    const duplicatePayment = await requestResponse(`/api/restaurant/orders/${dineIn.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: dineIn.total / 100 }),
    }, { role: 'cashier' });
    const tableAfterPaid = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    const duplicateDelivery = await request<FlowOrder>(`/api/restaurant/orders/${dineIn.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'waiter' });

    console.log('[verify:restaurant-service-flow] Dine-in delivery permissions...');
    const ownerDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-owner', {
        orderType: 'dine_in',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const ownerDelivered = await request<FlowOrder>(`/api/restaurant/orders/${ownerDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'owner' });
    const managerDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-manager', {
        orderType: 'dine_in',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const managerDelivered = await request<FlowOrder>(`/api/restaurant/orders/${managerDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'manager' });
    const adminDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-admin', {
        orderType: 'dine_in',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const adminDelivered = await request<FlowOrder>(`/api/restaurant/orders/${adminDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'admin' });
    const legacyOwnerDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-legacy-owner', {
        orderType: 'dine_in',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const legacyOwnerDelivered = await request<FlowOrder>(`/api/restaurant/orders/${legacyOwnerDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, {
        userId: legacyOwnerUserId,
        role: 'user',
        email: 'verify-restaurant-service-flow-owner@example.com',
    });
    const rejectedDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-reject-matrix', {
        orderType: 'dine_in',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const cashierDeliver = await requestResponse(`/api/restaurant/orders/${rejectedDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'cashier' });
    const kitchenDeliver = await requestResponse(`/api/restaurant/orders/${rejectedDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'kitchen' });
    const unknownDeliver = await requestResponse(`/api/restaurant/orders/${rejectedDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'chef' });
    const missingRoleDeliver = await requestResponse(`/api/restaurant/orders/${rejectedDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: '' });
    const genericUserOtherBusinessDeliver = await requestResponse(`/api/restaurant/orders/${rejectedDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { businessId: businessBId, userId: genericUserBId, role: 'user', email: 'verify-restaurant-service-flow-generic-b@example.com' });
    const crossTenantDeliver = await requestResponse(`/api/restaurant/orders/${rejectedDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { businessId: businessBId, userId: userBId, role: 'manager' });
    const nonReadyDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-non-ready', {
        orderType: 'dine_in',
        status: 'pending',
        serviceStatus: 'pending',
    });
    const nonReadyDeliver = await requestResponse(`/api/restaurant/orders/${nonReadyDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    const paidInvalidDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-paid-invalid-state', {
        orderType: 'dine_in',
        status: 'ready',
        serviceStatus: 'ready',
        paymentStatus: 'paid',
    });
    const paidInvalidDeliver = await requestResponse(`/api/restaurant/orders/${paidInvalidDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    const closedDeliveryOrder = await createDirectOrderFixture(table.id, 'flow-deliver-closed', {
        orderType: 'dine_in',
        status: 'closed',
        serviceStatus: 'closed',
    });
    const closedDeliver = await requestResponse(`/api/restaurant/orders/${closedDeliveryOrder.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    const readyTakeawayForWaiter = await createDirectOrderFixture(null, 'flow-deliver-ready-takeaway-waiter', {
        orderType: 'takeaway',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const takeawayViaDineInDeliver = await requestResponse(`/api/restaurant/orders/${readyTakeawayForWaiter.id}/deliver`, {
        method: 'POST',
        headers: deliveryPermissionHeaders,
        body: JSON.stringify({}),
    }, { role: 'waiter' });

    console.log('[verify:restaurant-service-flow] Takeaway collection permissions...');
    const cashierCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-cashier', {
        orderType: 'takeaway',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const cashierCollected = await collectOrder(cashierCollectionOrder.id, { role: 'cashier' });
    const duplicateCollection = await collectOrderResponse(cashierCollectionOrder.id, { role: 'cashier' });
    const ownerCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-owner', {
        orderType: 'takeaway',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const ownerCollected = await collectOrder(ownerCollectionOrder.id, { role: 'owner' });
    const managerCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-manager', {
        orderType: 'takeaway',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const managerCollected = await collectOrder(managerCollectionOrder.id, { role: 'manager' });
    const adminCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-admin', {
        orderType: 'takeaway',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const adminCollected = await collectOrder(adminCollectionOrder.id, { role: 'admin' });
    const legacyOwnerCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-legacy-owner', {
        orderType: 'takeaway',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const legacyOwnerCollected = await collectOrder(legacyOwnerCollectionOrder.id, {
        userId: legacyOwnerUserId,
        role: 'user',
        email: 'verify-restaurant-service-flow-owner@example.com',
    });
    const rejectedCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-reject-matrix', {
        orderType: 'takeaway',
        status: 'ready',
        serviceStatus: 'ready',
    });
    const waiterCollectReady = await collectOrderResponse(rejectedCollectionOrder.id, { role: 'waiter' });
    const kitchenCollectReady = await collectOrderResponse(rejectedCollectionOrder.id, { role: 'kitchen' });
    const unknownCollectReady = await collectOrderResponse(rejectedCollectionOrder.id, { role: 'chef' });
    const missingRoleCollectReady = await collectOrderResponse(rejectedCollectionOrder.id, { role: '' });
    const genericUserCollectReady = await collectOrderResponse(rejectedCollectionOrder.id, { userId: genericUserId, role: 'user', email: 'verify-restaurant-service-flow-generic@example.com' });
    const genericUserOtherBusinessCollect = await collectOrderResponse(rejectedCollectionOrder.id, { businessId: businessBId, userId: genericUserBId, role: 'user', email: 'verify-restaurant-service-flow-generic-b@example.com' });
    const crossTenantCollect = await collectOrderResponse(rejectedCollectionOrder.id, { businessId: businessBId, userId: userBId, role: 'manager' });
    const dineInThroughCollection = await collectOrderResponse(rejectedDeliveryOrder.id, { role: 'cashier' });
    const cancelledCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-cancelled', {
        orderType: 'takeaway',
        status: 'cancelled',
        serviceStatus: 'cancelled',
    });
    const cancelledCollect = await collectOrderResponse(cancelledCollectionOrder.id, { role: 'cashier' });
    const closedCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-closed', {
        orderType: 'takeaway',
        status: 'closed',
        serviceStatus: 'closed',
    });
    const closedCollect = await collectOrderResponse(closedCollectionOrder.id, { role: 'cashier' });
    const nonReadyCollectionOrder = await createDirectOrderFixture(null, 'flow-collect-non-ready', {
        orderType: 'takeaway',
        status: 'pending',
        serviceStatus: 'pending',
    });
    const nonReadyCollect = await collectOrderResponse(nonReadyCollectionOrder.id, { role: 'cashier' });

    console.log('[verify:restaurant-service-flow] Takeaway pay-before lifecycle...');
    const takeawayBefore = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_before_service',
            idempotency_key: 'flow-takeaway-before',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const paidBeforeKitchen = await request<FlowOrder>(`/api/restaurant/orders/${takeawayBefore.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'card', amount: takeawayBefore.total / 100 }),
    }, { role: 'cashier' });
    const paidOrderCancel = await requestResponse(`/api/restaurant/orders/${takeawayBefore.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Paid orders cannot cancel' }),
    }, { role: 'manager' });
    await markReady(takeawayBefore.id);
    const readyBefore = (await request<FlowOrder[]>('/api/restaurant/orders', undefined, { role: 'waiter' }))
        .find((order) => order.id === takeawayBefore.id);
    if (!readyBefore) throw new Error('Ready pay-before takeaway order was not returned');
    const collectedBefore = await request<FlowOrder>(`/api/restaurant/orders/${takeawayBefore.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'cashier' });

    console.log('[verify:restaurant-service-flow] Takeaway pay-after lifecycle...');
    const takeawayAfter = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-takeaway-after',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const invalidTakeawayPayment = await requestResponse(`/api/restaurant/orders/${takeawayAfter.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: takeawayAfter.total / 100 }),
    }, { role: 'cashier' });
    await markReady(takeawayAfter.id);
    const readyAfter = (await request<FlowOrder[]>('/api/restaurant/orders', undefined, { role: 'waiter' }))
        .find((order) => order.id === takeawayAfter.id);
    if (!readyAfter) throw new Error('Ready pay-after takeaway order was not returned');
    const collectedAfter = await request<FlowOrder>(`/api/restaurant/orders/${takeawayAfter.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'cashier' });
    const paidAfter = await request<FlowOrder>(`/api/restaurant/orders/${takeawayAfter.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'mobile', amount: takeawayAfter.total / 100 }),
    }, { role: 'cashier' });
    const legacyPaymentOrder = await createDirectOrderFixture(null, 'flow-legacy-owner-record-payment', {
        orderType: 'takeaway',
        status: 'collected',
        serviceStatus: 'collected',
    });
    const legacyOwnerPayment = await request<FlowOrder>(`/api/restaurant/orders/${legacyPaymentOrder.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: 11 }),
    }, { userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });
    const genericPaymentOrder = await createDirectOrderFixture(null, 'flow-generic-user-record-payment', {
        orderType: 'takeaway',
        status: 'collected',
        serviceStatus: 'collected',
    });
    const genericUserPayment = await requestResponse(`/api/restaurant/orders/${genericPaymentOrder.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: 11 }),
    }, { userId: genericUserId, role: 'user', email: 'verify-restaurant-service-flow-generic@example.com' });
    const legacyOwnerCrossTenantPayment = await requestResponse(`/api/restaurant/orders/${genericPaymentOrder.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: 11 }),
    }, { businessId: businessBId, userId: legacyOwnerUserId, role: 'user', email: 'verify-restaurant-service-flow-owner@example.com' });

    console.log('[verify:restaurant-service-flow] Cross-tenant and invalid transitions...');
    const foreignDeliver = await requestResponse(`/api/restaurant/orders/${dineIn.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { businessId: businessBId, userId: userBId, role: 'waiter' });
    const invalidJumpOrder = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-invalid-jump',
            items: [{ menu_item_id: itemId, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const invalidJump = await requestResponse(`/api/restaurant/orders/${invalidJumpOrder.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    const waiterCollectTakeaway = await requestResponse(`/api/restaurant/orders/${invalidJumpOrder.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'waiter' });

    console.log('[verify:restaurant-service-flow] Visible order numbering...');
    const tenantBOrder = await request<FlowOrder>('/api/restaurant/orders', {
        method: 'POST',
        headers: numberingHeaders,
        body: JSON.stringify({
            order_type: 'takeaway',
            payment_timing: 'pay_after_service',
            idempotency_key: 'flow-tenant-b-visible-number',
            items: [{ menu_item_id: itemBId, quantity: 1 }],
        }),
    }, { businessId: businessBId, userId: userBId, role: 'waiter' });
    const concurrentOrders = await Promise.all(Array.from({ length: 5 }, (_, index) =>
        request<FlowOrder>('/api/restaurant/orders', {
            method: 'POST',
            headers: numberingHeaders,
            body: JSON.stringify({
                order_type: 'takeaway',
                payment_timing: 'pay_after_service',
                idempotency_key: `flow-concurrent-${index}`,
                items: [{ menu_item_id: itemId, quantity: 1 }],
            }),
        }, { role: 'waiter' }),
    ));
    const numberedOrders = await request<FlowOrder[]>('/api/restaurant/orders', { headers: numberingHeaders }, { role: 'waiter' });
    const tenantBNumbers = await request<FlowOrder[]>('/api/restaurant/orders', { headers: numberingHeaders }, { businessId: businessBId, userId: userBId, role: 'waiter' });
    const tenantNumbers = numberedOrders
        .map((order) => order.visibleOrderNumber)
        .filter((number): number is number => typeof number === 'number');
    const orderNumberDisplays = numberedOrders.map((order) => order.displayOrderNumber);
    const concurrentNumbers = concurrentOrders.map((order) => order.visibleOrderNumber);
    const uniqueTenantNumbers = new Set(tenantNumbers);
    const uniqueConcurrentNumbers = new Set(concurrentNumbers);
    const kitchenPayload = await request<{ order: Record<string, unknown> | null }[]>('/api/restaurant/kds', { headers: numberingHeaders }, { role: 'kitchen' });
    const kitchenOrder = kitchenPayload.find((ticket) => ticket.order)?.order;

    const payments = await db.select().from(restaurantPayments)
        .where(and(eq(restaurantPayments.businessId, businessId), inArray(restaurantPayments.orderId, [dineIn.id, takeawayBefore.id, takeawayAfter.id])));
    const result = {
        domainAuthorization,
        dineIn: {
            statuses: [dineIn.serviceStatus, readyDineIn.serviceStatus, delivered.serviceStatus, paidDineIn.serviceStatus],
            paymentStatus: paidDineIn.paymentStatus,
            finalStatus: paidDineIn.status,
            visibleOrderNumber: dineIn.displayOrderNumber,
            tableAfterCreate: tableAfterCreate.find((entry) => entry.id === table.id)?.status,
            tableAfterDelivered: tableAfterDelivered.find((entry) => entry.id === table.id)?.status,
            tableAfterPaid: tableAfterPaid.find((entry) => entry.id === table.id)?.status,
        },
        takeawayPayBefore: {
            tableId: takeawayBefore.tableId,
            paymentAfterEarlyPayment: paidBeforeKitchen.paymentStatus,
            serviceAfterReady: readyBefore.serviceStatus,
            serviceAfterCollect: collectedBefore.serviceStatus,
            finalStatus: collectedBefore.status,
        },
        takeawayPayAfter: {
            invalidEarlyPaymentStatus: invalidTakeawayPayment.status,
            serviceAfterReady: readyAfter.serviceStatus,
            serviceAfterCollect: collectedAfter.serviceStatus,
            paymentStatus: paidAfter.paymentStatus,
            finalStatus: paidAfter.status,
        },
        guards: {
            ownerCreateStatus: ownerCreate.serviceStatus,
            legacyOwnerCreateStatus: legacyOwnerCreate.serviceStatus,
            waiterCreateStatus: waiterCreate.serviceStatus,
            kitchenCreateStatus: kitchenCreate.status,
            cashierTakeawayCreateStatus: cashierTakeawayCreate.serviceStatus,
            cashierTakeawayTableId: cashierTakeawayCreate.tableId,
            cashierDineInCreateStatus: cashierDineInCreate.status,
            unknownRoleCreateStatus: unknownRoleCreate.status,
            missingRoleCreateStatus: missingRoleCreate.status,
            crossTenantCreateStatus: crossTenantCreate.status,
            cashierCrossTenantCreateStatus: cashierCrossTenantCreate.status,
            legacyRoleUserCrossTenantCreateStatus: legacyRoleUserCrossTenantCreate.status,
            createForbiddenMessage: kitchenCreate.body,
            invalidEarlyDineInPaymentStatus: invalidEarlyPayment.status,
            invalidJumpStatus: invalidJump.status,
            waiterCollectTakeawayStatus: waiterCollectTakeaway.status,
            foreignDeliverStatus: foreignDeliver.status,
            duplicateOrderSameId: duplicateCreate.id === dineIn.id,
            duplicateReadyStatus: duplicateReady.status,
            duplicatePaymentStatus: duplicatePayment.status,
            waiterPaymentStatus: waiterPayment.status,
            kitchenPaymentStatus: kitchenPayment.status,
            legacyOwnerPaymentStatus: legacyOwnerPayment.paymentStatus,
            legacyOwnerPaymentFinalStatus: legacyOwnerPayment.status,
            genericUserPaymentStatus: genericUserPayment.status,
            legacyOwnerCrossTenantPaymentStatus: legacyOwnerCrossTenantPayment.status,
            paymentCount: payments.length,
        },
        deliveryPermissions: {
            waiterStatus: delivered.serviceStatus,
            ownerStatus: ownerDelivered.serviceStatus,
            managerStatus: managerDelivered.serviceStatus,
            adminStatus: adminDelivered.serviceStatus,
            legacyOwnerStatus: legacyOwnerDelivered.serviceStatus,
            legacyOwnerOrderId: legacyOwnerDelivered.id,
            cashierStatus: cashierDeliver.status,
            kitchenStatus: kitchenDeliver.status,
            unknownStatus: unknownDeliver.status,
            missingRoleStatus: missingRoleDeliver.status,
            genericUserOtherBusinessStatus: genericUserOtherBusinessDeliver.status,
            crossTenantStatus: crossTenantDeliver.status,
            takeawayViaDineInDeliverStatus: takeawayViaDineInDeliver.status,
            cancelledStatus: deliverCancelled.status,
            paidInvalidStateStatus: paidInvalidDeliver.status,
            closedStatus: closedDeliver.status,
            nonReadyStatus: nonReadyDeliver.status,
            duplicateDeliveryStatus: duplicateDelivery.serviceStatus,
            duplicateDeliveryOrderId: duplicateDelivery.id,
        },
        collectionPermissions: {
            cashierStatus: cashierCollected.serviceStatus,
            cashierFinalStatus: cashierCollected.status,
            ownerStatus: ownerCollected.serviceStatus,
            managerStatus: managerCollected.serviceStatus,
            adminStatus: adminCollected.serviceStatus,
            legacyOwnerStatus: legacyOwnerCollected.serviceStatus,
            legacyOwnerOrderId: legacyOwnerCollected.id,
            waiterStatus: waiterCollectReady.status,
            kitchenStatus: kitchenCollectReady.status,
            unknownStatus: unknownCollectReady.status,
            missingRoleStatus: missingRoleCollectReady.status,
            genericUserStatus: genericUserCollectReady.status,
            genericUserOtherBusinessStatus: genericUserOtherBusinessCollect.status,
            crossTenantStatus: crossTenantCollect.status,
            dineInThroughCollectionStatus: dineInThroughCollection.status,
            cancelledStatus: cancelledCollect.status,
            closedStatus: closedCollect.status,
            nonReadyStatus: nonReadyCollect.status,
            duplicateCollectionStatus: duplicateCollection.status,
        },
        kitchenReadyPermissions: {
            kitchenStatus: kitchenReady.updated.status,
            ownerStatus: ownerReady.updated.status,
            managerStatus: managerReady.updated.status,
            adminStatus: adminReady.updated.status,
            legacyOwnerStatus: legacyOwnerReady.updated.status,
            legacyOwnerOrderId: legacyOwnerReady.updated.order?.id,
            waiterStatus: waiterReady.status,
            cashierStatus: cashierReady.status,
            unknownStatus: unknownReady.status,
            missingRoleStatus: missingRoleReady.status,
            genericUserOtherBusinessStatus: genericUserReady.status,
            crossTenantStatus: crossTenantReady.status,
            duplicateReadyStatus: duplicateKitchenReady.status,
        },
        integratedPayNow: {
            cash: {
                orderType: payNowCash.order.orderType,
                serviceStatus: payNowCash.order.serviceStatus,
                paymentStatus: payNowCash.order.paymentStatus,
                paymentTiming: payNowCash.order.paymentTiming,
                method: payNowCash.payment.method,
                amount: payNowCash.payment.amount,
                cashReceived: payNowCash.payment.cashReceived,
                changeDue: payNowCash.payment.changeDue,
                ticketOrderId: payNowCash.kitchen.ticket?.order?.id,
                nextAction: payNowCash.nextAction,
                displayOrderNumber: payNowCash.displayOrderNumber,
            },
            card: {
                paymentStatus: payNowCard.order.paymentStatus,
                method: payNowCard.payment.method,
                cashReceivedPresent: 'cashReceived' in payNowCard.payment,
            },
            manual: {
                paymentStatus: payNowManual.order.paymentStatus,
                method: payNowManual.payment.method,
                cashReceivedPresent: 'cashReceived' in payNowManual.payment,
            },
            legacyOwner: {
                orderType: legacyOwnerPayNow.order.orderType,
                paymentStatus: legacyOwnerPayNow.order.paymentStatus,
                method: legacyOwnerPayNow.payment.method,
                ticketOrderId: legacyOwnerPayNow.kitchen.ticket?.order?.id,
            },
            duplicateSameOrder: payNowDuplicateFirst.order.id === payNowDuplicateSecond.order.id,
            duplicateSamePayment: payNowDuplicateFirst.payment.id === payNowDuplicateSecond.payment.id,
            shortCashStatus: shortCashPayNow.status,
            dineInPayNowStatus: dineInPayNow.status,
            craftedDineInPayBeforeStatus: craftedDineInPayBefore.status,
            waiterStatus: waiterPayNow.status,
            kitchenStatus: kitchenPayNow.status,
            genericUserStatus: genericUserPayNow.status,
            legacyOwnerCrossTenantStatus: legacyOwnerCrossTenantPayNow.status,
            crossTenantStatus: crossTenantPayNow.status,
            exactOrderCount: integratedOrders.length,
            exactPaymentCount: integratedPayments.length,
            exactTicketCount: integratedTickets.length,
        },
        cancellation: {
            cashierTakeawayStatus: cancelledTakeaway.status,
            cashierTakeawayServiceStatus: cancelledTakeaway.serviceStatus,
            cashierTakeawayReason: cancelledTakeaway.cancellationReason,
            dineInStatus: cancelledDineIn.status,
            dineInServiceStatus: cancelledDineIn.serviceStatus,
            dineInCancelledBySet: typeof cancelledDineIn.cancelledBy === 'string' && cancelledDineIn.cancelledBy.length > 0,
            dineInCancelledAtSet: typeof cancelledDineIn.cancelledAt === 'string' && cancelledDineIn.cancelledAt.length > 0,
            tableAfterCancel: tableAfterCancel.find((entry) => entry.id === table2.id)?.status,
            readyCancelledStatus: readyCancelled.status,
            deliverCancelledStatus: deliverCancelled.status,
            payCancelledStatus: payCancelled.status,
            paidOrderCancelStatus: paidOrderCancel.status,
            kitchenCancelStatus: kitchenCancel.status,
            crossTenantCancelStatus: crossTenantCancel.status,
            legacyOwnerStatus: legacyOwnerCancelled.status,
            legacyOwnerServiceStatus: legacyOwnerCancelled.serviceStatus,
            legacyOwnerCancelledBy: legacyOwnerCancelled.cancelledBy,
            genericUserStatus: genericUserCancel.status,
            legacyOwnerCrossTenantStatus: legacyOwnerCrossTenantCancel.status,
            auditCount: cancellationAudit.length,
            auditTenantScoped: cancellationAudit.every((entry) => entry.businessId === businessId),
        },
        numbering: {
            firstOrderNumber: ownerCreate.displayOrderNumber,
            tenantBOrderNumber: tenantBOrder.displayOrderNumber,
            tenantBNumbersStartAtOne: tenantBNumbers.some((order) => order.id === tenantBOrder.id && order.visibleOrderNumber === 1),
            noTenantDuplicates: uniqueTenantNumbers.size === tenantNumbers.length,
            concurrentNumbers,
            noConcurrentDuplicates: uniqueConcurrentNumbers.size === concurrentNumbers.length,
            orderNumberDisplays,
            noUuidFragments: orderNumberDisplays.every((displayOrderNumber) => (
                /^#\d+$/.test(displayOrderNumber) ||
                displayOrderNumber === 'Order pending number'
            )),
        },
        kitchenPayload: {
            hidesPaymentStatus: kitchenOrder ? !('paymentStatus' in kitchenOrder) : true,
            hidesPayments: kitchenOrder ? !('payments' in kitchenOrder) : true,
            hidesTotal: kitchenOrder ? !('total' in kitchenOrder) : true,
        },
    };

    if (
        result.dineIn.statuses.join(',') !== 'pending,ready,delivered,delivered' ||
        result.dineIn.paymentStatus !== 'paid' ||
        result.dineIn.finalStatus !== 'paid' ||
        result.dineIn.tableAfterCreate !== 'occupied' ||
        result.dineIn.tableAfterDelivered !== 'occupied' ||
        result.dineIn.tableAfterPaid !== 'available' ||
        result.takeawayPayBefore.tableId !== null ||
        result.takeawayPayBefore.paymentAfterEarlyPayment !== 'paid' ||
        result.takeawayPayBefore.serviceAfterReady !== 'ready' ||
        result.takeawayPayBefore.serviceAfterCollect !== 'collected' ||
        result.takeawayPayBefore.finalStatus !== 'closed' ||
        result.takeawayPayAfter.invalidEarlyPaymentStatus !== 409 ||
        result.takeawayPayAfter.serviceAfterReady !== 'ready' ||
        result.takeawayPayAfter.serviceAfterCollect !== 'collected' ||
        result.takeawayPayAfter.paymentStatus !== 'paid' ||
        result.takeawayPayAfter.finalStatus !== 'closed' ||
        result.guards.ownerCreateStatus !== 'pending' ||
        result.guards.legacyOwnerCreateStatus !== 'pending' ||
        result.guards.waiterCreateStatus !== 'pending' ||
        result.guards.kitchenCreateStatus !== 403 ||
        result.guards.cashierTakeawayCreateStatus !== 'pending' ||
        result.guards.cashierTakeawayTableId !== null ||
        result.guards.cashierDineInCreateStatus !== 403 ||
        result.guards.unknownRoleCreateStatus !== 403 ||
        result.guards.missingRoleCreateStatus !== 403 ||
        result.guards.crossTenantCreateStatus !== 404 ||
        result.guards.cashierCrossTenantCreateStatus !== 404 ||
        result.guards.legacyRoleUserCrossTenantCreateStatus !== 403 ||
        result.guards.invalidEarlyDineInPaymentStatus !== 409 ||
        result.guards.invalidJumpStatus !== 403 ||
        result.guards.waiterCollectTakeawayStatus !== 403 ||
        result.guards.foreignDeliverStatus !== 404 ||
        !result.guards.duplicateOrderSameId ||
        result.guards.duplicateReadyStatus !== 'done' ||
        result.guards.duplicatePaymentStatus !== 409 ||
        result.guards.waiterPaymentStatus !== 403 ||
        result.guards.kitchenPaymentStatus !== 403 ||
        result.guards.legacyOwnerPaymentStatus !== 'paid' ||
        result.guards.legacyOwnerPaymentFinalStatus !== 'closed' ||
        result.guards.genericUserPaymentStatus !== 403 ||
        result.guards.legacyOwnerCrossTenantPaymentStatus !== 403 ||
        result.guards.paymentCount !== 3 ||
        result.deliveryPermissions.waiterStatus !== 'delivered' ||
        result.deliveryPermissions.ownerStatus !== 'delivered' ||
        result.deliveryPermissions.managerStatus !== 'delivered' ||
        result.deliveryPermissions.adminStatus !== 'delivered' ||
        result.deliveryPermissions.legacyOwnerStatus !== 'delivered' ||
        result.deliveryPermissions.legacyOwnerOrderId !== legacyOwnerDeliveryOrder.id ||
        result.deliveryPermissions.cashierStatus !== 403 ||
        result.deliveryPermissions.kitchenStatus !== 403 ||
        result.deliveryPermissions.unknownStatus !== 403 ||
        result.deliveryPermissions.missingRoleStatus !== 403 ||
        result.deliveryPermissions.genericUserOtherBusinessStatus !== 404 ||
        result.deliveryPermissions.crossTenantStatus !== 404 ||
        result.deliveryPermissions.takeawayViaDineInDeliverStatus !== 403 ||
        result.deliveryPermissions.cancelledStatus !== 409 ||
        result.deliveryPermissions.paidInvalidStateStatus !== 409 ||
        result.deliveryPermissions.closedStatus !== 409 ||
        result.deliveryPermissions.nonReadyStatus !== 409 ||
        result.deliveryPermissions.duplicateDeliveryStatus !== 'delivered' ||
        result.deliveryPermissions.duplicateDeliveryOrderId !== dineIn.id ||
        result.collectionPermissions.cashierStatus !== 'collected' ||
        result.collectionPermissions.cashierFinalStatus !== 'collected' ||
        result.collectionPermissions.ownerStatus !== 'collected' ||
        result.collectionPermissions.managerStatus !== 'collected' ||
        result.collectionPermissions.adminStatus !== 'collected' ||
        result.collectionPermissions.legacyOwnerStatus !== 'collected' ||
        result.collectionPermissions.legacyOwnerOrderId !== legacyOwnerCollectionOrder.id ||
        result.collectionPermissions.waiterStatus !== 403 ||
        result.collectionPermissions.kitchenStatus !== 403 ||
        result.collectionPermissions.unknownStatus !== 403 ||
        result.collectionPermissions.missingRoleStatus !== 403 ||
        result.collectionPermissions.genericUserStatus !== 403 ||
        result.collectionPermissions.genericUserOtherBusinessStatus !== 404 ||
        result.collectionPermissions.crossTenantStatus !== 404 ||
        result.collectionPermissions.dineInThroughCollectionStatus !== 403 ||
        result.collectionPermissions.cancelledStatus !== 409 ||
        result.collectionPermissions.closedStatus !== 409 ||
        result.collectionPermissions.nonReadyStatus !== 409 ||
        result.collectionPermissions.duplicateCollectionStatus !== 409 ||
        result.kitchenReadyPermissions.kitchenStatus !== 'done' ||
        result.kitchenReadyPermissions.ownerStatus !== 'done' ||
        result.kitchenReadyPermissions.managerStatus !== 'done' ||
        result.kitchenReadyPermissions.adminStatus !== 'done' ||
        result.kitchenReadyPermissions.legacyOwnerStatus !== 'done' ||
        result.kitchenReadyPermissions.legacyOwnerOrderId !== legacyReadyOrder.id ||
        result.kitchenReadyPermissions.waiterStatus !== 403 ||
        result.kitchenReadyPermissions.cashierStatus !== 403 ||
        result.kitchenReadyPermissions.unknownStatus !== 403 ||
        result.kitchenReadyPermissions.missingRoleStatus !== 403 ||
        result.kitchenReadyPermissions.genericUserOtherBusinessStatus !== 404 ||
        result.kitchenReadyPermissions.crossTenantStatus !== 404 ||
        result.kitchenReadyPermissions.duplicateReadyStatus !== 'done' ||
        result.integratedPayNow.cash.orderType !== 'takeaway' ||
        result.integratedPayNow.cash.serviceStatus !== 'pending' ||
        result.integratedPayNow.cash.paymentStatus !== 'paid' ||
        result.integratedPayNow.cash.paymentTiming !== 'pay_before_service' ||
        result.integratedPayNow.cash.method !== 'cash' ||
        result.integratedPayNow.cash.amount !== payNowCash.order.total / 100 ||
        result.integratedPayNow.cash.cashReceived !== 20 ||
        result.integratedPayNow.cash.changeDue !== 20 - (payNowCash.order.total / 100) ||
        result.integratedPayNow.cash.ticketOrderId !== payNowCash.order.id ||
        result.integratedPayNow.cash.nextAction !== 'sent_to_kitchen' ||
        !/^#\d+$/.test(result.integratedPayNow.cash.displayOrderNumber) ||
        result.integratedPayNow.card.paymentStatus !== 'paid' ||
        result.integratedPayNow.card.method !== 'card' ||
        result.integratedPayNow.card.cashReceivedPresent ||
        result.integratedPayNow.manual.paymentStatus !== 'paid' ||
        result.integratedPayNow.manual.method !== 'manual' ||
        result.integratedPayNow.manual.cashReceivedPresent ||
        result.integratedPayNow.legacyOwner.orderType !== 'takeaway' ||
        result.integratedPayNow.legacyOwner.paymentStatus !== 'paid' ||
        result.integratedPayNow.legacyOwner.method !== 'cash' ||
        result.integratedPayNow.legacyOwner.ticketOrderId !== legacyOwnerPayNow.order.id ||
        !result.integratedPayNow.duplicateSameOrder ||
        !result.integratedPayNow.duplicateSamePayment ||
        result.integratedPayNow.shortCashStatus !== 400 ||
        result.integratedPayNow.dineInPayNowStatus !== 409 ||
        result.integratedPayNow.craftedDineInPayBeforeStatus !== 409 ||
        result.integratedPayNow.waiterStatus !== 403 ||
        result.integratedPayNow.kitchenStatus !== 403 ||
        result.integratedPayNow.genericUserStatus !== 403 ||
        result.integratedPayNow.legacyOwnerCrossTenantStatus !== 403 ||
        result.integratedPayNow.crossTenantStatus !== 404 ||
        result.integratedPayNow.exactOrderCount !== 5 ||
        result.integratedPayNow.exactPaymentCount !== 5 ||
        result.integratedPayNow.exactTicketCount !== 5 ||
        result.cancellation.cashierTakeawayStatus !== 'cancelled' ||
        result.cancellation.cashierTakeawayServiceStatus !== 'cancelled' ||
        result.cancellation.cashierTakeawayReason !== 'Customer changed order' ||
        result.cancellation.dineInStatus !== 'cancelled' ||
        result.cancellation.dineInServiceStatus !== 'cancelled' ||
        !result.cancellation.dineInCancelledBySet ||
        !result.cancellation.dineInCancelledAtSet ||
        result.cancellation.tableAfterCancel !== 'available' ||
        result.cancellation.readyCancelledStatus !== 409 ||
        result.cancellation.deliverCancelledStatus !== 409 ||
        result.cancellation.payCancelledStatus !== 409 ||
        result.cancellation.paidOrderCancelStatus !== 409 ||
        result.cancellation.kitchenCancelStatus !== 403 ||
        result.cancellation.crossTenantCancelStatus !== 404 ||
        result.cancellation.legacyOwnerStatus !== 'cancelled' ||
        result.cancellation.legacyOwnerServiceStatus !== 'cancelled' ||
        result.cancellation.legacyOwnerCancelledBy !== legacyOwnerUserId ||
        result.cancellation.genericUserStatus !== 403 ||
        result.cancellation.legacyOwnerCrossTenantStatus !== 404 ||
        result.cancellation.auditCount < 1 ||
        !result.cancellation.auditTenantScoped ||
        !/^#\d+$/.test(result.numbering.firstOrderNumber) ||
        result.numbering.tenantBOrderNumber !== '#1' ||
        !result.numbering.tenantBNumbersStartAtOne ||
        !result.numbering.noTenantDuplicates ||
        !result.numbering.noConcurrentDuplicates ||
        !result.numbering.noUuidFragments ||
        result.numbering.concurrentNumbers.some((number) => typeof number !== 'number') ||
        !result.kitchenPayload.hidesPaymentStatus ||
        !result.kitchenPayload.hidesPayments ||
        !result.kitchenPayload.hidesTotal ||
        result.domainAuthorization.nextActions.pendingKitchen.join(',') !== 'mark_ready' ||
        result.domainAuthorization.matrix.record_payment.genericUser !== false ||
        result.domainAuthorization.matrix.mark_ready.legacyOwnerCrossTenant !== false
    ) {
        throw new Error(`Service-flow assertion failed: ${JSON.stringify(result)}`);
    }

    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Restaurant service-flow verification failed:', error);
    if (serverOutput.trim()) console.error('[verify:restaurant-service-flow] API output:\n', serverOutput);
    process.exitCode = 1;
} finally {
    const runningServer = server;
    if (runningServer && runningServer.exitCode === null) {
        console.log('[verify:restaurant-service-flow] Stopping API server...');
        runningServer.kill();
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 2000);
            runningServer.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    await closeDatabase();
}
