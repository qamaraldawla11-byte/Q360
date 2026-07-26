import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useLocation, useNavigate } from 'react-router-dom';
import type { GuestSetup } from '@/modules/public/GuestQConcierge';
import { claimGuestBrief } from '@/api/qGuestBrief.api';
import { LogoApp } from '@/components/ui/Logo';
import { Button, Field, Input, Surface } from '@/components/design-system';
import './LoginView.css';

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
    const location = useLocation();
    const [guestSetup, setGuestSetup] = useState<GuestSetup | null>(null);

    useEffect(() => {
        const fromNavigation = (location.state as { guestSetup?: GuestSetup } | null)?.guestSetup;
        let saved: GuestSetup | null = null;
        try {
            saved = JSON.parse(sessionStorage.getItem('q360_guest_setup') || 'null') as GuestSetup | null;
        } catch {
            sessionStorage.removeItem('q360_guest_setup');
        }
        const setup = fromNavigation || saved;
        if (setup) {
            setGuestSetup(setup);
            if (setup.email) setEmail(setup.email);
            sessionStorage.setItem('q360_guest_setup', JSON.stringify(setup));
        }
    }, [location.state]);

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

            const briefToken = sessionStorage.getItem('q360_guest_brief_token');
            let briefClaimed = false;
            if (briefToken) {
                try {
                    await claimGuestBrief(briefToken);
                    briefClaimed = true;
                } catch {
                    // Claiming the guest brief is best-effort and must never block sign-in.
                }
                sessionStorage.removeItem('q360_guest_brief_token');
            }

            const user = useAuthStore.getState().user;

            if (briefClaimed && !user?.onboardingCompleted) {
                navigate('/onboarding/brief');
            } else if (user?.onboardingCompleted) {
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

    const errorId = 'login-error';

    return (
        <div className="login-view">
            <Surface className="login-view__card">
                <div className="login-view__header">
                    <div className="login-view__logo">
                        <LogoApp size={56} />
                    </div>
                    <h1 className="login-view__title">Welcome back</h1>
                    <p className="login-view__subtitle">
                        {step === 'email' ? 'Sign in to your Q360 workspace' : `Enter the code sent to ${email}`}
                    </p>
                </div>

                {guestSetup && step === 'email' && (
                    <div className="login-view__notice">
                        <strong>Your Q setup brief is saved.</strong><br />Sign in securely to create the workspace and review the final quotation.
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {step === 'email' ? (
                        <div className="login-view__field-group">
                            <Field label="Email Address">
                                <Input
                                    id="login-email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    placeholder="you@company.com"
                                    isInvalid={!!errorMessage}
                                    aria-describedby={errorMessage ? errorId : undefined}
                                />
                            </Field>
                        </div>
                    ) : (
                        <div className="login-view__field-group">
                            <Field label="6-digit code">
                                <Input
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
                                    className="q-input--otp"
                                    isInvalid={!!errorMessage}
                                    aria-describedby={errorMessage ? errorId : undefined}
                                />
                            </Field>
                            {developmentMode && (
                                <p className="login-view__dev-hint">
                                    Development mode: check server console for code
                                </p>
                            )}
                        </div>
                    )}

                    {errorMessage && (
                        <div id={errorId} className="login-view__error" role="alert">
                            {errorMessage}
                        </div>
                    )}

                    <div className="login-view__actions">
                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            isLoading={isLoading}
                            disabled={isLoading}
                        >
                            {step === 'email' ? 'Continue with email' : 'Verify and sign in'}
                        </Button>

                        {step === 'code' && (
                            <Button
                                type="button"
                                variant="secondary"
                                fullWidth
                                onClick={() => {
                                    setStep('email');
                                    setCode('');
                                    setErrorMessage('');
                                    setDevelopmentMode(false);
                                }}
                            >
                                Use a different email
                            </Button>
                        )}
                    </div>
                </form>
            </Surface>
        </div>
    );
};
