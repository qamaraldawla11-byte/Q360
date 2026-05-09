import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export const NotFoundView = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-app)',
            color: 'var(--fg-primary)',
            flexDirection: 'column'
        }}>
            <div style={{
                padding: '40px',
                background: 'var(--bg-panel)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
                backdropFilter: 'blur(var(--blur-glass))'
            }}>
                <AlertTriangle size={48} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px' }}>Page Not Found</h1>
                <p style={{ color: 'var(--fg-secondary)', marginBottom: '24px' }}>
                    The requested module or resource could not be located.
                </p>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '10px 20px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--fg-primary)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                    }}
                >
                    <ArrowLeft size={16} style={{ marginRight: '8px' }} />
                    Return Back
                </button>
            </div>
        </div>
    );
};
