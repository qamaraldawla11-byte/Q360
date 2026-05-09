import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    backUrl?: string;
    actions?: ReactNode;
}

export const PageHeader = ({ title, subtitle, backUrl, actions }: PageHeaderProps) => {
    const navigate = useNavigate();

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {backUrl && (
                    <button
                        onClick={() => navigate(backUrl)}
                        style={{
                            background: 'var(--surface-100)', border: '1px solid var(--surface-400)',
                            width: '40px', height: '40px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--fg-secondary)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--surface-400)'}
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 4px', color: 'var(--fg-primary)' }}>{title}</h1>
                    {subtitle && <p style={{ margin: 0, color: 'var(--fg-secondary)', fontSize: '15px' }}>{subtitle}</p>}
                </div>
            </div>
            {actions && <div style={{ display: 'flex', gap: '12px' }}>{actions}</div>}
        </div>
    );
};
