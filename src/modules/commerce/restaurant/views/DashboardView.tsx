import { useCallback, useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, Users, Clock, TrendingUp, ReceiptText, CircleDollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { restaurantApi, type RestaurantDailyReport, type RestaurantDashboard } from '@/api/restaurant.api';

const EMPTY_DASHBOARD: RestaurantDashboard = {
    total_revenue_today: 0,
    active_orders_count: 0,
    avg_prep_time_minutes: 0,
    live_diners_count: 0,
};

const todayInputValue = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const EMPTY_DAILY_SUMMARY: RestaurantDailyReport['summary'] = {
    totalOrders: 0,
    paidOrders: 0,
    unpaidOpenOrders: 0,
    paidRevenueCents: 0,
    dineInOrders: 0,
    takeawayOrders: 0,
};

export const DashboardView = () => {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
    const [dailySummary, setDailySummary] = useState(EMPTY_DAILY_SUMMARY);
    const [error, setError] = useState('');

    const loadDashboard = useCallback(async () => {
        try {
            const [nextDashboard, nextDailyReport] = await Promise.all([
                restaurantApi.getDashboard(),
                restaurantApi.getDailyReport(todayInputValue()),
            ]);
            setDashboard(nextDashboard);
            setDailySummary(nextDailyReport.summary);
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
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() => navigate('/app/restaurant/reports')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <TrendingUp size={18} /> View Reports
                    </button>
                }
            />

            {error && <div style={{ marginBottom: 16, color: '#b91c1c' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
            </div>

            <section className="restaurant-dashboard-summary" aria-label="Today's report summary">
                <div className="restaurant-dashboard-summary__heading">
                    <div>
                        <h2>Today's report</h2>
                        <p>Paid revenue and order status from persisted Restaurant records.</p>
                    </div>
                    <button type="button" onClick={() => navigate('/app/restaurant/reports')}>Open full report</button>
                </div>
                <div className="restaurant-dashboard-summary__grid">
                    <div><ReceiptText size={18} /><span>Total orders</span><strong>{dailySummary.totalOrders}</strong></div>
                    <div><CircleDollarSign size={18} /><span>Paid orders</span><strong>{dailySummary.paidOrders}</strong></div>
                    <div><ShoppingBag size={18} /><span>Unpaid/open</span><strong>{dailySummary.unpaidOpenOrders}</strong></div>
                    <div><DollarSign size={18} /><span>Paid revenue</span><strong>${(dailySummary.paidRevenueCents / 100).toFixed(2)}</strong></div>
                </div>
            </section>

            <div className="restaurant-dashboard-activity">
                <h3>Live Activity Feed</h3>
                <div>
                    No recent system alerts or critical notifications.
                </div>
            </div>

            <style>{`
                .restaurant-dashboard-summary,
                .restaurant-dashboard-activity {
                    margin-bottom: 24px;
                    padding: 24px;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    background: #ffffff;
                    color: #0f172a;
                }
                .restaurant-dashboard-summary__heading {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 18px;
                }
                .restaurant-dashboard-summary h2,
                .restaurant-dashboard-activity h3 { margin: 0 0 5px; color: #0f172a; font-size: 18px; }
                .restaurant-dashboard-summary p,
                .restaurant-dashboard-activity div { margin: 0; color: #64748b; font-size: 13px; line-height: 1.5; }
                .restaurant-dashboard-summary__heading button {
                    border: 0;
                    background: transparent;
                    color: #2563eb;
                    cursor: pointer;
                    font: inherit;
                    font-size: 13px;
                    font-weight: 700;
                }
                .restaurant-dashboard-summary__grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                }
                .restaurant-dashboard-summary__grid > div {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 5px 9px;
                    padding: 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    background: #f8fafc;
                }
                .restaurant-dashboard-summary__grid svg { grid-row: 1 / 3; color: #f97316; }
                .restaurant-dashboard-summary__grid span { color: #64748b; font-size: 11px; }
                .restaurant-dashboard-summary__grid strong { color: #0f172a; font-size: 20px; font-variant-numeric: tabular-nums; }
                @media (max-width: 840px) {
                    .restaurant-dashboard-summary__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 520px) {
                    .restaurant-dashboard-summary,
                    .restaurant-dashboard-activity { padding: 18px; }
                    .restaurant-dashboard-summary__heading { display: grid; }
                    .restaurant-dashboard-summary__heading button { padding: 0; text-align: left; }
                    .restaurant-dashboard-summary__grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </ModuleShell>
    );
};
