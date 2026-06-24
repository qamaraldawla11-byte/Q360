import { useEffect, useMemo, useState } from 'react';
import { inventoryService } from '@/core/services/inventory.service';
import { procurementService } from '@/core/services/procurement.service';
import type { InventoryItem } from '@/types/inventory';
import '../retail.css';

export const RetailProcurementView = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [selected, setSelected] = useState<InventoryItem | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const load = () => inventoryService.getInventory().then(setItems).catch(() => setItems([]));
    useEffect(() => {
        void load();
    }, []);

    const candidates = useMemo(
        () => [...items].sort((a, b) => (a.current - a.min) - (b.current - b.min)),
        [items],
    );

    const openOrder = (item: InventoryItem) => {
        setSelected(item);
        setQuantity(Math.max(1, item.min - item.current));
    };

    const placeOrder = async () => {
        if (!selected || quantity <= 0 || submitting) return;
        setSubmitting(true);
        try {
            await procurementService.createPurchaseOrder(selected.id, quantity);
            setSelected(null);
            await load();
        } catch {
            window.alert('The replenishment order could not be completed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="retail-page">
            <header style={{ marginBottom: 20 }}>
                <h1 style={{ margin: '0 0 6px' }}>Procurement</h1>
                <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>Replenish stock from assigned suppliers. Current orders are received immediately by the backend.</p>
            </header>

            <div className="retail-table-wrap">
                <table className="retail-table">
                    <thead><tr><th>Item</th><th>On hand</th><th>Minimum</th><th>Supplier</th><th>Recommended</th><th>Action</th></tr></thead>
                    <tbody>
                        {candidates.map(item => {
                            const recommended = Math.max(1, item.min - item.current);
                            return (
                                <tr key={item.id}>
                                    <td><strong>{item.name}</strong></td>
                                    <td>{item.current} {item.unit}</td>
                                    <td>{item.min} {item.unit}</td>
                                    <td>{item.supplier || 'Not assigned'}</td>
                                    <td>{recommended} {item.unit}</td>
                                    <td><button className="retail-button retail-button--primary" onClick={() => openOrder(item)}>Replenish</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selected && (
                <div className="retail-modal" role="dialog" aria-modal="true" aria-labelledby="retail-replenish-title">
                    <div className="retail-modal__panel">
                        <h2 id="retail-replenish-title">Replenish {selected.name}</h2>
                        <p style={{ color: 'var(--fg-secondary)' }}>Supplier: {selected.supplier || 'Not assigned'}</p>
                        <div className="retail-field">
                            <label htmlFor="retail-replenish-quantity">Quantity ({selected.unit})</label>
                            <input id="retail-replenish-quantity" type="number" min="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} />
                        </div>
                        <p><strong>Estimated cost: ${(selected.price * quantity).toFixed(2)}</strong></p>
                        <div className="retail-actions" style={{ justifyContent: 'flex-end' }}>
                            <button className="retail-button" onClick={() => setSelected(null)}>Cancel</button>
                            <button className="retail-button retail-button--primary" disabled={submitting || quantity <= 0} onClick={placeOrder}>{submitting ? 'Ordering...' : 'Place order'}</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
