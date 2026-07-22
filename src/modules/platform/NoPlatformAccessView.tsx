// Explicit role-denial surface for the Platform origin (ADR §5.3).
// Non-admin authenticated users land here — the tenant workspace is never
// rendered on admin.q360.app, and there is no automatic cross-context redirect.
import { ShieldAlert, LogOut, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { TENANT_APP_URL, environmentLabel } from '@/utils/host';

export const NoPlatformAccessView = () => {
    const logout = useAuthStore((state) => state.logout);
    const user = useAuthStore((state) => state.user);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f1115',
            fontFamily: 'var(--font-sans)',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '440px',
                padding: '48px',
                background: '#111827',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <ShieldAlert size={48} color="#f59e0b" />
                </div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#f9fafb' }}>
                    No Platform Access
                </h1>
                <p style={{ margin: '12px 0 0', color: '#9ca3af', fontSize: '14px', lineHeight: 1.6 }}>
                    {user?.email ? <strong style={{ color: '#d1d5db' }}>{user.email}</strong> : 'This account'}
                    {' '}is signed in, but it does not have Platform Operations permissions.
                    This console is restricted to Q360 platform operators.
                </p>
                <span style={{
                    display: 'inline-block',
                    marginTop: '16px',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#ef4444',
                }}>
                    {environmentLabel()}
                </span>

                <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <a
                        href={TENANT_APP_URL}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '14px',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '14px',
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        <ExternalLink size={16} />
                        Go to the Q360 workspace
                    </a>
                    <button
                        type="button"
                        onClick={logout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '12px',
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            color: '#9ca3af',
                            fontSize: '14px',
                            cursor: 'pointer',
                        }}
                    >
                        <LogOut size={16} />
                        Sign out of this origin
                    </button>
                </div>
            </div>
        </div>
    );
};
