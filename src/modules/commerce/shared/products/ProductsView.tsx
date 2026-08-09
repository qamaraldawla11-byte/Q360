import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle, Package, RefreshCw, Search, X } from 'lucide-react';
import {
    productsApi,
    type Product,
    type ProductListFilters,
    type ProductStatus,
    type ProductsApi,
} from '@/api/products.api';
import { formatProductPrice } from './productMoney';
import { ProductStatusBadge } from './ProductStatusBadge';
import { ProductList } from './ProductList';
import '@/modules/commerce/retail/retail.css';

const getErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { error?: unknown } } }).response;
        if (typeof response?.data?.error === 'string') return response.data.error;
    }
    return error instanceof Error ? error.message : 'Something went wrong';
};

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

type StatusFilterValue = '' | ProductStatus | 'all';

interface ProductsViewProps {
    title?: string;
    subtitle?: string;
    /** Optional API client override for bounded visual verification. Defaults to the real productsApi. */
    api?: ProductsApi;
}

const statusFilterOptions: { value: StatusFilterValue; label: string }[] = [
    { value: '', label: 'Active only' },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: 'All' },
];

export const ProductsView = ({
    title = 'Products',
    subtitle = 'What this business sells or provides. Backed by the shared Q360 Products API.',
    api = productsApi,
}: ProductsViewProps = {}) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('');

    const listFilters = useMemo<ProductListFilters>(() => {
        const filters: ProductListFilters = {};
        if (searchQuery.trim()) filters.search = searchQuery.trim();

        if (statusFilter === 'archived') {
            filters.status = 'archived';
            filters.includeArchived = true;
        } else if (statusFilter === 'all') {
            filters.includeArchived = true;
        } else {
            // Default: active only. The backend also defaults to active when
            // includeArchived is not set, but being explicit keeps the UX clear.
            filters.status = 'active';
        }

        return filters;
    }, [searchQuery, statusFilter]);

    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const rows = await api.list(listFilters);
            setProducts(rows);
            setSelectedProduct(current => (
                current && !rows.some(product => product.id === current.id) ? null : current
            ));
        } catch (loadError) {
            setError(getErrorMessage(loadError));
        } finally {
            setIsLoading(false);
        }
    }, [api, listFilters]);

    useEffect(() => {
        void loadProducts();
    }, [loadProducts]);

    const openProduct = async (productId: string) => {
        setIsDetailLoading(true);
        setDetailError(null);
        try {
            setSelectedProduct(await api.get(productId));
        } catch (selectError) {
            setDetailError(getErrorMessage(selectError));
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        // Filtering is already reactive; submit just ensures focus stays predictable.
    };

    const clearSearch = () => setSearchQuery('');

    const sortedProducts = useMemo(() => (
        [...products].sort((a, b) => a.name.localeCompare(b.name))
    ), [products]);

    return (
        <section className="retail-page">
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: '0 0 6px' }}>{title}</h1>
                    <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>{subtitle}</p>
                </div>
                <div className="retail-actions">
                    <button className="retail-button" onClick={loadProducts} disabled={isLoading}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </header>

            <div className="retail-card" style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                    <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: 240 }}>
                        <div className="retail-field" style={{ position: 'relative' }}>
                            <label htmlFor="product-search">Search products</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-secondary)' }} />
                                <input
                                    id="product-search"
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    placeholder="Name, SKU, barcode..."
                                    style={{ paddingLeft: 38 }}
                                />
                            </div>
                        </div>
                    </form>

                    <div className="retail-field" style={{ minWidth: 160 }}>
                        <label htmlFor="product-status-filter">Status</label>
                        <select
                            id="product-status-filter"
                            value={statusFilter}
                            onChange={event => setStatusFilter(event.target.value as StatusFilterValue)}
                        >
                            {statusFilterOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    {searchQuery && (
                        <button className="retail-button" onClick={clearSearch} type="button">
                            <X size={16} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div role="alert" className="retail-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderColor: 'var(--error)' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {isLoading ? (
                <div className="retail-empty" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <LoaderCircle size={18} /> Loading products...
                </div>
            ) : (
                <div className="retail-customers-layout">
                    <ProductList
                        products={sortedProducts}
                        selectedProductId={selectedProduct?.id}
                        searchQuery={searchQuery}
                        statusFilter={statusFilter}
                        onSelectProduct={productId => void openProduct(productId)}
                    />

                    <aside className="retail-detail-panel" aria-live="polite">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Package size={20} /> Detail
                            </h2>
                            {selectedProduct && (
                                <button className="retail-icon-button" onClick={() => setSelectedProduct(null)} aria-label="Close product detail">
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {isDetailLoading && (
                            <div className="retail-empty" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                <LoaderCircle size={18} /> Loading detail...
                            </div>
                        )}

                        {detailError && <div role="alert" style={{ color: 'var(--error)', marginTop: 16 }}>{detailError}</div>}

                        {!isDetailLoading && !selectedProduct && !detailError && (
                            <p style={{ color: 'var(--fg-secondary)' }}>Select a product to view its shared record.</p>
                        )}

                        {!isDetailLoading && selectedProduct && (
                            <dl className="retail-detail-list">
                                <div><dt>Name</dt><dd>{selectedProduct.name}</dd></div>
                                <div><dt>Description</dt><dd>{selectedProduct.description || '-'}</dd></div>
                                <div><dt>SKU</dt><dd>{selectedProduct.sku || '-'}</dd></div>
                                <div><dt>Barcode</dt><dd>{selectedProduct.barcode || '-'}</dd></div>
                                <div><dt>Unit</dt><dd>{selectedProduct.unit || '-'}</dd></div>
                                <div><dt>Default price</dt><dd>{formatProductPrice(selectedProduct.defaultPriceAmountMinor, selectedProduct.currency)}</dd></div>
                                <div><dt>Status</dt><dd><ProductStatusBadge status={selectedProduct.status} /></dd></div>
                                <div><dt>Created</dt><dd>{formatDate(selectedProduct.createdAt)}</dd></div>
                                <div><dt>Updated</dt><dd>{formatDate(selectedProduct.updatedAt)}</dd></div>
                            </dl>
                        )}
                    </aside>
                </div>
            )}
        </section>
    );
};
