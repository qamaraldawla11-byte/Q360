import { useEffect, useState } from 'react';
import { adminApi, type DashboardStats } from '@/api/admin.api';

export const DashboardView = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminApi.getStats()
            .then(data => setStats(data))
            .catch(err => console.error('Failed to load stats:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: '20px' }}>Loading dashboard...</div>;

    return (
        <div>
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Platform Overview</h1>
                <p style={{ color: 'var(--fg-secondary)', marginTop: '8px' }}>Platform health, tenants, and recent operations</p>
            </header>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <StatCard title="Total Users" value={stats?.totalUsers ?? 0} color="#3b82f6" />
                <StatCard title="Total Businesses" value={stats?.totalBusinesses ?? 0} color="#8b5cf6" />
                <StatCard title="Active Businesses" value={stats?.activeBusinesses ?? 0} color="#10b981" />
                <StatCard
                    title="System Health"
                    value={stats?.systemHealth?.database === 'ok' ? '✓ Healthy' : '⚠ Issue'}
                    color={stats?.systemHealth?.database === 'ok' ? '#10b981' : '#ef4444'}
                    isText
                />
            </div>

            {/* Recent Actions */}
            <div style={{ background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Recent Admin Actions</h3>
                {stats?.recentActions && stats.recentActions.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                                <th style={{ padding: '8px' }}>Action</th>
                                <th style={{ padding: '8px' }}>Entity</th>
                                <th style={{ padding: '8px' }}>User ID</th>
                                <th style={{ padding: '8px' }}>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recentActions.slice(0, 10).map(action => (
                                <tr key={action.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '8px' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            background: getActionColor(action.action),
                                            color: '#fff'
                                        }}>
                                            {action.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px' }}>{action.entity}</td>
                                    <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{action.userId?.slice(0, 8)}...</td>
                                    <td style={{ padding: '8px', color: 'var(--fg-secondary)' }}>
                                        {new Date(action.timestamp).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: 'var(--fg-muted)' }}>No recent actions</p>
                )}
            </div>
        </div>
    );
};

function StatCard({ title, value, color, isText = false }: { title: string; value: number | string; color: string; isText?: boolean }) {
    return (
        <div style={{
            background: 'var(--bg-panel)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
        }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--fg-secondary)', fontWeight: 500 }}>{title}</h3>
            <div style={{ fontSize: isText ? '18px' : '32px', fontWeight: 600, color }}>{value}</div>
        </div>
    );
}

function getActionColor(action: string): string {
    const colors: Record<string, string> = {
        'CREATE': '#10b981',
        'UPDATE': '#3b82f6',
        'DELETE': '#ef4444',
        'ACTIVATE_USER': '#10b981',
        'DEACTIVATE_USER': '#f59e0b',
        'LOCK_USER': '#ef4444',
        'UNLOCK_USER': '#10b981',
        'SUSPEND_BUSINESS': '#ef4444',
        'ACTIVATE_BUSINESS': '#10b981',
        'UPDATE_SETTING': '#8b5cf6',
    };
    return colors[action] || '#6b7280';
}
