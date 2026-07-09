import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Contact, FileText, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { customersApi, type Customer } from '@/api/customers.api';
import { quotesApi, type CreateQuoteInput, type Quote, type QuoteItemInput } from '@/api/quotes.api';
import '@/modules/commerce/retail/retail.css';

type QuoteForm = {
    customerId: string;
    currency: string;
    validUntil: string;
    notes: string;
    items: QuoteItemInput[];
};

const emptyItem = (): QuoteItemInput => ({
    description: '',
    quantity: 1,
    unitPrice: 0,
});

const emptyForm = (): QuoteForm => ({
    customerId: '',
    currency: 'USD',
    validUntil: '',
    notes: '',
    items: [emptyItem()],
});

const getErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { error?: unknown } } }).response;
        if (typeof response?.data?.error === 'string') return response.data.error;
    }
    return error instanceof Error ? error.message : 'Something went wrong';
};

const formatMoney = (value?: number, currency = 'USD') => (
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value || 0)
);

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

const getStatusLabel = (status: Quote['status']) => (
    status.charAt(0).toUpperCase() + status.slice(1)
);

const compactQuoteInput = (form: QuoteForm): CreateQuoteInput => ({
    customerId: form.customerId,
    currency: form.currency.trim().toUpperCase() || 'USD',
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
    notes: form.notes.trim() || undefined,
    items: form.items.map(item => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
    })),
});

const formFromQuote = (quote: Quote): QuoteForm => ({
    customerId: quote.customerId,
    currency: quote.currency || 'USD',
    validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : '',
    notes: quote.notes || '',
    items: quote.items?.length
        ? quote.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        }))
        : [emptyItem()],
});

export const QuotesView = () => {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [form, setForm] = useState<QuoteForm>(emptyForm);
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const customerNames = useMemo(() => new Map(customers.map(customer => [customer.id, customer.name])), [customers]);
    const sortedQuotes = useMemo(() => (
        [...quotes].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    ), [quotes]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [quoteRows, customerRows] = await Promise.all([
                quotesApi.list(),
                customersApi.list(),
            ]);
            setQuotes(quoteRows);
            setCustomers(customerRows);
            setSelectedQuote(current => (
                current && !quoteRows.some(quote => quote.id === current.id) ? null : current
            ));
        } catch (loadError) {
            setError(getErrorMessage(loadError));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const openQuote = async (quoteId: string) => {
        setIsDetailLoading(true);
        setDetailError(null);
        setSuccessMessage(null);
        try {
            setSelectedQuote(await quotesApi.get(quoteId));
        } catch (selectError) {
            setDetailError(getErrorMessage(selectError));
        } finally {
            setIsDetailLoading(false);
        }
    };

    const openCreateForm = () => {
        setEditingQuoteId(null);
        setForm(emptyForm());
        setFormError(null);
        setSuccessMessage(null);
        setShowForm(true);
    };

    const openEditForm = (quote: Quote) => {
        if (quote.status !== 'draft') {
            setDetailError('Only draft quotes can be edited.');
            return;
        }
        setEditingQuoteId(quote.id);
        setForm(formFromQuote(quote));
        setFormError(null);
        setSuccessMessage(null);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingQuoteId(null);
        setForm(emptyForm());
        setFormError(null);
    };

    const updateItem = (index: number, updates: Partial<QuoteItemInput>) => {
        setForm(current => ({
            ...current,
            items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item),
        }));
    };

    const addItem = () => {
        setForm(current => ({ ...current, items: [...current.items, emptyItem()] }));
    };

    const removeItem = (index: number) => {
        setForm(current => ({
            ...current,
            items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const validateInput = (input: CreateQuoteInput) => {
        if (!input.customerId) return 'Select a customer.';
        if (!input.items.length) return 'Add at least one quote item.';
        for (const item of input.items) {
            if (!item.description) return 'Each item needs a name.';
            if (!Number.isFinite(item.quantity) || item.quantity <= 0) return 'Each item quantity must be greater than zero.';
            if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) return 'Each item unit price must be zero or greater.';
        }
        return null;
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setFormError(null);
        setSuccessMessage(null);

        const input = compactQuoteInput(form);
        const validationError = validateInput(input);
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setIsSubmitting(true);
        try {
            const savedQuote = editingQuoteId
                ? await quotesApi.update(editingQuoteId, input)
                : await quotesApi.create(input);
            await loadData();
            setSelectedQuote(await quotesApi.get(savedQuote.id));
            setSuccessMessage(`${savedQuote.quoteNumber} was ${editingQuoteId ? 'updated' : 'created'}.`);
            closeForm();
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
                    <h1 style={{ margin: '0 0 6px' }}>Quotes</h1>
                    <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Draft customer quotes backed by the shared Q360 Commerce API.</p>
                </div>
                <div className="retail-actions">
                    <button className="retail-button" onClick={loadData} disabled={isLoading}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button className="retail-button retail-button--primary" onClick={openCreateForm} disabled={customers.length === 0}>
                        <Plus size={16} /> New quote
                    </button>
                </div>
            </header>

            {!isLoading && customers.length === 0 && !error && (
                <div className="retail-card retail-inline-notice" role="status">
                    <Contact size={18} />
                    <span>Create a real customer in Retail Customers before creating a quote.</span>
                </div>
            )}

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
                    <LoaderCircle size={18} /> Loading quotes...
                </div>
            ) : (
                <div className="retail-customers-layout">
                    <div className="retail-table-wrap">
                        <table className="retail-table">
                            <thead>
                                <tr>
                                    <th>Quote</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Valid until</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedQuotes.map(quote => (
                                    <tr
                                        key={quote.id}
                                        className={selectedQuote?.id === quote.id ? 'retail-table-row--active' : undefined}
                                        onClick={() => void openQuote(quote.id)}
                                    >
                                        <td><strong>{quote.quoteNumber}</strong></td>
                                        <td>{customerNames.get(quote.customerId) || 'Customer'}</td>
                                        <td>{getStatusLabel(quote.status)}</td>
                                        <td>{formatMoney(quote.total, quote.currency)}</td>
                                        <td>{formatDate(quote.validUntil)}</td>
                                        <td>{formatDate(quote.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedQuotes.length === 0 && (
                            <div className="retail-empty">
                                {customers.length === 0 ? 'Add a customer before creating quotes.' : 'No quotes yet. Create a draft quote to start.'}
                            </div>
                        )}
                    </div>

                    <div className="retail-customer-cards">
                        {sortedQuotes.map(quote => (
                            <button
                                key={quote.id}
                                className={`retail-customer-card${selectedQuote?.id === quote.id ? ' retail-customer-card--active' : ''}`}
                                onClick={() => void openQuote(quote.id)}
                            >
                                <strong>{quote.quoteNumber}</strong>
                                <span>{customerNames.get(quote.customerId) || 'Customer'} - {getStatusLabel(quote.status)}</span>
                                <span>{formatMoney(quote.total, quote.currency)}</span>
                            </button>
                        ))}
                        {sortedQuotes.length === 0 && (
                            <div className="retail-empty">
                                {customers.length === 0 ? 'Add a customer before creating quotes.' : 'No quotes yet. Create a draft quote to start.'}
                            </div>
                        )}
                    </div>

                    <aside className="retail-detail-panel" aria-live="polite">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={20} /> Detail
                            </h2>
                            {selectedQuote && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="retail-icon-button" onClick={() => openEditForm(selectedQuote)} aria-label="Edit quote" disabled={selectedQuote.status !== 'draft'}>
                                        <Pencil size={18} />
                                    </button>
                                    <button className="retail-icon-button" onClick={() => setSelectedQuote(null)} aria-label="Close quote detail">
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {isDetailLoading && (
                            <div className="retail-empty" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                <LoaderCircle size={18} /> Loading detail...
                            </div>
                        )}

                        {detailError && <div role="alert" style={{ color: 'var(--error)', marginTop: 16 }}>{detailError}</div>}

                        {!isDetailLoading && !selectedQuote && !detailError && (
                            <p style={{ color: 'var(--fg-secondary)' }}>Select a quote to view backend-calculated totals and saved items.</p>
                        )}

                        {!isDetailLoading && selectedQuote && (
                            <>
                                <dl className="retail-detail-list">
                                    <div><dt>Quote</dt><dd>{selectedQuote.quoteNumber}</dd></div>
                                    <div><dt>Customer</dt><dd>{customerNames.get(selectedQuote.customerId) || selectedQuote.customerId}</dd></div>
                                    <div><dt>Status</dt><dd>{getStatusLabel(selectedQuote.status)}</dd></div>
                                    <div><dt>Subtotal</dt><dd>{formatMoney(selectedQuote.subtotal, selectedQuote.currency)}</dd></div>
                                    <div><dt>Total</dt><dd>{formatMoney(selectedQuote.total, selectedQuote.currency)}</dd></div>
                                    <div><dt>Valid until</dt><dd>{formatDate(selectedQuote.validUntil)}</dd></div>
                                    <div><dt>Notes</dt><dd>{selectedQuote.notes || '-'}</dd></div>
                                </dl>
                                <div style={{ marginTop: 18 }}>
                                    <h3 style={{ marginBottom: 10 }}>Items</h3>
                                    <div className="retail-quote-items">
                                        {(selectedQuote.items || []).map(item => (
                                            <div key={item.id} className="retail-quote-item">
                                                <strong>{item.description}</strong>
                                                <span>{item.quantity} x {formatMoney(item.unitPrice, selectedQuote.currency)}</span>
                                                <span>{formatMoney(item.lineTotal, selectedQuote.currency)}</span>
                                            </div>
                                        ))}
                                        {(selectedQuote.items || []).length === 0 && <p style={{ color: 'var(--fg-secondary)' }}>No items returned.</p>}
                                    </div>
                                    <p style={{ color: 'var(--fg-secondary)', fontSize: 13, marginTop: 10 }}>
                                        Item totals are read from the saved quote response.
                                    </p>
                                </div>
                            </>
                        )}
                    </aside>
                </div>
            )}

            {showForm && (
                <div className="retail-modal" role="dialog" aria-modal="true" aria-labelledby="quote-form-title">
                    <form className="retail-modal__panel retail-modal__panel--wide" onSubmit={submit}>
                        <h2 id="quote-form-title" style={{ marginTop: 0 }}>{editingQuoteId ? 'Edit draft quote' : 'New quote'}</h2>
                        {formError && <div role="alert" style={{ color: 'var(--error)', marginBottom: 16 }}>{formError}</div>}

                        <div className="retail-grid">
                            <div className="retail-field">
                                <label htmlFor="quote-customer">Customer</label>
                                <select id="quote-customer" required value={form.customerId} onChange={event => setForm({ ...form, customerId: event.target.value })}>
                                    <option value="">Select customer</option>
                                    {customers.map(customer => (
                                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="retail-field">
                                <label htmlFor="quote-valid-until">Valid until</label>
                                <input id="quote-valid-until" type="date" value={form.validUntil} onChange={event => setForm({ ...form, validUntil: event.target.value })} />
                            </div>
                            <div className="retail-field">
                                <label htmlFor="quote-notes">Notes</label>
                                <textarea id="quote-notes" rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
                            </div>
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                                <h3 style={{ margin: 0 }}>Items</h3>
                                <button type="button" className="retail-button" onClick={addItem}><Plus size={16} /> Add item</button>
                            </div>
                            <div className="retail-quote-form-items">
                                {form.items.map((item, index) => (
                                    <div key={index} className="retail-quote-form-item">
                                        <div className="retail-field">
                                            <label htmlFor={`quote-item-description-${index}`}>Item name</label>
                                            <input id={`quote-item-description-${index}`} required value={item.description} onChange={event => updateItem(index, { description: event.target.value })} />
                                        </div>
                                        <div className="retail-field">
                                            <label htmlFor={`quote-item-quantity-${index}`}>Quantity</label>
                                            <input id={`quote-item-quantity-${index}`} required type="number" min="0.01" step="0.01" value={item.quantity} onChange={event => updateItem(index, { quantity: Number(event.target.value) })} />
                                        </div>
                                        <div className="retail-field">
                                            <label htmlFor={`quote-item-unit-price-${index}`}>Unit price</label>
                                            <input id={`quote-item-unit-price-${index}`} required type="number" min="0" step="0.01" value={item.unitPrice} onChange={event => updateItem(index, { unitPrice: Number(event.target.value) })} />
                                        </div>
                                        <button type="button" className="retail-icon-button" onClick={() => removeItem(index)} aria-label="Remove quote item" disabled={form.items.length === 1}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="retail-actions" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
                            <button type="button" className="retail-button" onClick={closeForm} disabled={isSubmitting}>Cancel</button>
                            <button className="retail-button retail-button--primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editingQuoteId ? 'Save draft' : 'Save quote'}</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};
