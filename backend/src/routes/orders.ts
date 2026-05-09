import { Hono } from 'hono';
import { db } from '../db/client.js';
import { products, orders, inventoryItems } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const ordersRouter = new Hono();

// All order routes require authentication
ordersRouter.use('/*', authMiddleware);

// GET /api/products/search?barcode=
ordersRouter.get('/products/search', (c) => {
    const barcode = c.req.query('barcode');

    if (!barcode) {
        return c.json({ error: 'Barcode query parameter is required' }, 400);
    }

    const businessId = c.get('businessId' as any) as string;
    const product = db.select().from(products).where(and(eq(products.barcode, barcode), eq(products.businessId, businessId))).get();

    if (!product) {
        return c.json(null);
    }

    return c.json(product);
});

// POST /api/orders
ordersRouter.post('/orders', requireRole(['owner', 'admin', 'manager', 'staff']), async (c) => {
    let body: { items: { id: string; name: string; price: number; quantity: number }[] };

    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ error: 'Items array is required' }, 400);
    }

    // Validate all items have required fields
    for (const item of body.items) {
        if (!item.id || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
            return c.json({ error: 'Each item must have id, price, and quantity' }, 400);
        }
    }

    // Calculate totals
    const subtotal = body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    // Generate unique order ID with random suffix to prevent collision
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
        // Use SQLite transaction for atomicity
        const { sqlite } = await import('../db/client.js');

        sqlite.transaction(() => {
            // Create order
            db.insert(orders).values({
                id: orderId,
                items: body.items,
                subtotal,
                tax,
                total,
                businessId: c.get('businessId' as any) as string,
            }).run();

            // Deduct inventory for each item
            for (const item of body.items) {
                const businessId = c.get('businessId' as any) as string; // Capture scope
                const inventoryItem = db.select().from(inventoryItems).where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.businessId, businessId))).get();

                if (inventoryItem) {
                    const newCurrent = Math.max(0, inventoryItem.current - item.quantity);

                    let newStatus: 'ok' | 'low' | 'critical' = 'ok';
                    if (newCurrent <= inventoryItem.min / 2) {
                        newStatus = 'critical';
                    } else if (newCurrent <= inventoryItem.min) {
                        newStatus = 'low';
                    }

                    db.update(inventoryItems)
                        .set({ current: newCurrent, status: newStatus })

                        .where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.businessId, businessId)))
                        .run();
                }
            }
        })();



        await logAudit(c, 'CREATE_ORDER', 'ORDER', orderId, { total, itemsCount: body.items.length });

        console.log(`[ORDERS] Created order ${orderId} with ${body.items.length} items, total: $${total.toFixed(2)}`);

        return c.json({
            orderId,
            subtotal,
            tax,
            total,
        }, 201);
    } catch (error) {
        console.error(`[ORDERS] Failed to create order:`, error);
        return c.json({ error: 'Failed to create order' }, 500);
    }
});

// GET /api/orders/:id
ordersRouter.get('/orders/:id', (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId' as any) as string;
    const order = db.select().from(orders).where(and(eq(orders.id, id), eq(orders.businessId, businessId))).get();

    if (!order) {
        return c.json({ error: 'Order not found' }, 404);
    }

    return c.json(order);
});

export default ordersRouter;
