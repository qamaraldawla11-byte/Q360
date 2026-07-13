import { http } from './http';

export type FinanceRecordType = 'purchase' | 'expense';
export type FinanceRecordStatus = 'saved' | 'voided';

export interface FinanceRecord {
    id: string;
    recordType: FinanceRecordType;
    status: FinanceRecordStatus;
    supplierName: string | null;
    category: string;
    amountMinor: number;
    currency: string;
    recordDate: string;
    reference: string | null;
    notes: string | null;
    createdAt: string;
}

export interface FinanceSummary {
    revenueMinor: number;
    purchasesMinor: number;
    expensesMinor: number;
    totalCostsMinor: number;
    netProfitMinor: number;
}

export interface DuplicateWarning {
    severity: 'exact_record_match' | 'similar_supplier_amount_date' | 'similar_reference';
    recordId: string;
    message: string;
}

export interface FinanceRecordInput {
    recordType: FinanceRecordType;
    supplierName?: string;
    category: string;
    amountMinor: number;
    currency: string;
    recordDate: string;
    reference?: string;
    notes?: string;
}

export const financeApi = {
    list: (from: string, to: string) => http.get<{ records: FinanceRecord[]; summary: FinanceSummary }>(`/purchases-expenses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    duplicateCheck: (payload: FinanceRecordInput) => http.post<{ warnings: DuplicateWarning[] }>('/purchases-expenses/duplicate-check', payload),
    create: (payload: FinanceRecordInput, confirmDuplicate = false) => http.post<FinanceRecord>('/purchases-expenses', { ...payload, confirmDuplicate }),
    void: (id: string) => http.post<FinanceRecord>(`/purchases-expenses/${id}/void`, {}),
};
