import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { ArrowRight, Check } from 'lucide-react';
import { LogoApp } from '@/components/ui/Logo';

// Onboarding Steps Definition
const STEPS = [
    { path: '/onboarding/identity', label: 'Profile', index: 1 },
    { path: '/onboarding/segment', label: 'Category', index: 2 },
    { path: '/onboarding/type', label: 'Business Type', index: 3 },
    { path: '/onboarding/workspace', label: 'Workspace', index: 4 },
];

export const OnboardingLayout = () => {
    const { logout, updateUser, user } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Current Step
    const currentStep = STEPS.find(s => location.pathname.startsWith(s.path)) || STEPS[0];

    // Skip Logic (Use Defaults)
    const handleUseDefaults = () => {
        if (currentStep.path.includes('identity')) {
            // Fill profile with email-derived name
            const name = user?.email?.split('@')[0] || 'User';
            updateUser({ name });
            navigate('/onboarding/segment');
        } else if (currentStep.path.includes('segment')) {
            // Category is MANDATORY - no skip
            return;
        } else if (currentStep.path.includes('type')) {
            const segment = user?.userType === 'personal' ? 'personal_freelancer' : 'restaurant';
            updateUser({ segment, lastActiveWorkspace: `/app/${segment}` });
            navigate('/onboarding/workspace');
        }
    };

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
                        {currentStep.label === 'Profile' && 'Set Up Your Profile'}
                        {currentStep.label === 'Category' && 'What kind of system do you need?'}
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
                    justifyContent: 'space-between',
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

                    {/* Use Defaults (Skip equivalent) - Not shown for Segment */}
                    {!currentStep.path.includes('segment') && !currentStep.path.includes('workspace') && (
                        <button
                            onClick={handleUseDefaults}
                            style={{
                                background: 'none', border: 'none',
                                color: 'var(--fg-secondary)', fontSize: '13px',
                                cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: '4px',
                                fontWeight: 500
                            }}
                        >
                            Use Defaults <ArrowRight size={14} />
                        </button>
                    )}
                </div>}
            </div>
        </div>
    );
};
