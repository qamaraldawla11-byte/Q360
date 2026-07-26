import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    confirmGuestBrief,
    dismissGuestBrief,
    getCurrentGuestBrief,
    type QGuestBriefView,
} from '@/api/qGuestBrief.api';
import { userApi } from '@/api/user.api';
import { useAuthStore } from '@/store/auth.store';
import { Button, Field, Input } from '@/components/design-system';

type Corrections = {
    businessName?: string;
    country?: string;
    currency?: string;
};

const answerOf = (brief: QGuestBriefView, question: string) =>
    brief.payload.answers.find((item) => item.question === question)?.answer || '';

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 'var(--q-space-2)',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--q-color-text-secondary)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--q-space-3) var(--q-space-3)',
    borderRadius: 'var(--q-radius-md)',
    border: '1px solid var(--q-color-border)',
    background: 'var(--q-color-surface-muted)',
    color: 'var(--q-color-text)',
    fontFamily: 'inherit',
    fontSize: '1rem',
    lineHeight: '1.5rem',
    outline: 'none',
    transition: 'border-color var(--q-duration-fast) var(--q-ease-standard), box-shadow var(--q-duration-fast) var(--q-ease-standard)',
};

export const GuestBriefReviewView = () => {
    const navigate = useNavigate();
    const updateUser = useAuthStore((state) => state.updateUser);
    const [brief, setBrief] = useState<QGuestBriefView | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [country, setCountry] = useState('');
    const [currency, setCurrency] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const { brief: current } = await getCurrentGuestBrief();
                if (cancelled) return;
                if (!current || (current.state !== 'claimed' && current.state !== 'confirmed')) {
                    navigate('/onboarding/identity', { replace: true });
                    return;
                }
                setBrief(current);
                setBusinessName(current.payload.prefill.businessName || '');
                setCountry(current.payload.prefill.country || '');
                setCurrency(current.payload.prefill.currency || '');
            } catch {
                if (!cancelled) setLoadError('Q could not load your workspace plan. You can continue with manual setup instead.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    if (isLoading) {
        return <div style={{ color: 'var(--q-color-text-secondary)', fontSize: '0.9375rem', textAlign: 'center' }}>Q is loading your workspace plan…</div>;
    }

    if (loadError || !brief) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--q-space-4)' }}>
                <div role="alert" style={{
                    padding: 'var(--q-space-3)',
                    borderRadius: 'var(--q-radius-md)',
                    background: 'var(--q-color-danger-soft)',
                    color: 'var(--q-color-danger)',
                    fontSize: '0.875rem',
                }}>
                    {loadError || 'This plan is no longer available.'}
                </div>
                <Button variant="primary" fullWidth onClick={() => navigate('/onboarding/identity')}>
                    Continue with manual setup
                </Button>
            </div>
        );
    }

    const prefill = brief.payload.prefill;
    const recommendation = brief.payload.recommendation;
    const businessType = recommendation.businessType || recommendation.intent || 'restaurant';
    const businessTypeLabel = businessType.charAt(0).toUpperCase() + businessType.slice(1);
    const tableCount = Number(answerOf(brief, 'table_count')) || 0;
    const serviceModes = answerOf(brief, 'service_modes');

    const buildCorrections = (): Corrections => {
        const corrections: Corrections = {};
        if (businessName.trim() !== (prefill.businessName || '')) corrections.businessName = businessName.trim();
        if (country.trim() !== (prefill.country || '')) corrections.country = country.trim();
        if (currency.trim().toUpperCase() !== (prefill.currency || '')) corrections.currency = currency.trim().toUpperCase();
        return corrections;
    };

    const isValid =
        businessName.trim().length > 0
        && businessName.trim().length <= 120
        && country.trim().length > 0
        && country.trim().length <= 100
        && /^[A-Za-z]{3}$/.test(currency.trim());

    const handleConfirm = async () => {
        if (!isValid || isSubmitting) return;
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            const acceptedFields = (['businessName', 'country', 'currency'] as const).filter((key) => prefill[key]);
            const corrections = buildCorrections();
            const result = await confirmGuestBrief({
                acceptedFields,
                corrections: Object.keys(corrections).length ? corrections : undefined,
            });
            const profile = await userApi.getProfile();
            updateUser(profile);
            sessionStorage.removeItem('q360_guest_setup');
            sessionStorage.removeItem('q360_guest_brief_token');
            navigate(result.destination, { replace: true });
        } catch (error) {
            if (
                axios.isAxiosError<{ error?: string }>(error)
                && error.response?.status === 409
                && error.response.data?.error === 'workspace_exists'
            ) {
                setNotice('You already have a workspace — taking you there.');
                window.setTimeout(() => {
                    navigate(useAuthStore.getState().user?.primaryWorkspace || '/app');
                }, 1500);
                return;
            }
            setErrorMessage('Q could not confirm your plan. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditFullDetails = async () => {
        try {
            await dismissGuestBrief();
        } catch {
            // Dismissing is best-effort; the manual setup path stays available either way.
        }
        navigate('/onboarding/identity');
    };

    const handleDismiss = async () => {
        try {
            await dismissGuestBrief();
        } catch {
            // Dismissing is best-effort; the owner can always walk away from the plan.
        }
        sessionStorage.removeItem('q360_guest_setup');
        navigate('/onboarding/identity');
    };

    const facts: Array<{ label: string; value: string }> = [
        { label: 'Business', value: prefill.businessName || '—' },
        { label: 'Business type', value: businessTypeLabel },
        { label: 'Country', value: prefill.country || '—' },
        { label: 'Currency', value: prefill.currency || '—' },
    ];
    if (tableCount > 0) facts.push({ label: 'Tables', value: String(tableCount) });
    if (serviceModes) facts.push({ label: 'Service modes', value: serviceModes });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--q-space-5)' }}>
            <div style={{
                margin: 0,
                padding: 'var(--q-space-3) var(--q-space-4)',
                borderRadius: 'var(--q-radius-md)',
                background: 'var(--q-color-info-soft)',
                border: '1px solid var(--q-color-border)',
                color: 'var(--q-color-info)',
                fontSize: '0.875rem',
                fontWeight: 600,
                lineHeight: 1.45,
            }}>
                Prepared by Q. Nothing happens without you.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--q-space-2)' }}>
                {facts.map((fact) => (
                    <div key={fact.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--q-space-3)', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--q-color-text-muted)' }}>{fact.label}</span>
                        <span style={{ fontWeight: 600, color: 'var(--q-color-text)', textAlign: 'right' }}>{fact.value}</span>
                    </div>
                ))}
                {recommendation.recommendedModules.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: 'var(--q-space-1)' }}>
                        {recommendation.recommendedModules.map((module) => (
                            <span key={module} style={{
                                padding: '7px 9px',
                                borderRadius: 'var(--q-radius-pill)',
                                background: 'var(--q-color-accent-soft)',
                                color: 'var(--q-color-accent)',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                            }}>
                                {module}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--q-space-3)' }}>
                <div style={{
                    padding: 'var(--q-space-3) var(--q-space-4)',
                    borderRadius: 'var(--q-radius-md)',
                    background: 'var(--q-color-accent-soft)',
                    border: '1px solid var(--q-color-border)',
                }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--q-color-accent)', fontWeight: 700, marginBottom: '6px' }}>What Q will create</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8125rem', color: 'var(--q-color-text-secondary)', lineHeight: 1.6 }}>
                        <li>{businessTypeLabel} workspace for {businessName.trim() || prefill.businessName || 'your business'}</li>
                        {tableCount > 0 && <li>{tableCount} tables (Table 1–Table {tableCount})</li>}
                        <li>{businessTypeLabel} modules</li>
                        <li>Your Q onboarding context</li>
                    </ul>
                </div>
                <div style={{
                    padding: 'var(--q-space-3) var(--q-space-4)',
                    borderRadius: 'var(--q-radius-md)',
                    background: 'var(--q-color-surface-muted)',
                    border: '1px solid var(--q-color-border)',
                }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--q-color-text)', fontWeight: 700, marginBottom: '6px' }}>What Q will not do</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8125rem', color: 'var(--q-color-text-secondary)', lineHeight: 1.6 }}>
                        <li>Create menu items, orders, customers, staff or payments</li>
                        <li>Change anything else without you</li>
                    </ul>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--q-space-3)' }}>
                <div>
                    <label htmlFor="brief-business-name" style={labelStyle}>Business name</label>
                    <input
                        id="brief-business-name"
                        type="text"
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        maxLength={120}
                        required
                        style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--q-color-text)'; e.currentTarget.style.boxShadow = 'var(--q-focus-ring)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--q-color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 'var(--q-space-3)' }}>
                    <div>
                        <label htmlFor="brief-country" style={labelStyle}>Country</label>
                        <input
                            id="brief-country"
                            type="text"
                            value={country}
                            onChange={(event) => setCountry(event.target.value)}
                            maxLength={100}
                            required
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--q-color-text)'; e.currentTarget.style.boxShadow = 'var(--q-focus-ring)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--q-color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>
                    <div>
                        <label htmlFor="brief-currency" style={labelStyle}>Currency</label>
                        <input
                            id="brief-currency"
                            type="text"
                            value={currency}
                            onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
                            maxLength={3}
                            required
                            style={inputStyle}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--q-color-text)'; e.currentTarget.style.boxShadow = 'var(--q-focus-ring)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--q-color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>
                </div>
            </div>

            {notice && (
                <div role="status" style={{
                    padding: 'var(--q-space-3)',
                    borderRadius: 'var(--q-radius-md)',
                    background: 'var(--q-color-info-soft)',
                    border: '1px solid var(--q-color-border)',
                    color: 'var(--q-color-info)',
                    fontSize: '0.875rem',
                }}>
                    {notice}
                </div>
            )}
            {errorMessage && (
                <div role="alert" style={{
                    padding: 'var(--q-space-3)',
                    borderRadius: 'var(--q-radius-md)',
                    background: 'var(--q-color-danger-soft)',
                    color: 'var(--q-color-danger)',
                    fontSize: '0.875rem',
                }}>
                    {errorMessage}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--q-space-2)' }}>
                <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    onClick={() => void handleConfirm()}
                    isLoading={isSubmitting}
                    disabled={!isValid || isSubmitting || Boolean(notice)}
                >
                    {isSubmitting ? 'Creating your workspace…' : 'Confirm and create workspace'}
                </Button>
                <div style={{ display: 'flex', gap: 'var(--q-space-2)' }}>
                    <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        onClick={() => void handleEditFullDetails()}
                        disabled={isSubmitting}
                    >
                        Edit full details
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        onClick={() => void handleDismiss()}
                        disabled={isSubmitting}
                    >
                        Dismiss plan
                    </Button>
                </div>
            </div>
        </div>
    );
};
