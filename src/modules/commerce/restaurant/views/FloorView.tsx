import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { CalendarDays, Check, Loader2, Plus, Users } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    restaurantApi,
    type RestaurantBooking,
    type RestaurantBookingStatus,
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
const BOOKING_STATUS_OPTIONS: RestaurantBookingStatus[] = ['pending', 'confirmed', 'arrived', 'seated', 'completed', 'cancelled', 'no_show'];

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
    const [bookings, setBookings] = useState<RestaurantBooking[]>([]);
    const [label, setLabel] = useState('');
    const [capacity, setCapacity] = useState('4');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [bookingName, setBookingName] = useState('');
    const [bookingPhone, setBookingPhone] = useState('');
    const [bookingPartySize, setBookingPartySize] = useState('4');
    const [bookingStart, setBookingStart] = useState('');
    const [bookingDuration, setBookingDuration] = useState('120');
    const [bookingTables, setBookingTables] = useState<string[]>([]);
    const [bookingOccasion, setBookingOccasion] = useState('');
    const [bookingNotes, setBookingNotes] = useState('');
    const [bookingDeposit, setBookingDeposit] = useState('');
    const [isBooking, setIsBooking] = useState(false);
    const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    const loadTables = useCallback(async () => {
        setIsLoading(true);
        try {
            const [tableData, bookingData] = await Promise.all([
                restaurantApi.getTables(),
                restaurantApi.getBookings(),
            ]);
            setTables(tableData);
            setBookings(bookingData);
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

    const toggleBookingTable = (tableId: string) => {
        setBookingTables((current) => current.includes(tableId)
            ? current.filter((entry) => entry !== tableId)
            : [...current, tableId]);
    };

    const createBooking = async (event: FormEvent) => {
        event.preventDefault();
        const partySize = Number(bookingPartySize);
        const durationMinutes = Number(bookingDuration);
        const startsAt = bookingStart ? new Date(bookingStart) : null;
        if (!bookingName.trim() || !startsAt || Number.isNaN(startsAt.getTime()) || !Number.isSafeInteger(partySize) || partySize < 1 || !Number.isSafeInteger(durationMinutes) || durationMinutes < 30 || bookingTables.length === 0) {
            setMessage({ kind: 'error', text: 'Add guest name, date and time, party size, duration, and at least one table.' });
            return;
        }
        setIsBooking(true);
        try {
            const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
            const booking = await restaurantApi.createBooking({
                customerName: bookingName.trim(),
                customerPhone: bookingPhone.trim() || undefined,
                partySize,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
                tableIds: bookingTables,
                occasion: bookingOccasion.trim() || undefined,
                notes: bookingNotes.trim() || undefined,
                depositAmount: bookingDeposit ? Number(bookingDeposit) : undefined,
            });
            setBookings((current) => [...current, booking].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
            setBookingName(''); setBookingPhone(''); setBookingPartySize('4'); setBookingTables([]); setBookingOccasion(''); setBookingNotes(''); setBookingDeposit('');
            setMessage({ kind: 'success', text: `Booking for ${booking.customerName} created.` });
        } catch (reason) {
            setMessage({ kind: 'error', text: reason instanceof Error ? reason.message : 'Unable to create booking.' });
        } finally { setIsBooking(false); }
    };

    const updateBookingStatus = async (booking: RestaurantBooking, status: RestaurantBookingStatus) => {
        setUpdatingId(`booking-${booking.id}`);
        try {
            const updated = await restaurantApi.updateBooking(booking.id, { status });
            setBookings((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setMessage({ kind: 'success', text: `${booking.customerName}'s booking is now ${status.replace('_', ' ')}.` });
        } catch (reason) {
            setMessage({ kind: 'error', text: reason instanceof Error ? reason.message : 'Unable to update booking.' });
        } finally { setUpdatingId(null); }
    };

    return (
        <ModuleShell fullHeight>
            <PageHeader
                title="Floor Management"
                subtitle="Manage live tables and future reservations for dine-in service."
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

            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, .75fr)', gap: 24, marginTop: 24 }}>
                <form onSubmit={createBooking} style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #d8dee8', borderRadius: 'var(--radius-md)', padding: 20 }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 16 }}><CalendarDays size={20} color="#ea580c" /><strong style={{ fontSize: 19 }}>New reservation</strong></div>
                    <p style={{ margin: '-8px 0 16px', color: '#64748b', fontSize: 13 }}>Reserve tables for birthdays, meetings, or future dine-in guests.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <input value={bookingName} onChange={(event) => setBookingName(event.target.value)} placeholder="Guest name *" style={fieldStyle} />
                        <input value={bookingPhone} onChange={(event) => setBookingPhone(event.target.value)} placeholder="Phone" style={fieldStyle} />
                        <input type="datetime-local" value={bookingStart} onChange={(event) => setBookingStart(event.target.value)} style={fieldStyle} />
                        <select value={bookingDuration} onChange={(event) => setBookingDuration(event.target.value)} style={fieldStyle}><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option></select>
                        <input type="number" min="1" max="100" value={bookingPartySize} onChange={(event) => setBookingPartySize(event.target.value)} placeholder="Party size" style={fieldStyle} />
                        <input value={bookingOccasion} onChange={(event) => setBookingOccasion(event.target.value)} placeholder="Occasion (e.g. birthday)" style={fieldStyle} />
                    </div>
                    <div style={{ marginTop: 14 }}><strong style={{ fontSize: 13 }}>Reserve tables *</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{tables.map((table) => <button type="button" key={table.id} onClick={() => toggleBookingTable(table.id)} style={{ border: `1px solid ${bookingTables.includes(table.id) ? '#ea580c' : '#cbd5e1'}`, background: bookingTables.includes(table.id) ? '#fff7ed' : '#fff', color: '#0f172a', padding: '9px 11px', borderRadius: 9, fontWeight: 700 }}>{bookingTables.includes(table.id) && <Check size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />}{table.label} · {table.capacity}</button>)}</div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12, marginTop: 14 }}><input value={bookingNotes} onChange={(event) => setBookingNotes(event.target.value)} placeholder="Notes: cake, allergies, decoration..." style={fieldStyle} /><input type="number" min="0" step="0.01" value={bookingDeposit} onChange={(event) => setBookingDeposit(event.target.value)} placeholder="Deposit" style={fieldStyle} /></div>
                    <button type="submit" className="btn-primary" disabled={isBooking} style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, opacity: isBooking ? .65 : 1 }}>{isBooking ? <Loader2 size={16} /> : <CalendarDays size={16} />} Create reservation</button>
                </form>

                <section style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #d8dee8', borderRadius: 'var(--radius-md)', padding: 20, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 19 }}>Upcoming bookings</strong><span style={{ color: '#64748b', fontSize: 13 }}>{bookings.length}</span></div>
                    <div style={{ display: 'grid', gap: 10, marginTop: 14, maxHeight: 360, overflow: 'auto' }}>{bookings.length === 0 ? <p style={{ color: '#64748b' }}>No reservations in the next 14 days.</p> : bookings.map((booking) => <article key={booking.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}><strong>{booking.customerName}</strong><div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{new Date(booking.startsAt).toLocaleString()} · {booking.partySize} guests</div><div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{booking.occasion || 'Dining reservation'} · {booking.tableIds.length} table{booking.tableIds.length === 1 ? '' : 's'}</div><select aria-label={`Status for ${booking.customerName}`} value={booking.status} disabled={updatingId === `booking-${booking.id}`} onChange={(event) => void updateBookingStatus(booking, event.target.value as RestaurantBookingStatus)} style={{ ...fieldStyle, marginTop: 9, padding: '7px 9px', fontSize: 12 }}>{BOOKING_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></article>)}</div>
                </section>
            </section>
        </ModuleShell>
    );
};
