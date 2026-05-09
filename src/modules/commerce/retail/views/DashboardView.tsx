import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ShoppingBag, Package, Users, TrendingUp } from 'lucide-react';

export const DashboardView = () => {
    return (
        <ModuleShell>
            <PageHeader
                title="Retail Dashboard"
                subtitle="Monitor your store performance"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <StatCard
                    title="Today's Sales"
                    value="$4,320"
                    trend="12%"
                    trendDirection="up"
                    icon={ShoppingBag}
                />
                <StatCard
                    title="Products Sold"
                    value="247"
                    trend="8%"
                    trendDirection="up"
                    icon={Package}
                />
                <StatCard
                    title="Active Customers"
                    value="89"
                    icon={Users}
                />
                <StatCard
                    title="Avg. Transaction"
                    value="$17.50"
                    trend="5%"
                    trendDirection="up"
                    icon={TrendingUp}
                />
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Quick Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {['New Sale', 'Add Product', 'View Inventory'].map((action, i) => (
                        <button key={i} style={{
                            padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)',
                            background: 'white', cursor: 'pointer', fontWeight: 600,
                            transition: 'all 0.2s'
                        }}>
                            {action}
                        </button>
                    ))}
                </div>
            </div>
        </ModuleShell>
    );
};
