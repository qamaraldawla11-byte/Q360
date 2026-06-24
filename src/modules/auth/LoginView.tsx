import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useNavigate } from 'react-router-dom';
import { LogoApp } from '@/components/ui/Logo';

export const LoginView = () => {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [developmentMode, setDevelopmentMode] = useState(false);
    const requestOtp = useAuthStore((state) => state.requestOtp);
    const verifyOtp = useAuthStore((state) => state.verifyOtp);
    const navigate = useNavigate();

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
            const user = useAuthStore.getState().user;

            if (user?.onboardingCompleted) {
                navigate(user.primaryWorkspace || (user.segment ? `/app/${user.segment}` : '/app'));
            } else {
                navigate('/onboarding/identity');
            }
        } catch (error) {
            console.error(error);
            setErrorMessage(error instanceof Error ? error.message : 'Cannot connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f1f5f9', // Slate 100 for login background
            fontFamily: 'var(--font-sans)'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '48px',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)', // Soft SaaS shadow
                border: '1px solid #e2e8f0'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <LogoApp size={56} />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Welcome back</h1>
                    <p style={{ margin: '8px 0 0', color: '#64748b' }}>
                        {step === 'email' ? 'Sign in to your Q360 workspace' : `Enter the code sent to ${email}`}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {step === 'email' ? (
                        <div style={{ marginBottom: '20px' }}>
                            <label htmlFor="login-email" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Email Address</label>
                            <input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                                placeholder="you@company.com"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 'var(--radius-md)',
                                    color: '#0f172a',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                    ) : (
                        <div style={{ marginBottom: '20px' }}>
                            <label htmlFor="login-code" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>6-digit code</label>
                            <input
                                id="login-code"
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
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 'var(--radius-md)',
                                    color: '#0f172a',
                                    outline: 'none',
                                    textAlign: 'center',
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    letterSpacing: '8px'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                            {developmentMode && (
                                <p style={{
                                    margin: '10px 0 0',
                                    color: '#64748b',
                                    fontSize: '13px',
                                    textAlign: 'center'
                                }}>
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
                            background: '#fef2f2',
                            color: '#b91c1c',
                            fontSize: '14px'
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
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            transition: 'opacity 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)',
                            marginBottom: '16px'
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
                                color: '#64748b',
                                fontSize: '13px',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Use a different email
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};
