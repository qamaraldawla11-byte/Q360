import { useState, useEffect } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Download } from 'lucide-react';
import { statsService } from '@/core/services/stats.service';
import type { Report } from '@/core/mocks/reports.mock';

const ICONS = {
    DollarSign,
    TrendingUp,
    ShoppingCart,
    BarChart3
};

export const ReportsView = () => {
    const [reports, setReports] = useState<Report[]>([]);

    useEffect(() => {
        statsService.getReports().then(setReports);
    }, []);

    return (
        <ModuleShell>
            <PageHeader
                title="Reports & Analytics"
                subtitle="Business insights and performance metrics"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                {reports.map((report, i) => {
                    const Icon = ICONS[report.iconName];
                    return (
                        <div key={i} style={{
                            background: 'white',
                            borderRadius: '16px',
                            border: '1px solid var(--border-subtle)',
                            padding: '32px',
                            transition: 'all 0.2s'
                        }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '14px',
                                    background: `${report.color}15`,
                                    color: report.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Icon size={28} />
                                </div>
                                <button style={{
                                    padding: '8px 12px',
                                    background: `${report.color}15`,
                                    color: report.color,
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Download size={14} />
                                    Export
                                </button>
                            </div>

                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{report.title}</h3>
                            <p style={{ color: 'var(--fg-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                                {report.description}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                {report.stats.map((stat, j) => (
                                    <div key={j} style={{
                                        padding: '16px',
                                        background: '#f8fafc',
                                        borderRadius: '12px'
                                    }}>
                                        <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', marginBottom: '6px' }}>
                                            {stat.label}
                                        </div>
                                        <div style={{ fontSize: '18px', fontWeight: 700, color: report.color }}>
                                            {stat.value}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button style={{
                                width: '100%',
                                marginTop: '24px',
                                padding: '14px',
                                background: report.color,
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}>
                                View Full Report
                            </button>
                        </div>
                    );
                })}
            </div>
        </ModuleShell>
    );
};
