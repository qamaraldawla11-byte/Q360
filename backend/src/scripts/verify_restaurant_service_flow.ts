import { spawn, spawnSync } from 'child_process';
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

const { closeDatabase, db } = await import('../db/client.js');
const { ensureRestaurantServiceFlowSchema } = await import('../db/restaurantServiceFlowMigration.js');

const businessId = 'biz_verify_restaurant_service_flow';
const businessBId = 'biz_verify_restaurant_service_flow_b';
const userId = 'usr_verify_restaurant_service_flow';
const userBId = 'usr_verify_restaurant_service_flow_b';
const legacyOwnerUserId = 'usr_verify_restaurant_service_flow_legacy_owner';

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
    await db.delete(users).where(inArray(users.id, [userId, userBId, legacyOwnerUserId]));
    await db.delete(businesses).where(inArray(businesses.id, businessesUnderTest));

    await db.insert(businesses).values([
        { id: businessId, name: 'Restaurant Service Flow Verification', type: 'restaurant', status: 'active' },
        { id: businessBId, name: 'Restaurant Service Flow Verification B', type: 'restaurant', status: 'active' },
    ]);
    await db.insert(users).values([
        { id: userId, email: 'verify-restaurant-service-flow@example.com', role: 'admin', businessId, onboardingCompleted: true },
        { id: userBId, email: 'verify-restaurant-service-flow-b@example.com', role: 'admin', businessId: businessBId, onboardingCompleted: true },
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

const firstTicketForOrder = async (orderId: string) => {
    const tickets = await request<{ id: string; order: ({ id: string; displayOrderNumber: string } & Record<string, unknown>) | null }[]>('/api/restaurant/kds', undefined, { role: 'kitchen' });
    const ticket = tickets.find((entry) => entry.order?.id === orderId);
    if (!ticket) throw new Error(`No KDS ticket found for ${orderId}`);
    return ticket;
};

const markReady = async (orderId: string) => {
    const ticket = await firstTicketForOrder(orderId);
    const updated = await request<{ id: string; status: string; completedAt: string | null; order: { id: string; displayOrderNumber: string } | null }>(`/api/restaurant/kds/${ticket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'kitchen' });
    return { ticket, updated };
};

let serverOutput = '';
let server: ReturnType<typeof spawn> | undefined;

try {
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
            body: JSON.stringify({
                order_type: 'takeaway',
                payment_timing: 'pay_after_service',
                idempotency_key: `flow-concurrent-${index}`,
                items: [{ menu_item_id: itemId, quantity: 1 }],
            }),
        }, { role: 'waiter' }),
    ));
    const numberedOrders = await request<FlowOrder[]>('/api/restaurant/orders', undefined, { role: 'waiter' });
    const tenantBNumbers = await request<FlowOrder[]>('/api/restaurant/orders', undefined, { businessId: businessBId, userId: userBId, role: 'waiter' });
    const tenantNumbers = numberedOrders
        .map((order) => order.visibleOrderNumber)
        .filter((number): number is number => typeof number === 'number');
    const orderNumberDisplays = numberedOrders.map((order) => order.displayOrderNumber);
    const concurrentNumbers = concurrentOrders.map((order) => order.visibleOrderNumber);
    const uniqueTenantNumbers = new Set(tenantNumbers);
    const uniqueConcurrentNumbers = new Set(concurrentNumbers);
    const kitchenPayload = await request<{ order: Record<string, unknown> | null }[]>('/api/restaurant/kds', undefined, { role: 'kitchen' });
    const kitchenOrder = kitchenPayload.find((ticket) => ticket.order)?.order;

    const payments = await db.select().from(restaurantPayments)
        .where(and(eq(restaurantPayments.businessId, businessId), inArray(restaurantPayments.orderId, [dineIn.id, takeawayBefore.id, takeawayAfter.id])));
    const result = {
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
            paymentCount: payments.length,
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
        result.guards.paymentCount !== 3 ||
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
        result.cancellation.auditCount < 1 ||
        !result.cancellation.auditTenantScoped ||
        result.numbering.firstOrderNumber !== '#1' ||
        result.numbering.tenantBOrderNumber !== '#1' ||
        !result.numbering.tenantBNumbersStartAtOne ||
        !result.numbering.noTenantDuplicates ||
        !result.numbering.noConcurrentDuplicates ||
        !result.numbering.noUuidFragments ||
        result.numbering.concurrentNumbers.some((number) => typeof number !== 'number') ||
        !result.kitchenPayload.hidesPaymentStatus ||
        !result.kitchenPayload.hidesPayments ||
        !result.kitchenPayload.hidesTotal
    ) {
        throw new Error(`Service-flow assertion failed: ${JSON.stringify(result)}`);
    }

    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Restaurant service-flow verification failed:', error);
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
