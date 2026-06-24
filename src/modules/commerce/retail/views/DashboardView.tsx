import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Package, ReceiptText, Users } from 'lucide-react';
import { inventoryService } from '@/core/services/inventory.service';
import type { InventoryItem } from '@/types/inventory';
import { StatCard } from '@/components/shared/StatCard';
import { useRetailStore } from '../store/retail.store';
import '../retail.css';

export const DashboardView = () => {
    const navigate = useNavigate();
    const sales = useRetailStore(state => state.sales);
    const customers = useRetailStore(state => state.customers);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);

    useEffect(() => {
        inventoryService.getInventory().then(setInventory).catch(() => setInventory([]));
    }, []);

    const today = new Date().toDateString();
    const todaySales = sales.filter(sale => new Date(sale.createdAt).toDateString() === today);
    const revenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const lowStock = inventory.filter(item => item.status !== 'ok');

    return (
        <section className="retail-page">
            <header style={{ marginBottom: 24 }}>
                <h1 style={{ margin: '0 0 6px' }}>Retail Dashboard</h1>
                <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Live store inventory and locally tracked retail sales.</p>
            </header>

            <div className="retail-grid retail-stats">
                <StatCard title="Today's Revenue" value={`$${revenue.toFixed(2)}`} icon={ReceiptText} color="#ec4899" />
                <StatCard title="Transactions" value={todaySales.length} icon={ReceiptText} color="#8b5cf6" />
                <StatCard title="Products" value={inventory.length} icon={Package} color="#3b82f6" />
                <StatCard title="Customers" value={Math.max(0, customers.length - 1)} icon={Users} color="#10b981" />
            </div>

            <div className="retail-grid retail-dashboard-panels">
                <article className="retail-card">
                    <h2>Quick actions</h2>
                    <div className="retail-actions">
                        <button className="retail-button retail-button--primary" onClick={() => navigate('/app/retail/pos')}>New sale</button>
                        <button className="retail-button" onClick={() => navigate('/app/retail/catalog')}>Add product</button>
                        <button className="retail-button" onClick={() => navigate('/app/retail/customers')}>Add customer</button>
                        <button className="retail-button" onClick={() => navigate('/app/retail/inventory')}>View inventory</button>
                    </div>
                </article>

                <article className="retail-card">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={20} color="#f59e0b" /> Stock attention</h2>
                    <strong style={{ fontSize: 34 }}>{lowStock.length}</strong>
                    <p style={{ color: 'var(--fg-secondary)', marginBottom: 0 }}>items are low or critical.</p>
                </article>
            </div>
        </section>
    );
};
