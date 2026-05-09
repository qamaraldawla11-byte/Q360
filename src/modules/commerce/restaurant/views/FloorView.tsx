import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Users } from 'lucide-react';
import { useRestaurantStore } from '../store/restaurant.store';

export const FloorView = () => {
    const { tables, updateTableStatus } = useRestaurantStore();

    return (
        <ModuleShell fullHeight>
            <PageHeader
                title="Floor Management"
                subtitle="Main Dining Room"
                actions={
                    <button style={{ padding: '8px 16px', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '14px' }}>
                        Edit Layout
                    </button>
                }
            />

            <div style={{
                height: '100%',
                background: '#f8fafc',
                borderRadius: 'var(--radius-lg)',
                border: '2px dashed var(--border-subtle)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '40px',
                    padding: '60px',
                    maxWidth: '1000px',
                    margin: '0 auto'
                }}>
                    {tables.map(table => (
                        <div
                            key={table.id}
                            onClick={() => updateTableStatus(table.id, table.status === 'free' ? 'occupied' : 'free')}
                            style={{
                                width: '120px', height: '120px',
                                background: table.status === 'free' ? 'white' : '#fee2e2',
                                border: `2px solid ${table.status === 'free' ? 'var(--border-subtle)' : '#ef4444'}`,
                                borderRadius: '16px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                position: 'relative'
                            }}
                        >
                            {/* Chairs (Visual Flourish) */}
                            <div style={{ position: 'absolute', top: '-10px', width: '40px', height: '8px', background: '#cbd5e1', borderRadius: '4px' }} />
                            <div style={{ position: 'absolute', bottom: '-10px', width: '40px', height: '8px', background: '#cbd5e1', borderRadius: '4px' }} />

                            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--fg-primary)' }}>{table.number}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '13px', color: 'var(--fg-secondary)' }}>
                                <Users size={14} /> {table.capacity}
                            </div>

                            {table.status === 'occupied' && (
                                <span style={{
                                    marginTop: '8px', fontSize: '11px', fontWeight: 700,
                                    background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '10px'
                                }}>
                                    BUSY
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </ModuleShell>
    );
};
