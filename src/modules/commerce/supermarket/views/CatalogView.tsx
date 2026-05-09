import { useEffect } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Package, Barcode, DollarSign } from 'lucide-react';
import { inventoryService } from '@/core/services/inventory.service';
import { useSupermarketStore } from '../store/supermarket.store';

export const CatalogView = () => {
    // We access inventory from store (which is populated by service)
    const products = useSupermarketStore(state => state.inventory);

    useEffect(() => {
        // Ensure inventory is loaded
        inventoryService.getInventory();
    }, []);

    return (
        <ModuleShell>
            <PageHeader
                title="Product Catalog"
                subtitle="Manage your supermarket product inventory"
                actions={
                    <button
                        onClick={() => alert('Add Product clicked')}
                        style={{
                            padding: '10px 16px', borderRadius: '10px',
                            background: 'var(--primary)', color: 'white',
                            border: 'none', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Add Product
                    </button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {products.map((product) => (
                    <div key={product.id} style={{
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px solid var(--border-subtle)',
                        padding: '20px'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '150px',
                            background: '#f8fafc',
                            borderRadius: '12px',
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Package size={48} color="var(--fg-muted)" />
                        </div>

                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>{product.name}</h3>

                        <div style={{ fontSize: '13px', color: 'var(--fg-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Barcode size={14} />
                            {product.barcode || 'N/A'}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                background: '#f0fdf4',
                                color: '#166534',
                                fontWeight: 600
                            }}>
                                {product.category || 'General'}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>
                                Stock: {product.current}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <DollarSign size={18} color="#10b981" />
                                <span style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>
                                    {product.price.toFixed(2)}
                                </span>
                            </div>
                            <button style={{
                                padding: '8px 16px',
                                background: 'var(--accent-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}>
                                Edit
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </ModuleShell>
    );
};
