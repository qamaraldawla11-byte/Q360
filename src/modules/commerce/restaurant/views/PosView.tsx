import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ShoppingCart, Trash2, ArrowRight, Loader2, Minus, Plus, ShoppingBag, Utensils, Clock3, WalletCards, Bike, MapPin, Phone, UserRound } from 'lucide-react';
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
import { useBusinessModulesStore } from '@/store/businessModules.store';
import { BillingView } from './BillingView';
import { customersApi, type Customer } from '@/api/customers.api';

type CartItem = RestaurantMenuItem & { quantity: number; notes?: string };
type PosPaymentMethod = Exclude<RestaurantPaymentMethod, 'mobile'>;
type PosCategoryFilter = 'All' | 'Food' | 'Drinks' | 'Snacks';
type PosServiceType = 'takeaway' | 'dine_in' | 'delivery';

const POS_CATEGORY_FILTERS: PosCategoryFilter[] = ['All', 'Food', 'Drinks', 'Snacks'];

const itemBucketFor = (categoryName: string): Exclude<PosCategoryFilter, 'All'> => {
    const normalized = categoryName.toLowerCase();
    if (/(drink|drinks|beverage|beverages|juice|coffee|tea|soda|water)/.test(normalized)) return 'Drinks';
    if (/(snack|snacks|side|sides|dessert|desserts|sweet|sweets)/.test(normalized)) return 'Snacks';
    return 'Food';
};

export const PosView = () => {
    const tablesEnabled = useBusinessModulesStore(state => state.isEnabled('tables'));
    const loadBusinessModules = useBusinessModulesStore(state => state.load);
    const [categories, setCategories] = useState<{ id: string; name: string; items: RestaurantMenuItem[] }[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<PosCategoryFilter>('All');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [serviceType, setServiceType] = useState<PosServiceType>('takeaway');
    const [selectedTable, setSelectedTable] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');
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
                await loadBusinessModules();
                const [menu, customerData] = await Promise.all([
                    restaurantApi.getMenu(),
                    customersApi.list().catch(() => [] as Customer[]),
                ]);
                const tableData = useBusinessModulesStore.getState().isEnabled('tables') ? await restaurantApi.getTables() : [];
                setCategories(menu.categories);
                setTables(tableData);
                setCustomers(customerData);
                setSelectedCategory((current) => current || 'All');
            } catch {
                setMessage({ kind: 'error', text: 'Unable to load the menu and tables.' });
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [loadBusinessModules]);

    useEffect(() => {
        if (!tablesEnabled) {
            setSelectedTable('');
            setTables([]);
            if (serviceType === 'dine_in') setServiceType('takeaway');
        }
    }, [serviceType, tablesEnabled]);

    useEffect(() => {
        if (!message) return;
        const timeout = window.setTimeout(() => setMessage(null), 3500);
        return () => window.clearTimeout(timeout);
    }, [message]);

    useEffect(() => {
        if (serviceType === 'dine_in' && paymentTiming === 'pay_before_service') {
            setPaymentTiming('pay_after_service');
        }
    }, [paymentTiming, serviceType]);

    const chooseServiceType = (next: PosServiceType) => {
        if (next === 'dine_in' && !tablesEnabled) return;
        setServiceType(next);
        if (next !== 'dine_in') setSelectedTable('');
        if (next === 'dine_in') setPaymentTiming('pay_after_service');
    };

    const chooseCustomer = (customerId: string) => {
        setSelectedCustomerId(customerId);
        const customer = customers.find((entry) => entry.id === customerId);
        if (!customer) return;
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || '');
        setDeliveryAddress(customer.address || '');
    };

    const menuItems = useMemo(() => (
        categories.flatMap((category) => category.items.map((item) => ({
            ...item,
            categoryName: category.name,
            filterBucket: itemBucketFor(category.name),
        })))
    ), [categories]);

    const visibleMenuItems = useMemo(() => (
        menuItems.filter((item) => (
            item.isAvailable &&
            (selectedCategory === 'All' || item.filterBucket === selectedCategory)
        ))
    ), [menuItems, selectedCategory]);

    const addToCart = (item: RestaurantMenuItem) => {
        setCart((current) => {
            const existing = current.find((entry) => entry.id === item.id);
            return existing
                ? current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
                : [...current, { ...item, quantity: 1 }];
        });
    };

    const updateCartQuantity = (itemId: string, adjustment: number) => {
        setCart((current) => current
            .map((entry) => entry.id === itemId
                ? { ...entry, quantity: entry.quantity + adjustment }
                : entry)
            .filter((entry) => entry.quantity > 0));
    };

    const totalCents = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = totalCents / 100;
    const isPayNow = serviceType !== 'dine_in' && paymentTiming === 'pay_before_service';
    const deliveryDetailsComplete = serviceType !== 'delivery' || (
        customerName.trim() !== '' && customerPhone.trim() !== '' && deliveryAddress.trim() !== ''
    );
    const serviceSelectionComplete = serviceType !== 'dine_in' || selectedTable !== '';
    const cashReceivedAmount = Number(cashReceived);
    const hasValidCashReceived = cashReceived.trim() !== '' && Number.isFinite(cashReceivedAmount);
    const changeDue = paymentMethod === 'cash' && hasValidCashReceived
        ? Math.max(0, cashReceivedAmount - totalAmount)
        : 0;
    const amountStillDue = paymentMethod === 'cash'
        ? Math.max(0, totalAmount - (hasValidCashReceived ? cashReceivedAmount : 0))
        : 0;
    const isShortCash = isPayNow && paymentMethod === 'cash' && (!hasValidCashReceived || cashReceivedAmount + 0.005 < totalAmount);

    const handleCheckout = async () => {
        if (!cart.length || isSubmitting) return;
        const correlationId = createPerformanceCorrelationId('pos-order');
        const submitStartedAt = performanceMark();
        logPerformanceTiming('restaurant.pos.submit.start', {
            correlationId,
            orderType: serviceType,
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
                ? await restaurantApi.createPayNowOrder({
                    order_type: serviceType === 'delivery' ? 'delivery' : 'takeaway',
                    payment_method: paymentMethod,
                    cash_received: paymentMethod === 'cash' ? cashReceivedAmount : undefined,
                    customer_id: serviceType === 'delivery' && selectedCustomerId ? selectedCustomerId : undefined,
                    customer_name: serviceType === 'delivery' ? customerName.trim() : undefined,
                    customer_phone: serviceType === 'delivery' ? customerPhone.trim() : undefined,
                    delivery_address: serviceType === 'delivery' ? deliveryAddress.trim() : undefined,
                    delivery_notes: serviceType === 'delivery' ? deliveryNotes.trim() || undefined : undefined,
                    idempotency_key: submissionKey,
                    items: orderItems,
                }, { correlationId })
                : await restaurantApi.createOrder({
                    table_id: serviceType === 'dine_in' ? selectedTable : undefined,
                    order_type: serviceType,
                    payment_timing: paymentTiming,
                    customer_id: serviceType === 'delivery' && selectedCustomerId ? selectedCustomerId : undefined,
                    customer_name: serviceType === 'delivery' ? customerName.trim() : undefined,
                    customer_phone: serviceType === 'delivery' ? customerPhone.trim() : undefined,
                    delivery_address: serviceType === 'delivery' ? deliveryAddress.trim() : undefined,
                    delivery_notes: serviceType === 'delivery' ? deliveryNotes.trim() || undefined : undefined,
                    idempotency_key: submissionKey,
                    items: orderItems,
                }, { correlationId });
            logPerformanceTiming('restaurant.pos.request.end', {
                correlationId,
                requestDurationMs: performanceDuration(requestStartedAt),
            });
            const displayOrderNumber = isPayNow ? result.displayOrderNumber : result.displayOrderNumber;
            setCart([]);
            setServiceType('takeaway');
            setSelectedTable('');
            setSelectedCustomerId('');
            setCustomerName('');
            setCustomerPhone('');
            setDeliveryAddress('');
            setDeliveryNotes('');
            setPaymentTiming('pay_after_service');
            setPaymentMethod('cash');
            setCashReceived('');
            setSubmissionKey(crypto.randomUUID());
            const [menu, tableData] = await Promise.all([
                restaurantApi.getMenu(),
                tablesEnabled ? restaurantApi.getTables() : Promise.resolve([]),
            ]);
            setCategories(menu.categories);
            setTables(tableData);
            setSelectedCategory((current) => current || 'All');
            setMessage({ kind: 'success', text: `${displayOrderNumber} sent to kitchen. ${isPayNow ? 'Payment recorded.' : 'Payment remains open.'}` });
            window.dispatchEvent(new CustomEvent('q360:restaurant-orders-updated'));
            logPerformanceTiming('restaurant.pos.response.handled', {
                correlationId,
                submitDurationMs: performanceDuration(submitStartedAt),
            });
        } catch (error) {
            setMessage({
                kind: 'error',
                text: axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
                    ? error.response.data.error
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
        <>
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
                        Create menu categories and items in Menu before starting POS orders.
                    </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {POS_CATEGORY_FILTERS.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            style={{
                                padding: '10px 20px', borderRadius: '100px', border: 'none',
                                background: selectedCategory === category ? 'var(--accent-primary)' : 'white',
                                color: selectedCategory === category ? 'white' : '#334155',
                                fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            }}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                    {visibleMenuItems.map((item) => (
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
                            <div style={{ color: '#64748b', fontSize: 12 }}>{item.categoryName}</div>
                            <div style={{ color: '#475569' }}>${(item.price / 100).toFixed(2)}</div>
                        </button>
                    ))}
                    {!isLoading && categories.length > 0 && !visibleMenuItems.length && (
                        <div style={{ gridColumn: '1/-1', background: '#ffffff', color: '#475569', border: '1px solid #d8dee8', borderRadius: 'var(--radius-md)', padding: 20 }}>
                            No available {selectedCategory.toLowerCase()} items.
                        </div>
                    )}
                </div>
            </div>

            <aside className="restaurant-pos__cart">
                <header className="pos-cart-header">
                    <div className="pos-cart-title">
                        <span className="pos-cart-icon"><ShoppingCart size={21} /></span>
                        <div>
                            <strong>Current order</strong>
                            <span>{totalItems ? `${totalItems} ${totalItems === 1 ? 'item' : 'items'}` : 'Ready for a new order'}</span>
                        </div>
                    </div>
                    {!!cart.length && (
                        <button type="button" className="pos-cart-clear" onClick={() => setCart([])}>Clear</button>
                    )}
                </header>

                <div className="pos-cart-scroll">
                    <section className="pos-cart-items" aria-label="Order items">
                        {!cart.length && (
                            <div className="pos-cart-empty">
                                <ShoppingCart size={28} />
                                <strong>Your order is empty</strong>
                                <span>Select a menu item to begin.</span>
                            </div>
                        )}
                        {cart.map((item) => (
                            <article key={item.id} className="pos-cart-item">
                                <div className="pos-cart-item-copy">
                                    <strong>{item.name}</strong>
                                    <span>${(item.price / 100).toFixed(2)} each</span>
                                </div>
                                <strong className="pos-cart-line-total">${((item.price * item.quantity) / 100).toFixed(2)}</strong>
                                <div className="pos-cart-quantity" aria-label={`${item.name} quantity`}>
                                    <button type="button" onClick={() => updateCartQuantity(item.id, -1)} aria-label={`Remove one ${item.name}`}>
                                        <Minus size={15} />
                                    </button>
                                    <span>{item.quantity}</span>
                                    <button type="button" onClick={() => updateCartQuantity(item.id, 1)} aria-label={`Add one ${item.name}`}>
                                        <Plus size={15} />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="pos-cart-remove"
                                    onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))}
                                    aria-label={`Remove ${item.name} from order`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </article>
                        ))}
                    </section>

                    <section className="pos-checkout">
                        <div className="pos-checkout-heading">
                            <strong>Order details</strong>
                            <span>Choose service and payment options.</span>
                        </div>
                    <div className="pos-field">
                        <span className="pos-field-label">SERVICE TYPE</span>
                        <div className="pos-touch-options pos-service-options" role="group" aria-label="Service type">
                            <button type="button" className={serviceType === 'takeaway' ? 'selected' : ''} onClick={() => chooseServiceType('takeaway')}>
                                <ShoppingBag size={20} /><span><strong>Takeaway</strong><small>No table</small></span>
                            </button>
                            <button type="button" disabled={!tablesEnabled} className={serviceType === 'dine_in' ? 'selected' : ''} onClick={() => chooseServiceType('dine_in')}>
                                <Utensils size={20} /><span><strong>Dine-in</strong><small>{tablesEnabled ? 'Choose table' : 'Tables disabled'}</small></span>
                            </button>
                            <button type="button" className={serviceType === 'delivery' ? 'selected' : ''} onClick={() => chooseServiceType('delivery')}>
                                <Bike size={20} /><span><strong>Delivery</strong><small>Customer address</small></span>
                            </button>
                        </div>
                        <div className="pos-field-help">
                            {serviceType === 'dine_in' ? 'Choose an available table. Dine-in is paid after service.' : serviceType === 'delivery' ? 'Add the customer contact and delivery address below.' : 'Takeaway orders can be paid now or left open.'}
                        </div>
                    </div>

                    {serviceType === 'dine_in' && <div className="pos-field">
                        <span className="pos-field-label">TABLE</span>
                        <div className="pos-touch-options pos-table-options" role="group" aria-label="Table assignment">
                            {tables.filter((table) => table.status === 'available').map((table) => (
                                <button type="button" key={table.id} className={selectedTable === table.id ? 'selected' : ''} onClick={() => setSelectedTable(table.id)}>
                                    <Utensils size={19} /><span><strong>{table.label}</strong><small>{table.capacity} seats</small></span>
                                </button>
                            ))}
                        </div>
                        {!tables.some((table) => table.status === 'available') && <div className="pos-field-help pos-field-help--error">No available tables. Free or create one in Floor / Tables.</div>}
                    </div>}

                    {serviceType === 'delivery' && <section className="pos-delivery-card" aria-label="Delivery customer details">
                        <div className="pos-delivery-heading"><Bike size={18}/><div><strong>Delivery customer</strong><small>Name, phone and address are required.</small></div></div>
                        <label className="pos-delivery-customer">Saved customer
                            <select value={selectedCustomerId} onChange={event => chooseCustomer(event.target.value)}>
                                <option value="">New / walk-in customer</option>
                                {customers.map(customer => <option value={customer.id} key={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
                            </select>
                        </label>
                        <div className="pos-delivery-grid">
                            <label><UserRound size={15}/><span>Name *</span><input value={customerName} onChange={event => setCustomerName(event.target.value)} maxLength={160} autoComplete="name" placeholder="Customer name" /></label>
                            <label><Phone size={15}/><span>Phone *</span><input value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} maxLength={60} type="tel" autoComplete="tel" placeholder="Contact number" /></label>
                            <label className="wide"><MapPin size={15}/><span>Delivery address *</span><textarea value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} maxLength={500} rows={2} autoComplete="street-address" placeholder="Street, building, area and city" /></label>
                            <label className="wide"><span>Delivery notes</span><input value={deliveryNotes} onChange={event => setDeliveryNotes(event.target.value)} maxLength={1000} placeholder="Door, landmark or driver note (optional)" /></label>
                        </div>
                        {!deliveryDetailsComplete && <div className="pos-field-help pos-field-help--error">Complete the customer name, phone and delivery address.</div>}
                    </section>}

                    <div className="pos-field">
                        <span className="pos-field-label">PAYMENT TYPE</span>
                        <div className="pos-touch-options" role="group" aria-label="Payment type">
                            <button type="button" className={paymentTiming === 'pay_after_service' ? 'selected' : ''} onClick={() => setPaymentTiming('pay_after_service')}>
                                <Clock3 size={20} /><span><strong>{serviceType === 'delivery' ? 'Pay on delivery' : 'Pay later'}</strong><small>Keep payment open</small></span>
                            </button>
                            {serviceType !== 'dine_in' && <button type="button" className={paymentTiming === 'pay_before_service' ? 'selected' : ''} onClick={() => setPaymentTiming('pay_before_service')}>
                                <WalletCards size={20} /><span><strong>Pay now</strong><small>Complete at POS</small></span>
                            </button>}
                        </div>
                        {serviceType === 'dine_in' && (
                            <div className="pos-field-help">Dine-in orders are paid after service.</div>
                        )}
                    </div>

                    {isPayNow && (
                        <div className="pos-payment-card">
                            <div className="pos-field">
                                <label htmlFor="restaurant-payment-method">PAYMENT METHOD</label>
                                <select
                                    id="restaurant-payment-method"
                                    value={paymentMethod}
                                    onChange={(event) => setPaymentMethod(event.target.value as PosPaymentMethod)}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="manual">Manual</option>
                                </select>
                            </div>
                            {paymentMethod === 'cash' && (
                                <div className="pos-field">
                                    <div className="pos-cash-label">
                                        <label htmlFor="restaurant-cash-received">CASH RECEIVED</label>
                                        <button type="button" onClick={() => setCashReceived(totalAmount.toFixed(2))}>Exact amount</button>
                                    </div>
                                    <div className="pos-money-input">
                                        <span>$</span>
                                        <input
                                            id="restaurant-cash-received"
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={cashReceived}
                                            onChange={(event) => setCashReceived(event.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className={`pos-change ${isShortCash ? 'pos-change--short' : ''}`}>
                                        <span>{isShortCash ? 'Amount still due' : 'Change due'}</span>
                                        <strong>${(isShortCash ? amountStillDue : changeDue).toFixed(2)}</strong>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pos-totals">
                        <div><span>Subtotal</span><span>${(totalCents / 100).toFixed(2)}</span></div>
                        <div><span>Tax</span><span>$0.00</span></div>
                        <div className="pos-total"><strong>Total</strong><strong>${(totalCents / 100).toFixed(2)}</strong></div>
                    </div>
                    </section>
                </div>

                <footer className="pos-cart-footer">
                    <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={!cart.length || isSubmitting || isShortCash || !deliveryDetailsComplete || !serviceSelectionComplete}
                    >
                        {isSubmitting ? <><Loader2 size={20} /> Sending...</> : <>{isPayNow ? 'Pay & Send to Kitchen' : 'Send to Kitchen'} <ArrowRight size={20} /></>}
                    </button>
                    {isShortCash && <span className="pos-footer-help">Enter enough cash to complete payment.</span>}
                    {!serviceSelectionComplete && <span className="pos-footer-help">Choose a table for this dine-in order.</span>}
                    {!deliveryDetailsComplete && <span className="pos-footer-help">Complete the required delivery details.</span>}
                </footer>
            </aside>
            <style>{`
                .restaurant-pos__cart {
                    width: 420px;
                    min-width: 380px;
                    background: #ffffff;
                    color: #0f172a;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-subtle);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
                }

                .pos-cart-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 18px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    flex: none;
                }

                .pos-cart-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
                .pos-cart-title > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
                .pos-cart-title strong { font-size: 18px; line-height: 1.2; }
                .pos-cart-title span { color: #64748b; font-size: 12px; }
                .pos-cart-icon { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: #1d4ed8; background: #eff6ff; }
                .pos-cart-clear { border: 0; background: transparent; color: #64748b; font-weight: 700; cursor: pointer; padding: 8px; }
                .pos-cart-clear:hover { color: #dc2626; }

                .pos-cart-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
                .pos-cart-items { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; }
                .pos-cart-empty { min-height: 130px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #94a3b8; text-align: center; }
                .pos-cart-empty strong { color: #475569; }
                .pos-cart-empty span { font-size: 13px; }

                .pos-cart-item {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 10px 14px;
                    align-items: center;
                    padding: 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 14px;
                    background: #ffffff;
                }
                .pos-cart-item-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
                .pos-cart-item-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .pos-cart-item-copy span { color: #64748b; font-size: 12px; }
                .pos-cart-line-total { font-size: 15px; }
                .pos-cart-quantity { display: inline-flex; align-items: center; width: max-content; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; }
                .pos-cart-quantity button { width: 34px; height: 32px; border: 0; background: #f8fafc; color: #334155; cursor: pointer; display: grid; place-items: center; }
                .pos-cart-quantity button:hover { background: #e2e8f0; }
                .pos-cart-quantity span { min-width: 32px; text-align: center; font-weight: 800; font-size: 13px; }
                .pos-cart-remove { justify-self: end; border: 0; background: transparent; color: #ef4444; cursor: pointer; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; }
                .pos-cart-remove:hover { background: #fef2f2; }

                .pos-checkout { border-top: 1px solid #e2e8f0; background: #f8fafc; padding: 18px; }
                .pos-checkout-heading { display: flex; flex-direction: column; gap: 3px; margin-bottom: 16px; }
                .pos-checkout-heading strong { font-size: 16px; }
                .pos-checkout-heading span { font-size: 12px; color: #64748b; }
                .pos-field { margin-bottom: 15px; }
                .pos-field label, .pos-field-label { display: block; margin-bottom: 7px; font-size: 11px; line-height: 1; letter-spacing: 0.06em; font-weight: 800; color: #475569; }
                .pos-field select, .pos-field input { width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 11px; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font: inherit; }
                .pos-field select:focus, .pos-field input:focus { outline: 2px solid rgba(59, 130, 246, 0.18); border-color: #3b82f6; }
                .pos-touch-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
                .pos-service-options { grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); }
                .pos-touch-options > button { min-height: 62px; padding: 9px 10px; display: flex; align-items: center; gap: 9px; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; color: #475569; cursor: pointer; font: inherit; text-align: left; touch-action: manipulation; }
                .pos-touch-options > button:hover { border-color: #93c5fd; background: #f8fbff; }
                .pos-touch-options > button:disabled { cursor: not-allowed; opacity: .45; }
                .pos-touch-options > button.selected { border: 2px solid #3b82f6; padding: 8px 9px; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59,130,246,.08); }
                .pos-touch-options > button > span { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
                .pos-touch-options > button strong { font-size: 12px; line-height: 1.2; }
                .pos-touch-options > button small { color: #64748b; font-size: 10px; line-height: 1.2; }
                .pos-field-help { margin-top: 7px; font-size: 12px; line-height: 1.45; color: #64748b; }
                .pos-field-help--error { color: #b91c1c; font-weight: 700; }
                .pos-takeaway-notice { margin-bottom: 15px; padding: 11px 12px; border-radius: 10px; background: #fff7ed; color: #9a3412; font-size: 12px; line-height: 1.45; }
                .pos-delivery-card { margin: 4px 0 16px; padding: 14px; border: 1px solid #fed7aa; border-radius: 14px; background: #fffaf5; }
                .pos-delivery-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; color: #9a3412; }
                .pos-delivery-heading > div { display: flex; flex-direction: column; gap: 2px; }
                .pos-delivery-heading small { color: #78716c; font-size: 11px; }
                .pos-delivery-customer { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; color: #475569; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
                .pos-delivery-customer select { width: 100%; min-height: 44px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; font: inherit; text-transform: none; letter-spacing: normal; }
                .pos-delivery-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }
                .pos-delivery-grid label { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 5px; color: #475569; font-size: 11px; font-weight: 800; }
                .pos-delivery-grid label.wide { grid-column: 1/-1; }
                .pos-delivery-grid input,.pos-delivery-grid textarea { grid-column: 1/-1; width: 100%; min-height: 42px; padding: 9px 11px; resize: vertical; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; font: inherit; font-size: 13px; }
                .pos-payment-card { margin: 4px 0 16px; padding: 14px; border-radius: 14px; background: #ffffff; border: 1px solid #dbe4f0; }
                .pos-payment-card .pos-field:last-child { margin-bottom: 0; }
                .pos-cash-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 7px; }
                .pos-cash-label label { margin: 0; }
                .pos-cash-label button { border: 0; background: transparent; color: #2563eb; font-size: 12px; font-weight: 800; cursor: pointer; }
                .pos-money-input { position: relative; }
                .pos-money-input > span { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #64748b; font-weight: 700; }
                .pos-money-input input { padding-left: 28px; }
                .pos-change { margin-top: 8px; display: flex; justify-content: space-between; gap: 12px; color: #166534; font-size: 13px; }
                .pos-change--short { color: #b91c1c; }
                .pos-totals { border-top: 1px solid #dbe4f0; padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
                .pos-totals > div { display: flex; justify-content: space-between; gap: 12px; color: #475569; font-size: 13px; }
                .pos-totals .pos-total { margin-top: 3px; color: #0f172a; font-size: 20px; }

                .pos-cart-footer { flex: none; padding: 14px 18px 16px; border-top: 1px solid #e2e8f0; background: #ffffff; }
                .pos-cart-footer button { width: 100%; padding: 14px 16px; background: var(--accent-primary); color: #ffffff; border: 0; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; }
                .pos-cart-footer button:disabled { cursor: not-allowed; opacity: 0.5; }
                .pos-footer-help { display: block; margin-top: 8px; color: #b91c1c; text-align: center; font-size: 12px; font-weight: 700; }

                @media (max-width: 1100px) {
                    .restaurant-pos__cart { width: 380px; min-width: 350px; }
                }

                @media (max-width: 860px) {
                    .restaurant-pos {
                        height: auto !important;
                        min-height: calc(100vh - 80px);
                        flex-direction: column;
                    }

                    .restaurant-pos__catalog {
                        overflow: visible !important;
                        padding-right: 0 !important;
                    }

                    .restaurant-pos__cart {
                        width: 100% !important;
                        min-width: 0;
                        min-height: 560px;
                        max-height: none;
                    }

                    .pos-cart-scroll { overflow: visible; }
                }
                @media (max-width: 480px) {
                    .pos-service-options { grid-template-columns: repeat(3,minmax(0,1fr)); }
                    .pos-service-options > button { min-height: 76px; flex-direction: column; justify-content: center; text-align: center; }
                    .pos-delivery-grid { grid-template-columns: 1fr; }
                    .pos-delivery-grid label.wide { grid-column: auto; }
                }
            `}</style>
        </div>
        <BillingView embedded />
        </>
    );
};
