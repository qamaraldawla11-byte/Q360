import type { Product, ProductStatus } from '@/api/products.api';
import { formatProductPrice } from './productMoney';
import { ProductStatusBadge } from './ProductStatusBadge';

type StatusFilterValue = '' | ProductStatus | 'all';

interface ProductListProps {
    products: Product[];
    selectedProductId?: string | null;
    searchQuery?: string;
    statusFilter?: StatusFilterValue;
    onSelectProduct: (productId: string) => void;
}

export const ProductList = ({
    products,
    selectedProductId,
    searchQuery = '',
    statusFilter = '',
    onSelectProduct,
}: ProductListProps) => {
    const emptyMessage = () => {
        if (searchQuery) return 'No products match your search.';
        if (statusFilter === 'archived') return 'No archived products.';
        return 'No products yet. Shared Products will appear here once they are created.';
    };

    return (
        <>
            <div className="retail-table-wrap">
                <table className="retail-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>SKU</th>
                            <th>Barcode</th>
                            <th>Unit</th>
                            <th>Default price</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr
                                key={product.id}
                                className={selectedProductId === product.id ? 'retail-table-row--active' : undefined}
                                onClick={() => onSelectProduct(product.id)}
                            >
                                <td><strong>{product.name}</strong></td>
                                <td>{product.sku || '-'}</td>
                                <td>{product.barcode || '-'}</td>
                                <td>{product.unit || '-'}</td>
                                <td>{formatProductPrice(product.defaultPriceAmountMinor, product.currency)}</td>
                                <td><ProductStatusBadge status={product.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {products.length === 0 && <div className="retail-empty">{emptyMessage()}</div>}
            </div>

            <div className="retail-customer-cards">
                {products.map(product => (
                    <button
                        key={product.id}
                        className={`retail-customer-card${selectedProductId === product.id ? ' retail-customer-card--active' : ''}`}
                        onClick={() => onSelectProduct(product.id)}
                    >
                        <strong>{product.name}</strong>
                        <span>{product.sku || 'No SKU'} &middot; {product.barcode || 'No barcode'}</span>
                        <span>{formatProductPrice(product.defaultPriceAmountMinor, product.currency)} <ProductStatusBadge status={product.status} /></span>
                    </button>
                ))}
                {products.length === 0 && <div className="retail-empty">{emptyMessage()}</div>}
            </div>
        </>
    );
};
