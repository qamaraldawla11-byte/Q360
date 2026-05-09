import { useState } from 'react';
import { useRestaurantStore } from '../store/restaurant.store';
import { ShoppingCart, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import type { OrderItem } from '../store/restaurant.types';
import { ordersService } from '@/core/services/orders.service';

export const PosView = () => {
    const { menu, categories, createOrder, tables } = useRestaurantStore();
    const [selectedCategory, setSelectedCategory] = useState(categories[0]);
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addToCart = (item: any) => {
        const existing = cart.find(i => i.id === item.id);
        if (existing) {
            setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setCart([...cart, { ...item, quantity: 1 }]);
        }
    };

    const removeFromCart = (itemId: string) => {
        setCart(cart.filter(i => i.id !== itemId));
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    const handleCheckout = async () => {
        if (cart.length === 0 || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Persist order to backend first (prevents data loss on refresh)
            await ordersService.processSale(cart);

            // Then update local restaurant state for kitchen display
            createOrder({
                items: cart,
                total,
                tableId: selectedTable || undefined,
                type: selectedTable ? 'dine-in' : 'takeaway'
            });

            setCart([]);
            setSelectedTable('');
            alert('Order sent to kitchen!');
        } catch (error) {
            console.error('Order submission failed:', error);
            alert('Failed to send order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 80px)' }}>

            {/* Menu Grid */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '100px',
                                border: 'none',
                                background: selectedCategory === cat ? 'var(--accent-primary)' : 'white',
                                color: selectedCategory === cat ? 'white' : 'var(--fg-secondary)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                    {menu.filter(m => m.category === selectedCategory).map(item => (
                        <div
                            key={item.id}
                            onClick={() => addToCart(item)}
                            style={{
                                background: 'white', padding: '16px', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-subtle)', cursor: 'pointer',
                                transition: 'transform 0.1s',
                                display: 'flex', flexDirection: 'column', gap: '8px'
                            }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{item.name}</div>
                            <div style={{ color: 'var(--fg-secondary)' }}>${item.price}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cart Sidebar */}
            <div style={{ width: '360px', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '18px' }}>
                        <ShoppingCart size={20} /> Current Order
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {cart.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--fg-muted)', marginTop: '40px' }}>
                            Cart is empty
                        </div>
                    )}
                    {cart.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>${item.price} x {item.quantity}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontWeight: 600 }}>${(item.price * item.quantity).toFixed(2)}</div>
                                <button onClick={() => removeFromCart(item.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ padding: '20px', background: '#f8fafc', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--fg-secondary)' }}>TABLE ASSIGNMENT</label>
                        <select
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}
                        >
                            <option value="">No Table (Takeaway)</option>
                            {tables.filter(t => t.status === 'free').map(t => (
                                <option key={t.id} value={t.id}>Table {t.number} ({t.capacity}p)</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: 'var(--fg-secondary)' }}>
                        <span>Tax (10%)</span>
                        <span>${tax.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isSubmitting}
                        style={{
                            width: '100%', padding: '16px', background: 'var(--accent-primary)', color: 'white',
                            border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '16px',
                            cursor: (cart.length > 0 && !isSubmitting) ? 'pointer' : 'not-allowed',
                            opacity: (cart.length > 0 && !isSubmitting) ? 1 : 0.6,
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                        }}
                    >
                        {isSubmitting ? (
                            <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                        ) : (
                            <>Send to Kitchen <ArrowRight size={20} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
