import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    restaurantApi,
    type RestaurantOrder,
    type RestaurantOrderStatus,
    type RestaurantPaymentMethod,
    type RestaurantTable,
} from '@/api/restaurant.api';
import { useAuthStore } from '@/store/auth.store';

type BillingTab = 'Today' | 'Service' | 'Payment' | 'Paid';

const statusLabels: Record<RestaurantOrderStatus, string> = {
    pending: 'Pending',
    in_kitchen: 'In Kitchen',
    ready: 'Ready',
    delivered: 'Delivered',
    served: 'Delivered',
    collected: 'Collected',
    closed: 'Closed',
    paid: 'Paid',
    cancelled: 'Cancelled',
};

const statusColors: Record<RestaurantOrderStatus, { background: string; color: string }> = {
    pending: { background: '#fef3c7', color: '#78350f' },
    in_kitchen: { background: '#dbeafe', color: '#1e3a8a' },
    ready: { background: '#dcfce7', color: '#166534' },
    delivered: { background: '#e0f2fe', color: '#075985' },
    served: { background: '#e0f2fe', color: '#075985' },
    collected: { background: '#fef3c7', color: '#78350f' },
    closed: { background: '#dcfce7', color: '#166534' },
    paid: { background: '#dcfce7', color: '#166534' },
    cancelled: { background: '#fee2e2', color: '#991b1b' },
};

const canTakePayment = (order: RestaurantOrder) => order.paymentStatus === 'unpaid' && (
    order.paymentTiming === 'pay_before_service' ||
    (order.orderType === 'takeaway' ? order.serviceStatus === 'collected' : order.serviceStatus === 'delivered')
);

const formatOrderNumber = (order: RestaurantOrder) => order.displayOrderNumber || 'Order pending number';

const currentTokenRole = () => {
    const token = localStorage.getItem('auth_token');
    const payload = token?.split('.')[1];
    if (!payload) return '';
    try {
        const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
        return typeof parsed.role === 'string' ? parsed.role : '';
    } catch {
        return '';
    }
};

const canCancel = (order: RestaurantOrder, role: string, userId?: string) => {
    if (order.paymentStatus === 'paid' || order.status === 'paid' || order.status === 'closed' || order.status === 'cancelled') return false;
    if (order.serviceStatus === 'closed' || order.serviceStatus === 'cancelled') return false;
    if (role === 'waiter') {
        return order.orderType === 'dine_in' && order.serviceStatus === 'pending' && order.createdBy === userId;
    }
    if (role === 'cashier') {
        return (order.orderType === 'takeaway' || order.orderType === 'delivery') && order.serviceStatus === 'pending';
    }
    return role === 'manager' || role === 'owner' || role === 'admin';
};

export const BillingView = ({ embedded = false }: { embedded?: boolean }) => {
    const user = useAuthStore((state) => state.user);
    const [orders, setOrders] = useState<RestaurantOrder[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [tab, setTab] = useState<BillingTab>('Today');
    const [payingId, setPayingId] = useState<string | null>(null);
    const [deliveringId, setDeliveringId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [paymentMethods, setPaymentMethods] = useState<Record<string, RestaurantPaymentMethod>>({});
    const [cashReceived, setCashReceived] = useState<Record<string, string>>({});
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const [orderData, tableData] = await Promise.all([
                restaurantApi.getOrders(),
                restaurantApi.getTables(),
            ]);
            setOrders(orderData);
            setTables(tableData);
            setError('');
        } catch {
            setError("Unable to load today's orders.");
        }
    }, []);

    useEffect(() => {
        void load();
        const refresh = () => void load();
        window.addEventListener('q360:restaurant-orders-updated', refresh);
        const interval = window.setInterval(refresh, 5_000);
        return () => {
            window.removeEventListener('q360:restaurant-orders-updated', refresh);
            window.clearInterval(interval);
        };
    }, [load]);

    const visibleOrders = useMemo(() => orders.filter((order) => {
        if (tab === 'Service') return order.serviceStatus === 'ready';
        if (tab === 'Payment') return canTakePayment(order);
        if (tab === 'Paid') return order.paymentStatus === 'paid';
        return true;
    }), [orders, tab]);

    const runningTotal = visibleOrders.reduce((sum, order) => sum + order.total, 0);
    const serviceLabel = (order: RestaurantOrder) => {
        if (order.orderType === 'delivery') return `Delivery${order.customerName ? ` · ${order.customerName}` : ''}`;
        if (order.orderType === 'takeaway') return 'Takeaway';
        return tables.find((table) => table.id === order.tableId)?.label || (order.tableId ? 'Table pending' : 'Dine-in');
    };

    const markPaid = async (order: RestaurantOrder) => {
        const method = paymentMethods[order.id] ?? 'cash';
        const total = order.total / 100;
        const received = Number(cashReceived[order.id] ?? '');
        if (method === 'cash' && (!Number.isFinite(received) || received < total)) {
            setError('Cash received must be at least the order total.');
            return;
        }
        setPayingId(order.id);
        try {
            const updated = await restaurantApi.completePayment(order.id, {
                method,
                amount: total,
            });
            setOrders((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setCashReceived((current) => {
                const next = { ...current };
                delete next[order.id];
                return next;
            });
            await load();
        } catch {
            setError('Unable to complete payment for this order.');
        } finally {
            setPayingId(null);
        }
    };

    const markDelivered = async (order: RestaurantOrder) => {
        setDeliveringId(order.id);
        try {
            const updated = await restaurantApi.markDelivered(order.id);
            setOrders((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            await load();
        } catch {
            setError(order.orderType === 'takeaway' ? 'Unable to mark this order as collected.' : 'Unable to mark this order as delivered.');
        } finally {
            setDeliveringId(null);
        }
    };

    const cancelOrder = async (order: RestaurantOrder) => {
        if (!window.confirm(`Cancel ${formatOrderNumber(order)}? This keeps the order in history.`)) return;
        const reason = window.prompt('Cancellation reason');
        const trimmedReason = reason?.trim();
        if (!trimmedReason) {
            setError('Cancellation reason is required.');
            return;
        }
        setCancellingId(order.id);
        try {
            const updated = await restaurantApi.cancelOrder(order.id, { reason: trimmedReason });
            setOrders((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setError('');
            await load();
        } catch {
            setError('Unable to cancel this order.');
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <div className={embedded ? 'cashier-queue cashier-queue--embedded' : 'cashier-queue'}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: embedded ? 16 : 24 }}>
                <div>
                    <h1 style={{ fontSize: embedded ? '22px' : '28px', fontWeight: 700, margin: '0 0 4px' }}>{embedded ? 'Cashier Queue' : 'Orders & Payments'}</h1>
                    {embedded && <p style={{ margin: 0, color: 'var(--fg-secondary)', fontSize: 13 }}>Complete collection, delivery, and payment without leaving POS.</p>}
                </div>
                {embedded && <button type="button" onClick={() => void load()} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 700 }}>Refresh</button>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {(['Today', 'Service', 'Payment', 'Paid'] as const).map((value) => (
                    <button
                        key={value}
                        onClick={() => setTab(value)}
                        style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--border-subtle)', background: tab === value ? 'var(--accent-primary)' : 'white', color: tab === value ? 'white' : 'var(--fg-secondary)', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {value}
                    </button>
                ))}
            </div>
            {error && <div style={{ marginBottom: 16, color: '#b91c1c' }}>{error}</div>}

            <div style={{ background: 'white', color: '#0f172a', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '16px' }}>Order</th>
                            <th style={{ padding: '16px' }}>Service</th>
                            <th style={{ padding: '16px' }}>Time</th>
                            <th style={{ padding: '16px' }}>Total</th>
                            <th style={{ padding: '16px' }}>Status</th>
                            <th style={{ padding: '16px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleOrders.map((order) => {
                            const orderCanTakePayment = canTakePayment(order);
                            const orderCanCancel = canCancel(order, currentTokenRole(), user?.id);
                            const method = paymentMethods[order.id] ?? 'cash';
                            const total = order.total / 100;
                            const received = Number(cashReceived[order.id] ?? '');
                            const changeDue = method === 'cash' && Number.isFinite(received)
                                ? Math.max(0, received - total)
                                : 0;
                            const cashIsShort = method === 'cash' && (!Number.isFinite(received) || received < total);
                            const cancelButton = orderCanCancel ? (
                                <button
                                    onClick={() => cancelOrder(order)}
                                    disabled={cancellingId === order.id}
                                    style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff1f2', color: '#991b1b', fontWeight: 700, cursor: cancellingId === order.id ? 'wait' : 'pointer' }}
                                >
                                    Cancel Order
                                </button>
                            ) : null;
                            return (
                                <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '16px', fontWeight: 800 }}>{formatOrderNumber(order)}</td>
                                <td style={{ padding: '16px' }}>{serviceLabel(order)}{order.orderType === 'delivery' && <small style={{ display: 'block', marginTop: 3, color: '#64748b' }}>{order.customerPhone}<br/>{order.deliveryAddress}</small>}</td>
                                <td style={{ padding: '16px' }}>{new Date(order.createdAt).toLocaleTimeString()}</td>
                                <td style={{ padding: '16px', fontWeight: 600 }}>${(order.total / 100).toFixed(2)}</td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, fontSize: '12px', fontWeight: 700, background: statusColors[order.status].background, color: statusColors[order.status].color }}>
                                        {statusLabels[order.status]}
                                    </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    {order.status === 'cancelled' ? (
                                        <div style={{ display: 'grid', gap: 4 }}>
                                            <span style={{ color: '#991b1b', fontWeight: 700 }}>Cancelled</span>
                                            {order.cancellationReason && <span style={{ color: '#64748b', fontSize: 12 }}>{order.cancellationReason}</span>}
                                            {order.cancelledBy && <span style={{ color: '#64748b', fontSize: 12 }}>By {order.cancelledBy}</span>}
                                        </div>
                                    ) : order.serviceStatus === 'ready' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => markDelivered(order)}
                                                disabled={deliveringId === order.id}
                                                className="btn-primary"
                                                style={{ padding: '7px 12px', cursor: deliveringId === order.id ? 'wait' : 'pointer' }}
                                            >
                                                {order.orderType === 'takeaway' ? 'Mark Collected' : 'Mark Delivered'}
                                            </button>
                                            {cancelButton}
                                        </div>
                                    ) : orderCanTakePayment ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <select
                                                aria-label={`Payment method for order ${formatOrderNumber(order)}`}
                                                value={method}
                                                onChange={(event) => setPaymentMethods((current) => ({
                                                    ...current,
                                                    [order.id]: event.target.value as RestaurantPaymentMethod,
                                                }))}
                                                disabled={payingId === order.id}
                                                style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="card">Card</option>
                                                <option value="manual">Manual</option>
                                                <option value="mobile">Mobile</option>
                                            </select>
                                            {method === 'cash' && (
                                                <div style={{ display: 'grid', gap: 4, minWidth: 150 }}>
                                                    <label htmlFor={`cash-${order.id}`} style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                                                        Total ${total.toFixed(2)}
                                                    </label>
                                                    <input
                                                        id={`cash-${order.id}`}
                                                        type="number"
                                                        min={total}
                                                        step="0.01"
                                                        inputMode="decimal"
                                                        placeholder="Cash received"
                                                        value={cashReceived[order.id] ?? ''}
                                                        onChange={(event) => setCashReceived((current) => ({
                                                            ...current,
                                                            [order.id]: event.target.value,
                                                        }))}
                                                        disabled={payingId === order.id}
                                                        style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${cashIsShort ? '#dc2626' : '#cbd5e1'}`, background: '#ffffff', color: '#0f172a' }}
                                                    />
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: cashIsShort ? '#b91c1c' : '#166534' }}>
                                                        Change ${changeDue.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => markPaid(order)}
                                                disabled={payingId === order.id || cashIsShort}
                                                className="btn-primary"
                                                style={{ padding: '7px 12px', cursor: payingId === order.id ? 'wait' : cashIsShort ? 'not-allowed' : 'pointer', opacity: cashIsShort ? 0.6 : 1 }}
                                            >
                                                Confirm Payment
                                            </button>
                                            {cancelButton}
                                        </div>
                                    ) : order.paymentStatus === 'paid' ? (
                                        <span style={{ color: '#166534', fontWeight: 600 }}>PAID</span>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ color: '#475569' }}>Awaiting service step</span>
                                            {cancelButton}
                                        </div>
                                    )}
                                </td>
                            </tr>
                            );
                        })}
                        {!visibleOrders.length && (
                            <tr>
                                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>No orders in this view</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>
                    <span>Running Total</span>
                    <span>${(runningTotal / 100).toFixed(2)}</span>
                </div>
            </div>
            <style>{`
                .cashier-queue--embedded { padding: 24px; border-top: 1px solid var(--border-subtle); background: var(--surface-100); }
                @media (max-width: 760px) {
                    .cashier-queue--embedded { padding: 18px; }
                    .cashier-queue table { min-width: 900px; }
                }
            `}</style>
        </div>
    );
};
