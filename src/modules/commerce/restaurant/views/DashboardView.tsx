import { useCallback, useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, Users, Clock, TrendingUp } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { restaurantApi, type RestaurantDashboard } from '@/api/restaurant.api';

const EMPTY_DASHBOARD: RestaurantDashboard = {
    total_revenue_today: 0,
    active_orders_count: 0,
    avg_prep_time_minutes: 0,
    live_diners_count: 0,
};

export const DashboardView = () => {
    const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
    const [error, setError] = useState('');

    const loadDashboard = useCallback(async () => {
        try {
            setDashboard(await restaurantApi.getDashboard());
            setError('');
        } catch {
            setError('Unable to load restaurant metrics.');
        }
    }, []);

    useEffect(() => {
        const initial = window.setTimeout(() => void loadDashboard(), 0);
        const interval = window.setInterval(() => void loadDashboard(), 30_000);
        return () => {
            window.clearTimeout(initial);
            window.clearInterval(interval);
        };
    }, [loadDashboard]);

    const stats = [
        { title: 'Total Revenue', value: `$${(dashboard.total_revenue_today / 100).toFixed(2)}`, icon: DollarSign },
        { title: 'Active Orders', value: dashboard.active_orders_count, icon: ShoppingBag, trend: 'Busy', trendDirection: 'neutral' as const },
        { title: 'Live Diners', value: dashboard.live_diners_count, icon: Users },
        { title: 'Avg Prep Time', value: `${dashboard.avg_prep_time_minutes}m`, icon: Clock },
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

            {error && <div style={{ marginBottom: 16, color: '#b91c1c' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
            </div>

            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Live Activity Feed</h3>
                <div style={{ color: 'var(--fg-secondary)', fontSize: '14px' }}>
                    No recent system alerts or critical notifications.
                </div>
            </div>
        </ModuleShell>
    );
};
