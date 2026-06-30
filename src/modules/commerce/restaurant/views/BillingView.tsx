import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    restaurantApi,
    type RestaurantOrder,
    type RestaurantOrderStatus,
    type RestaurantPaymentMethod,
    type RestaurantTable,
} from '@/api/restaurant.api';

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

export const BillingView = () => {
    const [orders, setOrders] = useState<RestaurantOrder[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [tab, setTab] = useState<BillingTab>('Today');
    const [payingId, setPayingId] = useState<string | null>(null);
    const [deliveringId, setDeliveringId] = useState<string | null>(null);
    const [paymentMethods, setPaymentMethods] = useState<Record<string, RestaurantPaymentMethod>>({});
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
            setError('Unable to load today’s orders.');
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const visibleOrders = useMemo(() => orders.filter((order) => {
        if (tab === 'Service') return order.serviceStatus === 'ready';
        if (tab === 'Payment') return canTakePayment(order);
        if (tab === 'Paid') return order.paymentStatus === 'paid';
        return true;
    }), [orders, tab]);

    const runningTotal = visibleOrders.reduce((sum, order) => sum + order.total, 0);
    const tableLabel = (tableId: string | null) =>
        tables.find((table) => table.id === tableId)?.label || (tableId ? tableId : 'Takeaway');

    const markPaid = async (order: RestaurantOrder) => {
        const method = paymentMethods[order.id] ?? 'cash';
        setPayingId(order.id);
        try {
            await restaurantApi.completePayment(order.id, {
                method,
                amount: order.total / 100,
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
            await restaurantApi.markDelivered(order.id);
            await load();
        } catch {
            setError('Unable to mark this order as delivered.');
        } finally {
            setDeliveringId(null);
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 24px' }}>Order History & Billing</h1>
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

            <div style={{ background: 'white', color: '#0f172a', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '16px' }}>ID</th>
                            <th style={{ padding: '16px' }}>Table</th>
                            <th style={{ padding: '16px' }}>Time</th>
                            <th style={{ padding: '16px' }}>Total</th>
                            <th style={{ padding: '16px' }}>Status</th>
                            <th style={{ padding: '16px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleOrders.map((order) => {
                            const orderCanTakePayment = canTakePayment(order);
                            return (
                                <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '16px', fontFamily: 'monospace' }}>#{order.id.slice(-8)}</td>
                                <td style={{ padding: '16px' }}>{tableLabel(order.tableId)}</td>
                                <td style={{ padding: '16px' }}>{new Date(order.createdAt).toLocaleTimeString()}</td>
                                <td style={{ padding: '16px', fontWeight: 600 }}>${(order.total / 100).toFixed(2)}</td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, fontSize: '12px', fontWeight: 700, background: statusColors[order.status].background, color: statusColors[order.status].color }}>
                                        {statusLabels[order.status]}
                                    </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    {order.serviceStatus === 'ready' ? (
                                        <button
                                            onClick={() => markDelivered(order)}
                                            disabled={deliveringId === order.id}
                                            className="btn-primary"
                                            style={{ padding: '7px 12px', cursor: deliveringId === order.id ? 'wait' : 'pointer' }}
                                        >
                                            {order.tableId ? 'Mark Delivered' : 'Mark Handed Over'}
                                        </button>
                                    ) : orderCanTakePayment ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <select
                                                aria-label={`Payment method for order ${order.id.slice(-8)}`}
                                                value={paymentMethods[order.id] ?? 'cash'}
                                                onChange={(event) => setPaymentMethods((current) => ({
                                                    ...current,
                                                    [order.id]: event.target.value as RestaurantPaymentMethod,
                                                }))}
                                                disabled={payingId === order.id}
                                                style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="card">Card</option>
                                                <option value="mobile">Mobile</option>
                                            </select>
                                            <button
                                                onClick={() => markPaid(order)}
                                                disabled={payingId === order.id}
                                                className="btn-primary"
                                                style={{ padding: '7px 12px', cursor: payingId === order.id ? 'wait' : 'pointer' }}
                                            >
                                                Mark as Paid
                                            </button>
                                        </div>
                                    ) : order.paymentStatus === 'paid' ? (
                                        <span style={{ color: '#166534', fontWeight: 600 }}>PAID</span>
                                    ) : (
                                        <span style={{ color: '#475569' }}>Awaiting service step</span>
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
        </div>
    );
};
