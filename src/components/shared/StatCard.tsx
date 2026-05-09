import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
    icon?: React.ElementType;
    color?: string;
}

export const StatCard = ({ title, value, trend, trendDirection = 'neutral', icon: Icon, color = 'var(--accent-primary)' }: StatCardProps) => {
    return (
        <div style={{
            background: 'var(--surface-100)', borderRadius: 'var(--radius-lg)',
            padding: '24px', border: '1px solid var(--surface-400)',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--fg-secondary)', fontSize: '14px', fontWeight: 600 }}>{title}</span>
                {Icon && <div style={{ color: color, opacity: 0.8 }}><Icon size={20} /></div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1 }}>{value}</span>

                {trend && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600,
                        color: trendDirection === 'up' ? 'var(--success)' : trendDirection === 'down' ? 'var(--error)' : 'var(--fg-secondary)',
                        background: trendDirection === 'up' ? 'var(--success-glow)' : trendDirection === 'down' ? 'var(--error-glow)' : 'var(--surface-300)',
                        padding: '2px 8px', borderRadius: '12px', marginBottom: '4px'
                    }}>
                        {trendDirection === 'up' && <ArrowUp size={12} />}
                        {trendDirection === 'down' && <ArrowDown size={12} />}
                        {trend}
                    </div>
                )}
            </div>
        </div>
    );
};
