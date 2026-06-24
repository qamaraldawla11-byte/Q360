import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import {
    restaurantApi,
    type RestaurantMenuItem,
    type RestaurantTable,
} from '@/api/restaurant.api';

type CartItem = RestaurantMenuItem & { quantity: number; notes?: string };

export const PosView = () => {
    const [categories, setCategories] = useState<{ id: string; name: string; items: RestaurantMenuItem[] }[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [menu, tableData] = await Promise.all([
                    restaurantApi.getMenu(),
                    restaurantApi.getTables(),
                ]);
                setCategories(menu.categories);
                setTables(tableData);
                setSelectedCategory((current) => current || menu.categories[0]?.id || '');
            } catch {
                setMessage({ kind: 'error', text: 'Unable to load the menu and tables.' });
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, []);

    useEffect(() => {
        if (!message) return;
        const timeout = window.setTimeout(() => setMessage(null), 3500);
        return () => window.clearTimeout(timeout);
    }, [message]);

    const menuItems = useMemo(
        () => categories.find((category) => category.id === selectedCategory)?.items || [],
        [categories, selectedCategory],
    );

    const addToCart = (item: RestaurantMenuItem) => {
        setCart((current) => {
            const existing = current.find((entry) => entry.id === item.id);
            return existing
                ? current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
                : [...current, { ...item, quantity: 1 }];
        });
    };

    const totalCents = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleCheckout = async () => {
        if (!cart.length || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await restaurantApi.createOrder({
                table_id: selectedTable || undefined,
                items: cart.map((item) => ({
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    notes: item.notes,
                })),
            });
            setCart([]);
            setSelectedTable('');
            setTables(await restaurantApi.getTables());
            setMessage({ kind: 'success', text: 'Order sent to kitchen.' });
        } catch {
            setMessage({ kind: 'error', text: 'Order could not be sent. Your cart was kept.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="restaurant-pos" style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 80px)' }}>
            {message && (
                <div style={{
                    position: 'fixed', right: 24, top: 24, zIndex: 'var(--z-toast)',
                    padding: '12px 16px', borderRadius: 8, color: 'white',
                    background: message.kind === 'success' ? '#16a34a' : '#dc2626',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
                }}>
                    {message.text}
                </div>
            )}

            <div className="restaurant-pos__catalog" style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                {isLoading && <div style={{ color: 'var(--fg-secondary)' }}>Loading menu...</div>}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            style={{
                                padding: '10px 20px', borderRadius: '100px', border: 'none',
                                background: selectedCategory === category.id ? 'var(--accent-primary)' : 'white',
                                color: selectedCategory === category.id ? 'white' : 'var(--fg-secondary)',
                                fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            }}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                    {menuItems.filter((item) => item.isAvailable).map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => addToCart(item)}
                            style={{
                                background: 'white', padding: '16px', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left',
                                display: 'flex', flexDirection: 'column', gap: '8px', font: 'inherit',
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{item.name}</div>
                            <div style={{ color: 'var(--fg-secondary)' }}>${(item.price / 100).toFixed(2)}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="restaurant-pos__cart" style={{ width: '360px', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: '18px', display: 'flex', gap: 8 }}>
                    <ShoppingCart size={20} /> Current Order
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!cart.length && <div style={{ textAlign: 'center', color: 'var(--fg-muted)', marginTop: '40px' }}>Cart is empty</div>}
                    {cart.map((item) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>
                                    ${(item.price / 100).toFixed(2)} x {item.quantity}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontWeight: 600 }}>${((item.price * item.quantity) / 100).toFixed(2)}</div>
                                <button onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ padding: '20px', background: '#f8fafc', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label htmlFor="restaurant-table" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--fg-secondary)' }}>TABLE ASSIGNMENT</label>
                        <select
                            id="restaurant-table"
                            value={selectedTable}
                            onChange={(event) => setSelectedTable(event.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}
                        >
                            <option value="">No Table (Takeaway)</option>
                            {tables.filter((table) => table.status === 'available').map((table) => (
                                <option key={table.id} value={table.id}>{table.label} ({table.capacity}p)</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                        <span>Subtotal</span><span>${(totalCents / 100).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: 'var(--fg-secondary)' }}>
                        <span>Tax</span><span>$0.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>
                        <span>Total</span><span>${(totalCents / 100).toFixed(2)}</span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={!cart.length || isSubmitting}
                        style={{
                            width: '100%', padding: '16px', background: 'var(--accent-primary)', color: 'white',
                            border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '16px',
                            cursor: cart.length && !isSubmitting ? 'pointer' : 'not-allowed',
                            opacity: cart.length && !isSubmitting ? 1 : 0.6,
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                        }}
                    >
                        {isSubmitting ? <><Loader2 size={20} /> Sending...</> : <>Send to Kitchen <ArrowRight size={20} /></>}
                    </button>
                </div>
            </div>
        </div>
    );
};
