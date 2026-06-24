import { useState } from 'react';
import { useRetailStore } from '../store/retail.store';
import '../retail.css';

export const SettingsView = () => {
    const saved = useRetailStore(state => state.settings);
    const updateSettings = useRetailStore(state => state.updateSettings);
    const [form, setForm] = useState(saved);
    const [savedMessage, setSavedMessage] = useState(false);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        updateSettings(form);
        setSavedMessage(true);
        window.setTimeout(() => setSavedMessage(false), 1800);
    };

    return (
        <section className="retail-page">
            <header style={{ marginBottom: 20 }}><h1 style={{ margin: '0 0 6px' }}>Retail Settings</h1><p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Configure local POS display and receipt preferences.</p></header>
            <form className="retail-card retail-grid" onSubmit={submit} style={{ maxWidth: 720 }}>
                <div className="retail-field"><label htmlFor="retail-store-name">Store name</label><input id="retail-store-name" required value={form.storeName} onChange={event => setForm({ ...form, storeName: event.target.value })} /></div>
                <div className="retail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="retail-field"><label htmlFor="retail-tax-rate">Tax rate (%)</label><input id="retail-tax-rate" type="number" value="10" disabled /><small style={{ color: 'var(--fg-muted)' }}>Fixed by the current checkout API.</small></div>
                    <div className="retail-field"><label htmlFor="retail-currency">Currency</label><select id="retail-currency" value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value })}><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option></select></div>
                </div>
                <div className="retail-field"><label htmlFor="retail-receipt-footer">Receipt footer</label><textarea id="retail-receipt-footer" rows={3} value={form.receiptFooter} onChange={event => setForm({ ...form, receiptFooter: event.target.value })} /></div>
                <div className="retail-actions"><button className="retail-button retail-button--primary">Save settings</button>{savedMessage && <span role="status" style={{ alignSelf: 'center', color: '#10b981' }}>Settings saved</span>}</div>
            </form>
        </section>
    );
};
