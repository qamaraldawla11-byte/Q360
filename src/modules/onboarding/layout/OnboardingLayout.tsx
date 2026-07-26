import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Check } from 'lucide-react';
import { LogoApp } from '@/components/ui/Logo';
import { Button, Surface } from '@/components/design-system';
import './OnboardingLayout.css';

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
        <div className="onboarding-canvas">
            <Surface className="onboarding-surface">
                {/* Header */}
                <div className="onboarding-header">
                    <div className="onboarding-logo">
                        <LogoApp size={48} />
                    </div>

                    {/* Progress Steps */}
                    <div className="onboarding-step-indicator" role="list" aria-label="Onboarding progress">
                        {STEPS.map((step, i) => (
                            <div key={step.path} className="onboarding-step" role="listitem">
                                <div
                                    className={[
                                        'onboarding-step__dot',
                                        step.index < currentStep.index
                                            ? 'onboarding-step__dot--complete'
                                            : step.index === currentStep.index
                                                ? 'onboarding-step__dot--current'
                                                : 'onboarding-step__dot--pending',
                                    ].join(' ')}
                                    aria-current={step.index === currentStep.index ? 'step' : undefined}
                                >
                                    {step.index < currentStep.index ? <Check size={14} aria-hidden="true" /> : step.index}
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div
                                        className={[
                                            'onboarding-step__line',
                                            step.index < currentStep.index
                                                ? 'onboarding-step__line--complete'
                                                : 'onboarding-step__line--pending',
                                        ].join(' ')}
                                        aria-hidden="true"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <h1 className="onboarding-title">
                        {currentStep.label === 'Review' && 'Review your workspace plan'}
                        {currentStep.label === 'Profile' && 'Set Up Your Profile'}
                        {currentStep.label === 'Business Type' && 'What type of business do you run?'}
                        {currentStep.label === 'Workspace' && 'Configure Your Workspace'}
                    </h1>
                    <p className="onboarding-subtitle">
                        Step {currentStep.index} of {STEPS.length}
                    </p>
                </div>

                {/* Content */}
                <Outlet />

                {/* Footer Actions */}
                {!currentStep.path.includes('type') && (
                    <div className="onboarding-footer">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={logout}
                        >
                            Sign Out
                        </Button>
                    </div>
                )}
            </Surface>
        </div>
    );
};
