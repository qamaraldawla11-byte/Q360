import { useState } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    Plus,
    Search,
    Filter,
    Clock,
    CheckCircle2,
    Truck,
    AlertCircle,
    ChevronRight,
    Package,
    ArrowLeft
} from 'lucide-react';
import type { PurchaseOrder, POStatus } from '@/types/procurement';


interface ProcurementViewProps {
    vertical?: string;
}

export const ProcurementView = ({ vertical }: ProcurementViewProps) => {
    const [view, setView] = useState<'list' | 'create' | 'detail'>('list');

    // Mock data for POs
    const [orders] = useState<PurchaseOrder[]>([
        {
            id: 'PO-2024-001',
            buyerId: 'b1',
            buyerName: 'Main Store',
            supplierId: 's1',
            supplierName: 'Dairy Fresh Ltd',
            status: 'delivered',
            items: [],
            subtotal: 450.00,
            tax: 45.00,
            total: 495.00,
            createdAt: '2024-01-05T10:00:00Z',
            updatedAt: '2024-01-07T14:30:00Z',
        },
        {
            id: 'PO-2024-002',
            buyerId: 'b1',
            buyerName: 'Main Store',
            supplierId: 's2',
            supplierName: 'Green Valley Farms',
            status: 'dispatched',
            items: [],
            subtotal: 280.00,
            tax: 28.00,
            total: 308.00,
            createdAt: '2024-01-08T09:15:00Z',
            updatedAt: '2024-01-09T11:00:00Z',
        },
        {
            id: 'PO-2024-003',
            buyerId: 'b1',
            buyerName: 'Main Store',
            supplierId: 's3',
            supplierName: 'Poultry Pro',
            status: 'submitted',
            items: [],
            subtotal: 1200.00,
            tax: 120.00,
            total: 1320.00,
            createdAt: '2024-01-10T08:00:00Z',
            updatedAt: '2024-01-10T08:00:00Z',
        }
    ]);

    const getStatusStyles = (status: POStatus) => {
        switch (status) {
            case 'draft': return { bg: 'var(--surface-300)', fg: 'var(--fg-secondary)', icon: Clock };
            case 'submitted': return { bg: 'var(--primary-glow)', fg: 'var(--primary)', icon: AlertCircle };
            case 'accepted': return { bg: 'var(--success-glow)', fg: 'var(--success)', icon: CheckCircle2 };
            case 'preparing': return { bg: 'var(--warning-glow)', fg: 'var(--warning)', icon: Package };
            case 'dispatched': return { bg: 'rgba(147, 51, 234, 0.1)', fg: '#9333ea', icon: Truck };
            case 'delivered': return { bg: 'var(--success-glow)', fg: 'var(--success)', icon: CheckCircle2 };
            case 'cancelled': return { bg: 'var(--error-glow)', fg: 'var(--error)', icon: AlertCircle };
            default: return { bg: 'var(--surface-300)', fg: 'var(--fg-secondary)', icon: Clock };
        }
    };

    if (view === 'create') {
        return (
            <ModuleShell>
                <div style={{ marginBottom: '24px' }}>
                    <button
                        onClick={() => setView('list')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--fg-secondary)',
                            cursor: 'pointer',
                            padding: 0,
                            marginBottom: '16px'
                        }}
                    >
                        <ArrowLeft size={16} /> Back to Orders
                    </button>
                    <PageHeader
                        title="Create Purchase Order"
                        subtitle="Create a new order for your suppliers"
                    />
                </div>
                <div style={{ background: 'var(--surface-100)', padding: '32px', borderRadius: '16px', border: '1px solid var(--surface-400)' }}>
                    <p style={{ color: 'var(--fg-secondary)' }}>Purchase Order creation form would go here...</p>
                    <button
                        onClick={() => setView('list')}
                        style={{ marginTop: '20px', padding: '10px 20px', background: 'var(--accent)', color: 'var(--fg-on-primary)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Submit Purchase Order (Demo)
                    </button>
                </div>
            </ModuleShell>
        );
    }

    return (
        <ModuleShell>
            <span hidden>{vertical}</span>
            <PageHeader
                title="Procurement"
                subtitle="Manage purchase orders and supplier relationships"
                actions={(
                    <button
                        onClick={() => setView('create')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                            background: 'var(--accent)', color: 'var(--fg-on-primary)', border: 'none',
                            borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        <Plus size={18} /> New Purchase Order
                    </button>
                )}
            />

            {/* Filters/Search */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-secondary)' }} size={18} />
                    <input
                        type="text"
                        placeholder="Search orders, suppliers..."
                        style={{
                            width: '100%',
                            padding: '10px 10px 10px 40px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '14px'
                        }}
                    />
                </div>
                <button style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                    borderRadius: '10px', border: '1px solid var(--surface-400)', background: 'var(--surface-100)',
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer'
                }}>
                    <Filter size={18} /> Filter
                </button>
            </div>

            {/* Orders List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {orders.map(order => {
                    const status = getStatusStyles(order.status);
                    const StatusIcon = status.icon;

                    return (
                        <div key={order.id} style={{
                            background: 'white',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '16px',
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--surface-400)'}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: 'var(--surface-200)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--fg-secondary)', border: '1px solid var(--surface-400)'
                                }}>
                                    <Package size={24} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{order.id}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>
                                        {order.supplierName} • {new Date(order.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>${order.total.toFixed(2)}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>
                                        {order.items.length || 3} items
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 12px', borderRadius: '20px',
                                    background: status.bg, color: status.fg,
                                    fontSize: '12px', fontWeight: 600, textTransform: 'capitalize'
                                }}>
                                    <StatusIcon size={14} />
                                    {order.status}
                                </div>

                                <ChevronRight size={18} color="var(--fg-secondary)" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </ModuleShell>
    );
};
