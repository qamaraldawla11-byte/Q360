import { useCallback, useEffect, useState } from 'react';
import { Activity, Bot, Building2, CircleDollarSign, RefreshCw, ShieldCheck, Users, Zap } from 'lucide-react';
import { adminApi, type QUsageResponse } from '@/api/admin.api';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 });
const whole = new Intl.NumberFormat('en-US');

const cardStyle = {
    padding: '20px',
    borderRadius: '16px',
    border: '1px solid #273449',
    background: '#111827',
} as const;

const modeLabel = (mode: QUsageResponse['provider']['mode']) => {
    if (mode === 'model_active') return 'Model active';
    if (mode === 'budget_reached') return 'Budget reached · safe fallback active';
    return 'Rules-only mode';
};

export const QUsagePage = () => {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<QUsageResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setData(await adminApi.getQUsage(days));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to load Q usage.');
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { void load(); }, [load]);

    const summaryCards = data ? [
        { label: 'Q requests', value: whole.format(data.summary.requests), icon: Activity },
        { label: 'Real model calls', value: whole.format(data.summary.modelRequests), icon: Bot },
        { label: 'Safe fallbacks', value: whole.format(data.summary.fallbackRequests), icon: ShieldCheck },
        { label: 'Tokens', value: whole.format(data.summary.totalTokens), icon: Zap },
        { label: 'Estimated cost', value: money.format(data.summary.estimatedCostUsd), icon: CircleDollarSign },
        { label: 'Active businesses', value: whole.format(data.summary.activeBusinesses), icon: Building2 },
        { label: 'Active users', value: whole.format(data.summary.activeUsers), icon: Users },
    ] : [];

    return (
        <div style={{ padding: '32px', color: '#f8fafc', minHeight: '100%', background: '#0b1120' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '24px' }}>
                <div>
                    <div style={{ color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, fontSize: '12px' }}>Q control panel</div>
                    <h1 style={{ margin: '8px 0', fontSize: '32px' }}>Usage, cost and safety</h1>
                    <p style={{ margin: 0, color: '#94a3b8', maxWidth: '680px' }}>Track every Q answer, model charge and automatic fallback without exposing the provider key.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <select value={days} onChange={(event) => setDays(Number(event.target.value))} style={{ background: '#111827', color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '10px 14px' }} aria-label="Usage period">
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <button onClick={() => void load()} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #334155', borderRadius: '10px', padding: '10px 14px', background: '#172033', color: '#fff', cursor: 'pointer' }}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {error && <div style={{ ...cardStyle, borderColor: '#7f1d1d', background: '#2b1116', color: '#fecaca', marginBottom: '20px' }}>{error}</div>}
            {loading && !data && <div style={cardStyle}>Loading the Q usage ledger…</div>}

            {data && (
                <>
                    <section style={{ ...cardStyle, marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', borderColor: data.provider.mode === 'budget_reached' ? '#92400e' : '#1d4ed8' }}>
                        <div style={{ width: 46, height: 46, borderRadius: 14, background: '#172554', display: 'grid', placeItems: 'center', color: '#60a5fa' }}><Bot /></div>
                        <div style={{ flex: 1, minWidth: 240 }}>
                            <div style={{ fontWeight: 700 }}>{modeLabel(data.provider.mode)} · {data.provider.model}</div>
                            <div style={{ color: '#94a3b8', marginTop: 5 }}>{data.provider.message}</div>
                        </div>
                        <div style={{ color: '#cbd5e1', textAlign: 'right' }}>
                            <strong>{money.format(data.provider.monthlyBudgetUsd)}</strong><br />monthly budget per business
                        </div>
                    </section>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                        {summaryCards.map(({ label, value, icon: Icon }) => (
                            <div key={label} style={cardStyle}>
                                <Icon size={19} color="#60a5fa" />
                                <div style={{ color: '#94a3b8', margin: '14px 0 6px', fontSize: 13 }}>{label}</div>
                                <div style={{ fontSize: 24, fontWeight: 750 }}>{value}</div>
                            </div>
                        ))}
                    </div>

                    <section style={{ ...cardStyle, marginBottom: '20px', overflowX: 'auto' }}>
                        <h2 style={{ marginTop: 0, fontSize: 20 }}>Business budget health</h2>
                        {data.businesses.length === 0 ? <p style={{ color: '#94a3b8' }}>No Q usage has been recorded in this period.</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                                <thead><tr>{['Business', 'Requests', 'Model / fallback', 'Tokens', 'Period cost', 'Monthly budget'].map((heading) => <th key={heading} style={{ textAlign: 'left', color: '#94a3b8', fontSize: 12, padding: '12px 10px', borderBottom: '1px solid #273449' }}>{heading}</th>)}</tr></thead>
                                <tbody>{data.businesses.map((business) => (
                                    <tr key={business.id}>
                                        <td style={{ padding: '15px 10px', borderBottom: '1px solid #1e293b' }}><strong>{business.name}</strong><div style={{ color: '#64748b', fontSize: 12 }}>{business.providerMode.replaceAll('_', ' ')}</div></td>
                                        <td style={{ padding: '15px 10px', borderBottom: '1px solid #1e293b' }}>{whole.format(business.requests)}</td>
                                        <td style={{ padding: '15px 10px', borderBottom: '1px solid #1e293b' }}>{business.modelRequests} / {business.fallbackRequests}</td>
                                        <td style={{ padding: '15px 10px', borderBottom: '1px solid #1e293b' }}>{whole.format(business.totalTokens)}</td>
                                        <td style={{ padding: '15px 10px', borderBottom: '1px solid #1e293b' }}>{money.format(business.periodCostUsd)}</td>
                                        <td style={{ padding: '15px 10px', borderBottom: '1px solid #1e293b', minWidth: 190 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{money.format(business.monthCostUsd)} used</span><span>{money.format(business.budgetRemainingUsd)} left</span></div>
                                            <div style={{ height: 7, borderRadius: 99, background: '#1e293b', marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, business.monthlyBudgetUsd ? (business.monthCostUsd / business.monthlyBudgetUsd) * 100 : 100)}%`, background: business.providerMode === 'budget_reached' ? '#f59e0b' : '#3b82f6' }} /></div>
                                        </td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        )}
                    </section>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                        <section style={cardStyle}>
                            <h2 style={{ marginTop: 0, fontSize: 20 }}>Most active users</h2>
                            {data.users.length === 0 ? <p style={{ color: '#94a3b8' }}>No user activity yet.</p> : data.users.slice(0, 10).map((user) => (
                                <div key={user.id} style={{ padding: '12px 0', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                                    <div><strong>{user.name}</strong><div style={{ color: '#64748b', fontSize: 12 }}>{user.email}</div></div>
                                    <div style={{ textAlign: 'right' }}>{user.requests} requests<div style={{ color: '#64748b', fontSize: 12 }}>{money.format(user.estimatedCostUsd)}</div></div>
                                </div>
                            ))}
                        </section>
                        <section style={cardStyle}>
                            <h2 style={{ marginTop: 0, fontSize: 20 }}>Fallback reasons</h2>
                            {data.fallbackReasons.length === 0 ? <p style={{ color: '#94a3b8' }}>No fallbacks in this period.</p> : data.fallbackReasons.map((item) => (
                                <div key={item.reason} style={{ padding: '12px 0', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>{item.reason}</span><strong>{item.count}</strong></div>
                            ))}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
};
