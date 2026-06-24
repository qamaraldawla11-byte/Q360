import { createHmac } from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl } from '../utils/env.js';
import { closeDatabase, db } from '../db/client.js';
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

requireDatabaseUrl();

const businessId = 'biz_verify_restaurant_core';
const userId = 'usr_verify_restaurant_core';
const port = 32000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const secret = process.env.JWT_SECRET || 'restaurant-core-test-secret';
const testEnv = {
    ...process.env,
    JWT_SECRET: secret,
    PORT: String(port),
};

const createToken = () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
        sub: userId,
        email: 'verify-restaurant-core@example.com',
        role: 'admin',
        businessId,
        iat: now,
        exp: now + 3600,
    });
    const signature = createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${createToken()}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`${init?.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<T>;
};

const requestResponse = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${createToken()}`,
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
    const existingOrders = await db.select({ id: restaurantOrders.id }).from(restaurantOrders)
        .where(eq(restaurantOrders.businessId, businessId));
    const orderIds = existingOrders.map((order) => order.id);

    await db.delete(restaurantPayments).where(eq(restaurantPayments.businessId, businessId));
    if (orderIds.length > 0) {
        await db.delete(kdsTickets).where(eq(kdsTickets.businessId, businessId));
        await db.delete(restaurantOrderItems).where(inArray(restaurantOrderItems.orderId, orderIds));
        await db.delete(restaurantOrders).where(eq(restaurantOrders.businessId, businessId));
    }

    await db.delete(restaurantTables).where(eq(restaurantTables.businessId, businessId));
    await db.delete(menuItems).where(eq(menuItems.businessId, businessId));
    await db.delete(menuCategories).where(eq(menuCategories.businessId, businessId));
    await db.delete(restaurantMenus).where(eq(restaurantMenus.businessId, businessId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(businesses).where(eq(businesses.id, businessId));

    await db.insert(businesses).values({
        id: businessId,
        name: 'Restaurant Verification Business',
        type: 'restaurant',
        status: 'active',
    });
    await db.insert(users).values({
        id: userId,
        email: 'verify-restaurant-core@example.com',
        name: 'Restaurant Verifier',
        role: 'admin',
        businessId,
        onboardingCompleted: true,
        primaryWorkspace: '/app/restaurant',
    });

    const menuId = 'verify_restaurant_menu';
    await db.insert(restaurantMenus).values({
        id: menuId,
        businessId,
        name: 'Verification Menu',
        isActive: true,
    });

    const categories = ['Starters', 'Mains', 'Drinks', 'Desserts'].map((name, index) => ({
        id: `verify_restaurant_category_${name.toLowerCase()}`,
        businessId,
        menuId,
        name,
        sortOrder: index,
    }));
    await db.insert(menuCategories).values(categories);
    const categoryIds = Object.fromEntries(categories.map((category) => [category.name, category.id]));

    await db.insert(menuItems).values([
        { id: 'verify_restaurant_item_bruschetta', name: 'Bruschetta', price: 800, categoryId: categoryIds.Starters },
        { id: 'verify_restaurant_item_caesar_salad', name: 'Caesar Salad', price: 1200, categoryId: categoryIds.Starters },
        { id: 'verify_restaurant_item_grilled_chicken', name: 'Grilled Chicken', price: 1800, categoryId: categoryIds.Mains },
        { id: 'verify_restaurant_item_beef_burger', name: 'Beef Burger', price: 1600, categoryId: categoryIds.Mains },
        { id: 'verify_restaurant_item_pasta_carbonara', name: 'Pasta Carbonara', price: 1500, categoryId: categoryIds.Mains },
        { id: 'verify_restaurant_item_margherita_pizza', name: 'Margherita Pizza', price: 1400, categoryId: categoryIds.Mains },
        { id: 'verify_restaurant_item_soft_drink', name: 'Soft Drink', price: 400, categoryId: categoryIds.Drinks },
        { id: 'verify_restaurant_item_fresh_juice', name: 'Fresh Juice', price: 600, categoryId: categoryIds.Drinks },
    ].map((item) => ({
        ...item,
        businessId,
        isAvailable: true,
        prepTimeMinutes: 0,
    })));

    await db.insert(restaurantTables).values(Array.from({ length: 12 }, (_, index) => {
        const number = index + 1;
        return {
            id: `verify_restaurant_table_t${number}`,
            businessId,
            label: `T${number}`,
            capacity: number <= 3 ? 2 : number <= 9 ? 4 : 6,
            status: 'available' as const,
        };
    }));
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
    }>('/api/restaurant/menu');
    const menu = menuResponse.categories.flatMap((category) => category.items);
    const tables = await request<{ id: string; label: string; status: string }[]>('/api/restaurant/tables');
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
    });
    console.log('[verify:restaurant] Verifying KDS ticket...');
    const tickets = await request<{ id: string; order: { id: string } | null }[]>('/api/restaurant/kds');
    const ticketId = tickets.find((ticket) => ticket.order?.id === created.id)?.id;
    if (!ticketId) throw new Error('Created order did not produce a KDS ticket');
    const doneTicket = await request<{ status: string; completedAt: string | null }>(`/api/restaurant/kds/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
    });
    console.log('[verify:restaurant] Verifying order and dashboard state...');
    const readyOrders = await request<{ id: string; status: string; total: number }[]>('/api/restaurant/orders');
    const ready = readyOrders.find((order) => order.id === created.id);
    if (!ready) throw new Error('KDS status change was not reflected on the order');
    const paid = await request<{ status: string; total: number }>(`/api/restaurant/orders/${created.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: ready.total / 100 }),
    });
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, created.id),
        ));
    const payment = payments[0];
    const tablesAfter = await request<{ id: string; status: string }[]>('/api/restaurant/tables');
    const dashboard = await request<{
        total_revenue_today: number;
        active_orders_count: number;
    }>('/api/restaurant/dashboard');
    const duplicatePayment = await requestResponse(`/api/restaurant/orders/${created.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: 'cash', amount: ready.total / 100 }),
    });
    const paymentsAfterDuplicate = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, created.id),
        ));

    const result = {
        menuItems: menu.length,
        tables: tables.length,
        statuses: [created.status, ready.status, paid.status],
        paymentCount: payments.length,
        paymentAmount: payment?.amount,
        paymentMethod: payment?.method,
        paymentTimestampExists: Boolean(payment?.paidAt),
        tableAfterPayment: tablesAfter.find((table) => table.id === tableT1.id)?.status,
        dashboard,
        kdsTicket: doneTicket,
        duplicatePayment,
        paymentCountAfterDuplicate: paymentsAfterDuplicate.length,
    };

    if (
        result.statuses.join(',') !== 'pending,ready,paid' ||
        result.paymentCount !== 1 ||
        result.paymentAmount !== paid.total / 100 ||
        result.paymentMethod !== 'cash' ||
        !result.paymentTimestampExists ||
        result.tableAfterPayment !== 'available' ||
        result.dashboard.total_revenue_today !== paid.total ||
        result.dashboard.active_orders_count !== 0 ||
        result.kdsTicket.status !== 'done' ||
        !result.kdsTicket.completedAt ||
        result.duplicatePayment.status !== 409 ||
        result.paymentCountAfterDuplicate !== 1
    ) {
        throw new Error(`Restaurant flow assertion failed: ${JSON.stringify(result)}`);
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
