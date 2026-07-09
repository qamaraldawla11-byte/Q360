import { useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Plus, Search } from 'lucide-react';
import { inventoryService } from '@/core/services/inventory.service';
import type { InventoryItem } from '@/types/inventory';
import '../retail.css';

type ProductForm = {
    name: string;
    barcode: string;
    category: string;
    current: string;
    min: string;
    max: string;
    unit: string;
    supplier: string;
    price: string;
};

const emptyProduct: ProductForm = { name: '', barcode: '', category: '', current: '', min: '', max: '', unit: 'units', supplier: '', price: '' };

const numericFields = new Set<keyof ProductForm>(['price', 'current', 'min', 'max']);

const getApiErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ error?: string }>(error)) {
        return error.response?.data?.error;
    }

    return undefined;
};

type ParsedNumber = { ok: true; value: number } | { ok: false; error: string };

const parseRequiredNumber = (value: string, label: string): ParsedNumber => {
    if (!value.trim()) {
        return { ok: false, error: `${label} is required.` };
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return { ok: false, error: `${label} must be a non-negative number.` };
    }

    return { ok: true, value: parsed };
};

export const CatalogView = () => {
    const [products, setProducts] = useState<InventoryItem[]>([]);
    const [query, setQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyProduct);
    const [formError, setFormError] = useState('');

    const load = () => inventoryService.getInventory().then(setProducts).catch(() => setProducts([]));
    useEffect(() => {
        void load();
    }, []);

    const filtered = useMemo(() => products.filter(product =>
        `${product.name} ${product.barcode ?? ''} ${product.category ?? ''}`.toLowerCase().includes(query.toLowerCase()),
    ), [products, query]);

    const openForm = () => {
        setForm(emptyProduct);
        setFormError('');
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setSaving(false);
        setFormError('');
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setFormError('');

        const name = form.name.trim();
        const barcode = form.barcode.trim();
        const price = parseRequiredNumber(form.price, 'Selling price');
        const current = parseRequiredNumber(form.current, 'Opening stock');
        const min = parseRequiredNumber(form.min, 'Low stock level');
        const max = form.max.trim() ? Number(form.max) : undefined;

        if (!name) {
            setFormError('Product name is required.');
            return;
        }
        if (!price.ok) {
            setFormError(price.error);
            return;
        }
        if (!current.ok) {
            setFormError(current.error);
            return;
        }
        if (!min.ok) {
            setFormError(min.error);
            return;
        }
        if (max !== undefined && (!Number.isFinite(max) || max < current.value)) {
            setFormError('Maximum stock must be greater than or equal to opening stock.');
            return;
        }
        if (barcode && products.some((product) => product.barcode?.trim().toLowerCase() === barcode.toLowerCase())) {
            setFormError('That barcode already exists in this workspace. Use a different barcode or leave it blank.');
            return;
        }

        const payload: Omit<InventoryItem, 'id' | 'status'> = {
            name,
            current: current.value,
            min: min.value,
            unit: form.unit.trim() || 'units',
            price: price.value,
        };

        if (max !== undefined) payload.max = max;
        if (barcode) payload.barcode = barcode;
        if (form.category.trim()) payload.category = form.category.trim();
        if (form.supplier.trim()) payload.supplier = form.supplier.trim();

        setSaving(true);
        try {
            await inventoryService.createItem(payload);
            setForm(emptyProduct);
            setShowForm(false);
            await load();
        } catch (error) {
            const apiMessage = getApiErrorMessage(error);
            setFormError(
                barcode
                    ? apiMessage || 'Product could not be created. Check that its barcode is unique.'
                    : apiMessage || 'Product could not be created. Check the product details and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="retail-page">
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                <div><h1 style={{ margin: '0 0 6px' }}>Product Catalog</h1><p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Products are stored in the shared business inventory.</p></div>
                <button className="retail-button retail-button--primary" onClick={openForm}><Plus size={16} /> Add product</button>
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
                <div className="retail-modal" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
                    <form className="retail-modal__panel" onSubmit={submit}>
                        <h2 id="add-product-title">Add product</h2>
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
                                        required={['name', 'price', 'current', 'min'].includes(key)}
                                        min={type === 'number' ? 0 : undefined}
                                        step={key === 'price' ? '0.01' : undefined}
                                        value={form[key as keyof typeof form]}
                                        onChange={event => {
                                            const field = key as keyof ProductForm;
                                            const value = event.target.value;
                                            setFormError('');
                                            if (numericFields.has(field) && value && Number(value) < 0) return;
                                            setForm({ ...form, [field]: value });
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        {formError && (
                            <div role="alert" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 14 }}>
                                {formError}
                            </div>
                        )}
                        <div className="retail-actions" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
                            <button type="button" className="retail-button" onClick={closeForm}>Cancel</button>
                            <button className="retail-button retail-button--primary" disabled={saving}>{saving ? 'Saving...' : 'Save product'}</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};
