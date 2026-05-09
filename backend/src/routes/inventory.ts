import { Hono } from 'hono';
import { db } from '../db/client.js';
import { inventoryItems } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const inventory = new Hono();

// All inventory routes require authentication
inventory.use('/*', authMiddleware);

// GET /api/inventory
inventory.get('/', (c) => {
    const businessId = c.get('businessId' as any) as string;
    const items = db.select().from(inventoryItems).where(eq(inventoryItems.businessId, businessId)).all();
    return c.json(items);
});

// GET /api/inventory/:id
inventory.get('/:id', (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId' as any) as string;
    const item = db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId))).get();

    if (!item) {
        return c.json({ error: 'Item not found' }, 404);
    }

    return c.json(item);
});

// PATCH /api/inventory/:id/stock
inventory.patch('/:id/stock', requireRole(['owner', 'admin', 'manager']), async (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId' as any) as string;
    const body = await c.req.json<{ delta: number }>();

    if (typeof body.delta !== 'number') {
        return c.json({ error: 'Delta must be a number' }, 400);
    }

    const item = db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId))).get();

    if (!item) {
        return c.json({ error: 'Item not found' }, 404);
    }

    const newCurrent = Math.max(0, item.current + body.delta);

    // Calculate new status
    let newStatus: 'ok' | 'low' | 'critical' = 'ok';
    if (newCurrent <= item.min / 2) {
        newStatus = 'critical';
    } else if (newCurrent <= item.min) {
        newStatus = 'low';
    }

    db.update(inventoryItems)
        .set({ current: newCurrent, status: newStatus })
        .where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId)))
        .run();

    await logAudit(c, 'UPDATE_STOCK', 'INVENTORY', id, { delta: body.delta, newCurrent, newStatus });

    const updatedItem = db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId))).get();

    return c.json(updatedItem);
});

// POST /api/inventory
inventory.post('/', requireRole(['owner', 'admin', 'manager']), async (c) => {
    let body: {
        name?: string;
        current?: number;
        min?: number;
        max?: number;
        unit?: string;
        barcode?: string;
        category?: string;
        status?: string;
        supplier?: string;
        price?: number;
    };

    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
        return c.json({ error: 'name is required and must be a string' }, 400);
    }
    if (typeof body.current !== 'number') {
        return c.json({ error: 'current is required and must be a number' }, 400);
    }
    if (typeof body.min !== 'number') {
        return c.json({ error: 'min is required and must be a number' }, 400);
    }
    if (!body.unit || typeof body.unit !== 'string') {
        return c.json({ error: 'unit is required and must be a string' }, 400);
    }
    if (typeof body.price !== 'number') {
        return c.json({ error: 'price is required and must be a number' }, 400);
    }

    const newId = `inv_${Date.now()}`;

    try {
        db.insert(inventoryItems).values({
            id: newId,
            name: body.name,
            current: body.current,
            min: body.min,
            max: body.max,
            unit: body.unit,
            barcode: body.barcode,
            category: body.category,
            status: body.status || 'ok',
            supplier: body.supplier,
            price: body.price,
            businessId: c.get('businessId' as any) as string,
        }).run();

        const createdItem = db.select().from(inventoryItems).where(eq(inventoryItems.id, newId)).get();

        await logAudit(c, 'CREATE', 'INVENTORY', newId, { name: body.name });

        console.log(`[INVENTORY] Created item ${newId}: ${body.name}`);
        return c.json(createdItem, 201);
    } catch (error) {
        console.error('[INVENTORY] Failed to create item:', error);
        return c.json({ error: 'Failed to create inventory item' }, 500);
    }
});

export default inventory;
