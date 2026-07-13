import { createHash } from 'crypto';

export type PurchaseExpenseInput = {
    recordType: 'purchase' | 'expense';
    supplierName: string | null;
    supplierId: string | null;
    category: string;
    amountMinor: number;
    currency: string;
    recordDate: string;
    reference: string | null;
    notes: string | null;
};

const normalized = (value: string | null) => (value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export const duplicateKeysFor = (input: PurchaseExpenseInput) => {
    const supplier = normalized(input.supplierName);
    const reference = normalized(input.reference);
    const base = `${supplier}|${input.amountMinor}|${input.currency}`;
    return {
        exact: reference ? hash(`${base}|${reference}`) : null,
        fingerprint: hash(`${base}|${input.recordDate}`),
        normalizedSupplier: supplier,
        normalizedReference: reference,
    };
};

export const isWithinDateWindow = (left: string, right: string, days = 7) => {
    const leftTime = Date.parse(`${left}T00:00:00.000Z`);
    const rightTime = Date.parse(`${right}T00:00:00.000Z`);
    return Number.isFinite(leftTime) && Number.isFinite(rightTime) && Math.abs(leftTime - rightTime) <= days * 86_400_000;
};

export const normalizeDuplicateText = normalized;
