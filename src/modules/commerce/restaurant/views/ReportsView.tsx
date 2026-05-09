import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { BarChart3, TrendingUp, DollarSign, Users } from 'lucide-react';

export const ReportsView = () => {
    return (
        <ModuleShell>
            <PageHeader
                title="Reports & Analytics"
                subtitle="Performance insights and business metrics"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                {[
                    { title: 'Sales Report', desc: 'Daily, weekly, and monthly revenue', icon: DollarSign, color: '#10b981' },
                    { title: 'Performance Metrics', desc: 'Table turnover and service times', icon: TrendingUp, color: '#3b82f6' },
                    { title: 'Menu Analytics', desc: 'Best sellers and item performance', icon: BarChart3, color: '#f59e0b' },
                    { title: 'Staff Reports', desc: 'Hours worked and productivity', icon: Users, color: '#8b5cf6' },
                ].map((report, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '32px', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)', cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = report.color}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                    >
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: `${report.color}15`, color: report.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <report.icon size={24} />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{report.title}</h3>
                        <p style={{ color: 'var(--fg-secondary)', fontSize: '14px' }}>{report.desc}</p>
                    </div>
                ))}
            </div>
        </ModuleShell>
    );
};
