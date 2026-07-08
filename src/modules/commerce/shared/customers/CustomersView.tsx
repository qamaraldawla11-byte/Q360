import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { customersApi, type CreateCustomerInput, type Customer } from '@/api/customers.api';
import '@/modules/commerce/retail/retail.css';

const emptyForm: CreateCustomerInput = {
    name: '',
    phone: '',
    email: '',
    companyName: '',
    address: '',
    notes: '',
};

const getErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { error?: unknown } } }).response;
        if (typeof response?.data?.error === 'string') return response.data.error;
    }
    return error instanceof Error ? error.message : 'Something went wrong';
};

const compactInput = (form: CreateCustomerInput): CreateCustomerInput => ({
    name: form.name.trim(),
    phone: form.phone?.trim() || undefined,
    email: form.email?.trim() || undefined,
    companyName: form.companyName?.trim() || undefined,
    address: form.address?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
});

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

export const CustomersView = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [form, setForm] = useState<CreateCustomerInput>(emptyForm);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const sortedCustomers = useMemo(() => (
        [...customers].sort((a, b) => a.name.localeCompare(b.name))
    ), [customers]);

    const loadCustomers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            setCustomers(await customersApi.list());
        } catch (loadError) {
            setError(getErrorMessage(loadError));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadCustomers();
    }, []);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);
        const input = compactInput(form);

        if (!input.name) {
            setFormError('Customer name is required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const createdCustomer = await customersApi.create(input);
            setCustomers(current => [createdCustomer, ...current]);
            setForm(emptyForm);
            setShowForm(false);
        } catch (submitError) {
            setFormError(getErrorMessage(submitError));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="retail-page">
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: '0 0 6px' }}>Customers</h1>
                    <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Reusable customer records backed by the shared Q360 API.</p>
                </div>
                <div className="retail-actions">
                    <button className="retail-button" onClick={loadCustomers} disabled={isLoading}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button className="retail-button retail-button--primary" onClick={() => setShowForm(true)}>
                        <Plus size={16} /> Add customer
                    </button>
                </div>
            </header>

            {error && (
                <div role="alert" className="retail-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderColor: 'var(--error)' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {isLoading ? (
                <div className="retail-empty" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <LoaderCircle size={18} /> Loading customers...
                </div>
            ) : (
                <div className="retail-table-wrap">
                    <table className="retail-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Company</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Address</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCustomers.map(customer => (
                                <tr key={customer.id}>
                                    <td><strong>{customer.name}</strong></td>
                                    <td>{customer.companyName || '-'}</td>
                                    <td>{customer.email || '-'}</td>
                                    <td>{customer.phone || '-'}</td>
                                    <td>{customer.address || '-'}</td>
                                    <td>{formatDate(customer.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sortedCustomers.length === 0 && <div className="retail-empty">No customers yet.</div>}
                </div>
            )}

            {showForm && (
                <div className="retail-modal" role="dialog" aria-modal="true" aria-labelledby="add-customer-title">
                    <form className="retail-modal__panel" onSubmit={submit}>
                        <h2 id="add-customer-title" style={{ marginTop: 0 }}>Add customer</h2>
                        {formError && (
                            <div role="alert" style={{ color: 'var(--error)', marginBottom: 16 }}>{formError}</div>
                        )}
                        <div className="retail-grid">
                            <div className="retail-field">
                                <label htmlFor="customer-name">Name</label>
                                <input id="customer-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
                            </div>
                            <div className="retail-field">
                                <label htmlFor="customer-company">Company</label>
                                <input id="customer-company" value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} />
                            </div>
                            <div className="retail-field">
                                <label htmlFor="customer-email">Email</label>
                                <input id="customer-email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
                            </div>
                            <div className="retail-field">
                                <label htmlFor="customer-phone">Phone</label>
                                <input id="customer-phone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
                            </div>
                            <div className="retail-field">
                                <label htmlFor="customer-address">Address</label>
                                <input id="customer-address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} />
                            </div>
                            <div className="retail-field">
                                <label htmlFor="customer-notes">Notes</label>
                                <textarea id="customer-notes" rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
                            </div>
                        </div>
                        <div className="retail-actions" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
                            <button type="button" className="retail-button" onClick={() => { setShowForm(false); setFormError(null); }} disabled={isSubmitting}>Cancel</button>
                            <button className="retail-button retail-button--primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save customer'}</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};
