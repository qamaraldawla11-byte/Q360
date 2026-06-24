import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    restaurantApi,
    type RestaurantTable,
    type RestaurantTableStatus,
} from '@/api/restaurant.api';

const STATUS_COLORS: Record<RestaurantTableStatus, { background: string; border: string }> = {
    available: { background: '#dcfce7', border: '#22c55e' },
    occupied: { background: '#fee2e2', border: '#ef4444' },
    reserved: { background: '#fef3c7', border: '#f59e0b' },
    cleaning: { background: '#e2e8f0', border: '#94a3b8' },
};
const STATUS_CYCLE: RestaurantTableStatus[] = ['available', 'occupied', 'reserved', 'cleaning'];

export const FloorView = () => {
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [error, setError] = useState('');

    const loadTables = useCallback(async () => {
        try {
            setTables(await restaurantApi.getTables());
            setError('');
        } catch {
            setError('Unable to load restaurant tables.');
        }
    }, []);

    useEffect(() => {
        const initial = window.setTimeout(() => void loadTables(), 0);
        return () => window.clearTimeout(initial);
    }, [loadTables]);

    const advanceStatus = async (table: RestaurantTable) => {
        const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(table.status) + 1) % STATUS_CYCLE.length];
        try {
            const updated = await restaurantApi.updateTableStatus(table.id, nextStatus);
            setTables((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
        } catch {
            setError(`Unable to update ${table.label}.`);
        }
    };

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
            {error && <div style={{ marginBottom: 16, color: '#b91c1c' }}>{error}</div>}

            <div style={{ height: '100%', background: '#f8fafc', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '40px', padding: '60px', maxWidth: '1000px', margin: '0 auto' }}>
                    {tables.map((table) => {
                        const colors = STATUS_COLORS[table.status];
                        return (
                            <div
                                key={table.id}
                                onClick={() => advanceStatus(table)}
                                style={{
                                    width: '120px', height: '120px', background: colors.background,
                                    border: `2px solid ${colors.border}`, borderRadius: '16px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative',
                                }}
                            >
                                <div style={{ position: 'absolute', top: '-10px', width: '40px', height: '8px', background: '#cbd5e1', borderRadius: '4px' }} />
                                <div style={{ position: 'absolute', bottom: '-10px', width: '40px', height: '8px', background: '#cbd5e1', borderRadius: '4px' }} />
                                <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--fg-primary)' }}>{table.label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '13px', color: 'var(--fg-secondary)' }}>
                                    <Users size={14} /> {table.capacity}
                                </div>
                                <span style={{ marginTop: '8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{table.status}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ModuleShell>
    );
};
