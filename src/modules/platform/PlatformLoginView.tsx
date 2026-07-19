// Platform Operations sign-in — the ONLY login surface on the Platform origin.
// Shares the OTP/JWT auth foundation with the tenant app (ADR §3), but has its
// own identity, environment badge, and post-login destination rules (ADR §5):
// admins land on Platform Overview; non-admins land on No Platform Access.
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { environmentLabel } from '@/utils/host';

export const PlatformLoginView = () => {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [developmentMode, setDevelopmentMode] = useState(false);
    const requestOtp = useAuthStore((state) => state.requestOtp);
    const verifyOtp = useAuthStore((state) => state.verifyOtp);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as { from?: string } | null)?.from;
    const destination = from && from !== '/login' ? from : '/';

    // Already signed in on this origin: go straight to the right surface.
    if (isAuthenticated) {
        return <Navigate to={user?.role === 'admin' ? destination : '/no-access'} replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');
        try {
            if (step === 'email') {
                const response = await requestOtp(email);
                setDevelopmentMode(response.developmentMode);
                setStep('code');
                return;
            }

            await verifyOtp(email, code);
            const signedInUser = useAuthStore.getState().user;
            // Never redirect into a tenant workspace from the Platform origin.
            navigate(signedInUser?.role === 'admin' ? destination : '/no-access', { replace: true });
        } catch (error) {
            console.error(error);
            setErrorMessage(error instanceof Error ? error.message : 'Cannot connect to server');
        } finally {
            setIsLoading(false);
        }
    };

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
                maxWidth: '400px',
                padding: '48px',
                background: '#111827',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <ShieldAlert size={48} color="#ef4444" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#f9fafb' }}>
                        Q360 Platform Operations
                    </h1>
                    <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: '14px' }}>
                        {step === 'email'
                            ? 'Sign in with your operator account'
                            : `Enter the code sent to ${email}`}
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
                </div>

                <form onSubmit={handleSubmit}>
                    {step === 'email' ? (
                        <div style={{ marginBottom: '20px' }}>
                            <label htmlFor="platform-login-email" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#d1d5db' }}>
                                Work email
                            </label>
                            <input
                                id="platform-login-email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                                placeholder="you@q360.app"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#0f1115',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    color: '#f9fafb',
                                    outline: 'none',
                                }}
                            />
                        </div>
                    ) : (
                        <div style={{ marginBottom: '20px' }}>
                            <label htmlFor="platform-login-code" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#d1d5db' }}>
                                6-digit code
                            </label>
                            <input
                                id="platform-login-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                autoFocus
                                placeholder="000000"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#0f1115',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    color: '#f9fafb',
                                    outline: 'none',
                                    textAlign: 'center',
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    letterSpacing: '8px',
                                }}
                            />
                            {developmentMode && (
                                <p style={{ margin: '10px 0 0', color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
                                    Development mode: check server console for code
                                </p>
                            )}
                        </div>
                    )}

                    {errorMessage && (
                        <div role="alert" style={{
                            marginBottom: '16px',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#fca5a5',
                            fontSize: '14px',
                        }}>
                            {errorMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            transition: 'opacity 0.2s',
                            marginBottom: '16px',
                        }}
                    >
                        {isLoading
                            ? (step === 'email' ? 'Sending code...' : 'Verifying...')
                            : (step === 'email' ? 'Continue with email' : 'Verify and sign in')}
                    </button>

                    {step === 'code' && (
                        <button
                            type="button"
                            onClick={() => {
                                setStep('email');
                                setCode('');
                                setErrorMessage('');
                                setDevelopmentMode(false);
                            }}
                            style={{
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                color: '#9ca3af',
                                fontSize: '13px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                            }}
                        >
                            Use a different email
                        </button>
                    )}
                </form>

                <p style={{ margin: '24px 0 0', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                    Restricted to Q360 platform operators. All actions are audited.
                </p>
            </div>
        </div>
    );
};
