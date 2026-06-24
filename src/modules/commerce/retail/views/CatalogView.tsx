import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { inventoryService } from '@/core/services/inventory.service';
import type { InventoryItem } from '@/types/inventory';
import '../retail.css';

const emptyProduct = { name: '', barcode: '', category: '', current: 0, min: 5, max: 100, unit: 'units', supplier: '', price: 0 };

export const CatalogView = () => {
    const [products, setProducts] = useState<InventoryItem[]>([]);
    const [query, setQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyProduct);

    const load = () => inventoryService.getInventory().then(setProducts).catch(() => setProducts([]));
    useEffect(() => {
        void load();
    }, []);

    const filtered = useMemo(() => products.filter(product =>
        `${product.name} ${product.barcode ?? ''} ${product.category ?? ''}`.toLowerCase().includes(query.toLowerCase()),
    ), [products, query]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            await inventoryService.createItem(form);
            setForm(emptyProduct);
            setShowForm(false);
            await load();
        } catch {
            window.alert('Product could not be created. Check that its barcode is unique.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="retail-page">
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                <div><h1 style={{ margin: '0 0 6px' }}>Product Catalog</h1><p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Products are stored in the shared business inventory.</p></div>
                <button className="retail-button retail-button--primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add product</button>
            </header>

            <div className="retail-card" style={{ marginBottom: 18 }}>
                <div className="retail-field">
                    <label htmlFor="retail-catalog-search">Search products</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--fg-muted)' }} />
                        <input id="retail-catalog-search" value={query} onChange={event => setQuery(event.target.value)} style={{ paddingLeft: 40 }} />
                    </div>
                </div>
            </div>

            <div className="retail-table-wrap">
                <table className="retail-table">
                    <thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
                    <tbody>
                        {filtered.map(product => (
                            <tr key={product.id}>
                                <td><strong>{product.name}</strong></td>
                                <td>{product.barcode || 'Not set'}</td>
                                <td>{product.category || 'General'}</td>
                                <td>${product.price.toFixed(2)}</td>
                                <td>{product.current} {product.unit}</td>
                                <td>{product.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="retail-modal" role="dialog" aria-modal="true" aria-labelledby="add-retail-product-title">
                    <form className="retail-modal__panel" onSubmit={submit}>
                        <h2 id="add-retail-product-title">Add retail product</h2>
                        <div className="retail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            {[
                                ['name', 'Product name', 'text'],
                                ['barcode', 'Barcode', 'text'],
                                ['category', 'Category', 'text'],
                                ['supplier', 'Supplier', 'text'],
                                ['price', 'Selling price', 'number'],
                                ['current', 'Opening stock', 'number'],
                                ['min', 'Low stock level', 'number'],
                                ['max', 'Maximum stock', 'number'],
                            ].map(([key, label, type]) => (
                                <div className="retail-field" key={key}>
                                    <label htmlFor={`retail-product-${key}`}>{label}</label>
                                    <input
                                        id={`retail-product-${key}`}
                                        type={type}
                                        required={['name', 'barcode', 'price', 'current', 'min'].includes(key)}
                                        min={type === 'number' ? 0 : undefined}
                                        step={key === 'price' ? '0.01' : undefined}
                                        value={form[key as keyof typeof form]}
                                        onChange={event => setForm({ ...form, [key]: type === 'number' ? Number(event.target.value) : event.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="retail-actions" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
                            <button type="button" className="retail-button" onClick={() => setShowForm(false)}>Cancel</button>
                            <button className="retail-button retail-button--primary" disabled={saving}>{saving ? 'Saving...' : 'Save product'}</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};
