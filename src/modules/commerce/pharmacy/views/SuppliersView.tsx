import { useState } from 'react';
import { Truck, Plus, MapPin, Phone } from 'lucide-react';

export const SuppliersView = () => {
    const [suppliers] = useState([
        { id: 1, name: 'PharmaDirect Distributors', contact: 'John Smith', phone: '+1 555-0101', email: 'orders@pharmadirect.com', location: 'New York, NY', status: 'Active' },
        { id: 2, name: 'Global Med Supplies', contact: 'Sarah Chen', phone: '+1 555-0102', email: 'sales@globalmed.com', location: 'Chicago, IL', status: 'Active' },
        { id: 3, name: 'Apex Pharmaceuticals', contact: 'Support Team', phone: '+1 555-9988', email: 'support@apexpharma.com', location: 'Austin, TX', status: 'On Hold' },
    ]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Supplier Management</h1>
                <button style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                    background: 'var(--accent-primary)', color: 'white', border: 'none',
                    borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer'
                }}>
                    <Plus size={18} /> Add Supplier
                </button>
            </div>

            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '16px', color: 'var(--fg-secondary)' }}>Supplier Name</th>
                            <th style={{ padding: '16px', color: 'var(--fg-secondary)' }}>Contact Person</th>
                            <th style={{ padding: '16px', color: 'var(--fg-secondary)' }}>Contact Info</th>
                            <th style={{ padding: '16px', color: 'var(--fg-secondary)' }}>Location</th>
                            <th style={{ padding: '16px', color: 'var(--fg-secondary)' }}>Status</th>
                            <th style={{ padding: '16px', color: 'var(--fg-secondary)' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '16px', fontWeight: 600 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Truck size={16} color="var(--fg-muted)" /> {s.name}
                                    </div>
                                </td>
                                <td style={{ padding: '16px' }}>{s.contact}</td>
                                <td style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> {s.phone}</span>
                                        <span style={{ color: 'var(--fg-secondary)' }}>{s.email}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '16px', color: 'var(--fg-secondary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <MapPin size={14} /> {s.location}
                                    </div>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                                        background: s.status === 'Active' ? '#dcfce7' : '#fef2f2',
                                        color: s.status === 'Active' ? '#166534' : '#991b1b'
                                    }}>
                                        {s.status}
                                    </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <button style={{ border: 'none', background: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
