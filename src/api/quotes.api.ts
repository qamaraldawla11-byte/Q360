import { http } from './http';

export interface QuoteItem {
    id: string;
    businessId: string;
    quoteId: string;
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface Quote {
    id: string;
    businessId: string;
    customerId: string;
    quoteNumber: string;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    currency: string;
    validUntil?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    items?: QuoteItem[];
}

export interface QuoteItemInput {
    description: string;
    quantity: number;
    unitPrice: number;
}

export interface CreateQuoteInput {
    customerId: string;
    currency?: string;
    validUntil?: string | null;
    notes?: string;
    items: QuoteItemInput[];
}

export type UpdateQuoteInput = Partial<CreateQuoteInput>;

export const quotesApi = {
    list: () => http.get<Quote[]>('/quotes'),
    get: (id: string) => http.get<Quote>(`/quotes/${id}`),
    create: (input: CreateQuoteInput) => http.post<Quote>('/quotes', input),
    update: (id: string, input: UpdateQuoteInput) => http.patch<Quote>(`/quotes/${id}`, input),
};
