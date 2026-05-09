import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Clock, CheckCircle2 } from 'lucide-react';
import { useRestaurantStore } from '../store/restaurant.store';

export const KitchenView = () => {
    const { orders, updateOrderStatus } = useRestaurantStore();
    const activeOrders = orders.filter(o => o.status !== 'served' && o.status !== 'paid' && o.status !== 'cancelled');

    return (
        <ModuleShell fullHeight>
            <PageHeader
                title="Kitchen Display System"
                subtitle={`Live Orders: ${activeOrders.length}`}
                actions={
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--fg-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} /> Late (&gt;20m)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: '#eab308', borderRadius: '50%' }} /> Cooking</span>
                    </div>
                }
            />

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '24px',
                overflowX: 'auto',
                paddingBottom: '24px'
            }}>
                {activeOrders.map(order => (
                    <div key={order.id} style={{
                        background: 'white', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '16px', borderBottom: '1px solid var(--border-subtle)',
                            background: order.status === 'new' ? '#fee2e2' : '#f0fdf4',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <span style={{ fontWeight: 800, fontSize: '16px' }}>#{order.id.slice(-4)}</span>
                                <span style={{ marginLeft: '8px', fontSize: '13px', color: '#64748b' }}>Table {order.tableId?.replace('t-', '') || 'Takeaway'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                                <Clock size={14} /> 12:05
                            </div>
                        </div>

                        {/* Items */}
                        <div style={{ padding: '16px', flex: 1 }}>
                            {order.items.map((item, idx) => (
                                <div key={idx} style={{ marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                        width: '24px', height: '24px', background: 'var(--bg-app)',
                                        borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: '13px'
                                    }}>
                                        {item.quantity}x
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{item.name}</div>
                                        {/* Modifiers would go here */}
                                        <div style={{ fontSize: '13px', color: 'var(--fg-secondary)', marginTop: '2px' }}>No Onions</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid var(--border-subtle)' }}>
                            <button
                                onClick={() => updateOrderStatus(order.id, 'ready')}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                                    background: 'var(--accent-primary)', color: 'white', border: 'none',
                                    fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <CheckCircle2 size={18} /> Mark Ready
                            </button>
                        </div>
                    </div>
                ))}

                {activeOrders.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--fg-muted)' }}>
                        <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', margin: '0 auto 16px' }} />
                        <h3>All Clean!</h3>
                        <p>No active orders in queue.</p>
                    </div>
                )}
            </div>
        </ModuleShell>
    );
};
