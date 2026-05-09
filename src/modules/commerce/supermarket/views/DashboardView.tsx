import { useState, useEffect } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ShoppingCart, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { statsService } from '@/core/services/stats.service';
import type { DashboardStats } from '@/core/mocks/stats.mock';

export const DashboardView = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        statsService.getDashboardStats().then(setStats);
    }, []);

    if (!stats) return <ModuleShell><PageHeader title="Supermarket Dashboard" /><div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div></ModuleShell>;

    return (
        <ModuleShell>
            <PageHeader
                title="Supermarket Dashboard"
                subtitle="Real-time store operations overview"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <StatCard
                    title="Today's Revenue"
                    value={`$${stats.revenue.toLocaleString()}`}
                    trendDirection="up"
                    trend={`${stats.revenueTrend}%`}
                    icon={ShoppingCart}
                />
                <StatCard
                    title="Items Sold"
                    value={stats.itemsSold.toLocaleString()}
                    trendDirection="up"
                    trend={`${stats.itemsSoldTrend}%`}
                    icon={Package}
                />
                <StatCard
                    title="Avg. Basket Size"
                    value={`$${stats.avgBasket.toFixed(2)}`}
                    trendDirection="up"
                    trend={`${stats.avgBasketTrend}%`}
                    icon={TrendingUp}
                />
                <StatCard
                    title="Low Stock Items"
                    value="23"
                    icon={AlertTriangle}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Top Selling Products</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {stats.topSelling.map((item, i) => (
                            <div key={i} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 600 }}>{item.name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>Sold: {item.sold} units</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Expiring Soon</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {stats.expiring.map((item, i) => (
                            <div key={i} style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 600 }}>{item.name}</div>
                                <div style={{ fontSize: '13px', color: '#92400e' }}>Expires in {item.days} days</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ModuleShell>
    );
};
