import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, first } from '../db/client.js';
import { customers, products, quoteItems, quotes } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import type { AppEnv } from '../types/app.js';

const quotesRouter = new Hono<AppEnv>();

quotesRouter.use('/*', authMiddleware);

type QuoteItemInput = {
    productId?: unknown;
    description?: unknown;
    quantity?: unknown;
    unitPrice?: unknown;
};

type QuoteInput = {
    customerId?: unknown;
    validUntil?: unknown;
    notes?: unknown;
    currency?: unknown;
    items?: unknown;
};

type CanonicalQuoteItem = {
    id: string;
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
};

class QuoteValidationError extends Error {
    constructor(
        message: string,
        readonly status: 400 | 404,
    ) {
        super(message);
    }
}

const optionalText = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

const optionalNullableText = (value: unknown) => {
    if (value === null) return null;
    if (typeof value === 'string') return value.trim() || null;
    return undefined;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const parseValidUntil = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value !== 'string') {
        throw new QuoteValidationError('validUntil must be an ISO date string when provided', 400);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new QuoteValidationError('validUntil must be a valid ISO date string', 400);
    }
    return date;
};

const parseCurrency = (value: unknown) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value.trim()) {
        throw new QuoteValidationError('currency must be a non-empty string when provided', 400);
    }
    return value.trim().toUpperCase();
};

const validateCustomer = async (
    customerId: unknown,
    businessId: string,
    required = false,
) => {
    if (customerId === undefined || customerId === null || customerId === '') {
        if (required) {
            throw new QuoteValidationError('customerId is required', 400);
        }
        return null;
    }
    if (typeof customerId !== 'string') {
        throw new QuoteValidationError('customerId must be a string when provided', 400);
    }
    const customer = await first(db.select()
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.businessId, businessId)))
    );
    if (!customer) {
        throw new QuoteValidationError('Customer not found', 404);
    }
    return customerId;
};

const canonicalizeItems = async (
    rawItems: unknown,
    businessId: string,
) => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new QuoteValidationError('items array is required', 400);
    }

    const canonicalItems: CanonicalQuoteItem[] = [];

    for (const rawItem of rawItems) {
        const item = rawItem as QuoteItemInput;
        if (!item || typeof item !== 'object') {
            throw new QuoteValidationError('Each item must be an object', 400);
        }

        const quantity = item.quantity;
        if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
            throw new QuoteValidationError('Each item quantity must be a positive number', 400);
        }

        let productId: string | undefined;
        let description = optionalText(item.description);
        let unitPrice = item.unitPrice;

        if (item.productId !== undefined && item.productId !== null && item.productId !== '') {
            if (typeof item.productId !== 'string') {
                throw new QuoteValidationError('productId must be a string when provided', 400);
            }

            const product = await first(db.select()
                .from(products)
                .where(and(eq(products.id, item.productId), eq(products.businessId, businessId)))
            );
            if (!product) {
                throw new QuoteValidationError(`Product ${item.productId} was not found`, 404);
            }

            productId = product.id;
            description ||= product.name;
            unitPrice = typeof unitPrice === 'number' ? unitPrice : product.price;
        }

        if (!description) {
            throw new QuoteValidationError('Each item description must be a non-empty string', 400);
        }
        if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new QuoteValidationError('Each item unitPrice must be a non-negative number', 400);
        }

        const lineTotal = roundMoney(quantity * unitPrice);
        canonicalItems.push({
            id: `qitem_${randomUUID()}`,
            productId,
            description,
            quantity,
            unitPrice,
            lineTotal,
        });
    }

    const subtotal = roundMoney(canonicalItems.reduce((sum, item) => sum + item.lineTotal, 0));
    const discountTotal = 0;
    const taxTotal = 0;
    const total = roundMoney(subtotal - discountTotal + taxTotal);

    return { canonicalItems, subtotal, discountTotal, taxTotal, total };
};

const quoteWithItems = async (quoteId: string, businessId: string) => {
    const quote = await first(db.select()
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.businessId, businessId)))
    );
    if (!quote) return undefined;

    const items = await db.select()
        .from(quoteItems)
        .where(and(eq(quoteItems.quoteId, quoteId), eq(quoteItems.businessId, businessId)));

    return { ...quote, items };
};

// GET /api/quotes
quotesRouter.get('/', async (c) => {
    const businessId = c.get('businessId');
    const quoteRows = await db.select()
        .from(quotes)
        .where(eq(quotes.businessId, businessId));

    return c.json(quoteRows);
});

// GET /api/quotes/:id
quotesRouter.get('/:id', async (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId');
    const quote = await quoteWithItems(id, businessId);

    if (!quote) {
        return c.json({ error: 'Quote not found' }, 404);
    }

    return c.json(quote);
});

// POST /api/quotes
quotesRouter.post('/', async (c) => {
    let body: QuoteInput;

    try {
        body = await c.req.json<QuoteInput>();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const businessId = c.get('businessId');
    const quoteId = `quote_${randomUUID()}`;
    const quoteNumber = `Q-${Date.now()}`;

    try {
        const validUntil = parseValidUntil(body.validUntil);
        const currency = parseCurrency(body.currency) || 'USD';
        const customerId = await validateCustomer(body.customerId, businessId, true);
        const totals = await canonicalizeItems(body.items, businessId);

        await db.transaction(async (tx) => {
            await tx.insert(quotes).values({
                id: quoteId,
                businessId,
                customerId,
                quoteNumber,
                status: 'draft',
                subtotal: totals.subtotal,
                discountTotal: totals.discountTotal,
                taxTotal: totals.taxTotal,
                total: totals.total,
                currency,
                validUntil,
                notes: optionalText(body.notes),
            });

            await tx.insert(quoteItems).values(totals.canonicalItems.map((item) => ({
                id: item.id,
                businessId,
                quoteId,
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
            })));
        });

        const createdQuote = await quoteWithItems(quoteId, businessId);
        await logAudit(c, 'CREATE', 'QUOTE', quoteId, { quoteNumber, total: totals.total });

        return c.json(createdQuote, 201);
    } catch (error) {
        if (error instanceof QuoteValidationError) {
            return c.json({ error: error.message }, error.status);
        }
        console.error('[QUOTES] Failed to create quote:', error);
        return c.json({ error: 'Failed to create quote' }, 500);
    }
});

// PATCH /api/quotes/:id
quotesRouter.patch('/:id', async (c) => {
    let body: QuoteInput;

    try {
        body = await c.req.json<QuoteInput>();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const id = c.req.param('id');
    const businessId = c.get('businessId');

    try {
        const existingQuote = await first(db.select()
            .from(quotes)
            .where(and(eq(quotes.id, id), eq(quotes.businessId, businessId)))
        );

        if (!existingQuote) {
            throw new QuoteValidationError('Quote not found', 404);
        }
        if (existingQuote.status !== 'draft') {
            throw new QuoteValidationError('Only draft quotes can be updated', 400);
        }

        const updates: Partial<typeof quotes.$inferInsert> = {};
        let replacementItems: CanonicalQuoteItem[] | undefined;

        if ('customerId' in body) {
            updates.customerId = await validateCustomer(body.customerId, businessId);
        }
        if ('validUntil' in body) {
            updates.validUntil = parseValidUntil(body.validUntil);
        }
        if ('notes' in body) {
            updates.notes = optionalNullableText(body.notes);
        }
        if ('currency' in body) {
            updates.currency = parseCurrency(body.currency);
        }

        if ('items' in body) {
            const totals = await canonicalizeItems(body.items, businessId);
            updates.subtotal = totals.subtotal;
            updates.discountTotal = totals.discountTotal;
            updates.taxTotal = totals.taxTotal;
            updates.total = totals.total;
            replacementItems = totals.canonicalItems;
        }

        if (Object.keys(updates).length === 0) {
            throw new QuoteValidationError('At least one supported quote field is required', 400);
        }

        await db.transaction(async (tx) => {
            if (replacementItems) {
                await tx.delete(quoteItems)
                    .where(and(eq(quoteItems.quoteId, id), eq(quoteItems.businessId, businessId)));
                await tx.insert(quoteItems).values(replacementItems.map((item) => ({
                    id: item.id,
                    businessId,
                    quoteId: id,
                    productId: item.productId,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.lineTotal,
                })));
            }

            await tx.update(quotes)
                .set({ ...updates, updatedAt: new Date() })
                .where(and(eq(quotes.id, id), eq(quotes.businessId, businessId)));
        });

        const updatedQuote = await quoteWithItems(id, businessId);
        if (!updatedQuote) {
            throw new QuoteValidationError('Quote not found', 404);
        }

        await logAudit(c, 'UPDATE', 'QUOTE', id, { fields: Object.keys(body) });

        return c.json(updatedQuote);
    } catch (error) {
        if (error instanceof QuoteValidationError) {
            return c.json({ error: error.message }, error.status);
        }
        console.error('[QUOTES] Failed to update quote:', error);
        return c.json({ error: 'Failed to update quote' }, 500);
    }
});

export default quotesRouter;
