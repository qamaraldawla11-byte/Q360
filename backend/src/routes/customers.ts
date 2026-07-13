import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, first } from '../db/client.js';
import { customers } from '../db/schema.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import type { AppEnv } from '../types/app.js';

const customersRouter = new Hono<AppEnv>();

customersRouter.use('/*', authMiddleware);

type CustomerInput = {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    companyName?: unknown;
    address?: unknown;
    notes?: unknown;
};

const optionalText = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

const optionalUpdateText = (value: unknown) => {
    if (value === null) return null;
    if (typeof value === 'string') return value.trim() || null;
    return undefined;
};

// GET /api/customers
customersRouter.get('/', async (c) => {
    const businessId = c.get('businessId');
    const customerRows = await db.select()
        .from(customers)
        .where(eq(customers.businessId, businessId));

    return c.json(customerRows);
});

// GET /api/customers/:id
customersRouter.get('/:id', async (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId');
    const customer = await first(db.select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
    );

    if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
    }

    return c.json(customer);
});

// POST /api/customers
customersRouter.post('/', requireRole(['owner', 'admin', 'manager']), async (c) => {
    let body: CustomerInput;

    try {
        body = await c.req.json<CustomerInput>();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return c.json({ error: 'name is required and must be a non-empty string' }, 400);
    }

    const businessId = c.get('businessId');
    const customerId = `cust_${randomUUID()}`;
    const name = body.name.trim();

    await db.insert(customers).values({
        id: customerId,
        businessId,
        name,
        phone: optionalText(body.phone),
        email: optionalText(body.email),
        companyName: optionalText(body.companyName),
        address: optionalText(body.address),
        notes: optionalText(body.notes),
    });

    const createdCustomer = await first(db.select()
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.businessId, businessId)))
    );

    await logAudit(c, 'CREATE', 'CUSTOMER', customerId, { name });

    return c.json(createdCustomer, 201);
});

// PATCH /api/customers/:id
customersRouter.patch('/:id', requireRole(['owner', 'admin', 'manager']), async (c) => {
    let body: CustomerInput;

    try {
        body = await c.req.json<CustomerInput>();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const updates: Partial<typeof customers.$inferInsert> = {};

    if ('name' in body) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            return c.json({ error: 'name must be a non-empty string when provided' }, 400);
        }
        updates.name = body.name.trim();
    }

    const phone = optionalUpdateText(body.phone);
    const email = optionalUpdateText(body.email);
    const companyName = optionalUpdateText(body.companyName);
    const address = optionalUpdateText(body.address);
    const notes = optionalUpdateText(body.notes);

    if ('phone' in body) updates.phone = phone;
    if ('email' in body) updates.email = email;
    if ('companyName' in body) updates.companyName = companyName;
    if ('address' in body) updates.address = address;
    if ('notes' in body) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
        return c.json({ error: 'At least one supported customer field is required' }, 400);
    }

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Customer id is required' }, 400);
    const businessId = c.get('businessId');
    const updatedCustomer = await first(db.update(customers)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
        .returning()
    );

    if (!updatedCustomer) {
        return c.json({ error: 'Customer not found' }, 404);
    }

    await logAudit(c, 'UPDATE', 'CUSTOMER', id, { fields: Object.keys(updates) });

    return c.json(updatedCustomer);
});

export default customersRouter;
