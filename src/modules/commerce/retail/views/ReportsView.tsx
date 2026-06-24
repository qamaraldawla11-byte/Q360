import { ReceiptText, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { useRetailStore } from '../store/retail.store';
import '../retail.css';

export const ReportsView = () => {
    const sales = useRetailStore(state => state.sales);
    const customers = useRetailStore(state => state.customers);
    const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const items = sales.reduce((sum, sale) => sum + sale.itemCount, 0);
    const average = sales.length ? revenue / sales.length : 0;

    return (
        <section className="retail-page">
            <header style={{ marginBottom: 20 }}><h1 style={{ margin: '0 0 6px' }}>Retail Reports</h1><p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Summary of sales completed through the Retail POS on this device.</p></header>
            <div className="retail-grid retail-stats">
                <StatCard title="Revenue" value={`$${revenue.toFixed(2)}`} icon={TrendingUp} color="#ec4899" />
                <StatCard title="Transactions" value={sales.length} icon={ReceiptText} color="#8b5cf6" />
                <StatCard title="Items sold" value={items} icon={ShoppingBag} color="#3b82f6" />
                <StatCard title="Customers" value={Math.max(0, customers.length - 1)} icon={Users} color="#10b981" />
            </div>
            <article className="retail-card" style={{ marginBottom: 18 }}><strong>Average transaction: ${average.toFixed(2)}</strong></article>
            <div className="retail-table-wrap">
                <table className="retail-table">
                    <thead><tr><th>Date</th><th>Order</th><th>Items</th><th>Subtotal</th><th>Tax</th><th>Total</th></tr></thead>
                    <tbody>{sales.map(sale => <tr key={sale.id}><td>{new Date(sale.createdAt).toLocaleString()}</td><td>{sale.orderId}</td><td>{sale.itemCount}</td><td>${sale.subtotal.toFixed(2)}</td><td>${sale.tax.toFixed(2)}</td><td><strong>${sale.total.toFixed(2)}</strong></td></tr>)}</tbody>
                </table>
                {!sales.length && <div className="retail-empty">Completed Retail POS sales will appear here.</div>}
            </div>
        </section>
    );
};
