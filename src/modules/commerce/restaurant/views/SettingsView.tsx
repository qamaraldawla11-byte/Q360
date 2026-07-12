import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Building2, CheckCircle2, ImagePlus, Loader2, Lock, Upload } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { businessApi, type BusinessProfile, type RestaurantBusinessType } from '@/api/business.api';
import { useAuthStore } from '@/store/auth.store';

const EMPTY_PROFILE = {
    name: '', country: '', city: '', address: '', phone: '', email: '', currency: 'USD',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', taxIdentifier: '',
    restaurantType: 'both' as RestaurantBusinessType,
};

export const SettingsView = () => {
    const updateUser = useAuthStore(state => state.updateUser);
    const inputRef = useRef<HTMLInputElement>(null);
    const [profile, setProfile] = useState<BusinessProfile | null>(null);
    const [form, setForm] = useState(EMPTY_PROFILE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        businessApi.getProfile().then(result => {
            setProfile(result);
            setForm({
                name: result.name || '', country: result.country || '', city: result.city || '',
                address: result.address || '', phone: result.phone || '', email: result.email || '',
                currency: result.currency || 'USD', timezone: result.timezone || EMPTY_PROFILE.timezone,
                taxIdentifier: result.taxIdentifier || '', restaurantType: result.restaurantType || 'both',
            });
        }).catch(error => setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to load business profile' }))
            .finally(() => setLoading(false));
    }, []);

    const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm(current => ({ ...current, [field]: event.target.value }));
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true); setMessage(null);
        try {
            const updated = await businessApi.updateProfile(form);
            setProfile(updated);
            updateUser({ businessName: updated.name, country: updated.country, currency: updated.currency });
            window.dispatchEvent(new CustomEvent('q360:business-profile', { detail: updated }));
            setMessage({ kind: 'success', text: 'Business profile saved.' });
        } catch (error) {
            setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save business profile' });
        } finally { setSaving(false); }
    };

    const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
            setMessage({ kind: 'error', text: 'Choose a PNG, JPEG, or WebP logo up to 2 MB.' });
            return;
        }
        setUploading(true); setMessage(null);
        try {
            const updated = await businessApi.uploadLogo(file);
            setProfile(updated);
            window.dispatchEvent(new CustomEvent('q360:business-profile', { detail: updated }));
            setMessage({ kind: 'success', text: 'Business logo updated.' });
        } catch (error) {
            setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to upload logo' });
        } finally { setUploading(false); }
    };

    return (
        <ModuleShell>
            <PageHeader title="Business Settings" subtitle="Your saved Restaurant identity and operating defaults." />
            {message && <div className={`settings-message settings-message--${message.kind}`}>{message.kind === 'success' && <CheckCircle2 size={17} />}{message.text}</div>}
            {loading ? <div className="settings-loading"><Loader2 size={20} /> Loading business profile...</div> : (
                <div className="business-settings-layout">
                    <section className="business-settings-card business-settings-brand">
                        <div className="settings-section-heading"><ImagePlus size={20} /><div><h2>Business logo</h2><p>Shown in your Q360 sidebar and business surfaces.</p></div></div>
                        <div className="business-logo-preview">
                            {profile?.logoUrl ? <img src={`${profile.logoUrl}?v=${encodeURIComponent(profile.updatedAt || '')}`} alt={`${profile.name} logo`} /> : <Building2 size={40} />}
                        </div>
                        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} hidden />
                        <button type="button" className="settings-secondary-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
                            {uploading ? <Loader2 size={17} /> : <Upload size={17} />} {uploading ? 'Uploading...' : 'Upload logo'}
                        </button>
                        <small>PNG, JPEG, or WebP. Maximum 2 MB.</small>
                    </section>

                    <form className="business-settings-card business-settings-form" onSubmit={save}>
                        <div className="settings-section-heading"><Building2 size={20} /><div><h2>Business profile</h2><p>Country is required for future suppliers, tax, and regional services.</p></div></div>
                        <div className="settings-fields">
                            <label><span>Business name *</span><input value={form.name} onChange={update('name')} maxLength={120} required /></label>
                            <label><span>Country *</span><input value={form.country} onChange={update('country')} maxLength={80} placeholder="e.g. United Kingdom" required /></label>
                            <label><span>City</span><input value={form.city} onChange={update('city')} maxLength={100} /></label>
                            <label><span>Phone</span><input value={form.phone} onChange={update('phone')} maxLength={40} type="tel" /></label>
                            <label className="settings-field-wide"><span>Address</span><input value={form.address} onChange={update('address')} maxLength={240} /></label>
                            <label><span>Business email</span><input value={form.email} onChange={update('email')} type="email" /></label>
                            <label><span>Tax identifier</span><input value={form.taxIdentifier} onChange={update('taxIdentifier')} maxLength={80} /></label>
                            <label><span>Currency *</span><input value={form.currency} onChange={update('currency')} maxLength={3} pattern="[A-Za-z]{3}" required /></label>
                            <label><span>Timezone *</span><input value={form.timezone} onChange={update('timezone')} maxLength={80} required /></label>
                            <label className="settings-field-wide"><span>Restaurant service *</span><select value={form.restaurantType} onChange={update('restaurantType')}><option value="both">Dine-in and takeaway</option><option value="dine_in">Dine-in only</option><option value="takeaway">Takeaway only</option></select></label>
                        </div>
                        <div className="settings-form-footer"><span><Lock size={14} /> Saved only to this business.</span><button type="submit" disabled={saving}>{saving ? <Loader2 size={17} /> : null}{saving ? 'Saving...' : 'Save profile'}</button></div>
                    </form>
                </div>
            )}
            <style>{`
                .business-settings-layout{display:grid;grid-template-columns:minmax(220px,300px) minmax(0,1fr);gap:20px;max-width:1100px}.business-settings-card{background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:16px;padding:22px}.settings-section-heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:22px}.settings-section-heading svg{color:#f97316;flex:none}.settings-section-heading h2{margin:0 0 4px;font-size:17px}.settings-section-heading p{margin:0;color:#64748b;font-size:13px;line-height:1.45}.business-settings-brand{display:flex;flex-direction:column;align-items:stretch;height:max-content}.business-logo-preview{height:170px;display:grid;place-items:center;overflow:hidden;border:1px dashed #cbd5e1;border-radius:14px;background:#f8fafc;color:#94a3b8;margin-bottom:14px}.business-logo-preview img{width:100%;height:100%;object-fit:contain;padding:16px}.settings-secondary-button,.settings-form-footer button{min-height:42px;display:flex;justify-content:center;align-items:center;gap:8px;border-radius:9px;cursor:pointer;font:inherit;font-weight:700}.settings-secondary-button{border:1px solid #cbd5e1;background:#fff;color:#334155}.business-settings-brand small{margin-top:9px;color:#64748b;text-align:center}.settings-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.settings-fields label{display:flex;flex-direction:column;gap:7px;color:#334155;font-size:12px;font-weight:700}.settings-fields input,.settings-fields select{width:100%;min-height:42px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;font:inherit;font-size:14px}.settings-field-wide{grid-column:1/-1}.settings-form-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:22px;padding-top:18px;border-top:1px solid #e2e8f0}.settings-form-footer span{display:flex;align-items:center;gap:6px;color:#64748b;font-size:12px}.settings-form-footer button{min-width:140px;padding:0 18px;border:0;background:#f97316;color:#fff}.settings-message,.settings-loading{max-width:1100px;margin:0 0 18px;padding:13px 15px;display:flex;align-items:center;gap:8px;border-radius:10px;font-size:13px}.settings-message--success{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}.settings-message--error{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}.settings-loading{background:#fff;color:#475569;border:1px solid #d8dee8}@media(max-width:820px){.business-settings-layout{grid-template-columns:1fr}.business-logo-preview{height:140px}}@media(max-width:620px){.settings-fields{grid-template-columns:1fr}.settings-field-wide{grid-column:auto}.settings-form-footer{align-items:stretch;flex-direction:column}.settings-form-footer button{width:100%}}
            `}</style>
        </ModuleShell>
    );
};
