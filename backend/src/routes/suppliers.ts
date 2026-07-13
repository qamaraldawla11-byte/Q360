import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businesses, inventoryItems, purchaseExpenseRecords, purchaseOrders, stockMovements, suppliers } from '../db/schema.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';
import { duplicateKeysFor } from '../services/purchaseExpenses.js';

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

suppliersRouter.patch('/:id', requireRole(['user', 'owner', 'admin', 'manager']), async c => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Supplier ID is required' }, 400);
    let body: { name?: unknown; contact?: unknown; phone?: unknown; email?: unknown; address?: unknown; status?: unknown };
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const businessId = c.get('businessId');
    const existing = await first(db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.businessId, businessId))));
    if (!existing) return c.json({ error: 'Supplier not found' }, 404);
    const name = body.name === undefined ? existing.name : typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Supplier name is required' }, 400);
    if (body.email !== undefined && typeof body.email !== 'string') return c.json({ error: 'Invalid supplier email' }, 400);
    if (body.status !== undefined && !['active', 'inactive'].includes(String(body.status))) return c.json({ error: 'Invalid supplier status' }, 400);
    const optionalText = (value: unknown, current: string | null) => value === undefined ? current : typeof value === 'string' ? value.trim() || null : current;
    const [updated] = await db.update(suppliers).set({
        name,
        contact: optionalText(body.contact, existing.contact),
        phone: optionalText(body.phone, existing.phone),
        email: optionalText(body.email, existing.email),
        address: optionalText(body.address, existing.address),
        status: typeof body.status === 'string' ? body.status : existing.status,
    }).where(and(eq(suppliers.id, id), eq(suppliers.businessId, businessId))).returning();
    await logAudit(c, 'UPDATE', 'SUPPLIER', id, { fields: Object.keys(body) });
    return c.json(updated);
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
    const supplier = order.supplierId ? await first(db.select().from(suppliers).where(and(eq(suppliers.id, order.supplierId), eq(suppliers.businessId, businessId)))) : null;
    const business = await first(db.select({ currency: businesses.currency }).from(businesses).where(eq(businesses.id, businessId)));
    const receivedAt = new Date();
    let newCurrent = item.current;
    let financeRecordId: string | null = null;
    try {
        await db.transaction(async tx => {
            const [receivedOrder] = await tx.update(purchaseOrders).set({ status: 'received', receivedAt })
                .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.businessId, businessId), eq(purchaseOrders.status, 'ordered')))
                .returning({ id: purchaseOrders.id });
            if (!receivedOrder) throw new Error('PURCHASE_ORDER_ALREADY_RECEIVED');

            const [updatedItem] = await tx.update(inventoryItems)
                .set({ current: sql`${inventoryItems.current} + ${order.quantity}` })
                .where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.businessId, businessId)))
                .returning({ current: inventoryItems.current, min: inventoryItems.min });
            if (!updatedItem) throw new Error('INVENTORY_ITEM_NOT_FOUND');
            newCurrent = updatedItem.current;
            const status = newCurrent <= updatedItem.min / 2 ? 'critical' : newCurrent <= updatedItem.min ? 'low' : 'ok';
            await tx.update(inventoryItems).set({ status }).where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.businessId, businessId)));
            await tx.insert(stockMovements).values({ id: randomUUID(), businessId, inventoryItemId: item.id, purchaseOrderId: id, delta: order.quantity, reason: 'purchase_received', createdBy: c.get('userId') });

            const amountMinor = Math.round(order.quantity * order.unitCost * 100);
            if (amountMinor > 0) {
                financeRecordId = randomUUID();
                const recordDate = receivedAt.toISOString().slice(0, 10);
                const reference = `PUR-${recordDate.replace(/-/g, '')}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
                const financeInput = { recordType: 'purchase' as const, supplierName: supplier?.name || null, supplierId: supplier?.id || null, category: 'Ingredients & stock', amountMinor, currency: business?.currency || 'USD', recordDate, reference, notes: `Stock received: ${order.quantity} ${item.unit} ${item.name}` };
                const duplicateKeys = duplicateKeysFor(financeInput);
                await tx.insert(purchaseExpenseRecords).values({ id: financeRecordId, businessId, ...financeInput, purchaseOrderId: id, source: 'purchase_order', duplicateKeyExact: duplicateKeys.exact, duplicateFingerprint: duplicateKeys.fingerprint, createdBy: c.get('userId'), updatedBy: c.get('userId'), createdAt: receivedAt, updatedAt: receivedAt });
            }
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'PURCHASE_ORDER_ALREADY_RECEIVED') return c.json({ error: 'Purchase order already received' }, 409);
        if (error instanceof Error && error.message === 'INVENTORY_ITEM_NOT_FOUND') return c.json({ error: 'Inventory item not found' }, 404);
        throw error;
    }
    await logAudit(c, 'PURCHASE_ORDER_RECEIVED', 'PURCHASE_ORDER', id, { itemId: item.id, quantity: order.quantity, newCurrent });
    return c.json({ ...order, status: 'received', receivedAt: receivedAt.toISOString(), newStock: newCurrent, financeRecordId });
});

export default suppliersRouter;
