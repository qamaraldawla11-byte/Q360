import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle, Plus, RefreshCw, UserRound, X } from 'lucide-react';
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
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [form, setForm] = useState<CreateCustomerInput>(emptyForm);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const sortedCustomers = useMemo(() => (
        [...customers].sort((a, b) => a.name.localeCompare(b.name))
    ), [customers]);

    const loadCustomers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const customerRows = await customersApi.list();
            setCustomers(customerRows);
            setSelectedCustomer(current => (
                current && !customerRows.some(customer => customer.id === current.id) ? null : current
            ));
        } catch (loadError) {
            setError(getErrorMessage(loadError));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadCustomers();
    }, [loadCustomers]);

    const openCustomer = async (customerId: string) => {
        setIsDetailLoading(true);
        setDetailError(null);
        setSuccessMessage(null);
        try {
            setSelectedCustomer(await customersApi.get(customerId));
        } catch (selectError) {
            setDetailError(getErrorMessage(selectError));
        } finally {
            setIsDetailLoading(false);
        }
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setFormError(null);
        setSuccessMessage(null);
        const input = compactInput(form);

        if (!input.name) {
            setFormError('Customer name is required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const createdCustomer = await customersApi.create(input);
            setCustomers(current => [createdCustomer, ...current]);
            setSelectedCustomer(createdCustomer);
            setSuccessMessage(`${createdCustomer.name} was added.`);
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
                    <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Customer records backed by the shared Q360 Commerce API.</p>
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

            {successMessage && (
                <div role="status" className="retail-card" style={{ marginBottom: 18, borderColor: 'var(--success, #10b981)' }}>
                    {successMessage}
                </div>
            )}

            {isLoading ? (
                <div className="retail-empty" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <LoaderCircle size={18} /> Loading customers...
                </div>
            ) : (
                <div className="retail-customers-layout">
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
                                    <tr
                                        key={customer.id}
                                        className={selectedCustomer?.id === customer.id ? 'retail-table-row--active' : undefined}
                                        onClick={() => void openCustomer(customer.id)}
                                    >
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
                        {sortedCustomers.length === 0 && <div className="retail-empty">No customers yet. Add one to start a shared customer file.</div>}
                    </div>

                    <div className="retail-customer-cards">
                        {sortedCustomers.map(customer => (
                            <button
                                key={customer.id}
                                className="retail-customer-card"
                                onClick={() => void openCustomer(customer.id)}
                            >
                                <strong>{customer.name}</strong>
                                <span>{customer.companyName || 'No company'}</span>
                                <span>{customer.phone || customer.email || 'No contact saved'}</span>
                            </button>
                        ))}
                        {sortedCustomers.length === 0 && <div className="retail-empty">No customers yet. Add one to start a shared customer file.</div>}
                    </div>

                    <aside className="retail-detail-panel" aria-live="polite">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserRound size={20} /> Detail
                            </h2>
                            {selectedCustomer && (
                                <button className="retail-icon-button" onClick={() => setSelectedCustomer(null)} aria-label="Close customer detail">
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {isDetailLoading && (
                            <div className="retail-empty" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                <LoaderCircle size={18} /> Loading detail...
                            </div>
                        )}

                        {detailError && (
                            <div role="alert" style={{ color: 'var(--error)', marginTop: 16 }}>{detailError}</div>
                        )}

                        {!isDetailLoading && !selectedCustomer && !detailError && (
                            <p style={{ color: 'var(--fg-secondary)' }}>Select a customer to view the backend detail record.</p>
                        )}

                        {!isDetailLoading && selectedCustomer && (
                            <dl className="retail-detail-list">
                                <div><dt>Name</dt><dd>{selectedCustomer.name}</dd></div>
                                <div><dt>Company</dt><dd>{selectedCustomer.companyName || '-'}</dd></div>
                                <div><dt>Phone</dt><dd>{selectedCustomer.phone || '-'}</dd></div>
                                <div><dt>Email</dt><dd>{selectedCustomer.email || '-'}</dd></div>
                                <div><dt>Address</dt><dd>{selectedCustomer.address || '-'}</dd></div>
                                <div><dt>Notes</dt><dd>{selectedCustomer.notes || '-'}</dd></div>
                                <div><dt>Created</dt><dd>{formatDate(selectedCustomer.createdAt)}</dd></div>
                            </dl>
                        )}
                    </aside>
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
