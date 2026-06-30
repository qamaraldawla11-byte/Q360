import { createHmac } from 'crypto';
import { spawn } from 'child_process';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';
import {
    businesses,
    menuCategories,
    menuItems,
    restaurantMenus,
    restaurantTables,
    users,
} from '../db/schema.js';

requireQ360StagingDatabaseGuard('verify:restaurant-setup');
requireDatabaseUrl();

const { closeDatabase, db } = await import('../db/client.js');

const businessA = 'biz_verify_restaurant_setup_a';
const businessB = 'biz_verify_restaurant_setup_b';
const userA = 'usr_verify_restaurant_setup_a';
const userB = 'usr_verify_restaurant_setup_b';
const emailA = 'verify-restaurant-setup-a@example.com';
const emailB = 'verify-restaurant-setup-b@example.com';
const businessesUnderTest = [businessA, businessB];
const usersUnderTest = [userA, userB];
const port = 33000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const secret = process.env.JWT_SECRET || 'restaurant-setup-test-secret';
const testEnv = {
    ...process.env,
    JWT_SECRET: secret,
    PORT: String(port),
};

const createToken = (userId: string, email: string, businessId: string) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
        sub: userId,
        email,
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

const tokenA = () => createToken(userA, emailA, businessA);
const tokenB = () => createToken(userB, emailB, businessB);

const request = async <T>(token: string, path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`${init?.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<T>;
};

const requestStatus = async (token: string, path: string, init?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    return response.status;
};

const resetFixture = async () => {
    await db.delete(restaurantTables).where(inArray(restaurantTables.businessId, businessesUnderTest));
    await db.delete(menuItems).where(inArray(menuItems.businessId, businessesUnderTest));
    await db.delete(menuCategories).where(inArray(menuCategories.businessId, businessesUnderTest));
    await db.delete(restaurantMenus).where(inArray(restaurantMenus.businessId, businessesUnderTest));
    await db.delete(users).where(inArray(users.id, usersUnderTest));
    await db.delete(businesses).where(inArray(businesses.id, businessesUnderTest));

    await db.insert(businesses).values([
        { id: businessA, name: 'Restaurant Setup A', type: 'restaurant', status: 'active' },
        { id: businessB, name: 'Restaurant Setup B', type: 'restaurant', status: 'active' },
    ]);
    await db.insert(users).values([
        {
            id: userA,
            email: emailA,
            name: 'Restaurant Setup A',
            role: 'admin',
            businessId: businessA,
            onboardingCompleted: true,
            primaryWorkspace: '/app/restaurant',
        },
        {
            id: userB,
            email: emailB,
            name: 'Restaurant Setup B',
            role: 'admin',
            businessId: businessB,
            onboardingCompleted: true,
            primaryWorkspace: '/app/restaurant',
        },
    ]);
};

type MenuResponse = {
    categories: {
        id: string;
        name: string;
        items: { id: string; name: string; categoryId: string }[];
    }[];
};

let serverOutput = '';
let server: ReturnType<typeof spawn> | undefined;

try {
    console.log('[verify:restaurant-setup] Resetting isolated tenants...');
    await resetFixture();

    console.log('[verify:restaurant-setup] Starting API server...');
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

    console.log('[verify:restaurant-setup] Creating setup data for Restaurant A...');
    const categoryA = await request<{ id: string; name: string; items: unknown[] }>(tokenA(), '/api/restaurant/menu/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Setup Mains' }),
    });
    const itemA = await request<{ id: string; name: string; categoryId: string; businessId: string }>(tokenA(), '/api/restaurant/menu/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'Setup Burger', category_id: categoryA.id, price: 12.5 }),
    });
    const tableA = await request<{ id: string; label: string; businessId: string }>(tokenA(), '/api/restaurant/tables', {
        method: 'POST',
        body: JSON.stringify({ label: 'SETUP-A1', capacity: 4 }),
    });

    console.log('[verify:restaurant-setup] Creating independent setup data for Restaurant B...');
    const categoryB = await request<{ id: string; name: string }>(tokenB(), '/api/restaurant/menu/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'B Setup Drinks' }),
    });
    const itemB = await request<{ id: string; name: string; businessId: string }>(tokenB(), '/api/restaurant/menu/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'B Setup Tea', category_id: categoryB.id, price: 3 }),
    });
    const tableB = await request<{ id: string; label: string; businessId: string }>(tokenB(), '/api/restaurant/tables', {
        method: 'POST',
        body: JSON.stringify({ label: 'SETUP-B1', capacity: 2 }),
    });

    console.log('[verify:restaurant-setup] Verifying tenant isolation and persistence...');
    const menuA = await request<MenuResponse>(tokenA(), '/api/restaurant/menu');
    const tablesA = await request<{ id: string; businessId: string; label: string }[]>(tokenA(), '/api/restaurant/tables');
    const menuB = await request<MenuResponse>(tokenB(), '/api/restaurant/menu');
    const tablesB = await request<{ id: string; businessId: string; label: string }[]>(tokenB(), '/api/restaurant/tables');
    const reloginMenuA = await request<MenuResponse>(tokenA(), '/api/restaurant/menu');
    const reloginTablesA = await request<{ id: string; label: string }[]>(tokenA(), '/api/restaurant/tables');
    const crossTenantCreateStatus = await requestStatus(tokenB(), '/api/restaurant/menu/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'Cross Tenant Item', category_id: categoryA.id, price: 9 }),
    });

    const aItemVisibleInA = menuA.categories.flatMap((category) => category.items).some((item) => item.id === itemA.id);
    const aTableVisibleInA = tablesA.some((table) => table.id === tableA.id);
    const aItemVisibleInB = menuB.categories.flatMap((category) => category.items).some((item) => item.id === itemA.id);
    const aTableVisibleInB = tablesB.some((table) => table.id === tableA.id);
    const bItemVisibleInA = menuA.categories.flatMap((category) => category.items).some((item) => item.id === itemB.id);
    const bTableVisibleInA = tablesA.some((table) => table.id === tableB.id);
    const persistedAfterRelogin = reloginMenuA.categories.some((category) => category.id === categoryA.id)
        && reloginMenuA.categories.flatMap((category) => category.items).some((item) => item.id === itemA.id)
        && reloginTablesA.some((table) => table.id === tableA.id);

    const directRows = {
        categoryA: await db.select().from(menuCategories)
            .where(and(eq(menuCategories.id, categoryA.id), eq(menuCategories.businessId, businessA))),
        itemA: await db.select().from(menuItems)
            .where(and(eq(menuItems.id, itemA.id), eq(menuItems.businessId, businessA))),
        tableA: await db.select().from(restaurantTables)
            .where(and(eq(restaurantTables.id, tableA.id), eq(restaurantTables.businessId, businessA))),
    };

    const result = {
        restaurantA: {
            category: categoryA.name,
            item: itemA.name,
            table: tableA.label,
            posMenuVisible: aItemVisibleInA,
            posTableVisible: aTableVisibleInA,
            persistedAfterRelogin,
        },
        tenantIsolation: {
            restaurantBCannotReadAItem: !aItemVisibleInB,
            restaurantBCannotReadATable: !aTableVisibleInB,
            restaurantACannotReadBItem: !bItemVisibleInA,
            restaurantACannotReadBTable: !bTableVisibleInA,
            restaurantBCannotCreateItemInACategory: crossTenantCreateStatus === 404,
        },
        storage: {
            categoryStoredUnderA: directRows.categoryA.length === 1,
            itemStoredUnderA: directRows.itemA.length === 1,
            tableStoredUnderA: directRows.tableA.length === 1,
        },
    };

    if (
        !result.restaurantA.posMenuVisible ||
        !result.restaurantA.posTableVisible ||
        !result.restaurantA.persistedAfterRelogin ||
        !Object.values(result.tenantIsolation).every(Boolean) ||
        !Object.values(result.storage).every(Boolean)
    ) {
        throw new Error(`Restaurant setup assertion failed: ${JSON.stringify(result)}`);
    }

    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Restaurant setup verification failed:', error);
    process.exitCode = 1;
} finally {
    const runningServer = server;
    if (runningServer && runningServer.exitCode === null) {
        console.log('[verify:restaurant-setup] Stopping API server...');
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
