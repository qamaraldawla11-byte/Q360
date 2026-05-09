import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-app)',
                    color: 'var(--fg-primary)'
                }}>
                    <div style={{
                        maxWidth: '500px',
                        padding: '40px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-lg)',
                        textAlign: 'center',
                        backdropFilter: 'blur(var(--blur-glass))'
                    }}>
                        <AlertOctagon size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
                        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>System Error</h1>
                        <p style={{ color: 'var(--fg-secondary)', marginBottom: '24px' }}>
                            The application encountered a critical error.
                        </p>
                        <div style={{
                            padding: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            color: '#fca5a5',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            marginBottom: '24px',
                            textAlign: 'left',
                            overflow: 'auto',
                            maxHeight: '100px'
                        }}>
                            {this.state.error?.message}
                        </div>
                        <button
                            onClick={this.handleReload}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '10px 20px',
                                background: 'var(--accent-primary)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            <RefreshCw size={16} style={{ marginRight: '8px' }} />
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
