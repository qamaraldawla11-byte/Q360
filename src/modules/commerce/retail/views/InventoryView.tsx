import { useEffect, useState } from 'react';
import { inventoryService } from '@/core/services/inventory.service';
import type { InventoryItem } from '@/types/inventory';
import '../retail.css';

export const InventoryView = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [updating, setUpdating] = useState<string | null>(null);
    const load = () => inventoryService.getInventory().then(setItems).catch(() => setItems([]));
    useEffect(() => {
        void load();
    }, []);

    const adjust = async (item: InventoryItem, delta: number) => {
        setUpdating(item.id);
        try {
            await inventoryService.updateStock(item.id, delta);
            await load();
        } finally {
            setUpdating(null);
        }
    };

    return (
        <section className="retail-page">
            <header style={{ marginBottom: 20 }}><h1 style={{ margin: '0 0 6px' }}>Retail Inventory</h1><p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Review stock health and record counted adjustments.</p></header>
            <div className="retail-table-wrap">
                <table className="retail-table">
                    <thead><tr><th>Item</th><th>On hand</th><th>Minimum</th><th>Supplier</th><th>Status</th><th>Count adjustment</th></tr></thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id}>
                                <td><strong>{item.name}</strong><div style={{ color: 'var(--fg-secondary)', fontSize: 12 }}>{item.category || 'General'}</div></td>
                                <td>{item.current} {item.unit}</td>
                                <td>{item.min} {item.unit}</td>
                                <td>{item.supplier || 'Not assigned'}</td>
                                <td><span style={{ color: item.status === 'ok' ? '#10b981' : item.status === 'low' ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{item.status}</span></td>
                                <td>
                                    <div className="retail-actions">
                                        <button className="retail-button" disabled={updating === item.id} onClick={() => adjust(item, -1)}>-1</button>
                                        <button className="retail-button" disabled={updating === item.id} onClick={() => adjust(item, 1)}>+1</button>
                                        <button className="retail-button" disabled={updating === item.id} onClick={() => adjust(item, 10)}>+10</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};
