import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Package, AlertTriangle, TrendingDown } from 'lucide-react';

export const InventoryView = () => {
    const lowStockItems = [
        { name: 'Tomatoes', current: 12, min: 50, unit: 'kg', status: 'critical' },
        { name: 'Chicken Breast', current: 25, min: 40, unit: 'kg', status: 'low' },
        { name: 'Pasta', current: 8, min: 20, unit: 'kg', status: 'critical' },
        { name: 'Olive Oil', current: 15, min: 25, unit: 'L', status: 'low' },
    ];

    return (
        <ModuleShell>
            <PageHeader
                title="Inventory preview"
                subtitle="Preview-only sample data. Restaurant inventory persistence is not production-ready yet."
            />

            <div style={{ marginBottom: 20, padding: 16, border: '1px solid #fed7aa', borderRadius: 8, background: '#fff7ed', color: '#9a3412', fontWeight: 700 }}>
                Coming soon: these numbers are static examples and are not connected to saved Restaurant stock.
            </div>

            <div className="restaurant-inventory-preview-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                    { label: 'Total Items', value: '247', icon: Package, color: '#3b82f6' },
                    { label: 'Low Stock', value: '12', icon: AlertTriangle, color: '#f59e0b' },
                    { label: 'Out of Stock', value: '4', icon: TrendingDown, color: '#ef4444' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '24px', borderRadius: '8px',
                        border: '1px solid var(--border-subtle)', color: '#0f172a'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: `${stat.color}15`, color: stat.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <stat.icon size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '28px', fontWeight: 700 }}>{stat.value}</div>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>{stat.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: 'white', color: '#0f172a', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: 700 }}>Low Stock Alerts</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Item</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Current</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Minimum</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lowStockItems.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '16px 20px', fontWeight: 500 }}>{item.name}</td>
                                <td style={{ padding: '16px 20px' }}>{item.current} {item.unit}</td>
                                <td style={{ padding: '16px 20px', color: '#64748b' }}>{item.min} {item.unit}</td>
                                <td style={{ padding: '16px 20px' }}>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                        background: item.status === 'critical' ? '#fee2e2' : '#fef3c7',
                                        color: item.status === 'critical' ? '#991b1b' : '#92400e'
                                    }}>
                                        {item.status === 'critical' ? 'Critical' : 'Low'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <style>{`
                @media (max-width: 760px) {
                    .restaurant-inventory-preview-stats {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </ModuleShell>
    );
};
