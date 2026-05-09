import { useRestaurantStore } from '../store/restaurant.store';

export const BillingView = () => {
    const { orders } = useRestaurantStore();

    // Sort recent first
    const sortedOrders = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 24px' }}>Order History & Billing</h1>

            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--fg-secondary)' }}>ID</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--fg-secondary)' }}>Type</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--fg-secondary)' }}>Table</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--fg-secondary)' }}>Time</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--fg-secondary)' }}>Total</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--fg-secondary)' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedOrders.map(order => (
                            <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '16px', fontFamily: 'monospace' }}>#{order.id.slice(-4)}</td>
                                <td style={{ padding: '16px', textTransform: 'capitalize' }}>{order.type}</td>
                                <td style={{ padding: '16px' }}>{order.tableId ? order.tableId.replace('t-', '') : '-'}</td>
                                <td style={{ padding: '16px' }}>{order.createdAt.toLocaleTimeString()}</td>
                                <td style={{ padding: '16px', fontWeight: 600 }}>${order.total.toFixed(2)}</td>
                                <td style={{ padding: '16px' }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 8px', borderRadius: '100px', fontSize: '12px', fontWeight: 600,
                                        background: order.status === 'served' ? '#dcfce7' : order.status === 'cancelled' ? '#fee2e2' : '#f1f5f9',
                                        color: order.status === 'served' ? '#166534' : order.status === 'cancelled' ? '#991b1b' : '#475569'
                                    }}>
                                        {order.status.toUpperCase()}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {sortedOrders.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-secondary)' }}>
                                    No orders recorded today
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
