import { useState } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    ClipboardList,
    Search,
    Filter,
    ChevronRight,
    Package,
    Truck,
    CheckCircle2,
    Clock,
    AlertCircle
} from 'lucide-react';
import type { POStatus } from '@/types/procurement';

export const SupplierOrdersView = () => {
    const [orders] = useState([
        {
            id: 'PO-2024-003',
            buyerName: 'Main Store Supermarket',
            status: 'submitted' as POStatus,
            total: 1320.00,
            items: 12,
            createdAt: '2024-01-10T08:00:00Z',
        },
        {
            id: 'PO-2024-002',
            buyerName: 'Main Store Supermarket',
            status: 'dispatched' as POStatus,
            total: 308.00,
            items: 5,
            createdAt: '2024-01-08T09:15:00Z',
        }
    ]);

    const getStatusStyles = (status: POStatus) => {
        switch (status) {
            case 'submitted': return { bg: '#eff6ff', fg: '#2563eb', icon: AlertCircle, label: 'New' };
            case 'preparing': return { bg: '#fefce8', fg: '#ca8a04', icon: Package, label: 'Preparing' };
            case 'dispatched': return { bg: '#faf5ff', fg: '#9333ea', icon: Truck, label: 'In Transit' };
            case 'delivered': return { bg: '#f0fdf4', fg: '#16a34a', icon: CheckCircle2, label: 'Delivered' };
            default: return { bg: '#f1f5f9', fg: '#475569', icon: Clock, label: status };
        }
    };

    return (
        <ModuleShell>
            <PageHeader
                title="Orders Management"
                subtitle="Review and fulfill incoming purchase orders"
            />

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-secondary)' }} size={18} />
                    <input
                        type="text"
                        placeholder="Search by order ID or buyer..."
                        style={{
                            width: '100%', padding: '10px 10px 10px 40px',
                            borderRadius: '10px', border: '1px solid var(--border-subtle)',
                            fontSize: '14px'
                        }}
                    />
                </div>
                <button style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                    borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'white',
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer'
                }}>
                    <Filter size={18} /> Filter
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {orders.map(order => {
                    const status = getStatusStyles(order.status);
                    const StatusIcon = status.icon;

                    return (
                        <div key={order.id} style={{
                            background: 'white', border: '1px solid var(--border-subtle)',
                            borderRadius: '16px', padding: '16px 20px', display: 'flex',
                            alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)'
                                }}>
                                    <ClipboardList size={24} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{order.buyerName}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>
                                        {order.id} • {new Date(order.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>${order.total.toFixed(2)}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>
                                        {order.items} items
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 12px', borderRadius: '20px',
                                    background: status.bg, color: status.fg,
                                    fontSize: '12px', fontWeight: 600
                                }}>
                                    <StatusIcon size={14} />
                                    {status.label}
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={{
                                        padding: '6px 12px', borderRadius: '8px', border: 'none',
                                        background: '#10b981', color: 'white', fontWeight: 600,
                                        fontSize: '12px', cursor: 'pointer'
                                    }}>Accept</button>
                                    <ChevronRight size={18} color="var(--fg-secondary)" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ModuleShell>
    );
};
