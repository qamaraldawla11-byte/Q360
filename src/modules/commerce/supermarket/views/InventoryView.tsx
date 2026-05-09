import { useState, useEffect } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Package, AlertTriangle, ShoppingCart } from 'lucide-react';
import { useSupermarketStore } from '../store/supermarket.store';
import { inventoryService } from '@/core/services/inventory.service';
import { procurementService } from '@/core/services/procurement.service';
import type { InventoryItem } from '@/types/inventory';

export const InventoryView = () => {
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [orderQuantity, setOrderQuantity] = useState<number>(0);

    const inventoryItems = useSupermarketStore(state => state.inventory);

    useEffect(() => {
        inventoryService.getInventory();
    }, []);

    const lowStockItems = inventoryItems.filter(item => item.status !== 'ok');

    const handleOrderClick = (item: InventoryItem) => {
        setSelectedItem(item);
        setOrderQuantity(item.min - item.current);
        setShowOrderModal(true);
    };

    const handlePlaceOrder = async () => {
        if (!selectedItem) return;

        await procurementService.createPurchaseOrder(selectedItem.id, orderQuantity);

        alert(`Order placed:\n${orderQuantity} ${selectedItem.unit} of ${selectedItem.name}\nSupplier: ${selectedItem.supplier}\nTotal: $${(selectedItem.price * orderQuantity).toFixed(2)}`);
        setShowOrderModal(false);
    };

    return (
        <ModuleShell>
            <PageHeader
                title="Inventory Management"
                subtitle="Track stock levels and manage supplier orders"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                {[
                    { label: 'Total Items', value: inventoryItems.length.toString(), icon: Package, color: '#3b82f6' },
                    { label: 'Low Stock', value: lowStockItems.length.toString(), icon: AlertTriangle, color: '#f59e0b' },
                    { label: 'Pending Orders', value: '3', icon: ShoppingCart, color: '#10b981' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '24px', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: `${stat.color}15`, color: stat.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <stat.icon size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '28px', fontWeight: 700 }}>{stat.value}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{stat.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Low Stock Alerts - Order from Suppliers</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Item</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Current</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Minimum</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Supplier</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Status</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lowStockItems.map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '16px 20px', fontWeight: 500 }}>{item.name}</td>
                                <td style={{ padding: '16px 20px' }}>{item.current} {item.unit}</td>
                                <td style={{ padding: '16px 20px', color: 'var(--fg-secondary)' }}>{item.min} {item.unit}</td>
                                <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--fg-secondary)' }}>{item.supplier}</td>
                                <td style={{ padding: '16px 20px' }}>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                        background: item.status === 'critical' ? '#fee2e2' : '#fef3c7',
                                        color: item.status === 'critical' ? '#991b1b' : '#92400e'
                                    }}>
                                        {item.status === 'critical' ? 'Critical' : 'Low'}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 20px' }}>
                                    <button
                                        onClick={() => handleOrderClick(item)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Order Now
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Order Modal */}
            {showOrderModal && selectedItem && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        padding: '32px',
                        maxWidth: '500px',
                        width: '90%'
                    }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>
                            Place Order - {selectedItem.name}
                        </h3>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ marginBottom: '12px' }}>
                                <strong>Supplier:</strong> {selectedItem.supplier}
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <strong>Price per unit:</strong> ${selectedItem.price}
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <strong>Current stock:</strong> {selectedItem.current} {selectedItem.unit}
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <strong>Recommended order:</strong> {selectedItem.min - selectedItem.current} {selectedItem.unit}
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                                Order Quantity ({selectedItem.unit})
                            </label>
                            <input
                                type="number"
                                value={orderQuantity}
                                onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-subtle)',
                                    fontSize: '16px'
                                }}
                            />
                        </div>

                        <div style={{
                            padding: '16px',
                            background: '#f0fdf4',
                            borderRadius: '12px',
                            marginBottom: '24px'
                        }}>
                            <div style={{ fontSize: '14px', color: '#166534', fontWeight: 600 }}>
                                Total Cost: ${(selectedItem.price * orderQuantity).toFixed(2)}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowOrderModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'white',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePlaceOrder}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Place Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ModuleShell>
    );
};
