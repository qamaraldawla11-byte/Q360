import './personal-dashboard.css';

interface PersonalStubViewProps {
    title: string;
}

const PersonalStubView = ({ title }: PersonalStubViewProps) => (
    <section className="personal-dashboard">
        <header className="personal-dashboard__header">
            <p>Personal workspace</p>
            <h1>{title}</h1>
        </header>
        <article className="personal-panel" style={{ padding: '28px 22px', color: 'var(--personal-muted)' }}>
            This feature is coming soon
        </article>
    </section>
);

export const InvoiceListView = () => <PersonalStubView title="Invoices" />;
export const ClientListView = () => <PersonalStubView title="Clients" />;
export const ExpenseView = () => <PersonalStubView title="Expenses" />;
export const TaskView = () => <PersonalStubView title="Tasks" />;
export const PersonalSettingsView = () => <PersonalStubView title="Settings" />;
