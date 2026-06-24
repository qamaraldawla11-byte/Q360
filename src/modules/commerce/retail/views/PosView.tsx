import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingBag } from 'lucide-react';
import { inventoryService } from '@/core/services/inventory.service';
import { ordersService } from '@/core/services/orders.service';
import type { InventoryItem } from '@/types/inventory';
import { useRetailStore } from '../store/retail.store';
import '../retail.css';

export const PosView = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [search, setSearch] = useState('');
    const [customerId, setCustomerId] = useState('customer_walkin');
    const [processing, setProcessing] = useState(false);
    const cart = useRetailStore(state => state.cart);
    const customers = useRetailStore(state => state.customers);
    const addToCart = useRetailStore(state => state.addToCart);
    const updateQuantity = useRetailStore(state => state.updateQuantity);
    const clearCart = useRetailStore(state => state.clearCart);
    const recordSale = useRetailStore(state => state.recordSale);

    useEffect(() => {
        inventoryService.getInventory().then(setInventory).catch(() => setInventory([]));
    }, []);

    const products = useMemo(() => inventory.filter(item =>
        item.current > 0 &&
        `${item.name} ${item.barcode ?? ''} ${item.category ?? ''}`.toLowerCase().includes(search.toLowerCase()),
    ), [inventory, search]);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    const checkout = async () => {
        if (!cart.length || processing) return;
        setProcessing(true);
        try {
            const response = await ordersService.processSale(cart);
            recordSale({
                orderId: response.orderId,
                customerId,
                itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
                subtotal: response.subtotal,
                tax: response.tax,
                total: response.total,
            });
            clearCart();
            setInventory(await inventoryService.getInventory());
            window.alert(`Sale completed. Order ${response.orderId}`);
        } catch {
            window.alert('Sale could not be completed. Check stock and try again.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <section className="retail-page">
            <header style={{ marginBottom: 20 }}>
                <h1 style={{ margin: '0 0 6px' }}>Retail POS</h1>
                <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Search or scan products, assign a customer, and complete a sale.</p>
            </header>

            <div className="retail-grid retail-pos">
                <div>
                    <div className="retail-card" style={{ marginBottom: 18 }}>
                        <div className="retail-field">
                            <label htmlFor="retail-product-search">Product name or barcode</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--fg-muted)' }} />
                                <input id="retail-product-search" value={search} onChange={event => setSearch(event.target.value)} style={{ paddingLeft: 40 }} autoFocus />
                            </div>
                        </div>
                    </div>

                    <div className="retail-grid retail-product-grid">
                        {products.map(product => (
                            <button
                                key={product.id}
                                type="button"
                                className="retail-product"
                                onClick={() => addToCart({ id: product.id, name: product.name, price: product.price })}
                            >
                                <ShoppingBag size={22} color="#ec4899" />
                                <strong style={{ display: 'block', margin: '12px 0 6px' }}>{product.name}</strong>
                                <span style={{ color: 'var(--fg-secondary)' }}>${product.price.toFixed(2)} · {product.current} available</span>
                            </button>
                        ))}
                    </div>
                </div>

                <aside className="retail-card">
                    <h2>Current sale</h2>
                    <div className="retail-field" style={{ marginBottom: 16 }}>
                        <label htmlFor="retail-customer">Customer</label>
                        <select id="retail-customer" value={customerId} onChange={event => setCustomerId(event.target.value)}>
                            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                        </select>
                    </div>

                    {cart.length === 0 ? <div className="retail-empty">Select a product to begin.</div> : cart.map(item => (
                        <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--surface-400)' }}>
                            <strong>{item.name}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                <div className="retail-actions">
                                    <button className="retail-button" aria-label={`Decrease ${item.name}`} onClick={() => updateQuantity(item.id, -1)}><Minus size={15} /></button>
                                    <span style={{ alignSelf: 'center', minWidth: 22, textAlign: 'center' }}>{item.quantity}</span>
                                    <button className="retail-button" aria-label={`Increase ${item.name}`} onClick={() => updateQuantity(item.id, 1)}><Plus size={15} /></button>
                                </div>
                                <strong>${(item.price * item.quantity).toFixed(2)}</strong>
                            </div>
                        </div>
                    ))}

                    <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax (10%)</span><strong>${tax.toFixed(2)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, paddingTop: 12, borderTop: '1px solid var(--surface-400)' }}><span>Total</span><strong>${total.toFixed(2)}</strong></div>
                    </div>

                    <button className="retail-button retail-button--primary" disabled={!cart.length || processing} onClick={checkout} style={{ width: '100%', marginTop: 18 }}>
                        {processing ? 'Processing...' : 'Complete sale'}
                    </button>
                    <button className="retail-button" disabled={!cart.length} onClick={clearCart} style={{ width: '100%', marginTop: 8 }}>Clear cart</button>
                </aside>
            </div>
        </section>
    );
};
