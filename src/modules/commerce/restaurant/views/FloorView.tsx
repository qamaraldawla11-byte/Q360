import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Loader2, Plus, Users } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    restaurantApi,
    type RestaurantTable,
    type RestaurantTableStatus,
} from '@/api/restaurant.api';

const STATUS_COLORS: Record<RestaurantTableStatus, { background: string; border: string; color: string }> = {
    available: { background: '#dcfce7', border: '#22c55e', color: '#14532d' },
    occupied: { background: '#fee2e2', border: '#ef4444', color: '#7f1d1d' },
    reserved: { background: '#fef3c7', border: '#f59e0b', color: '#78350f' },
    cleaning: { background: '#e2e8f0', border: '#94a3b8', color: '#334155' },
};
const STATUS_CYCLE: RestaurantTableStatus[] = ['available', 'occupied', 'reserved', 'cleaning'];

const fieldStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    font: 'inherit',
};

export const FloorView = () => {
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [label, setLabel] = useState('');
    const [capacity, setCapacity] = useState('4');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    const loadTables = useCallback(async () => {
        setIsLoading(true);
        try {
            setTables(await restaurantApi.getTables());
            setMessage(null);
        } catch {
            setMessage({ kind: 'error', text: 'Unable to load restaurant tables.' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTables();
    }, [loadTables]);

    const createTable = async (event: FormEvent) => {
        event.preventDefault();
        const parsedCapacity = Number(capacity);
        if (!label.trim() || !Number.isSafeInteger(parsedCapacity) || parsedCapacity < 1 || isCreating) {
            setMessage({ kind: 'error', text: 'Add a table label and a whole-number capacity.' });
            return;
        }
        setIsCreating(true);
        try {
            const table = await restaurantApi.createTable({ label: label.trim(), capacity: parsedCapacity });
            setLabel('');
            setCapacity('4');
            await loadTables();
            setMessage({ kind: 'success', text: `${table.label} created.` });
        } catch {
            setMessage({ kind: 'error', text: 'Unable to create that table.' });
        } finally {
            setIsCreating(false);
        }
    };

    const advanceStatus = async (table: RestaurantTable) => {
        const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(table.status) + 1) % STATUS_CYCLE.length];
        setUpdatingId(table.id);
        try {
            const updated = await restaurantApi.updateTableStatus(table.id, nextStatus);
            setTables((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setMessage({ kind: 'success', text: `${table.label} is now ${updated.status}.` });
        } catch {
            setMessage({ kind: 'error', text: `Unable to update ${table.label}.` });
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <ModuleShell fullHeight>
            <PageHeader
                title="Floor Management"
                subtitle="Create simple tables for POS assignment. Advanced layout editing is not enabled."
            />

            <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 24, minHeight: 0 }}>
                <form onSubmit={createTable} style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #d8dee8', borderRadius: 'var(--radius-md)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }}>
                    <strong>New table</strong>
                    <label htmlFor="restaurant-table-label" style={{ fontSize: 13, fontWeight: 700 }}>Label</label>
                    <input
                        id="restaurant-table-label"
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder="T1"
                        style={fieldStyle}
                    />
                    <label htmlFor="restaurant-table-capacity" style={{ fontSize: 13, fontWeight: 700 }}>Capacity</label>
                    <input
                        id="restaurant-table-capacity"
                        type="number"
                        min="1"
                        max="30"
                        step="1"
                        value={capacity}
                        onChange={(event) => setCapacity(event.target.value)}
                        style={fieldStyle}
                    />
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={!label.trim() || isCreating}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !label.trim() || isCreating ? 0.65 : 1 }}
                    >
                        {isCreating ? <Loader2 size={16} /> : <Plus size={16} />} Create Table
                    </button>
                </form>

                <section style={{ minWidth: 0 }}>
                    {message && (
                        <div role="status" style={{ marginBottom: 16, color: message.kind === 'success' ? '#bbf7d0' : '#fecaca', fontWeight: 600 }}>
                            {message.text}
                        </div>
                    )}

                    <div style={{ minHeight: 420, background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '2px dashed #cbd5e1', overflow: 'auto', color: '#0f172a' }}>
                        {isLoading ? (
                            <div style={{ padding: 40, color: '#475569' }}>Loading tables...</div>
                        ) : tables.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
                                No tables yet. Create the first dining table for POS.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 28, padding: 32 }}>
                                {tables.map((table) => {
                                    const colors = STATUS_COLORS[table.status];
                                    return (
                                        <button
                                            type="button"
                                            key={table.id}
                                            onClick={() => advanceStatus(table)}
                                            disabled={updatingId === table.id}
                                            style={{
                                                width: 120,
                                                height: 120,
                                                background: colors.background,
                                                color: colors.color,
                                                border: `2px solid ${colors.border}`,
                                                borderRadius: 16,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: updatingId === table.id ? 'wait' : 'pointer',
                                                boxShadow: '0 4px 6px -1px rgba(15,23,42,0.08)',
                                                position: 'relative',
                                                font: 'inherit',
                                            }}
                                        >
                                            <span style={{ fontSize: 24, fontWeight: 800 }}>{table.label}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 13, fontWeight: 700 }}>
                                                <Users size={14} /> {table.capacity}
                                            </span>
                                            <span style={{ marginTop: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{table.status}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </ModuleShell>
    );
};
