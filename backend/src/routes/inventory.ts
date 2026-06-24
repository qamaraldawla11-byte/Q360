import { Hono } from 'hono';
import { db, first } from '../db/client.js';
import { inventoryItems, products } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import type { AppEnv } from '../types/app.js';

const inventory = new Hono<AppEnv>();

// All inventory routes require authentication
inventory.use('/*', authMiddleware);

// GET /api/inventory
inventory.get('/', async (c) => {
    const businessId = c.get('businessId');
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.businessId, businessId));
    return c.json(items);
});

// GET /api/inventory/:id
inventory.get('/:id', async (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId');
    const item = await first(db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId))));

    if (!item) {
        return c.json({ error: 'Item not found' }, 404);
    }

    return c.json(item);
});

// PATCH /api/inventory/:id/stock
inventory.patch('/:id/stock', requireRole(['owner', 'admin', 'manager']), async (c) => {
    const id = c.req.param('id');
    if (!id) {
        return c.json({ error: 'Item ID is required' }, 400);
    }
    const businessId = c.get('businessId');
    const body = await c.req.json<{ delta: number }>();

    if (typeof body.delta !== 'number' || !Number.isFinite(body.delta)) {
        return c.json({ error: 'Delta must be a finite number' }, 400);
    }
    const delta = body.delta;

    const item = await first(db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId))));

    if (!item) {
        return c.json({ error: 'Item not found' }, 404);
    }

    const newCurrent = Math.max(0, item.current + delta);

    // Calculate new status
    let newStatus: 'ok' | 'low' | 'critical' = 'ok';
    if (newCurrent <= item.min / 2) {
        newStatus = 'critical';
    } else if (newCurrent <= item.min) {
        newStatus = 'low';
    }

    await db.update(inventoryItems)
        .set({ current: newCurrent, status: newStatus })
        .where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId)));

    await logAudit(c, 'UPDATE_STOCK', 'INVENTORY', id, { delta, newCurrent, newStatus });

    const updatedItem = await first(db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.businessId, businessId))));

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
    if (typeof body.current !== 'number' || !Number.isFinite(body.current) || body.current < 0) {
        return c.json({ error: 'current is required and must be a non-negative finite number' }, 400);
    }
    if (typeof body.min !== 'number' || !Number.isFinite(body.min) || body.min < 0) {
        return c.json({ error: 'min is required and must be a non-negative finite number' }, 400);
    }
    if (!body.unit || typeof body.unit !== 'string') {
        return c.json({ error: 'unit is required and must be a string' }, 400);
    }
    if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) {
        return c.json({ error: 'price is required and must be a non-negative finite number' }, 400);
    }
    if (body.max !== undefined && (!Number.isFinite(body.max) || body.max < body.current)) {
        return c.json({ error: 'max must be finite and greater than or equal to current stock' }, 400);
    }
    if (body.barcode !== undefined && (typeof body.barcode !== 'string' || !body.barcode.trim())) {
        return c.json({ error: 'barcode must be a non-empty string' }, 400);
    }

    const newId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const businessId = c.get('businessId');
    const status = body.current <= body.min / 2 ? 'critical' : body.current <= body.min ? 'low' : 'ok';

    try {
        await db.transaction(async (tx) => {
            await tx.insert(inventoryItems).values({
                id: newId,
                name: body.name!.trim(),
                current: body.current!,
                min: body.min!,
                max: body.max,
                unit: body.unit!.trim(),
                barcode: body.barcode?.trim(),
                category: body.category?.trim(),
                status,
                supplier: body.supplier?.trim(),
                price: body.price!,
                businessId,
            });

            if (body.barcode) {
                await tx.insert(products).values({
                    id: newId,
                    name: body.name!.trim(),
                    barcode: body.barcode.trim(),
                    price: body.price!,
                    category: body.category?.trim(),
                    businessId,
                });
            }
        });

        const createdItem = await first(db.select().from(inventoryItems)
            .where(and(eq(inventoryItems.id, newId), eq(inventoryItems.businessId, businessId)))
        );

        await logAudit(c, 'CREATE', 'INVENTORY', newId, { name: body.name });

        console.log(`[INVENTORY] Created item ${newId}: ${body.name}`);
        return c.json(createdItem, 201);
    } catch (error) {
        console.error('[INVENTORY] Failed to create item:', error);
        return c.json({ error: 'Failed to create inventory item' }, 500);
    }
});

export default inventory;
