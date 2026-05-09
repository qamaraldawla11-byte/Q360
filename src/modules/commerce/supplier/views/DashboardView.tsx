import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    TrendingUp,
    ClipboardList,
    Users,
    ArrowUpRight,
    Truck
} from 'lucide-react';

export const SupplierDashboard = () => {
    return (
        <ModuleShell>
            <PageHeader
                title="Supplier Dashboard"
                subtitle="Overview of your distribution network and fulfillment"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
                {[
                    { label: 'New Orders', value: '12', icon: ClipboardList, color: '#6366f1', trend: '+15%' },
                    { label: 'Monthly Revenue', value: '$45,280', icon: TrendingUp, color: '#10b981', trend: '+8.2%' },
                    { label: 'Active Buyers', value: '84', icon: Users, color: '#3b82f6', trend: '+4' },
                    { label: 'Shipments Today', value: '18', icon: Truck, color: '#f59e0b', trend: 'On track' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '24px', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: `${stat.color}15`, color: stat.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <stat.icon size={20} />
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: stat.color === '#f59e0b' ? '#92400e' : '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {stat.trend} {stat.color !== '#f59e0b' && <ArrowUpRight size={14} />}
                            </div>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{stat.value}</div>
                        <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Recent Orders</h3>
                    <div style={{ color: 'var(--fg-secondary)', fontSize: '14px' }}>Orders list would go here...</div>
                </div>
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Top Buyers</h3>
                    {[
                        { name: 'City Supermarket', orders: 124, revenue: '$12.4k' },
                        { name: 'HealthFirst Pharmacy', orders: 89, revenue: '$8.2k' },
                        { name: 'Fresh Foods Market', orders: 67, revenue: '$5.1k' },
                    ].map((buyer, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{buyer.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>{buyer.orders} orders</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#10b981' }}>{buyer.revenue}</div>
                        </div>
                    ))}
                </div>
            </div>
        </ModuleShell>
    );
};
