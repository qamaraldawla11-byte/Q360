import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Check } from 'lucide-react';
import { LogoApp } from '@/components/ui/Logo';

// Onboarding Steps Definition
const STEPS = [
    { path: '/onboarding/brief', label: 'Review', index: 1 },
    { path: '/onboarding/identity', label: 'Profile', index: 2 },
    { path: '/onboarding/type', label: 'Business Type', index: 3 },
    { path: '/onboarding/workspace', label: 'Workspace', index: 4 },
];

export const OnboardingLayout = () => {
    const { logout } = useAuthStore();
    const location = useLocation();

    // Current Step
    const currentStep = STEPS.find(s => location.pathname.startsWith(s.path)) || STEPS[0];

    return (
        <div className="onboarding-canvas" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
        }}>
            <div className="onboarding-surface" style={{
                width: '100%',
                maxWidth: '520px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                padding: '48px 40px',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ margin: '0 auto 20px' }}>
                        <LogoApp size={48} />
                    </div>

                    {/* Progress Steps */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                        {STEPS.map((step, i) => (
                            <div key={step.path} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: step.index < currentStep.index ? '#10b981'
                                        : step.index === currentStep.index ? 'var(--accent-primary)'
                                            : '#e2e8f0',
                                    color: step.index <= currentStep.index ? 'white' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 700
                                }}>
                                    {step.index < currentStep.index ? <Check size={14} /> : step.index}
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div style={{
                                        width: '40px', height: '2px',
                                        background: step.index < currentStep.index ? '#10b981' : '#e2e8f0'
                                    }} />
                                )}
                            </div>
                        ))}
                    </div>

                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
                        {currentStep.label === 'Review' && 'Review your workspace plan'}
                        {currentStep.label === 'Profile' && 'Set Up Your Profile'}
                        {currentStep.label === 'Business Type' && 'What type of business do you run?'}
                        {currentStep.label === 'Workspace' && 'Configure Your Workspace'}
                    </h1>
                    <p style={{ color: 'var(--fg-secondary)', fontSize: '15px', margin: 0 }}>
                        Step {currentStep.index} of {STEPS.length}
                    </p>
                </div>

                {/* Content */}
                <Outlet />

                {/* Footer Actions */}
                {!currentStep.path.includes('type') && <div style={{
                    marginTop: '32px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={logout}
                        style={{
                            background: 'none', border: 'none',
                            color: 'var(--fg-muted)', fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        Sign Out
                    </button>
                </div>}
            </div>
        </div>
    );
};
