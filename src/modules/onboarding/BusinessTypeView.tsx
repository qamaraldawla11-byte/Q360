import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, DollarSign, Globe } from 'lucide-react';
import { userApi } from '@/api/user.api';
import { useAuthStore } from '@/store/auth.store';

const countries = [
    { value: 'US', label: 'United States', hint: 'US' },
    { value: 'GB', label: 'United Kingdom', hint: 'GB' },
    { value: 'FR', label: 'France', hint: 'FR' },
    { value: 'AE', label: 'UAE', hint: 'AE' },
];

const currencies = [
    { value: 'USD', label: 'US Dollar', hint: 'USD' },
    { value: 'GBP', label: 'British Pound', hint: 'GBP' },
    { value: 'EUR', label: 'Euro', hint: 'EUR' },
    { value: 'AED', label: 'UAE Dirham', hint: 'AED' },
];

export const BusinessTypeView = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const [businessName, setBusinessName] = useState(user?.businessName || '');
    const [country, setCountry] = useState(user?.country || 'US');
    const [currency, setCurrency] = useState(user?.currency || 'USD');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const segment = user?.segment;
    const workspacePath = user?.lastActiveWorkspace || (segment ? `/app/${segment}` : '/onboarding/type');

    const handleFinish = async () => {
        if (!businessName.trim() || !user?.userType || !segment) return;
        setIsLoading(true);
        setErrorMessage('');

        try {
            const updatedUser = await userApi.updateProfile({
                userType: user.userType,
                segment,
                businessName: businessName.trim(),
                country,
                currency,
            });
            updateUser({ ...updatedUser, name: user.name, lastActiveWorkspace: workspacePath });
            localStorage.setItem('onboarding_complete', 'true');
            navigate(workspacePath, { replace: true });
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to save your profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <label htmlFor="onboarding-business-name" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--fg-primary)' }}>
                    Business Name
                </label>
                <div style={{ position: 'relative' }}>
                    <Building2
                        size={18}
                        style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }}
                    />
                    <input
                        id="onboarding-business-name"
                        type="text"
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        placeholder="My Business"
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '14px 16px 14px 44px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '15px',
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>
                    Country
                    <div style={{ position: 'relative', marginTop: '8px' }}>
                        <Globe size={19} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', pointerEvents: 'none' }} />
                        <select
                            value={country}
                            onChange={(event) => setCountry(event.target.value)}
                            aria-label="Country"
                            style={{
                                width: '100%',
                                minHeight: '52px',
                                appearance: 'none',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '14px',
                                background: '#ffffff',
                                color: 'var(--fg-primary)',
                                fontFamily: 'inherit',
                                fontSize: '15px',
                                fontWeight: 700,
                                lineHeight: 1.2,
                                outline: 'none',
                                padding: '14px 42px 14px 44px',
                                boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)',
                            }}
                        >
                            {countries.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <span aria-hidden="true" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', fontSize: '12px' }}>
                            {countries.find((option) => option.value === country)?.hint}
                        </span>
                    </div>
                </label>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>
                    Currency
                    <div style={{ position: 'relative', marginTop: '8px' }}>
                        <DollarSign size={19} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', pointerEvents: 'none' }} />
                        <select
                            value={currency}
                            onChange={(event) => setCurrency(event.target.value)}
                            aria-label="Currency"
                            style={{
                                width: '100%',
                                minHeight: '52px',
                                appearance: 'none',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '14px',
                                background: '#ffffff',
                                color: 'var(--fg-primary)',
                                fontFamily: 'inherit',
                                fontSize: '15px',
                                fontWeight: 700,
                                lineHeight: 1.2,
                                outline: 'none',
                                padding: '14px 42px 14px 44px',
                                boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)',
                            }}
                        >
                            {currencies.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <span aria-hidden="true" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', fontSize: '12px' }}>
                            {currencies.find((option) => option.value === currency)?.hint}
                        </span>
                    </div>
                </label>
            </div>

            <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                    You selected: {segment?.replaceAll('_', ' ') || 'No segment selected'}
                </div>
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                    We will set up your workspace with segment-specific tools.
                </div>
            </div>

            {errorMessage && (
                <div role="alert" style={{ padding: '12px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '14px' }}>
                    {errorMessage}
                </div>
            )}

            <button
                onClick={handleFinish}
                disabled={!businessName.trim() || !segment || isLoading}
                style={{
                    width: '100%',
                    padding: '16px',
                    background: businessName.trim() && segment && !isLoading ? 'var(--accent-primary)' : '#cbd5e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: businessName.trim() && segment && !isLoading ? 'pointer' : 'not-allowed',
                    marginTop: '8px',
                }}
            >
                {isLoading ? 'Saving your profile...' : 'Launch My Workspace'}
            </button>
        </div>
    );
};
