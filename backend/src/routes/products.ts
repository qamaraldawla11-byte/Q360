import { Hono } from 'hono';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, first } from '../db/client.js';
import { products } from '../db/schema.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { requireModule } from '../middleware/moduleAuthorization.js';
import { SHARED_WORKSPACE_KEY } from '../services/businessModules.js';
import { logAudit } from '../utils/audit.js';
import type { AppEnv } from '../types/app.js';

const productsRouter = new Hono<AppEnv>();

productsRouter.use('/*', authMiddleware);
// Shared Products is a tenant-wide shared module: entitlement resolves under the
// canonical 'shared' scope using the existing role/moduleAccess model.
productsRouter.use('/*', requireModule('products', SHARED_WORKSPACE_KEY));

const SUPPORTED_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'MXN', 'COP', 'PEN', 'CLP', 'ARS', 'BRL',
    'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'CHF', 'SEK', 'NOK', 'DKK',
    'NZD', 'SGD', 'HKD', 'KRW', 'TWD', 'ZAR', 'AED', 'SAR',
]);

const optionalText = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

const optionalUpdateText = (value: unknown) => {
    if (value === null) return null;
    if (typeof value === 'string') return value.trim() || null;
    return undefined;
};

const isSupportedCurrency = (value: string): boolean => SUPPORTED_CURRENCIES.has(value.toUpperCase());

const minorToFloat = (minor: number | null | undefined): number => {
    if (minor === null || minor === undefined) return 0;
    return minor / 100;
};

const normalizeStatus = (value: unknown): 'active' | 'archived' | undefined => {
    if (value === 'active' || value === 'archived') return value;
    return undefined;
};

const PRODUCT_UNIQUE_CONSTRAINTS = new Set([
    'products_business_sku_idx',
    'products_business_barcode_idx',
]);

const isDuplicateSkuOrBarcodeError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;

    const seen = new WeakSet<object>();
    const constraints = Array.from(PRODUCT_UNIQUE_CONSTRAINTS);

    const inspect = (value: unknown): boolean => {
        if (!value || typeof value !== 'object') return false;
        if (seen.has(value)) return false;
        seen.add(value);

        const e = value as Record<string, unknown>;

        if (e.code === '23505') return true;

        const constraintName = e.constraint_name ?? e.constraint;
        if (typeof constraintName === 'string' && PRODUCT_UNIQUE_CONSTRAINTS.has(constraintName)) {
            return true;
        }

        const message = e.message;
        if (typeof message === 'string' && constraints.some((c) => message.includes(c))) {
            return true;
        }

        if (e.cause) return inspect(e.cause);
        return false;
    };

    return inspect(error);
};

type ProductInput = {
    name?: unknown;
    description?: unknown;
    sku?: unknown;
    barcode?: unknown;
    unit?: unknown;
    defaultPriceAmountMinor?: unknown;
    currency?: unknown;
    category?: unknown;
};

// GET /api/products
productsRouter.get('/', async (c) => {
    const businessId = c.get('businessId');
    const { search, status, barcode, sku, includeArchived } = c.req.query();

    const filters: (ReturnType<typeof eq> | ReturnType<typeof and> | ReturnType<typeof or>)[] = [
        eq(products.businessId, businessId),
    ];

    if (includeArchived !== 'true') {
        filters.push(eq(products.status, 'active'));
    }

    const normalizedStatus = status ? normalizeStatus(status) : undefined;
    if (normalizedStatus) {
        filters.push(eq(products.status, normalizedStatus));
    }

    if (barcode !== undefined) {
        const normalized = barcode.trim();
        if (normalized) {
            filters.push(eq(products.barcode, normalized));
        } else {
            filters.push(sql`${products.barcode} IS NULL OR ${products.barcode} = ''`);
        }
    }

    if (sku !== undefined) {
        const normalized = sku.trim();
        if (normalized) {
            filters.push(eq(products.sku, normalized));
        } else {
            filters.push(sql`${products.sku} IS NULL OR ${products.sku} = ''`);
        }
    }

    if (search && search.trim()) {
        const pattern = `%${search.trim()}%`;
        filters.push(or(
            ilike(products.name, pattern),
            ilike(products.description, pattern),
            ilike(products.sku, pattern),
            ilike(products.barcode, pattern),
        ));
    }

    const productRows = await db.select()
        .from(products)
        .where(and(...filters))
        .orderBy(products.createdAt);

    return c.json(productRows);
});

// GET /api/products/:id
productsRouter.get('/:id', async (c) => {
    const id = c.req.param('id');
    const businessId = c.get('businessId');
    const product = await first(db.select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.businessId, businessId)))
    );

    if (!product) {
        return c.json({ error: 'Product not found' }, 404);
    }

    return c.json(product);
});

// POST /api/products
productsRouter.post('/', requireRole(['owner', 'admin', 'manager']), async (c) => {
    let body: ProductInput;

    try {
        body = await c.req.json<ProductInput>();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return c.json({ error: 'name is required and must be a non-empty string' }, 400);
    }

    if (typeof body.defaultPriceAmountMinor !== 'number' || !Number.isSafeInteger(body.defaultPriceAmountMinor)) {
        return c.json({ error: 'defaultPriceAmountMinor is required and must be an integer' }, 400);
    }
    if (body.defaultPriceAmountMinor < 0) {
        return c.json({ error: 'defaultPriceAmountMinor must be non-negative' }, 400);
    }

    if (typeof body.currency !== 'string' || !body.currency.trim()) {
        return c.json({ error: 'currency is required and must be a non-empty string' }, 400);
    }
    const currency = body.currency.trim().toUpperCase();
    if (!isSupportedCurrency(currency)) {
        return c.json({ error: `currency '${currency}' is not supported` }, 400);
    }

    const businessId = c.get('businessId');
    const productId = `prod_${randomUUID()}`;
    const name = body.name.trim();
    const description = optionalText(body.description);
    const sku = optionalText(body.sku);
    const barcode = optionalText(body.barcode);
    const unit = optionalText(body.unit);
    const category = optionalText(body.category);
    const defaultPriceAmountMinor = body.defaultPriceAmountMinor;

    try {
        await db.insert(products).values({
            id: productId,
            businessId,
            name,
            description,
            sku,
            barcode,
            unit,
            price: minorToFloat(defaultPriceAmountMinor),
            defaultPriceAmountMinor,
            currency,
            category,
            status: 'active',
            createdBy: c.get('userId'),
        });

        const createdProduct = await first(db.select()
            .from(products)
            .where(and(eq(products.id, productId), eq(products.businessId, businessId)))
        );

        await logAudit(c, 'CREATE', 'PRODUCT', productId, { name, sku, barcode });

        return c.json(createdProduct, 201);
    } catch (error) {
        if (isDuplicateSkuOrBarcodeError(error)) {
            return c.json({ error: 'A product with this SKU or barcode already exists for this business' }, 409);
        }
        console.error('[PRODUCTS] Failed to create product:', error);
        return c.json({ error: 'Failed to create product' }, 500);
    }
});

// PATCH /api/products/:id
productsRouter.patch('/:id', requireRole(['owner', 'admin', 'manager']), async (c) => {
    let body: ProductInput;

    try {
        body = await c.req.json<ProductInput>();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Product id is required' }, 400);
    const businessId = c.get('businessId');

    const existingProduct = await first(db.select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.businessId, businessId)))
    );

    if (!existingProduct) {
        return c.json({ error: 'Product not found' }, 404);
    }

    const updates: Partial<typeof products.$inferInsert> = {};

    if ('name' in body) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            return c.json({ error: 'name must be a non-empty string when provided' }, 400);
        }
        updates.name = body.name.trim();
    }

    if ('description' in body) updates.description = optionalUpdateText(body.description);
    if ('sku' in body) updates.sku = optionalUpdateText(body.sku);
    if ('barcode' in body) updates.barcode = optionalUpdateText(body.barcode);
    if ('unit' in body) updates.unit = optionalUpdateText(body.unit);
    if ('category' in body) updates.category = optionalUpdateText(body.category);

    let currency: string | undefined;
    if ('currency' in body) {
        if (typeof body.currency !== 'string' || !body.currency.trim()) {
            return c.json({ error: 'currency must be a non-empty string when provided' }, 400);
        }
        currency = body.currency.trim().toUpperCase();
        if (!isSupportedCurrency(currency)) {
            return c.json({ error: `currency '${currency}' is not supported` }, 400);
        }
        updates.currency = currency;
    }

    let defaultPriceAmountMinor: number | undefined;
    if ('defaultPriceAmountMinor' in body) {
        if (typeof body.defaultPriceAmountMinor !== 'number' || !Number.isSafeInteger(body.defaultPriceAmountMinor)) {
            return c.json({ error: 'defaultPriceAmountMinor must be an integer' }, 400);
        }
        if (body.defaultPriceAmountMinor < 0) {
            return c.json({ error: 'defaultPriceAmountMinor must be non-negative' }, 400);
        }
        defaultPriceAmountMinor = body.defaultPriceAmountMinor;
        updates.defaultPriceAmountMinor = defaultPriceAmountMinor;
        // Keep the legacy float price in sync so existing POS/Inventory consumers
        // can still read a price for Shared Products.
        updates.price = minorToFloat(defaultPriceAmountMinor);
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: 'At least one supported product field is required' }, 400);
    }

    try {
        const updatedProduct = await first(db.update(products)
            .set({ ...updates, updatedAt: new Date() })
            .where(and(eq(products.id, id), eq(products.businessId, businessId)))
            .returning()
        );

        await logAudit(c, 'UPDATE', 'PRODUCT', id, { fields: Object.keys(updates) });

        return c.json(updatedProduct);
    } catch (error) {
        if (isDuplicateSkuOrBarcodeError(error)) {
            return c.json({ error: 'A product with this SKU or barcode already exists for this business' }, 409);
        }
        console.error('[PRODUCTS] Failed to update product:', error);
        return c.json({ error: 'Failed to update product' }, 500);
    }
});

// PATCH /api/products/:id/archive
productsRouter.patch('/:id/archive', requireRole(['owner', 'admin', 'manager']), async (c) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Product id is required' }, 400);
    const businessId = c.get('businessId');

    const existingProduct = await first(db.select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.businessId, businessId)))
    );

    if (!existingProduct) {
        return c.json({ error: 'Product not found' }, 404);
    }

    if (existingProduct.status === 'archived') {
        return c.json(existingProduct);
    }

    const archivedProduct = await first(db.update(products)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(eq(products.id, id), eq(products.businessId, businessId)))
        .returning()
    );

    await logAudit(c, 'UPDATE', 'PRODUCT', id, { status: 'archived' });

    return c.json(archivedProduct);
});

export default productsRouter;
