import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, first } from '../db/client.js';
import { customers } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
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
customersRouter.post('/', async (c) => {
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

export default customersRouter;
