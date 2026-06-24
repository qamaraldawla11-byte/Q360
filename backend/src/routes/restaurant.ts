import { randomUUID } from 'crypto';
import { Hono, type Context } from 'hono';
import { and, asc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import {
    kdsTickets,
    menuCategories,
    menuItems,
    restaurantMenus,
    restaurantOrderItems,
    restaurantOrders,
    restaurantPayments,
    restaurantTables,
} from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AppEnv } from '../types/app.js';

const restaurant = new Hono<AppEnv>();
const tableStatuses = ['available', 'occupied', 'reserved', 'cleaning'] as const;
const orderStatuses = ['pending', 'in_kitchen', 'ready', 'served', 'paid', 'cancelled'] as const;
const ticketStatuses = ['new', 'cooking', 'done'] as const;
const paymentMethods = ['cash', 'card', 'mobile'] as const;
type TableStatus = typeof tableStatuses[number];
type OrderStatus = typeof orderStatuses[number];
type TicketStatus = typeof ticketStatuses[number];

restaurant.use('/*', authMiddleware);

const parseJson = async <T>(c: Context<AppEnv>) => {
    try {
        return await c.req.json<T>();
    } catch {
        return null;
    }
};

const todayBounds = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

const orderWithItems = async (businessId: string, orderId: string) => {
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, orderId), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return null;
    const items = await db.select().from(restaurantOrderItems)
        .where(eq(restaurantOrderItems.orderId, orderId))
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, orderId),
        ));
    return { ...order, items, payments };
};

const ensureCategory = async (executor: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0], businessId: string, categoryId?: string, categoryName?: string) => {
    if (categoryId) {
        return await first(executor.select().from(menuCategories)
            .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.businessId, businessId)))
        ) || null;
    }

    let menu = await first(executor.select().from(restaurantMenus)
        .where(and(eq(restaurantMenus.businessId, businessId), eq(restaurantMenus.isActive, true)))
    );
    if (!menu) {
        menu = { id: randomUUID(), businessId, name: 'Main Menu', isActive: true };
        await executor.insert(restaurantMenus).values(menu);
    }

    const name = categoryName?.trim() || 'Uncategorized';
    let category = await first(executor.select().from(menuCategories)
        .where(and(
            eq(menuCategories.businessId, businessId),
            eq(menuCategories.menuId, menu.id),
            eq(menuCategories.name, name),
        ))
    );
    if (!category) {
        const last = await first(executor.select({ sortOrder: menuCategories.sortOrder }).from(menuCategories)
            .where(and(eq(menuCategories.businessId, businessId), eq(menuCategories.menuId, menu.id)))
            .orderBy(sql`${menuCategories.sortOrder} DESC`)
        );
        category = {
            id: randomUUID(),
            businessId,
            menuId: menu.id,
            name,
            sortOrder: (last?.sortOrder ?? -1) + 1,
        };
        await executor.insert(menuCategories).values(category);
    }
    return category;
};

restaurant.get('/menu', async (c) => {
    const businessId = c.get('businessId');
    const categories = await db.select().from(menuCategories)
        .where(eq(menuCategories.businessId, businessId))
        .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
    const items = await db.select().from(menuItems)
        .where(eq(menuItems.businessId, businessId))
        .orderBy(asc(menuItems.name));
    return c.json({
        categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            items: items.filter((item) => item.categoryId === category.id),
        })),
    });
});

restaurant.post('/menu/items', async (c) => {
    const body = await parseJson<{
        name?: unknown;
        description?: unknown;
        price?: unknown;
        categoryId?: unknown;
        category_id?: unknown;
        category?: unknown;
        isAvailable?: unknown;
        is_available?: unknown;
        prepTimeMinutes?: unknown;
        prep_time_minutes?: unknown;
    }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Name is required' }, 400);
    if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price <= 0) {
        return c.json({ error: 'Price must be greater than 0' }, 400);
    }
    const prepTime = body.prepTimeMinutes ?? body.prep_time_minutes ?? 0;
    if (typeof prepTime !== 'number' || !Number.isSafeInteger(prepTime) || prepTime < 0) {
        return c.json({ error: 'Prep time must be a non-negative integer' }, 400);
    }
    const categoryId = body.categoryId ?? body.category_id;
    if (categoryId !== undefined && typeof categoryId !== 'string') {
        return c.json({ error: 'Invalid category id' }, 400);
    }
    if (body.category !== undefined && typeof body.category !== 'string') {
        return c.json({ error: 'Invalid category name' }, 400);
    }

    const businessId = c.get('businessId');
    let itemId = '';
    try {
        await db.transaction(async (tx) => {
            const category = await ensureCategory(
                tx,
                businessId,
                categoryId as string | undefined,
                body.category as string | undefined,
            );
            if (!category) throw new Error('CATEGORY_NOT_FOUND');
            itemId = randomUUID();
            const availability = body.isAvailable ?? body.is_available;
            await tx.insert(menuItems).values({
                id: itemId,
                businessId,
                categoryId: category.id,
                name,
                description: typeof body.description === 'string' ? body.description.trim() || null : null,
                price: Math.round(body.price as number * 100),
                isAvailable: typeof availability === 'boolean' ? availability : true,
                prepTimeMinutes: prepTime,
            });
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'CATEGORY_NOT_FOUND') {
            return c.json({ error: 'Category not found' }, 404);
        }
        throw error;
    }

    return c.json(await first(db.select().from(menuItems)
        .where(and(eq(menuItems.id, itemId), eq(menuItems.businessId, businessId)))
    ), 201);
});

restaurant.get('/tables', async (c) => {
    return c.json(await db.select().from(restaurantTables)
        .where(eq(restaurantTables.businessId, c.get('businessId')))
        .orderBy(asc(restaurantTables.label)));
});

restaurant.patch('/tables/:id/status', async (c) => {
    const body = await parseJson<{ status?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.status !== 'string' || !tableStatuses.includes(body.status as TableStatus)) {
        return c.json({ error: 'Invalid table status' }, 400);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const result = await db.update(restaurantTables)
        .set({ status: body.status as TableStatus })
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.businessId, businessId)))
        .returning({ id: restaurantTables.id });
    if (result.length === 0) return c.json({ error: 'Table not found' }, 404);
    return c.json(await first(db.select().from(restaurantTables)
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.businessId, businessId)))
    ));
});

restaurant.post('/orders', async (c) => {
    const body = await parseJson<{
        tableId?: unknown;
        table_id?: unknown;
        items?: {
            menuItemId?: unknown;
            menu_item_id?: unknown;
            quantity?: unknown;
            notes?: unknown;
        }[];
    }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ error: 'At least one item is required' }, 400);
    }
    const tableId = body.tableId ?? body.table_id;
    if (tableId !== undefined && tableId !== null && typeof tableId !== 'string') {
        return c.json({ error: 'Invalid table id' }, 400);
    }
    for (const item of body.items) {
        const menuItemId = item.menuItemId ?? item.menu_item_id;
        if (
            typeof menuItemId !== 'string' ||
            typeof item.quantity !== 'number' ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0 ||
            (item.notes !== undefined && typeof item.notes !== 'string')
        ) {
            return c.json({ error: 'Each item requires a menu_item_id and positive integer quantity' }, 400);
        }
    }

    const businessId = c.get('businessId');
    const orderId = randomUUID();
    try {
        await db.transaction(async (tx) => {
            if (typeof tableId === 'string') {
                const table = await first(tx.select().from(restaurantTables)
                    .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.businessId, businessId)))
                );
                if (!table) throw new Error('TABLE_NOT_FOUND');
            }

            const requests = new Map<string, { quantity: number; notes: string | null }>();
            for (const item of body.items!) {
                const id = (item.menuItemId ?? item.menu_item_id) as string;
                const previous = requests.get(id);
                requests.set(id, {
                    quantity: (previous?.quantity || 0) + (item.quantity as number),
                    notes: typeof item.notes === 'string' ? item.notes.trim() || null : previous?.notes || null,
                });
            }
            const canonicalItems = [];
            for (const [id, request] of requests.entries()) {
                const item = await first(tx.select().from(menuItems)
                    .where(and(eq(menuItems.id, id), eq(menuItems.businessId, businessId)))
                );
                if (!item) throw new Error('ITEM_NOT_FOUND');
                if (!item.isAvailable) throw new Error('ITEM_UNAVAILABLE');
                canonicalItems.push({ item, ...request });
            }
            const total = canonicalItems.reduce(
                (sum, entry) => sum + entry.item.price * entry.quantity,
                0,
            );
            const now = new Date();

            await tx.insert(restaurantOrders).values({
                id: orderId,
                businessId,
                tableId: typeof tableId === 'string' ? tableId : null,
                status: 'pending',
                createdBy: c.get('userId'),
                total,
                createdAt: now,
                updatedAt: now,
            });
            await tx.insert(restaurantOrderItems).values(canonicalItems.map((entry) => ({
                id: randomUUID(),
                orderId,
                menuItemId: entry.item.id,
                name: entry.item.name,
                quantity: entry.quantity,
                unitPrice: entry.item.price,
                notes: entry.notes,
                status: 'pending' as const,
            })));
            await tx.insert(kdsTickets).values({
                id: randomUUID(),
                orderId,
                businessId,
                status: 'new',
                createdAt: now,
                completedAt: null,
            });
            if (typeof tableId === 'string') {
                await tx.update(restaurantTables)
                    .set({ status: 'occupied' })
                    .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.businessId, businessId)));
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'TABLE_NOT_FOUND') return c.json({ error: 'Table not found' }, 404);
        if (message === 'ITEM_NOT_FOUND') return c.json({ error: 'Menu item not found' }, 404);
        if (message === 'ITEM_UNAVAILABLE') return c.json({ error: 'Menu item is unavailable' }, 409);
        throw error;
    }
    return c.json(await orderWithItems(businessId, orderId), 201);
});

restaurant.get('/orders', async (c) => {
    const businessId = c.get('businessId');
    const { start, end } = todayBounds();
    const conditions = [
        eq(restaurantOrders.businessId, businessId),
        gte(restaurantOrders.createdAt, start),
        lt(restaurantOrders.createdAt, end),
    ];
    if (c.req.query('status') === 'active') {
        conditions.push(inArray(restaurantOrders.status, ['in_kitchen', 'ready']));
    }
    const orders = await db.select().from(restaurantOrders)
        .where(and(...conditions))
        .orderBy(sql`${restaurantOrders.createdAt} DESC`);
    if (!orders.length) return c.json([]);
    const items = await db.select().from(restaurantOrderItems)
        .where(inArray(restaurantOrderItems.orderId, orders.map((order) => order.id)));
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            inArray(restaurantPayments.orderId, orders.map((order) => order.id)),
        ));
    return c.json(orders.map((order) => ({
        ...order,
        items: items.filter((item) => item.orderId === order.id),
        payments: payments.filter((payment) => payment.orderId === order.id),
    })));
});

restaurant.patch('/orders/:id/status', async (c) => {
    const body = await parseJson<{ status?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.status !== 'string' || !orderStatuses.includes(body.status as OrderStatus)) {
        return c.json({ error: 'Invalid order status' }, 400);
    }
    if (body.status === 'paid') {
        return c.json({ error: 'Use the payment endpoint to mark restaurant orders as paid' }, 409);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return c.json({ error: 'Order not found' }, 404);

    await db.transaction(async (tx) => {
        await tx.update(restaurantOrders)
            .set({ status: body.status as OrderStatus, updatedAt: new Date() })
            .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)));
        if (body.status === 'paid' && order.tableId) {
            await tx.update(restaurantTables)
                .set({ status: 'available' })
                .where(and(
                    eq(restaurantTables.id, order.tableId),
                    eq(restaurantTables.businessId, businessId),
                ));
        }
    });
    return c.json(await orderWithItems(businessId, id));
});

restaurant.post('/orders/:id/payments', async (c) => {
    const body = await parseJson<{ method?: unknown; amount?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.method !== 'string' || !paymentMethods.includes(body.method as typeof paymentMethods[number])) {
        return c.json({ error: 'Payment method must be cash, card, or mobile' }, 400);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return c.json({ error: 'Order not found' }, 404);
    const existingPayment = await first(db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, id),
            eq(restaurantPayments.status, 'completed'),
        ))
    );
    if (order.status === 'paid' || existingPayment) {
        return c.json({ error: 'Order is already paid' }, 409);
    }
    if (order.status === 'cancelled') return c.json({ error: 'Cancelled orders cannot be paid' }, 409);
    if (!['ready', 'served'].includes(order.status)) {
        return c.json({ error: 'Order must be ready or served before payment' }, 409);
    }

    const total = order.total / 100;
    const amount = body.amount ?? total;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || Math.abs(amount - total) > 0.005) {
        return c.json({ error: `Payment amount must equal ${total.toFixed(2)}` }, 400);
    }

    try {
        await db.transaction(async (tx) => {
            await tx.execute(sql`
                SELECT id
                FROM restaurant_orders
                WHERE id = ${id} AND business_id = ${businessId}
                FOR UPDATE
            `);
            const lockedOrder = await first(tx.select().from(restaurantOrders)
                .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
            );
            if (!lockedOrder) throw new Error('ORDER_NOT_FOUND');
            if (lockedOrder.status === 'paid') throw new Error('ORDER_ALREADY_PAID');
            if (lockedOrder.status === 'cancelled') throw new Error('ORDER_CANCELLED');
            if (!['ready', 'served'].includes(lockedOrder.status)) throw new Error('ORDER_NOT_READY');
            const payment = await first(tx.select().from(restaurantPayments)
                .where(and(
                    eq(restaurantPayments.businessId, businessId),
                    eq(restaurantPayments.orderId, id),
                    eq(restaurantPayments.status, 'completed'),
                ))
            );
            if (payment) throw new Error('ORDER_ALREADY_PAID');

            const lockedTotal = lockedOrder.total / 100;
            if (Math.abs(amount - lockedTotal) > 0.005) {
                throw new Error('AMOUNT_CHANGED');
            }

            const now = new Date();
            await tx.insert(restaurantPayments).values({
                id: randomUUID(),
                businessId,
                orderId: id,
                method: body.method as typeof paymentMethods[number],
                amount,
                status: 'completed',
                paidAt: now,
            });
            await tx.update(restaurantOrders)
                .set({ status: 'paid', updatedAt: now })
                .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)));
            if (lockedOrder.tableId) {
                await tx.update(restaurantTables)
                    .set({ status: 'available' })
                    .where(and(
                        eq(restaurantTables.id, lockedOrder.tableId),
                        eq(restaurantTables.businessId, businessId),
                    ));
            }
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'ORDER_NOT_FOUND') return c.json({ error: 'Order not found' }, 404);
            if (error.message === 'ORDER_ALREADY_PAID') return c.json({ error: 'Order is already paid' }, 409);
            if (error.message === 'ORDER_CANCELLED') return c.json({ error: 'Cancelled orders cannot be paid' }, 409);
            if (error.message === 'ORDER_NOT_READY') return c.json({ error: 'Order must be ready or served before payment' }, 409);
            if (error.message === 'AMOUNT_CHANGED') return c.json({ error: `Payment amount must equal ${total.toFixed(2)}` }, 400);
        }
        throw error;
    }

    return c.json(await orderWithItems(businessId, id), 201);
});

restaurant.get('/kds', async (c) => {
    const businessId = c.get('businessId');
    const tickets = await db.select().from(kdsTickets)
        .where(and(
            eq(kdsTickets.businessId, businessId),
            or(eq(kdsTickets.status, 'new'), eq(kdsTickets.status, 'cooking')),
        ))
        .orderBy(asc(kdsTickets.createdAt));
    const payload = [];
    for (const ticket of tickets) {
        const order = await first(db.select().from(restaurantOrders)
            .where(and(
                eq(restaurantOrders.id, ticket.orderId),
                eq(restaurantOrders.businessId, businessId),
            ))
        );
        const items = await db.select().from(restaurantOrderItems)
            .where(eq(restaurantOrderItems.orderId, ticket.orderId));
        const table = order?.tableId
            ? await first(db.select().from(restaurantTables)
                .where(and(
                    eq(restaurantTables.id, order.tableId),
                    eq(restaurantTables.businessId, businessId),
                ))
            )
            : null;
        payload.push({
            ...ticket,
            order: order ? { ...order, items } : null,
            tableLabel: table?.label ?? null,
        });
    }
    return c.json(payload);
});

restaurant.patch('/kds/:id/status', async (c) => {
    const body = await parseJson<{ status?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.status !== 'string' || !ticketStatuses.includes(body.status as TicketStatus)) {
        return c.json({ error: 'Invalid KDS status' }, 400);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const ticket = await first(db.select().from(kdsTickets)
        .where(and(eq(kdsTickets.id, id), eq(kdsTickets.businessId, businessId)))
    );
    if (!ticket) return c.json({ error: 'KDS ticket not found' }, 404);

    await db.transaction(async (tx) => {
        await tx.update(kdsTickets)
            .set({
                status: body.status as TicketStatus,
                completedAt: body.status === 'done' ? new Date() : null,
            })
            .where(and(eq(kdsTickets.id, id), eq(kdsTickets.businessId, businessId)));
        if (body.status === 'cooking' || body.status === 'done') {
            await tx.update(restaurantOrders)
                .set({
                    status: body.status === 'done' ? 'ready' : 'in_kitchen',
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(restaurantOrders.id, ticket.orderId),
                    eq(restaurantOrders.businessId, businessId),
                ));
            await tx.update(restaurantOrderItems)
                .set({ status: body.status === 'done' ? 'done' : 'cooking' })
                .where(eq(restaurantOrderItems.orderId, ticket.orderId));
        }
    });
    return c.json(await first(db.select().from(kdsTickets)
        .where(and(eq(kdsTickets.id, id), eq(kdsTickets.businessId, businessId)))
    ));
});

restaurant.get('/dashboard', async (c) => {
    const businessId = c.get('businessId');
    const { start, end } = todayBounds();
    const orders = await db.select().from(restaurantOrders)
        .where(and(
            eq(restaurantOrders.businessId, businessId),
            gte(restaurantOrders.createdAt, start),
            lt(restaurantOrders.createdAt, end),
        ));
    const completedTickets = await db.select().from(kdsTickets)
        .where(and(
            eq(kdsTickets.businessId, businessId),
            eq(kdsTickets.status, 'done'),
            gte(kdsTickets.completedAt, start),
            lt(kdsTickets.completedAt, end),
        ));
    const tables = await db.select().from(restaurantTables)
        .where(eq(restaurantTables.businessId, businessId));
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.status, 'completed'),
            gte(restaurantPayments.paidAt, start),
            lt(restaurantPayments.paidAt, end),
        ));
    const prepTimes = completedTickets
        .filter((ticket) => ticket.completedAt)
        .map((ticket) => (ticket.completedAt!.getTime() - ticket.createdAt.getTime()) / 60_000);
    const occupiedTableCount = tables.filter((table) => table.status === 'occupied').length;
    const averageCapacity = tables.length
        ? tables.reduce((sum, table) => sum + table.capacity, 0) / tables.length
        : 0;
    return c.json({
        total_revenue_today: orders
            .filter((order) => order.status === 'paid')
            .reduce((sum, order) => {
                const orderPayments = payments.filter((payment) => payment.orderId === order.id);
                return sum + orderPayments.reduce(
                    (paymentSum, payment) => paymentSum + Math.round(payment.amount * 100),
                    0,
                );
            }, 0),
        active_orders_count: orders
            .filter((order) => order.status === 'in_kitchen' || order.status === 'ready')
            .length,
        avg_prep_time_minutes: prepTimes.length
            ? Math.round((prepTimes.reduce((sum, value) => sum + value, 0) / prepTimes.length) * 10) / 10
            : 0,
        live_diners_count: Math.round(occupiedTableCount * averageCapacity),
    });
});

export default restaurant;
