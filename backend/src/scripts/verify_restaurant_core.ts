import { createHmac } from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';
import {
    businesses,
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

requireQ360StagingDatabaseGuard('verify:restaurant');
requireDatabaseUrl();

const { closeDatabase, db } = await import('../db/client.js');

const businessId = 'biz_verify_restaurant_core';
const businessBId = 'biz_verify_restaurant_core_b';
const userId = 'usr_verify_restaurant_core';
const userBId = 'usr_verify_restaurant_core_b';
const port = 32000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const secret = process.env.JWT_SECRET || 'restaurant-core-test-secret';
const testEnv = {
    ...process.env,
    JWT_SECRET: secret,
    PORT: String(port),
};

const createToken = (options?: { businessId?: string; userId?: string; role?: string; email?: string }) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const tokenBusinessId = options?.businessId ?? businessId;
    const tokenUserId = options?.userId ?? userId;
    const tokenRole = options?.role ?? 'admin';
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
        sub: tokenUserId,
        email: options?.email ?? `${tokenRole}-verify-restaurant-core@example.com`,
        role: tokenRole,
        businessId: tokenBusinessId,
        iat: now,
        exp: now + 3600,
    });
    const signature = createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
};

const todayDateParam = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const request = async <T>(path: string, init?: RequestInit, tokenOptions?: { businessId?: string; userId?: string; role?: string; email?: string }): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${createToken(tokenOptions)}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`${init?.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<T>;
};

const requestResponse = async (path: string, init?: RequestInit, tokenOptions?: { businessId?: string; userId?: string; role?: string; email?: string }) => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${createToken(tokenOptions)}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    const text = await response.text();
    return {
        status: response.status,
        body: text ? JSON.parse(text) as unknown : null,
    };
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
    await db.delete(users).where(inArray(users.id, [userId, userBId]));
    await db.delete(businesses).where(inArray(businesses.id, businessesUnderTest));

    await db.insert(businesses).values([
        { id: businessId, name: 'Restaurant Verification Business', type: 'restaurant', status: 'active' },
        { id: businessBId, name: 'Restaurant Verification Business B', type: 'restaurant', status: 'active' },
    ]);
    await db.insert(users).values([
        {
            id: userId,
            email: 'verify-restaurant-core@example.com',
            name: 'Restaurant Verifier',
            role: 'admin',
            businessId,
            onboardingCompleted: true,
            primaryWorkspace: '/app/restaurant',
        },
        {
            id: userBId,
            email: 'verify-restaurant-core-b@example.com',
            name: 'Restaurant Verifier B',
            role: 'admin',
            businessId: businessBId,
            onboardingCompleted: true,
            primaryWorkspace: '/app/restaurant',
        },
    ]);

    for (const tenantId of businessesUnderTest) {
        const prefix = tenantId === businessId ? 'verify_restaurant' : 'verify_restaurant_b';
        const menuId = `${prefix}_menu`;
        await db.insert(restaurantMenus).values({
            id: menuId,
            businessId: tenantId,
            name: 'Verification Menu',
            isActive: true,
        });

        const categories = ['Starters', 'Mains', 'Drinks', 'Desserts'].map((name, index) => ({
            id: `${prefix}_category_${name.toLowerCase()}`,
            businessId: tenantId,
            menuId,
            name,
            sortOrder: index,
        }));
        await db.insert(menuCategories).values(categories);
        const categoryIds = Object.fromEntries(categories.map((category) => [category.name, category.id]));

        await db.insert(menuItems).values([
            { id: `${prefix}_item_bruschetta`, name: 'Bruschetta', price: 800, categoryId: categoryIds.Starters },
            { id: `${prefix}_item_caesar_salad`, name: 'Caesar Salad', price: 1200, categoryId: categoryIds.Starters },
            { id: `${prefix}_item_grilled_chicken`, name: 'Grilled Chicken', price: 1800, categoryId: categoryIds.Mains },
            { id: `${prefix}_item_beef_burger`, name: 'Beef Burger', price: 1600, categoryId: categoryIds.Mains },
            { id: `${prefix}_item_pasta_carbonara`, name: 'Pasta Carbonara', price: 1500, categoryId: categoryIds.Mains },
            { id: `${prefix}_item_margherita_pizza`, name: 'Margherita Pizza', price: 1400, categoryId: categoryIds.Mains },
            { id: `${prefix}_item_soft_drink`, name: 'Soft Drink', price: 400, categoryId: categoryIds.Drinks },
            { id: `${prefix}_item_fresh_juice`, name: 'Fresh Juice', price: 600, categoryId: categoryIds.Drinks },
            { id: `${prefix}_item_unavailable`, name: 'Unavailable Special', price: 2200, categoryId: categoryIds.Mains, isAvailable: false },
        ].map((item) => ({
            ...item,
            businessId: tenantId,
            isAvailable: 'isAvailable' in item ? item.isAvailable : true,
            prepTimeMinutes: 0,
        })));

        await db.insert(restaurantTables).values(Array.from({ length: tenantId === businessId ? 12 : 1 }, (_, index) => {
            const number = index + 1;
            return {
                id: `${prefix}_table_t${number}`,
                businessId: tenantId,
                label: `T${number}`,
                capacity: number <= 3 ? 2 : number <= 9 ? 4 : 6,
                status: 'available' as const,
            };
        }));
    }
};

let serverOutput = '';
let server: ReturnType<typeof spawn> | undefined;

try {
    console.log('[verify:restaurant] Seeding database...');
    const seed = spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed.ts'], {
        cwd: process.cwd(),
        env: testEnv,
        encoding: 'utf8',
    });
    if (seed.status !== 0) {
        throw new Error(`Seed failed:\n${seed.stdout}\n${seed.stderr}`);
    }

    console.log('[verify:restaurant] Resetting isolated verification fixture...');
    await resetFixture();

    console.log('[verify:restaurant] Starting API server...');
    server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
        cwd: process.cwd(),
        env: testEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', (chunk) => { serverOutput += chunk.toString(); });
    server.stderr?.on('data', (chunk) => { serverOutput += chunk.toString(); });

    console.log('[verify:restaurant] Waiting for API health check...');
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

    console.log('[verify:restaurant] Loading menu and tables...');
    const menuResponse = await request<{
        categories: { items: { id: string }[] }[];
    }>('/api/restaurant/menu', undefined, { role: 'waiter' });
    const menu = menuResponse.categories.flatMap((category) => category.items);
    const tables = await request<{ id: string; label: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    if (menu.length < 8 || tables.length < 12) {
        throw new Error(`Seeded menu or tables are missing: ${JSON.stringify({
            apiMenu: menu.length,
            apiTables: tables.length,
            serverOutput,
        })}`);
    }
    const tableT1 = tables.find((table) => table.label === 'T1');
    if (!tableT1) throw new Error('Seeded table T1 was not returned');

    console.log('[verify:restaurant] Creating restaurant order...');
    const created = await request<{ id: string; status: string }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            table_id: tableT1.id,
            items: [
                { menu_item_id: menu[0].id, quantity: 1 },
                { menu_item_id: menu[1].id, quantity: 1 },
            ],
        }),
    }, { role: 'waiter' });
    const tablesAfterCreate = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });

    console.log('[verify:restaurant] Verifying tenant isolation...');
    const menuResponseB = await request<{ categories: { items: { id: string }[] }[] }>(
        '/api/restaurant/menu',
        undefined,
        { businessId: businessBId, userId: userBId, role: 'waiter' },
    );
    const menuB = menuResponseB.categories.flatMap((category) => category.items);
    const tablesB = await request<{ id: string; label: string }[]>(
        '/api/restaurant/tables',
        undefined,
        { businessId: businessBId, userId: userBId, role: 'waiter' },
    );
    if (!menuB[0] || !tablesB[0]) throw new Error('Tenant B fixture menu or table is missing');
    const orderB = await request<{ id: string; status: string }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            table_id: tablesB[0].id,
            items: [{ menu_item_id: menuB[0].id, quantity: 1 }],
        }),
    }, { businessId: businessBId, userId: userBId, role: 'waiter' });
    const ordersVisibleToA = await request<{ id: string }[]>('/api/restaurant/orders', undefined, { role: 'waiter' });
    const foreignDeliverAsA = await requestResponse(`/api/restaurant/orders/${orderB.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    if (ordersVisibleToA.some((order) => order.id === orderB.id) || foreignDeliverAsA.status !== 404) {
        throw new Error(`Tenant isolation failed: ${JSON.stringify({ orderB, ordersVisibleToA, foreignDeliverAsA })}`);
    }

    console.log('[verify:restaurant] Verifying KDS ticket...');
    const tickets = await request<{ id: string; order: { id: string } | null }[]>('/api/restaurant/kds', undefined, { role: 'kitchen' });
    const ticketId = tickets.find((ticket) => ticket.order?.id === created.id)?.id;
    if (!ticketId) throw new Error('Created order did not produce a KDS ticket');
    const doneTicket = await request<{ status: string; completedAt: string | null }>(`/api/restaurant/kds/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    }, { role: 'kitchen' });
    console.log('[verify:restaurant] Verifying order and dashboard state...');
    const readyOrders = await request<{ id: string; status: string; total: number }[]>('/api/restaurant/orders', undefined, { role: 'waiter' });
    const ready = readyOrders.find((order) => order.id === created.id);
    if (!ready) throw new Error('KDS status change was not reflected on the order');
    const tablesAfterReady = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    const waiterPayment = await requestResponse(`/api/restaurant/orders/${created.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: ready.total / 100 }),
    }, { role: 'waiter' });
    const kitchenPayment = await requestResponse(`/api/restaurant/orders/${created.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: ready.total / 100 }),
    }, { role: 'kitchen' });
    const paymentBeforeDelivery = await requestResponse(`/api/restaurant/orders/${created.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: ready.total / 100 }),
    }, { role: 'cashier' });
    const delivered = await request<{ status: string; total: number }>(`/api/restaurant/orders/${created.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({}),
    }, { role: 'waiter' });
    const tablesAfterDelivered = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });
    const paid = await request<{ status: string; total: number }>(`/api/restaurant/orders/${created.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: ready.total / 100 }),
    }, { role: 'cashier' });
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, created.id),
        ));
    const payment = payments[0];
    const tablesAfter = await request<{ id: string; status: string }[]>('/api/restaurant/tables', undefined, { role: 'waiter' });

    console.log('[verify:restaurant] Verifying takeaway order support...');
    const takeaway = await request<{ id: string; status: string; tableId: string | null }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            items: [{ menu_item_id: menu[0].id, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const dashboard = await request<{
        total_revenue_today: number;
        active_orders_count: number;
    }>('/api/restaurant/dashboard', undefined, { role: 'manager' });
    const dailyReport = await request<{
        summary: {
            totalOrders: number;
            paidOrders: number;
            unpaidOpenOrders: number;
            paidRevenueCents: number;
            dineInOrders: number;
            takeawayOrders: number;
        };
        recentOrders: { id: string }[];
    }>(`/api/restaurant/reports/daily?date=${todayDateParam()}`, undefined, { role: 'manager' });
    const duplicatePayment = await requestResponse(`/api/restaurant/orders/${created.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: ready.total / 100 }),
    }, { role: 'cashier' });
    const paymentsAfterDuplicate = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, created.id),
        ));

    const result = {
        menuItems: menu.length,
        tables: tables.length,
        statuses: [created.status, ready.status, delivered.status, paid.status],
        waiterPaymentStatus: waiterPayment.status,
        kitchenPaymentStatus: kitchenPayment.status,
        paymentBeforeDeliveryStatus: paymentBeforeDelivery.status,
        paymentCount: payments.length,
        paymentAmount: payment?.amount,
        paymentMethod: payment?.method,
        paymentTimestampExists: Boolean(payment?.paidAt),
        tableAfterCreate: tablesAfterCreate.find((table) => table.id === tableT1.id)?.status,
        tableAfterReady: tablesAfterReady.find((table) => table.id === tableT1.id)?.status,
        tableAfterDelivered: tablesAfterDelivered.find((table) => table.id === tableT1.id)?.status,
        tableAfterPayment: tablesAfter.find((table) => table.id === tableT1.id)?.status,
        tenantIsolation: {
            foreignOrderHiddenFromA: !ordersVisibleToA.some((order) => order.id === orderB.id),
            foreignDeliverAsAStatus: foreignDeliverAsA.status,
        },
        takeaway: {
            id: takeaway.id,
            status: takeaway.status,
            tableId: takeaway.tableId,
        },
        dashboard,
        dailyReport,
        kdsTicket: doneTicket,
        duplicatePayment,
        paymentCountAfterDuplicate: paymentsAfterDuplicate.length,
    };

    if (
        result.statuses.join(',') !== 'pending,ready,delivered,paid' ||
        result.waiterPaymentStatus !== 403 ||
        result.kitchenPaymentStatus !== 403 ||
        result.paymentBeforeDeliveryStatus !== 409 ||
        result.paymentCount !== 1 ||
        result.paymentAmount !== paid.total / 100 ||
        result.paymentMethod !== 'cash' ||
        !result.paymentTimestampExists ||
        result.tableAfterCreate !== 'occupied' ||
        result.tableAfterReady !== 'occupied' ||
        result.tableAfterDelivered !== 'occupied' ||
        result.tableAfterPayment !== 'available' ||
        result.dashboard.total_revenue_today !== paid.total ||
        result.dashboard.active_orders_count !== 1 ||
        result.dailyReport.summary.totalOrders !== 2 ||
        result.dailyReport.summary.paidOrders !== 1 ||
        result.dailyReport.summary.unpaidOpenOrders !== 1 ||
        result.dailyReport.summary.paidRevenueCents !== paid.total ||
        result.dailyReport.summary.dineInOrders !== 1 ||
        result.dailyReport.summary.takeawayOrders !== 1 ||
        result.dailyReport.recentOrders.length !== 2 ||
        result.kdsTicket.status !== 'done' ||
        !result.kdsTicket.completedAt ||
        result.duplicatePayment.status !== 409 ||
        result.paymentCountAfterDuplicate !== 1 ||
        !result.tenantIsolation.foreignOrderHiddenFromA ||
        result.tenantIsolation.foreignDeliverAsAStatus !== 404 ||
        result.takeaway.status !== 'pending' ||
        result.takeaway.tableId !== null
    ) {
        throw new Error(`Restaurant flow assertion failed: ${JSON.stringify(result)}`);
    }

    console.log('[verify:restaurant] Verifying batched menu validation regressions...');
    const oneItemOrder = await request<{ id: string; items: { menuItemId: string; quantity: number }[]; total: number }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            items: [{ menu_item_id: menu[0].id, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const multipleDistinctOrder = await request<{ id: string; items: { menuItemId: string; quantity: number }[]; total: number }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            items: [
                { menu_item_id: menu[0].id, quantity: 1 },
                { menu_item_id: menu[1].id, quantity: 2 },
                { menu_item_id: menu[2].id, quantity: 1 },
            ],
        }),
    }, { role: 'waiter' });
    const duplicateItemOrder = await request<{ id: string; items: { menuItemId: string; quantity: number; notes: string | null }[]; total: number }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            idempotency_key: 'restaurant-core-batched-duplicate-items',
            items: [
                { menu_item_id: menu[0].id, quantity: 1, notes: 'first note' },
                { menu_item_id: menu[0].id, quantity: 3, notes: 'second note' },
            ],
        }),
    }, { role: 'waiter' });
    const duplicateItemOrderReplay = await request<{ id: string }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            idempotency_key: 'restaurant-core-batched-duplicate-items',
            items: [{ menu_item_id: menu[1].id, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const unavailableItem = menu.find((item) => item.id.endsWith('_item_unavailable'));
    if (!unavailableItem) throw new Error('Unavailable menu fixture was not returned');
    const unavailableResponse = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            items: [{ menu_item_id: unavailableItem.id, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const crossTenantItemResponse = await requestResponse('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            items: [{ menu_item_id: menuB[0].id, quantity: 1 }],
        }),
    }, { role: 'waiter' });
    const ownerOrder = await request<{ id: string; orderType: string; items: { menuItemId: string }[] }>('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
            items: [{ menu_item_id: menu[1].id, quantity: 1 }],
        }),
    }, { role: 'owner' });
    const payNow = await request<{
        order: { id: string; paymentStatus: string; orderType: string };
        payment: { status: string; amount: number };
        kitchen: { ticket: { id: string; orderId: string } | null };
    }>('/api/restaurant/orders/pay-now', {
        method: 'POST',
        body: JSON.stringify({
            payment_method: 'manual',
            idempotency_key: 'restaurant-core-batched-pay-now',
            items: [{ menu_item_id: menu[2].id, quantity: 1 }],
        }),
    }, { role: 'cashier' });
    const duplicateOrderTickets = await db.select({ id: kdsTickets.id }).from(kdsTickets)
        .where(and(
            eq(kdsTickets.businessId, businessId),
            eq(kdsTickets.orderId, duplicateItemOrder.id),
        ));
    const focusedRegression = {
        oneItemCount: oneItemOrder.items.length,
        multipleDistinctItemCount: multipleDistinctOrder.items.length,
        duplicateItemCount: duplicateItemOrder.items.length,
        duplicateItemQuantity: duplicateItemOrder.items[0]?.quantity,
        duplicateItemNotes: duplicateItemOrder.items[0]?.notes,
        idempotencyReplaySameOrder: duplicateItemOrderReplay.id === duplicateItemOrder.id,
        unavailableStatus: unavailableResponse.status,
        crossTenantItemStatus: crossTenantItemResponse.status,
        ownerOrderType: ownerOrder.orderType,
        payNowPaymentStatus: payNow.payment.status,
        payNowOrderPaymentStatus: payNow.order.paymentStatus,
        payNowTicketOrderId: payNow.kitchen.ticket?.orderId,
        duplicateOrderKdsTicketCount: duplicateOrderTickets.length,
    };
    if (
        focusedRegression.oneItemCount !== 1 ||
        focusedRegression.multipleDistinctItemCount !== 3 ||
        focusedRegression.duplicateItemCount !== 1 ||
        focusedRegression.duplicateItemQuantity !== 4 ||
        focusedRegression.duplicateItemNotes !== 'second note' ||
        !focusedRegression.idempotencyReplaySameOrder ||
        focusedRegression.unavailableStatus !== 409 ||
        focusedRegression.crossTenantItemStatus !== 404 ||
        focusedRegression.ownerOrderType !== 'takeaway' ||
        focusedRegression.payNowPaymentStatus !== 'completed' ||
        focusedRegression.payNowOrderPaymentStatus !== 'paid' ||
        focusedRegression.payNowTicketOrderId !== payNow.order.id ||
        focusedRegression.duplicateOrderKdsTicketCount !== 1
    ) {
        throw new Error(`Batched menu validation regression failed: ${JSON.stringify(focusedRegression)}`);
    }

    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Restaurant verification failed:', error);
    process.exitCode = 1;
} finally {
    const runningServer = server;
    if (runningServer && runningServer.exitCode === null) {
        console.log('[verify:restaurant] Stopping API server...');
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
