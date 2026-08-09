import { http } from './http';

export type ProductStatus = 'active' | 'archived';

export interface Product {
    id: string;
    businessId: string;
    name: string;
    description?: string | null;
    sku?: string | null;
    barcode?: string | null;
    unit?: string | null;
    defaultPriceAmountMinor?: number | null;
    // Legacy float price preserved for compatibility with existing consumers.
    // Display should prefer defaultPriceAmountMinor when available.
    price?: number | null;
    currency?: string | null;
    category?: string | null;
    status: ProductStatus;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface ProductListFilters {
    search?: string;
    status?: ProductStatus;
    sku?: string;
    barcode?: string;
    includeArchived?: boolean;
}

const buildQueryParams = (filters: ProductListFilters): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.status) params.status = filters.status;
    if (filters.sku !== undefined) params.sku = filters.sku.trim();
    if (filters.barcode !== undefined) params.barcode = filters.barcode.trim();
    if (filters.includeArchived) params.includeArchived = 'true';
    return params;
};

export const productsApi = {
    list: (filters: ProductListFilters = {}) => http.get<Product[]>('/products', { params: buildQueryParams(filters) }),
    get: (id: string) => http.get<Product>(`/products/${id}`),
};

export type ProductsApi = typeof productsApi;
