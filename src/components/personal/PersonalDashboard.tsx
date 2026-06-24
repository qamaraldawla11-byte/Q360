import { ArrowUpRight, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import './personal-dashboard.css';

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue';

interface Invoice {
    id: string;
    client: string;
    amount: number;
    status: InvoiceStatus;
}

const recentInvoices: Invoice[] = [
    { id: 'INV-1048', client: 'Northstar Studio', amount: 2400, status: 'Paid' },
    { id: 'INV-1047', client: 'Morrow & Co.', amount: 1850, status: 'Pending' },
    { id: 'INV-1046', client: 'Cedar Labs', amount: 920, status: 'Overdue' },
    { id: 'INV-1045', client: 'Aperture Works', amount: 3200, status: 'Paid' },
    { id: 'INV-1044', client: 'Field Notes', amount: 780, status: 'Pending' },
];

const insights = [
    'Your paid income is 12% higher than this time last month.',
    "One invoice is overdue. Following up today could improve this month's cash flow.",
];

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
};

export const PersonalDashboard = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const displayName = user?.name?.trim()
        ? user.name.trim().split(' ')[0]
        : user?.email?.split('@')[0] ?? 'there';
    const currency = user?.currency || 'USD';
    const formatMoney = (amount: number) => new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);

    const today = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(new Date());

    const quickActions = [
        { label: 'New Invoice', path: '/app/personal/invoices' },
        { label: 'New Client', path: '/app/personal/clients' },
        { label: 'Log Expense', path: '/app/personal/expenses' },
    ];

    return (
        <section className="personal-dashboard">
            <header className="personal-dashboard__header">
                <p>{today}</p>
                <h1>Good {getGreeting()}, {displayName}</h1>
            </header>

            <div className="personal-dashboard__stats">
                <article className="personal-stat">
                    <span>This month income</span>
                    <strong>{formatMoney(7250)}</strong>
                    <small><ArrowUpRight size={14} /> 12% from last month</small>
                </article>
                <article className="personal-stat">
                    <span>Outstanding invoices</span>
                    <strong>{formatMoney(3550)}</strong>
                    <small>2 invoices awaiting payment</small>
                </article>
            </div>

            <div className="personal-dashboard__actions" aria-label="Quick actions">
                {quickActions.map((action) => (
                    <button key={action.label} type="button" onClick={() => navigate(action.path)}>
                        <Plus size={15} />
                        {action.label}
                    </button>
                ))}
            </div>

            <article className="personal-panel">
                <div className="personal-panel__heading">
                    <div>
                        <span>Activity</span>
                        <h2>Recent invoices</h2>
                    </div>
                    <button type="button" onClick={() => navigate('/app/personal/invoices')}>
                        View all
                    </button>
                </div>

                <div className="personal-invoices">
                    {recentInvoices.slice(0, 5).map((invoice) => (
                        <div className="personal-invoice" key={invoice.id}>
                            <div>
                                <strong>{invoice.client}</strong>
                                <span>{invoice.id}</span>
                            </div>
                            <b>{formatMoney(invoice.amount)}</b>
                            <span className={`personal-status personal-status--${invoice.status.toLowerCase()}`}>
                                {invoice.status}
                            </span>
                        </div>
                    ))}
                </div>
            </article>

            <article className="personal-panel personal-assistant">
                <div className="personal-panel__heading">
                    <div>
                        <span>Assistant</span>
                        <h2>Financial insights</h2>
                    </div>
                    <Sparkles size={18} />
                </div>

                {insights.length > 0 ? (
                    <div className="personal-assistant__feed">
                        {insights.slice(0, 2).map((insight) => <p key={insight}>{insight}</p>)}
                    </div>
                ) : (
                    <p className="personal-assistant__empty">Add your first invoice to get started</p>
                )}
            </article>
        </section>
    );
};
