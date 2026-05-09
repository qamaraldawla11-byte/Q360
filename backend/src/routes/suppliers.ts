import { Hono } from 'hono';
import { db } from '../db/client.js';
import { suppliers, inventoryItems } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const suppliersRouter = new Hono();

// All supplier routes require authentication
suppliersRouter.use('/*', authMiddleware);

// GET /api/suppliers
suppliersRouter.get('/', (c) => {
    const businessId = c.get('businessId' as any) as string;
    const allSuppliers = db.select().from(suppliers).where(eq(suppliers.businessId, businessId)).all();

    // Parse JSON products field
    const parsed = allSuppliers.map(s => ({
        ...s,
        products: typeof s.products === 'string' ? JSON.parse(s.products) : s.products,
    }));

    return c.json(parsed);
});

// POST /api/procurement/orders
suppliersRouter.post('/procurement/orders', requireRole(['owner', 'admin', 'manager']), async (c) => {
    const body = await c.req.json<{ itemId: string; quantity: number }>();

    if (!body.itemId || typeof body.quantity !== 'number') {
        return c.json({ error: 'itemId and quantity are required' }, 400);
    }

    const businessId = c.get('businessId' as any) as string;
    const item = db.select().from(inventoryItems).where(and(eq(inventoryItems.id, body.itemId), eq(inventoryItems.businessId, businessId))).get();

    if (!item) {
        return c.json({ error: 'Inventory item not found' }, 404);
    }

    // For Phase 2, we "auto-receive" the order immediately
    const newCurrent = item.current + body.quantity;

    let newStatus: 'ok' | 'low' | 'critical' = 'ok';
    if (newCurrent <= item.min / 2) {
        newStatus = 'critical';
    } else if (newCurrent <= item.min) {
        newStatus = 'low';
    }

    db.update(inventoryItems)
        .set({ current: newCurrent, status: newStatus })

        .where(and(eq(inventoryItems.id, body.itemId), eq(inventoryItems.businessId, businessId)))
        .run();

    await logAudit(c, 'PROCUREMENT_ORDER', 'INVENTORY', body.itemId, { quantity: body.quantity, supplierId: item.supplier });

    return c.json({
        orderId: `po_${Date.now()}`,
        itemId: body.itemId,
        itemName: item.name,
        quantity: body.quantity,
        status: 'received', // Auto-received for Phase 2
        newStock: newCurrent,
    }, 201);
});

export default suppliersRouter;
