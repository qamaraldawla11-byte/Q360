import { useState, useEffect } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Truck, Phone, Mail, MapPin, Plus } from 'lucide-react';
import { procurementService } from '@/core/services/procurement.service';
import type { Supplier } from '@/types/supplier';

export const SuppliersView = () => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            const data = await procurementService.getSuppliers();
            setSuppliers(data);
        };
        fetchSuppliers();
    }, []);

    return (
        <ModuleShell>
            <PageHeader
                title="Supplier Management"
                subtitle="Manage your supplier relationships and orders"
                actions={
                    <button
                        onClick={() => setShowAddModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 16px', borderRadius: '10px',
                            background: 'var(--primary)', color: 'white',
                            border: 'none', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        <Plus size={18} />
                        Add Supplier
                    </button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                {suppliers.map((supplier) => (
                    <div key={supplier.id} style={{
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px solid var(--border-subtle)',
                        padding: '24px',
                        transition: 'all 0.2s'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: '#10b98115',
                                        color: '#10b981',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Truck size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{supplier.name}</h3>
                                        <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{supplier.contact}</div>
                                    </div>
                                </div>
                            </div>
                            <span style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: '#dcfce7',
                                color: '#166534'
                            }}>
                                {supplier.status.toUpperCase()}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                <Phone size={16} color="var(--fg-secondary)" />
                                <span>{supplier.phone}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                <Mail size={16} color="var(--fg-secondary)" />
                                <span>{supplier.email}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                <MapPin size={16} color="var(--fg-secondary)" />
                                <span>{supplier.address}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--fg-secondary)' }}>
                                Products:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {supplier.products.map((product, i) => (
                                    <span key={i} style={{
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        background: '#f8fafc',
                                        border: '1px solid var(--border-subtle)'
                                    }}>
                                        {product}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={{
                                flex: 1,
                                padding: '10px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}>
                                Place Order
                            </button>
                            <button style={{
                                padding: '10px 16px',
                                background: 'white',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '10px',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}>
                                View History
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Supplier Modal Placeholder */}
            {showAddModal && (
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
                }} onClick={() => setShowAddModal(false)}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        padding: '32px',
                        maxWidth: '500px',
                        width: '90%'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                            Add New Supplier
                        </h3>
                        <p style={{ color: 'var(--fg-secondary)', marginBottom: '24px' }}>
                            Supplier management form would go here
                        </p>
                        <button
                            onClick={() => setShowAddModal(false)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'var(--accent-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </ModuleShell>
    );
};
