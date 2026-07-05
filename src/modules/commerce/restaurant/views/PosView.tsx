import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ShoppingCart, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import {
    restaurantApi,
    type RestaurantMenuItem,
    type RestaurantPaymentMethod,
    type RestaurantPaymentTiming,
    type RestaurantTable,
} from '@/api/restaurant.api';
import {
    createPerformanceCorrelationId,
    logPerformanceTiming,
    performanceDuration,
    performanceMark,
} from '@/utils/performanceInstrumentation';

type CartItem = RestaurantMenuItem & { quantity: number; notes?: string };
type PosPaymentMethod = Exclude<RestaurantPaymentMethod, 'mobile'>;

export const PosView = () => {
    const [categories, setCategories] = useState<{ id: string; name: string; items: RestaurantMenuItem[] }[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [paymentTiming, setPaymentTiming] = useState<RestaurantPaymentTiming>('pay_after_service');
    const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());
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

    useEffect(() => {
        if (selectedTable && paymentTiming === 'pay_before_service') {
            setPaymentTiming('pay_after_service');
        }
    }, [paymentTiming, selectedTable]);

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
    const totalAmount = totalCents / 100;
    const isPayNow = !selectedTable && paymentTiming === 'pay_before_service';
    const cashReceivedAmount = Number(cashReceived);
    const hasValidCashReceived = cashReceived.trim() !== '' && Number.isFinite(cashReceivedAmount);
    const changeDue = paymentMethod === 'cash' && hasValidCashReceived
        ? Math.max(0, cashReceivedAmount - totalAmount)
        : 0;
    const isShortCash = isPayNow && paymentMethod === 'cash' && (!hasValidCashReceived || cashReceivedAmount + 0.005 < totalAmount);

    const handleCheckout = async () => {
        if (!cart.length || isSubmitting) return;
        const correlationId = createPerformanceCorrelationId('pos-order');
        const submitStartedAt = performanceMark();
        logPerformanceTiming('restaurant.pos.submit.start', {
            correlationId,
            orderType: selectedTable ? 'dine_in' : 'takeaway',
            payNow: isPayNow,
        });
        setIsSubmitting(true);
        try {
            const orderItems = cart.map((item) => ({
                menu_item_id: item.id,
                quantity: item.quantity,
                notes: item.notes,
            }));
            const requestStartedAt = performanceMark();
            const result = isPayNow
                ? await restaurantApi.createPayNowTakeawayOrder({
                    payment_method: paymentMethod,
                    cash_received: paymentMethod === 'cash' ? cashReceivedAmount : undefined,
                    idempotency_key: submissionKey,
                    items: orderItems,
                }, { correlationId })
                : await restaurantApi.createOrder({
                    table_id: selectedTable || undefined,
                    order_type: selectedTable ? 'dine_in' : 'takeaway',
                    payment_timing: paymentTiming,
                    idempotency_key: submissionKey,
                    items: orderItems,
                }, { correlationId });
            logPerformanceTiming('restaurant.pos.request.end', {
                correlationId,
                requestDurationMs: performanceDuration(requestStartedAt),
            });
            const displayOrderNumber = isPayNow ? result.displayOrderNumber : result.displayOrderNumber;
            setCart([]);
            setSelectedTable('');
            setPaymentTiming('pay_after_service');
            setPaymentMethod('cash');
            setCashReceived('');
            setSubmissionKey(crypto.randomUUID());
            const [menu, tableData] = await Promise.all([
                restaurantApi.getMenu(),
                restaurantApi.getTables(),
            ]);
            setCategories(menu.categories);
            setTables(tableData);
            setSelectedCategory((current) => current || menu.categories[0]?.id || '');
            setMessage({ kind: 'success', text: `${displayOrderNumber} sent to kitchen.` });
            logPerformanceTiming('restaurant.pos.response.handled', {
                correlationId,
                submitDurationMs: performanceDuration(submitStartedAt),
            });
        } catch (error) {
            setMessage({
                kind: 'error',
                text: axios.isAxiosError(error) && error.response?.status === 403
                    ? 'You do not have permission to create orders'
                    : 'Order could not be sent. Your cart was kept.',
            });
            logPerformanceTiming('restaurant.pos.response.handled', {
                correlationId,
                submitDurationMs: performanceDuration(submitStartedAt),
                failed: true,
            });
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
                {!isLoading && !categories.length && (
                    <div style={{ background: '#ffffff', color: '#475569', border: '1px solid #d8dee8', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 20 }}>
                        Create menu categories and items in Menu Architect before starting POS orders.
                    </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            style={{
                                padding: '10px 20px', borderRadius: '100px', border: 'none',
                                background: selectedCategory === category.id ? 'var(--accent-primary)' : 'white',
                                color: selectedCategory === category.id ? 'white' : '#334155',
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
                                background: 'white', color: '#0f172a', padding: '16px', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left',
                                display: 'flex', flexDirection: 'column', gap: '8px', font: 'inherit',
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{item.name}</div>
                            <div style={{ color: '#475569' }}>${(item.price / 100).toFixed(2)}</div>
                        </button>
                    ))}
                    {!isLoading && categories.length > 0 && !menuItems.filter((item) => item.isAvailable).length && (
                        <div style={{ gridColumn: '1/-1', background: '#ffffff', color: '#475569', border: '1px solid #d8dee8', borderRadius: 'var(--radius-md)', padding: 20 }}>
                            No available items in this category.
                        </div>
                    )}
                </div>
            </div>

            <div className="restaurant-pos__cart" style={{ width: '360px', background: 'white', color: '#0f172a', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: '18px', display: 'flex', gap: 8 }}>
                    <ShoppingCart size={20} /> Current Order
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!cart.length && <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>Cart is empty</div>}
                    {cart.map((item) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                <div style={{ fontSize: '12px', color: '#475569' }}>
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
                        <label htmlFor="restaurant-table" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>TABLE ASSIGNMENT</label>
                        <select
                            id="restaurant-table"
                            value={selectedTable}
                            onChange={(event) => {
                                setSelectedTable(event.target.value);
                                if (event.target.value) setPaymentTiming('pay_after_service');
                            }}
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                        >
                            <option value="">No Table (Takeaway)</option>
                            {tables.filter((table) => table.status === 'available').map((table) => (
                                <option key={table.id} value={table.id}>{table.label} ({table.capacity}p)</option>
                            ))}
                        </select>
                        {!tables.some((table) => table.status === 'available') && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>No available tables. Create or free a table in Floor / Tables.</div>
                        )}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label htmlFor="restaurant-payment-timing" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>PAYMENT TIMING</label>
                        <select
                            id="restaurant-payment-timing"
                            value={paymentTiming}
                            onChange={(event) => setPaymentTiming(event.target.value as RestaurantPaymentTiming)}
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                        >
                            <option value="pay_after_service">Pay later</option>
                            {!selectedTable && <option value="pay_before_service">Pay now</option>}
                        </select>
                        {selectedTable && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Dine-in orders are pay later.</div>
                        )}
                    </div>

                    {isPayNow && (
                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label htmlFor="restaurant-payment-method" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>PAYMENT METHOD</label>
                                <select
                                    id="restaurant-payment-method"
                                    value={paymentMethod}
                                    onChange={(event) => setPaymentMethod(event.target.value as PosPaymentMethod)}
                                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="manual">Manual</option>
                                </select>
                            </div>
                            {paymentMethod === 'cash' && (
                                <div>
                                    <label htmlFor="restaurant-cash-received" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>CASH RECEIVED</label>
                                    <input
                                        id="restaurant-cash-received"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={cashReceived}
                                        onChange={(event) => setCashReceived(event.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                                    />
                                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: isShortCash ? '#b91c1c' : '#475569', fontWeight: 700 }}>
                                        <span>Change due</span>
                                        <span>${changeDue.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                        <span>Subtotal</span><span>${(totalCents / 100).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: '#475569' }}>
                        <span>Tax</span><span>$0.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>
                        <span>Total</span><span>${(totalCents / 100).toFixed(2)}</span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={!cart.length || isSubmitting || isShortCash}
                        style={{
                            width: '100%', padding: '16px', background: 'var(--accent-primary)', color: 'white',
                            border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '16px',
                            cursor: cart.length && !isSubmitting && !isShortCash ? 'pointer' : 'not-allowed',
                            opacity: cart.length && !isSubmitting && !isShortCash ? 1 : 0.6,
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                        }}
                    >
                        {isSubmitting ? <><Loader2 size={20} /> Sending...</> : <>{isPayNow ? 'Pay & Send to Kitchen' : 'Send to Kitchen'} <ArrowRight size={20} /></>}
                    </button>
                </div>
            </div>
        </div>
    );
};
