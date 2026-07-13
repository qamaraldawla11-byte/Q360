import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import { and, desc, eq, gte, lte, ne } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businesses, purchaseExpenseRecords, restaurantPayments, suppliers } from '../db/schema.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { duplicateKeysFor, isWithinDateWindow, normalizeDuplicateText, type PurchaseExpenseInput } from '../services/purchaseExpenses.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';

const router = new Hono<AppEnv>();
router.use('*', authMiddleware);
router.use('*', requireRole(['owner', 'admin']));

type InputBody = Partial<PurchaseExpenseInput> & { confirmDuplicate?: unknown; businessId?: unknown };
type DuplicateSeverity = 'exact_record_match' | 'similar_supplier_amount_date' | 'similar_reference';
type DuplicateWarning = { severity: DuplicateSeverity; recordId: string; message: string };

const generatedReference = (recordType: 'purchase' | 'expense', recordDate: string) => {
    const prefix = recordType === 'purchase' ? 'PUR' : 'EXP';
    return `${prefix}-${recordDate.replace(/-/g, '')}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
};

const warningMessage = (severity: DuplicateSeverity) => severity === 'exact_record_match'
    ? 'A saved record has the same supplier, reference, amount, and currency.'
    : severity === 'similar_reference'
        ? 'A saved record uses the same reference and amount.'
        : 'A saved record has a similar supplier, amount, and nearby date.';

const optionalText = (value: unknown) => typeof value === 'string' ? value.trim() || null : value == null ? null : undefined;
const parseInput = async (body: InputBody, businessId: string): Promise<{ input?: PurchaseExpenseInput; error?: string }> => {
    if (body.recordType !== 'purchase' && body.recordType !== 'expense') return { error: 'recordType must be purchase or expense' };
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!category || category.length > 80) return { error: 'A category of at most 80 characters is required' };
    if (!Number.isInteger(body.amountMinor) || Number(body.amountMinor) <= 0) return { error: 'amountMinor must be a positive integer' };
    const recordDate = typeof body.recordDate === 'string' ? body.recordDate : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || Number.isNaN(Date.parse(`${recordDate}T00:00:00.000Z`))) return { error: 'recordDate must use YYYY-MM-DD' };
    const business = await first(db.select({ currency: businesses.currency }).from(businesses).where(eq(businesses.id, businessId)));
    const currency = (typeof body.currency === 'string' ? body.currency : business?.currency || 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return { error: 'currency must be a three-letter code' };
    const supplierName = optionalText(body.supplierName), supplierId = optionalText(body.supplierId), reference = optionalText(body.reference), notes = optionalText(body.notes);
    if ([supplierName, supplierId, reference, notes].some(value => value === undefined)) return { error: 'Optional text fields must be strings' };
    if (supplierName && supplierName.length > 160) return { error: 'supplierName is too long' };
    if (reference && reference.length > 120) return { error: 'reference is too long' };
    if (notes && notes.length > 2000) return { error: 'notes is too long' };
    if (supplierId && !await first(db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.businessId, businessId))))) return { error: 'Supplier not found' };
    return { input: { recordType: body.recordType, supplierName: supplierName!, supplierId: supplierId!, category, amountMinor: Number(body.amountMinor), currency, recordDate, reference: reference!, notes: notes! } };
};

const duplicateWarningsFor = async (businessId: string, input: PurchaseExpenseInput, excludeId?: string) => {
    const keys = duplicateKeysFor(input);
    const conditions = [eq(purchaseExpenseRecords.businessId, businessId), eq(purchaseExpenseRecords.status, 'saved'), eq(purchaseExpenseRecords.amountMinor, input.amountMinor), eq(purchaseExpenseRecords.currency, input.currency)];
    if (excludeId) conditions.push(ne(purchaseExpenseRecords.id, excludeId));
    const candidates = await db.select().from(purchaseExpenseRecords).where(and(...conditions));
    const warnings: DuplicateWarning[] = [];
    for (const candidate of candidates) {
        const severity = keys.exact && candidate.duplicateKeyExact === keys.exact ? 'exact_record_match'
            : keys.normalizedSupplier && normalizeDuplicateText(candidate.supplierName) === keys.normalizedSupplier && isWithinDateWindow(candidate.recordDate, input.recordDate) ? 'similar_supplier_amount_date'
                : keys.normalizedReference && normalizeDuplicateText(candidate.reference) === keys.normalizedReference ? 'similar_reference' : null;
        if (severity) warnings.push({ severity, recordId: candidate.id, message: warningMessage(severity) });
    }
    return { warnings, keys };
};

router.get('/', async c => {
    const businessId = c.get('businessId');
    const conditions = [eq(purchaseExpenseRecords.businessId, businessId)];
    const type = c.req.query('type'), status = c.req.query('status'), from = c.req.query('from'), to = c.req.query('to');
    if (type === 'purchase' || type === 'expense') conditions.push(eq(purchaseExpenseRecords.recordType, type));
    if (status === 'saved' || status === 'voided') conditions.push(eq(purchaseExpenseRecords.status, status));
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) conditions.push(gte(purchaseExpenseRecords.recordDate, from));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conditions.push(lte(purchaseExpenseRecords.recordDate, to));
    const records = await db.select().from(purchaseExpenseRecords).where(and(...conditions)).orderBy(desc(purchaseExpenseRecords.recordDate), desc(purchaseExpenseRecords.createdAt));
    const active = records.filter(record => record.status === 'saved');
    const purchasesMinor = active.filter(record => record.recordType === 'purchase').reduce((sum, record) => sum + record.amountMinor, 0);
    const expensesMinor = active.filter(record => record.recordType === 'expense').reduce((sum, record) => sum + record.amountMinor, 0);
    const paymentConditions = [eq(restaurantPayments.businessId, businessId), eq(restaurantPayments.status, 'completed')];
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) paymentConditions.push(gte(restaurantPayments.paidAt, new Date(`${from}T00:00:00.000Z`)));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) paymentConditions.push(lte(restaurantPayments.paidAt, new Date(`${to}T23:59:59.999Z`)));
    const payments = await db.select({ amount: restaurantPayments.amount }).from(restaurantPayments).where(and(...paymentConditions));
    const revenueMinor = Math.round(payments.reduce((sum, payment) => sum + payment.amount * 100, 0));
    const totalCostsMinor = purchasesMinor + expensesMinor;
    return c.json({ records, summary: { revenueMinor, purchasesMinor, expensesMinor, totalCostsMinor, netProfitMinor: revenueMinor - totalCostsMinor } });
});

router.post('/duplicate-check', async c => {
    let body: InputBody; try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = await parseInput(body, c.get('businessId')); if (!parsed.input) return c.json({ error: parsed.error }, 400);
    const result = await duplicateWarningsFor(c.get('businessId'), parsed.input);
    await logAudit(c, 'PURCHASE_EXPENSE_DUPLICATE_CHECKED', 'PURCHASE_EXPENSE', null, { warningCount: result.warnings.length });
    if (result.warnings.length) await logAudit(c, 'PURCHASE_EXPENSE_DUPLICATE_WARNING_SHOWN', 'PURCHASE_EXPENSE', null, { warningCount: result.warnings.length, warningTypes: result.warnings.map(item => item.severity) });
    return c.json({ warnings: result.warnings });
});

router.post('/', async c => {
    let body: InputBody; try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const businessId = c.get('businessId'), parsed = await parseInput(body, businessId); if (!parsed.input) return c.json({ error: parsed.error }, 400);
    const duplicate = await duplicateWarningsFor(businessId, parsed.input);
    if (duplicate.warnings.length && body.confirmDuplicate !== true) {
        await logAudit(c, 'PURCHASE_EXPENSE_DUPLICATE_WARNING_SHOWN', 'PURCHASE_EXPENSE', null, { warningCount: duplicate.warnings.length, warningTypes: duplicate.warnings.map(item => item.severity) });
        return c.json({ error: 'Potential duplicate requires confirmation', requiresConfirmation: true, warnings: duplicate.warnings }, 409);
    }
    const id = randomUUID(), now = new Date();
    const finalInput = parsed.input.reference ? parsed.input : {
        ...parsed.input,
        reference: generatedReference(parsed.input.recordType, parsed.input.recordDate),
    };
    const finalKeys = duplicateKeysFor(finalInput);
    const [created] = await db.insert(purchaseExpenseRecords).values({ id, businessId, ...finalInput, duplicateKeyExact: finalKeys.exact, duplicateFingerprint: finalKeys.fingerprint, createdBy: c.get('userId'), updatedBy: c.get('userId'), createdAt: now, updatedAt: now }).returning();
    await logAudit(c, 'PURCHASE_EXPENSE_CREATED', 'PURCHASE_EXPENSE', id, { recordType: created.recordType, amountMinor: created.amountMinor, currency: created.currency, recordDate: created.recordDate, category: created.category, duplicateWarningCount: duplicate.warnings.length });
    return c.json(created, 201);
});

router.get('/:id', async c => {
    const record = await first(db.select().from(purchaseExpenseRecords).where(and(eq(purchaseExpenseRecords.id, c.req.param('id')), eq(purchaseExpenseRecords.businessId, c.get('businessId')))));
    return record ? c.json(record) : c.json({ error: 'Record not found' }, 404);
});

router.patch('/:id', async c => {
    const businessId = c.get('businessId'), id = c.req.param('id');
    const current = await first(db.select().from(purchaseExpenseRecords).where(and(eq(purchaseExpenseRecords.id, id), eq(purchaseExpenseRecords.businessId, businessId))));
    if (!current) return c.json({ error: 'Record not found' }, 404);
    if (current.status === 'voided') return c.json({ error: 'Voided records cannot be edited' }, 409);
    let body: InputBody; try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = await parseInput({ ...current, ...body }, businessId); if (!parsed.input) return c.json({ error: parsed.error }, 400);
    const duplicate = await duplicateWarningsFor(businessId, parsed.input, id);
    if (duplicate.warnings.length && body.confirmDuplicate !== true) return c.json({ error: 'Potential duplicate requires confirmation', requiresConfirmation: true, warnings: duplicate.warnings }, 409);
    const [updated] = await db.update(purchaseExpenseRecords).set({ ...parsed.input, duplicateKeyExact: duplicate.keys.exact, duplicateFingerprint: duplicate.keys.fingerprint, updatedBy: c.get('userId'), updatedAt: new Date() }).where(and(eq(purchaseExpenseRecords.id, id), eq(purchaseExpenseRecords.businessId, businessId))).returning();
    await logAudit(c, 'PURCHASE_EXPENSE_UPDATED', 'PURCHASE_EXPENSE', id, { fields: Object.keys(body).filter(key => key !== 'businessId'), duplicateWarningCount: duplicate.warnings.length });
    return c.json(updated);
});

router.post('/:id/void', async c => {
    const businessId = c.get('businessId'), id = c.req.param('id'), now = new Date();
    const [updated] = await db.update(purchaseExpenseRecords).set({ status: 'voided', voidedAt: now, voidedBy: c.get('userId'), updatedAt: now, updatedBy: c.get('userId') }).where(and(eq(purchaseExpenseRecords.id, id), eq(purchaseExpenseRecords.businessId, businessId), eq(purchaseExpenseRecords.status, 'saved'))).returning();
    if (!updated) return c.json({ error: 'Saved record not found' }, 404);
    await logAudit(c, 'PURCHASE_EXPENSE_VOIDED', 'PURCHASE_EXPENSE', id, { recordType: updated.recordType, amountMinor: updated.amountMinor, currency: updated.currency });
    return c.json(updated);
});

export default router;
