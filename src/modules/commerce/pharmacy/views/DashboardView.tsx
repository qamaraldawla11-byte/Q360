import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Activity, AlertTriangle, Package, DollarSign, TrendingUp } from 'lucide-react';
import { usePharmacyStore } from '../store/pharmacy.store';

export const DashboardView = () => {
    const { inventory, prescriptions } = usePharmacyStore();

    // KPIS
    const lowStock = inventory.filter(i => i.stock <= i.minStock).length;
    const expiringSoon = inventory.filter(i => {
        return i.batches.some(b => {
            const days = Math.ceil((new Date(b.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            return days <= 90;
        });
    }).length;
    const activeScripts = prescriptions.filter(p => p.status === 'new' || p.status === 'processing').length;

    const stats = [
        { title: 'Active Prescriptions', value: activeScripts, icon: Activity, trend: '+5', trendDirection: 'up' as const },
        { title: 'Low Stock Alerts', value: lowStock, icon: AlertTriangle, trend: lowStock > 0 ? 'Action Needed' : 'Healthy', trendDirection: lowStock > 0 ? 'down' as const : 'neutral' as const, color: '#ef4444' },
        { title: 'Expiring Batches', value: expiringSoon, icon: Package, trend: 'Within 90 days', trendDirection: 'neutral' as const, color: '#f59e0b' },
        { title: 'Daily Revenue', value: '$1,240.50', icon: DollarSign, trend: '+8%', trendDirection: 'up' as const },
    ];

    return (
        <ModuleShell>
            <PageHeader
                title="Pharmacy Output"
                subtitle="Compliance, Dispensing, and Inventory Overview."
                actions={
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} /> Compliance Report
                    </button>
                }
            />

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {stats.map((stat, i) => (
                    <StatCard key={i} {...stat} />
                ))}
            </div>

            {/* Recent Alerts Panel */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Regulatory & Safety Alerts</h3>

                {lowStock === 0 && expiringSoon === 0 ? (
                    <div style={{ color: 'var(--fg-secondary)', fontSize: '14px' }}>System is operating within compliance standards.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {lowStock > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fef2f2', borderRadius: '8px', color: '#991b1b', fontSize: '14px', fontWeight: 600 }}>
                                <AlertTriangle size={16} />
                                {lowStock} items are below minimum stock levels.
                            </div>
                        )}
                        {expiringSoon > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fffbeb', borderRadius: '8px', color: '#92400e', fontSize: '14px', fontWeight: 600 }}>
                                <Package size={16} />
                                {expiringSoon} batches are expiring within 90 days.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </ModuleShell>
    );
};
