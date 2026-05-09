import { usePharmacyStore } from '../store/pharmacy.store';
import { Calendar } from 'lucide-react';

export const InventoryView = () => {
    const { inventory } = usePharmacyStore();

    // Flatten batches
    const flattenedBatches = inventory.flatMap(med =>
        med.batches.map(b => ({
            ...b,
            medName: med.name,
            medId: med.id
        }))
    );

    // Sort by expiry
    const sortedBatches = flattenedBatches.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

    const getExpiryClass = (date: Date) => {
        const today = new Date();
        const threeMonths = new Date(); threeMonths.setMonth(today.getMonth() + 3);

        if (date < today) return { bg: '#fee2e2', text: '#991b1b', label: 'EXPIRED' };
        if (date < threeMonths) return { bg: '#fef9c3', text: '#854d0e', label: 'EXPIRING SOON' };
        return { bg: '#dcfce7', text: '#166534', label: 'GOOD' };
    };

    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 24px' }}>Inventory & Expiry Management</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                {/* Expiry Timeline */}
                <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={20} />
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Batch Expiry Timeline</h3>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '16px' }}>Status</th>
                                <th style={{ padding: '16px' }}>Medicine</th>
                                <th style={{ padding: '16px' }}>Batch Number</th>
                                <th style={{ padding: '16px' }}>Expiry Date</th>
                                <th style={{ padding: '16px' }}>Quantity</th>
                                <th style={{ padding: '16px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedBatches.map((batch, i) => {
                                const status = getExpiryClass(batch.expiryDate);
                                return (
                                    <tr key={`${batch.medId}-${batch.id}-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                                background: status.bg, color: status.text
                                            }}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', fontWeight: 600 }}>{batch.medName}</td>
                                        <td style={{ padding: '16px', fontFamily: 'monospace' }}>{batch.number}</td>
                                        <td style={{ padding: '16px' }}>{batch.expiryDate.toLocaleDateString()}</td>
                                        <td style={{ padding: '16px' }}>{batch.quantity}</td>
                                        <td style={{ padding: '16px' }}>
                                            {status.label === 'EXPIRED' && (
                                                <button style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                                                    Write Off
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
