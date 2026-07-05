import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import axios from 'axios';
import { restaurantApi, type KdsTicket } from '@/api/restaurant.api';
import {
    createPerformanceCorrelationId,
    logPerformanceTiming,
    performanceDuration,
    performanceMark,
} from '@/utils/performanceInstrumentation';

export const KitchenView = () => {
    const [tickets, setTickets] = useState<KdsTicket[]>([]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const pendingRenderTiming = useRef<{ correlationId: string; fetchEndedAt: number } | null>(null);

    const loadTickets = useCallback(async () => {
        const correlationId = createPerformanceCorrelationId('kds-fetch');
        const fetchStartedAt = performanceMark();
        logPerformanceTiming('restaurant.kitchen.fetch.start', { correlationId });
        try {
            const nextTickets = await restaurantApi.getKds({ correlationId });
            const fetchDurationMs = performanceDuration(fetchStartedAt);
            pendingRenderTiming.current = { correlationId, fetchEndedAt: performanceMark() };
            logPerformanceTiming('restaurant.kitchen.fetch.end', {
                correlationId,
                fetchDurationMs,
                kdsTicketCount: nextTickets.length,
            });
            setTickets(nextTickets);
            setError('');
        } catch {
            setError('Unable to refresh kitchen tickets.');
            logPerformanceTiming('restaurant.kitchen.fetch.end', {
                correlationId,
                fetchDurationMs: performanceDuration(fetchStartedAt),
                failed: true,
            });
        }
    }, []);

    useEffect(() => {
        void loadTickets();
        const interval = window.setInterval(() => void loadTickets(), 5_000);
        return () => window.clearInterval(interval);
    }, [loadTickets]);

    useEffect(() => {
        if (!pendingRenderTiming.current) return;
        const timing = pendingRenderTiming.current;
        pendingRenderTiming.current = null;
        logPerformanceTiming('restaurant.kitchen.state.render.updated', {
            correlationId: timing.correlationId,
            renderUpdateDurationMs: performanceDuration(timing.fetchEndedAt),
            kdsTicketCount: tickets.length,
        });
    }, [tickets]);

    const markDone = async (ticketId: string) => {
        setUpdatingId(ticketId);
        try {
            const updated = await restaurantApi.updateKdsStatus(ticketId, 'done');
            setTickets((current) => current.filter((ticket) => ticket.id !== updated.id));
            setError('');
        } catch (caught) {
            const message = axios.isAxiosError(caught) && typeof caught.response?.data?.error === 'string'
                ? caught.response.data.error
                : 'Unable to mark this ticket as ready. Refresh and try again.';
            setError(message);
            await loadTickets();
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <ModuleShell fullHeight>
            <PageHeader
                title="Kitchen Display System"
                subtitle={`Live Orders: ${tickets.length}`}
                actions={
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--fg-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} /> Late (&gt;20m)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, background: '#eab308', borderRadius: '50%' }} /> Cooking</span>
                    </div>
                }
            />

            {error && <div style={{ marginBottom: 16, color: '#b91c1c' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', overflowX: 'auto', paddingBottom: '24px' }}>
                {tickets.map((ticket) => {
                    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 60_000));
                    const isLate = elapsed > 20;
                    const headerColor = isLate ? '#fee2e2' : ticket.status === 'cooking' ? '#fef3c7' : '#f8fafc';
                    return (
                        <div key={ticket.id} style={{ background: 'white', color: '#0f172a', borderRadius: 'var(--radius-lg)', border: `1px solid ${isLate ? '#ef4444' : 'var(--border-subtle)'}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: headerColor, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 800, fontSize: '16px' }}>{ticket.order?.displayOrderNumber ?? 'Order pending number'}</span>
                                    <span style={{ marginLeft: '8px', fontSize: '13px', color: '#64748b' }}>{ticket.tableLabel || 'Takeaway'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                                    <Clock size={14} /> {elapsed}m
                                </div>
                            </div>

                            <div style={{ padding: '16px', flex: 1, color: '#0f172a' }}>
                                {ticket.order?.items.map((item) => (
                                    <div key={item.id} style={{ marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{ width: '24px', height: '24px', background: '#e2e8f0', color: '#0f172a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                                            {item.quantity}x
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{item.name}</div>
                                            {item.notes && <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>{item.notes}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid var(--border-subtle)' }}>
                                <button
                                    onClick={() => markDone(ticket.id)}
                                    disabled={updatingId === ticket.id}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)', color: 'white', border: 'none', fontWeight: 700, cursor: updatingId === ticket.id ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                >
                                    <CheckCircle2 size={18} /> Mark Ready
                                </button>
                            </div>
                        </div>
                    );
                })}

                {!tickets.length && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--fg-muted)' }}>
                        <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', margin: '0 auto 16px' }} />
                        <h3>All Clean!</h3>
                        <p>No active orders in queue.</p>
                    </div>
                )}
            </div>
        </ModuleShell>
    );
};
