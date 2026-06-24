import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRetailStore } from '../store/retail.store';
import '../retail.css';

export const CustomersView = () => {
    const customers = useRetailStore(state => state.customers);
    const addCustomer = useRetailStore(state => state.addCustomer);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', phone: '' });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        addCustomer(form);
        setForm({ name: '', email: '', phone: '' });
        setShowForm(false);
    };

    return (
        <section className="retail-page">
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                <div><h1 style={{ margin: '0 0 6px' }}>Customers</h1><p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Build a lightweight customer directory and sales history.</p></div>
                <button className="retail-button retail-button--primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add customer</button>
            </header>

            <div className="retail-table-wrap">
                <table className="retail-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Visits</th><th>Total spent</th></tr></thead>
                    <tbody>
                        {customers.filter(customer => customer.id !== 'customer_walkin').map(customer => (
                            <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.email || '—'}</td><td>{customer.phone || '—'}</td><td>{customer.visits}</td><td>${customer.totalSpent.toFixed(2)}</td></tr>
                        ))}
                    </tbody>
                </table>
                {customers.length === 1 && <div className="retail-empty">No saved customers yet.</div>}
            </div>

            {showForm && (
                <div className="retail-modal" role="dialog" aria-modal="true" aria-labelledby="add-customer-title">
                    <form className="retail-modal__panel" onSubmit={submit}>
                        <h2 id="add-customer-title">Add customer</h2>
                        <div className="retail-grid">
                            <div className="retail-field"><label htmlFor="customer-name">Name</label><input id="customer-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div>
                            <div className="retail-field"><label htmlFor="customer-email">Email</label><input id="customer-email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></div>
                            <div className="retail-field"><label htmlFor="customer-phone">Phone</label><input id="customer-phone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></div>
                        </div>
                        <div className="retail-actions" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
                            <button type="button" className="retail-button" onClick={() => setShowForm(false)}>Cancel</button>
                            <button className="retail-button retail-button--primary">Save customer</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};
