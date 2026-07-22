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

type Corrections = {
    businessName?: string;
    country?: string;
    currency?: string;
};

const answerOf = (brief: QGuestBriefView, question: string) =>
    brief.payload.answers.find((item) => item.question === question)?.answer || '';

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--fg-primary)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--border-subtle)',
    fontSize: '15px',
    outline: 'none',
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
        return <div style={{ color: 'var(--fg-secondary)', fontSize: '15px', textAlign: 'center' }}>Q is loading your workspace plan…</div>;
    }

    if (loadError || !brief) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div role="alert" style={{ padding: '12px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '14px' }}>
                    {loadError || 'This plan is no longer available.'}
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/onboarding/identity')}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Continue with manual setup
                </button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{
                margin: 0,
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e40af',
                fontSize: '14px',
                fontWeight: 700,
                lineHeight: 1.45,
            }}>
                Prepared by Q. Nothing happens without you.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {facts.map((fact) => (
                    <div key={fact.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
                        <span style={{ color: 'var(--fg-muted)' }}>{fact.label}</span>
                        <span style={{ fontWeight: 600, color: 'var(--fg-primary)', textAlign: 'right' }}>{fact.value}</span>
                    </div>
                ))}
                {recommendation.recommendedModules.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '4px' }}>
                        {recommendation.recommendedModules.map((module) => (
                            <span key={module} style={{
                                padding: '7px 9px',
                                borderRadius: '999px',
                                background: '#fff2e4',
                                color: '#b85200',
                                fontSize: '13px',
                                fontWeight: 700,
                            }}>
                                {module}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '14px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '13px', color: '#166534', fontWeight: 700, marginBottom: '6px' }}>What Q will create</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#15803d', lineHeight: 1.6 }}>
                        <li>{businessTypeLabel} workspace for {businessName.trim() || prefill.businessName || 'your business'}</li>
                        {tableCount > 0 && <li>{tableCount} tables (Table 1–Table {tableCount})</li>}
                        <li>{businessTypeLabel} modules</li>
                        <li>Your Q onboarding context</li>
                    </ul>
                </div>
                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--fg-primary)', fontWeight: 700, marginBottom: '6px' }}>What Q will not do</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--fg-secondary)', lineHeight: 1.6 }}>
                        <li>Create menu items, orders, customers, staff or payments</li>
                        <li>Change anything else without you</li>
                    </ul>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
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
                        />
                    </div>
                </div>
            </div>

            {notice && (
                <div role="status" style={{ padding: '12px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '14px' }}>
                    {notice}
                </div>
            )}
            {errorMessage && (
                <div role="alert" style={{ padding: '12px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '14px' }}>
                    {errorMessage}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={!isValid || isSubmitting || Boolean(notice)}
                    style={{
                        width: '100%',
                        padding: '16px',
                        background: isValid && !isSubmitting && !notice ? 'var(--accent-primary)' : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 700,
                        fontSize: '15px',
                        cursor: isValid && !isSubmitting && !notice ? 'pointer' : 'not-allowed',
                    }}
                >
                    {isSubmitting ? 'Creating your workspace…' : 'Confirm and create workspace'}
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={() => void handleEditFullDetails()}
                        disabled={isSubmitting}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: 'transparent',
                            color: 'var(--fg-primary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer',
                        }}
                    >
                        Edit full details
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleDismiss()}
                        disabled={isSubmitting}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: 'transparent',
                            color: '#b91c1c',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer',
                        }}
                    >
                        Dismiss plan
                    </button>
                </div>
            </div>
        </div>
    );
};
