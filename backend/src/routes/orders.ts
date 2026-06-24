import { Hono } from 'hono';
import { db, first } from '../db/client.js';
import { products, orders, inventoryItems } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import type { AppEnv } from '../types/app.js';

const ordersRouter = new Hono<AppEnv>();

class OrderValidationError extends Error {
    constructor(
        message: string,
        readonly status: 400 | 404 | 409,
    ) {
        super(message);
    }
}

// All order routes require authentication
ordersRouter.use('/*', authMiddleware);

// GET /api/products/search?barcode=
ordersRouter.get('/products/search', async (c) => {
    const barcode = c.req.query('barcode');

    if (!barcode) {
        return c.json({ error: 'Barcode query parameter is required' }, 400);
    }

    const businessId = c.get('businessId');
    const product = await first(db.select().from(products).where(and(eq(products.barcode, barcode), eq(products.businessId, businessId))));

    if (!product) {
        return c.json(null);
    }

    return c.json(product);
});

// POST /api/orders
ordersRouter.post('/orders', requireRole(['owner', 'admin', 'manager', 'staff']), async (c) => {
    let body: { items?: { id?: unknown; quantity?: unknown }[] };

    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ error: 'Items array is required' }, 400);
    }

    for (const item of body.items) {
        if (
            typeof item.id !== 'string' ||
            typeof item.quantity !== 'number' ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0
        ) {
            return c.json({ error: 'Each item must have an id and a positive integer quantity' }, 400);
        }
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const businessId = c.get('businessId');

    try {
        const result = await db.transaction(async (tx) => {
            const quantities = new Map<string, number>();
            for (const item of body.items!) {
                const id = item.id as string;
                quantities.set(id, (quantities.get(id) || 0) + (item.quantity as number));
            }

            const canonicalItems: { id: string; name: string; price: number; quantity: number }[] = [];
            for (const [id, quantity] of quantities) {
                const product = await first(tx.select().from(products)
                    .where(and(eq(products.id, id), eq(products.businessId, businessId)))
                );
                const inventoryItem = await first(tx.select().from(inventoryItems)
                    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId)))
                );

                if (!product || !inventoryItem) {
                    throw new OrderValidationError(`Product ${id} was not found`, 404);
                }
                if (inventoryItem.current < quantity) {
                    throw new OrderValidationError(
                        `Insufficient stock for ${product.name}. Available: ${inventoryItem.current}`,
                        409,
                    );
                }

                canonicalItems.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity,
                });
            }

            const subtotal = canonicalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.1;
            const total = subtotal + tax;

            await tx.insert(orders).values({
                id: orderId,
                items: canonicalItems,
                subtotal,
                tax,
                total,
                businessId,
            });

            for (const item of canonicalItems) {
                const inventoryItem = await first(tx.select().from(inventoryItems)
                    .where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.businessId, businessId)))
                );
                if (!inventoryItem) {
                    throw new OrderValidationError(`Product ${item.id} was not found`, 404);
                }
                const newCurrent = inventoryItem.current - item.quantity;

                let newStatus: 'ok' | 'low' | 'critical' = 'ok';
                if (newCurrent <= inventoryItem.min / 2) {
                    newStatus = 'critical';
                } else if (newCurrent <= inventoryItem.min) {
                    newStatus = 'low';
                }

                await tx.update(inventoryItems)
                    .set({ current: newCurrent, status: newStatus })
                    .where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.businessId, businessId)));
            }

            return { canonicalItems, subtotal, tax, total };
        });

        await logAudit(c, 'CREATE_ORDER', 'ORDER', orderId, {
            total: result.total,
            itemsCount: result.canonicalItems.length,
        });

        console.log(`[ORDERS] Created order ${orderId} with ${result.canonicalItems.length} items, total: $${result.total.toFixed(2)}`);

        return c.json({
            orderId,
            subtotal: result.subtotal,
            tax: result.tax,
            total: result.total,
        }, 201);
    } catch (error) {
        if (error instanceof OrderValidationError) {
            return c.json({ error: error.message }, error.status);
        }
        console.error(`[ORDERS] Failed to create order:`, error);
        return c.json({ error: 'Failed to create order' }, 500);
    }
});

// GET /api/orders/:id
ordersRouter.get('/orders/:id', async (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId');
    const order = await first(db.select().from(orders).where(and(eq(orders.id, id), eq(orders.businessId, businessId))));

    if (!order) {
        return c.json({ error: 'Order not found' }, 404);
    }

    return c.json(order);
});

export default ordersRouter;
