import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Globe, DollarSign, ArrowRight } from 'lucide-react';
import { useBusinessStore } from '@/store/business.store';
import { useAuthStore } from '@/store/auth.store';

export const BusinessView = () => {
    const navigate = useNavigate();
    const { profile, updateProfile } = useBusinessStore();
    const { previewMode } = useAuthStore();

    const [name, setName] = useState(profile?.name || '');
    const [jurisdiction, setJurisdiction] = useState(profile?.jurisdiction || 'US');
    const [currency, setCurrency] = useState(profile?.currency || 'USD');
    const [phone, setPhone] = useState(profile?.phone || '');

    // Preview Mode Auto-fill
    useEffect(() => {
        if (previewMode && !name) {
            setName('One OS Demo Corp');
            setPhone('+1 (555) 0123');
        }
    }, [previewMode, name]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfile({ name, jurisdiction, currency, phone });
        navigate('/onboarding/segment');
    };

    return (
        <div style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--fg-primary)', marginBottom: '8px' }}>Setup your business</h1>
                <p style={{ color: 'var(--fg-secondary)', fontSize: '15px' }}>Tell us about your organization.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Business Name</label>
                    <div style={{ position: 'relative' }}>
                        <Building2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-base"
                            placeholder="Acme Corp"
                            style={{ width: '100%', paddingLeft: '40px' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Jurisdiction</label>
                        <div style={{ position: 'relative' }}>
                            <Globe size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                            <select
                                value={jurisdiction}
                                onChange={(e) => setJurisdiction(e.target.value)}
                                className="input-base"
                                style={{ width: '100%', paddingLeft: '40px' }}
                            >
                                <option value="US">United States</option>
                                <option value="UK">United Kingdom</option>
                                <option value="EU">European Union</option>
                                <option value="UAE">UAE</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Currency</label>
                        <div style={{ position: 'relative' }}>
                            <DollarSign size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="input-base"
                                style={{ width: '100%', paddingLeft: '40px' }}
                            >
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="AED">AED (د.إ)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Business Phone</label>
                    <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input-base"
                        placeholder="+1 (555) 000-0000"
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <button type="submit" className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <span>Continue</span>
                        <ArrowRight size={18} />
                    </button>
                    {previewMode && (
                        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--fg-muted)' }}>
                            Preview Mode: Data auto-filled. Click Continue to proceed.
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};
