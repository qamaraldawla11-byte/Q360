import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { inventoryItems, purchaseOrders, stockMovements, suppliers } from '../db/schema.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';

const suppliersRouter = new Hono<AppEnv>();
suppliersRouter.use('/*', authMiddleware);

suppliersRouter.get('/', async c => c.json(await db.select().from(suppliers).where(eq(suppliers.businessId, c.get('businessId')))));

suppliersRouter.post('/', requireRole(['user', 'owner', 'admin', 'manager']), async c => {
    let body: { name?: unknown; contact?: unknown; phone?: unknown; email?: unknown; address?: unknown };
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Supplier name is required' }, 400);
    const id = randomUUID();
    const [created] = await db.insert(suppliers).values({
        id, businessId: c.get('businessId'), name,
        contact: typeof body.contact === 'string' ? body.contact.trim() || null : null,
        phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
        email: typeof body.email === 'string' ? body.email.trim() || null : null,
        address: typeof body.address === 'string' ? body.address.trim() || null : null,
        products: [], status: 'active',
    }).returning();
    await logAudit(c, 'CREATE', 'SUPPLIER', id, { name });
    return c.json(created, 201);
});

suppliersRouter.get('/procurement/orders', async c => c.json(await db.select().from(purchaseOrders)
    .where(eq(purchaseOrders.businessId, c.get('businessId'))).orderBy(desc(purchaseOrders.orderedAt))));

suppliersRouter.post('/procurement/orders', requireRole(['user', 'owner', 'admin', 'manager']), async c => {
    let body: { itemId?: unknown; supplierId?: unknown; quantity?: unknown; unitCost?: unknown };
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    if (typeof body.itemId !== 'string' || typeof body.quantity !== 'number' || !Number.isFinite(body.quantity) || body.quantity <= 0 || typeof body.unitCost !== 'number' || !Number.isFinite(body.unitCost) || body.unitCost < 0) {
        return c.json({ error: 'Item, positive quantity, and non-negative unit cost are required' }, 400);
    }
    const businessId = c.get('businessId');
    const item = await first(db.select().from(inventoryItems).where(and(eq(inventoryItems.id, body.itemId), eq(inventoryItems.businessId, businessId))));
    if (!item) return c.json({ error: 'Inventory item not found' }, 404);
    if (body.supplierId !== undefined && typeof body.supplierId !== 'string') return c.json({ error: 'Invalid supplier' }, 400);
    if (typeof body.supplierId === 'string') {
        const supplier = await first(db.select().from(suppliers).where(and(eq(suppliers.id, body.supplierId), eq(suppliers.businessId, businessId))));
        if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    }
    const id = randomUUID();
    const [created] = await db.insert(purchaseOrders).values({ id, businessId, supplierId: typeof body.supplierId === 'string' ? body.supplierId : null, inventoryItemId: item.id, quantity: body.quantity, unitCost: body.unitCost, createdBy: c.get('userId') }).returning();
    await logAudit(c, 'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER', id, { itemId: item.id, quantity: body.quantity });
    return c.json(created, 201);
});

suppliersRouter.patch('/procurement/orders/:id/receive', requireRole(['user', 'owner', 'admin', 'manager']), async c => {
    const businessId = c.get('businessId');
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Purchase order ID is required' }, 400);
    const order = await first(db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.businessId, businessId))));
    if (!order) return c.json({ error: 'Purchase order not found' }, 404);
    if (order.status === 'received') return c.json({ error: 'Purchase order already received' }, 409);
    if (order.status !== 'ordered') return c.json({ error: 'Purchase order cannot be received' }, 409);
    const item = await first(db.select().from(inventoryItems).where(and(eq(inventoryItems.id, order.inventoryItemId), eq(inventoryItems.businessId, businessId))));
    if (!item) return c.json({ error: 'Inventory item not found' }, 404);
    const newCurrent = item.current + order.quantity;
    const status = newCurrent <= item.min / 2 ? 'critical' : newCurrent <= item.min ? 'low' : 'ok';
    await db.transaction(async tx => {
        await tx.update(inventoryItems).set({ current: newCurrent, status }).where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.businessId, businessId)));
        await tx.update(purchaseOrders).set({ status: 'received', receivedAt: new Date() }).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.businessId, businessId)));
        await tx.insert(stockMovements).values({ id: randomUUID(), businessId, inventoryItemId: item.id, purchaseOrderId: id, delta: order.quantity, reason: 'purchase_received', createdBy: c.get('userId') });
    });
    await logAudit(c, 'PURCHASE_ORDER_RECEIVED', 'PURCHASE_ORDER', id, { itemId: item.id, quantity: order.quantity, newCurrent });
    return c.json({ ...order, status: 'received', receivedAt: new Date().toISOString(), newStock: newCurrent });
});

export default suppliersRouter;
