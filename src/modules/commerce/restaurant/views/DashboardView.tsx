import { useRestaurantStore } from '../store/restaurant.store';
import { DollarSign, ShoppingBag, Users, Clock, TrendingUp } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';

export const DashboardView = () => {
    const { orders, tables } = useRestaurantStore();

    const activeOrders = orders.filter(o => o.status !== 'paid' && o.status !== 'cancelled').length;
    const occupiedTables = tables.filter(t => t.status === 'occupied').length;
    const totalRevenue = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);

    // Mock Trends
    const stats = [
        { title: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, trend: '+12.5%', trendDirection: 'up' as const },
        { title: 'Active Orders', value: activeOrders, icon: ShoppingBag, trend: 'Busy', trendDirection: 'neutral' as const },
        { title: 'Live Diners', value: occupiedTables * 3, icon: Users, trend: '+4', trendDirection: 'up' as const },
        { title: 'Avg Prep Time', value: '14m', icon: Clock, trend: '-2m', trendDirection: 'up' as const },
    ];

    return (
        <ModuleShell>
            <PageHeader
                title="Restaurant Overview"
                subtitle="Real-time operational metrics and floor status."
                actions={
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} /> View Reports
                    </button>
                }
            />

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {stats.map((stat, i) => (
                    <StatCard key={i} {...stat} />
                ))}
            </div>

            {/* Recent Activity (Placeholder) */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Live Activity Feed</h3>
                <div style={{ color: 'var(--fg-secondary)', fontSize: '14px' }}>
                    No recent system alerts or critical notifications.
                </div>
            </div>
        </ModuleShell>
    );
};
