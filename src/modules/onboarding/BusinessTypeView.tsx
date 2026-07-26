import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, DollarSign, Globe } from 'lucide-react';
import { userApi } from '@/api/user.api';
import { useAuthStore } from '@/store/auth.store';
import { Button, Input } from '@/components/design-system';

const countries = [
    { value: 'US', label: 'United States', hint: 'US' },
    { value: 'GB', label: 'United Kingdom', hint: 'GB' },
    { value: 'FR', label: 'France', hint: 'FR' },
    { value: 'AE', label: 'UAE', hint: 'AE' },
    { value: 'EG', label: 'Egypt', hint: 'EG' },
];

const currencies = [
    { value: 'USD', label: 'US Dollar', hint: 'USD' },
    { value: 'GBP', label: 'British Pound', hint: 'GBP' },
    { value: 'EUR', label: 'Euro', hint: 'EUR' },
    { value: 'AED', label: 'UAE Dirham', hint: 'AED' },
    { value: 'EGP', label: 'Egyptian Pound', hint: 'EGP' },
];

type GuestSetupBrief = {
    businessName?: string;
    country?: string;
};

const countryDefaults: Record<string, { country: string; currency: string }> = {
    ae: { country: 'AE', currency: 'AED' },
    egypt: { country: 'EG', currency: 'EGP' },
    eg: { country: 'EG', currency: 'EGP' },
    france: { country: 'FR', currency: 'EUR' },
    fr: { country: 'FR', currency: 'EUR' },
    gb: { country: 'GB', currency: 'GBP' },
    uk: { country: 'GB', currency: 'GBP' },
    'united arab emirates': { country: 'AE', currency: 'AED' },
    'united kingdom': { country: 'GB', currency: 'GBP' },
    'united states': { country: 'US', currency: 'USD' },
    us: { country: 'US', currency: 'USD' },
    usa: { country: 'US', currency: 'USD' },
};

const readGuestSetupBrief = (): GuestSetupBrief | null => {
    try {
        const rawBrief = sessionStorage.getItem('q360_guest_setup');
        return rawBrief ? JSON.parse(rawBrief) as GuestSetupBrief : null;
    } catch {
        return null;
    }
};

const selectBaseStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '48px',
    appearance: 'none',
    border: '1px solid var(--q-color-border)',
    borderRadius: 'var(--q-radius-md)',
    background: 'var(--q-color-surface)',
    color: 'var(--q-color-text)',
    fontFamily: 'inherit',
    fontSize: '0.9375rem',
    fontWeight: 600,
    lineHeight: 1.2,
    outline: 'none',
    padding: '12px 42px 12px 44px',
    transition: 'border-color var(--q-duration-fast) var(--q-ease-standard), box-shadow var(--q-duration-fast) var(--q-ease-standard)',
};

export const BusinessTypeView = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const [guestBrief] = useState(readGuestSetupBrief);
    const guestCountry = guestBrief?.country?.trim().toLowerCase();
    const guestDefaults = guestCountry ? countryDefaults[guestCountry] : undefined;
    const [businessName, setBusinessName] = useState(user?.businessName || guestBrief?.businessName || '');
    const [country, setCountry] = useState(user?.country || guestDefaults?.country || 'US');
    const [currency, setCurrency] = useState(user?.currency || guestDefaults?.currency || 'USD');
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
            sessionStorage.removeItem('q360_guest_setup');
            navigate(workspacePath, { replace: true });
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to save your profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--q-space-6)' }}>
            <div>
                <label htmlFor="onboarding-business-name" style={{
                    display: 'block',
                    marginBottom: 'var(--q-space-2)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--q-color-text-secondary)',
                }}>
                    Business Name
                </label>
                <div style={{ position: 'relative' }}>
                    <Building2
                        size={18}
                        style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--q-color-text-muted)', pointerEvents: 'none' }}
                        aria-hidden="true"
                    />
                    <Input
                        id="onboarding-business-name"
                        type="text"
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        placeholder="My Business"
                        autoFocus
                        style={{ paddingLeft: '44px' }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--q-space-3)' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--q-color-text-secondary)' }}>
                    Country
                    <div style={{ position: 'relative', marginTop: 'var(--q-space-2)' }}>
                        <Globe size={19} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--q-color-text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
                        <select
                            value={country}
                            onChange={(event) => setCountry(event.target.value)}
                            aria-label="Country"
                            style={selectBaseStyle}
                        >
                            {countries.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <span aria-hidden="true" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--q-color-text-muted)', fontSize: '0.75rem' }}>
                            {countries.find((option) => option.value === country)?.hint}
                        </span>
                    </div>
                </label>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--q-color-text-secondary)' }}>
                    Currency
                    <div style={{ position: 'relative', marginTop: 'var(--q-space-2)' }}>
                        <DollarSign size={19} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--q-color-text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
                        <select
                            value={currency}
                            onChange={(event) => setCurrency(event.target.value)}
                            aria-label="Currency"
                            style={selectBaseStyle}
                        >
                            {currencies.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <span aria-hidden="true" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--q-color-text-muted)', fontSize: '0.75rem' }}>
                            {currencies.find((option) => option.value === currency)?.hint}
                        </span>
                    </div>
                </label>
            </div>

            <div style={{
                padding: 'var(--q-space-3) var(--q-space-4)',
                borderRadius: 'var(--q-radius-md)',
                background: 'var(--q-color-accent-soft)',
                border: '1px solid var(--q-color-border)',
            }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--q-color-accent)', fontWeight: 600 }}>
                    You selected: {segment?.replaceAll('_', ' ') || 'No segment selected'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--q-color-text-secondary)', marginTop: 'var(--q-space-1)' }}>
                    We will set up your workspace with segment-specific tools.
                </div>
            </div>

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

            <Button
                onClick={handleFinish}
                variant="primary"
                fullWidth
                isLoading={isLoading}
                disabled={!businessName.trim() || !segment || isLoading}
            >
                {isLoading ? 'Saving your profile…' : 'Launch My Workspace'}
            </Button>
        </div>
    );
};
