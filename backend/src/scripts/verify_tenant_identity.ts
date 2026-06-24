import { Hono } from 'hono';
import { requireDatabaseUrl } from '../utils/env.js';

requireDatabaseUrl();

process.env.JWT_SECRET ||= 'tenant-identity-verification-secret';
delete process.env.RESEND_API_KEY;
process.env.NODE_ENV = 'test';

const { db, first, closeDatabase } = await import('../db/client.js');
const {
    businesses,
    menuItems,
    restaurantOrders,
    restaurantTables,
} = await import('../db/schema.js');
const { eq } = await import('drizzle-orm');
const { default: authRoutes } = await import('../routes/auth.js');
const { default: userRoutes } = await import('../routes/user.js');
const { default: restaurantRoutes } = await import('../routes/restaurant.js');

type TokenPayload = {
    sub: string;
    email: string;
    role: string;
    businessId: string;
};

const app = new Hono();
app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/restaurant', restaurantRoutes);

const decodeToken = (token: string) => {
    const payload = token.split('.')[1];
    if (!payload) throw new Error('JWT is missing its payload');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
};

const requestOtpAndVerify = async (email: string) => {
    let otpOutput = '';
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
        otpOutput += `${args.map(String).join(' ')}\n`;
    };

    try {
        const loginResponse = await app.request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (loginResponse.status !== 200) {
            throw new Error(`OTP request failed with status ${loginResponse.status}: ${await loginResponse.text()}`);
        }

        const code = otpOutput.match(new RegExp(`\\[DEV OTP\\] Code for ${email}: (\\d{6})`))?.[1];
        if (!code) throw new Error('OTP code was not captured from development output');

        const verifyResponse = await app.request('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const verifyBody = await verifyResponse.json() as { token?: string };
        if (verifyResponse.status !== 200 || !verifyBody.token) {
            throw new Error(`OTP verify failed with status ${verifyResponse.status}`);
        }
        return verifyBody.token;
    } finally {
        console.log = originalLog;
    }
};

const authedRequest = async <T>(token: string, path: string, init?: RequestInit): Promise<T> => {
    const response = await app.request(path, {
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

const requireStableBusinessId = async (businessId: string) => {
    if (!businessId || businessId.startsWith('/app/')) {
        throw new Error(`JWT businessId is not a stable tenant id: ${businessId}`);
    }

    const business = await first(db.select().from(businesses).where(eq(businesses.id, businessId)));
    if (!business) {
        throw new Error(`JWT businessId does not exist in businesses table: ${businessId}`);
    }
};

const ensureRestaurantTable = async (businessId: string) => {
    const existing = await first(db.select().from(restaurantTables).where(eq(restaurantTables.businessId, businessId)));
    if (existing) return existing;

    const id = `tenant_identity_table_${businessId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    await db.insert(restaurantTables).values({
        id,
        businessId,
        label: 'TID-1',
        capacity: 2,
        status: 'available',
    }).onConflictDoNothing();

    const created = await first(db.select().from(restaurantTables).where(eq(restaurantTables.id, id)));
    if (!created) throw new Error('Failed to create tenant identity verification table');
    return created;
};

try {
const email = 'tenant-identity-restaurant@example.com';
const token = await requestOtpAndVerify(email);
const firstPayload = decodeToken(token);
await requireStableBusinessId(firstPayload.businessId);

const profile = await authedRequest<{
    primaryWorkspace: string | null;
}>(
    token,
    '/api/user/profile',
    {
        method: 'PUT',
        body: JSON.stringify({
            userType: 'sme',
            segment: 'restaurant',
            businessName: 'Tenant Identity Bistro',
            country: 'US',
            currency: 'USD',
        }),
    },
);

if (profile.primaryWorkspace !== '/app/restaurant') {
    throw new Error(`Expected primaryWorkspace to be /app/restaurant, received ${profile.primaryWorkspace}`);
}

const onboardedPayload = decodeToken(token);
if (onboardedPayload.businessId !== firstPayload.businessId) {
    throw new Error('Onboarding changed the active session tenant identity');
}
await requireStableBusinessId(onboardedPayload.businessId);

const table = await ensureRestaurantTable(onboardedPayload.businessId);
const menu = await authedRequest<{
    categories: { items: { id: string; name: string }[] }[];
}>(token, '/api/restaurant/menu');
let menuItem = menu.categories.flatMap((category) => category.items)[0];
if (!menuItem) {
    menuItem = await authedRequest<{ id: string; name: string }>(token, '/api/restaurant/menu/items', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Tenant Identity Plate',
            price: 9.5,
            category: 'Verification',
        }),
    });
}

const order = await authedRequest<{ id: string }>(token, '/api/restaurant/orders', {
    method: 'POST',
    body: JSON.stringify({
        table_id: table.id,
        items: [{ menu_item_id: menuItem.id, quantity: 1 }],
    }),
});

await authedRequest<{ success: true }>(token, '/api/auth/logout', { method: 'POST' });

const reloginToken = await requestOtpAndVerify(email);
const reloginPayload = decodeToken(reloginToken);
await requireStableBusinessId(reloginPayload.businessId);

if (reloginPayload.businessId !== onboardedPayload.businessId) {
    throw new Error(JSON.stringify({
        error: 'Re-login issued a different businessId',
        before: onboardedPayload.businessId,
        after: reloginPayload.businessId,
    }));
}

const reloadedMenu = await authedRequest<{
    categories: { items: { id: string }[] }[];
}>(reloginToken, '/api/restaurant/menu');
const reloadedTables = await authedRequest<{ id: string }[]>(reloginToken, '/api/restaurant/tables');
const reloadedOrders = await authedRequest<{ id: string }[]>(reloginToken, '/api/restaurant/orders');

const directMenuItem = await first(db.select().from(menuItems).where(eq(menuItems.id, menuItem.id)));
const directOrder = await first(db.select().from(restaurantOrders).where(eq(restaurantOrders.id, order.id)));

const result = {
    email,
    primaryWorkspace: profile.primaryWorkspace,
    businessId: reloginPayload.businessId,
    sameBusinessIdAfterRelogin: reloginPayload.businessId === onboardedPayload.businessId,
    menuItemVisible: reloadedMenu.categories.flatMap((category) => category.items).some((item) => item.id === menuItem.id),
    tableVisible: reloadedTables.some((reloadedTable) => reloadedTable.id === table.id),
    orderVisible: reloadedOrders.some((reloadedOrder) => reloadedOrder.id === order.id),
    persistedRows: {
        menuItem: directMenuItem?.businessId,
        order: directOrder?.businessId,
    },
};

if (!result.menuItemVisible || !result.tableVisible || !result.orderVisible) {
    throw new Error(`Restaurant tenant data was not visible after re-login: ${JSON.stringify(result)}`);
}

if (result.persistedRows.menuItem !== result.businessId || result.persistedRows.order !== result.businessId) {
    throw new Error(`Restaurant rows were not stored under the JWT tenant: ${JSON.stringify(result)}`);
}

console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Tenant identity verification failed:', error);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
