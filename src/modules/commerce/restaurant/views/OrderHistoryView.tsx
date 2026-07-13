import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, Search, XCircle } from 'lucide-react';
import { restaurantApi, type RestaurantOrder, type RestaurantTable } from '@/api/restaurant.api';

type Filter = 'all' | 'open' | 'paid' | 'cancelled';
const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const OrderHistoryView = () => {
    const [orders, setOrders] = useState<RestaurantOrder[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        setLoading(true);
        try { const [orderRows, tableRows] = await Promise.all([restaurantApi.getOrders(), restaurantApi.getTables()]); setOrders(orderRows); setTables(tableRows); setError(''); }
        catch { setError('Unable to load order history.'); } finally { setLoading(false); }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const visible = useMemo(() => orders.filter(order => {
        if (filter === 'open' && (order.paymentStatus === 'paid' || order.status === 'cancelled')) return false;
        if (filter === 'paid' && order.paymentStatus !== 'paid') return false;
        if (filter === 'cancelled' && order.status !== 'cancelled') return false;
        const table = tables.find(item => item.id === order.tableId)?.label || 'Takeaway';
        return `${order.displayOrderNumber} ${table} ${order.status} ${order.paymentStatus}`.toLowerCase().includes(query.trim().toLowerCase());
    }), [filter, orders, query, tables]);
    const paidTotal = visible.filter(order => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0);
    return <div className="order-history">
        <header><div><span>RESTAURANT RECORDS</span><h1>Order history</h1><p>Completed and open records are shown here. Continue service and take payments from POS / Cashier.</p></div><button type="button" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button></header>
        {error && <div className="history-error">{error}</div>}
        <div className="history-summary"><div><small>Orders shown</small><strong>{visible.length}</strong></div><div><small>Paid revenue shown</small><strong>{formatMoney(paidTotal)}</strong></div><div><small>Open payments</small><strong>{visible.filter(order => order.paymentStatus === 'unpaid' && order.status !== 'cancelled').length}</strong></div></div>
        <div className="history-tools"><label><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search order, table or status" /></label><div>{(['all','open','paid','cancelled'] as const).map(value => <button type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div></div>
        <div className="history-table"><table><thead><tr><th>Order</th><th>Service</th><th>Date & time</th><th>Items</th><th>Total</th><th>Service status</th><th>Payment record</th></tr></thead><tbody>
            {visible.map(order => { const payment = order.payments?.find(item => item.status === 'completed'); const table = tables.find(item => item.id === order.tableId)?.label; return <tr key={order.id}><td><strong>{order.displayOrderNumber}</strong><small>{order.id.slice(0,8)}</small></td><td>{order.orderType === 'takeaway' ? 'Takeaway' : table || 'Dine-in'}</td><td>{new Date(order.createdAt).toLocaleDateString()}<small>{new Date(order.createdAt).toLocaleTimeString()}</small></td><td>{order.items.reduce((sum,item) => sum + item.quantity, 0)}</td><td><strong>{formatMoney(order.total)}</strong></td><td><span className={`status status--${order.status}`}>{order.status.replace('_',' ')}</span>{order.cancellationReason && <small>{order.cancellationReason}</small>}</td><td>{payment ? <div className="payment paid"><CheckCircle2 size={15} /><span><strong>Paid · {payment.method}</strong><small>{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : ''}</small></span></div> : order.status === 'cancelled' ? <div className="payment cancelled"><XCircle size={15} /><span><strong>Cancelled</strong><small>No payment due</small></span></div> : <div className="payment open"><Clock3 size={15} /><span><strong>Open</strong><small>Complete in POS / Cashier</small></span></div>}</td></tr>; })}
            {!loading && !visible.length && <tr><td colSpan={7} className="history-empty">No orders match this view.</td></tr>}
            {loading && <tr><td colSpan={7} className="history-empty">Loading order history…</td></tr>}
        </tbody></table></div>
        <style>{`
        .order-history{max-width:1400px;margin:auto;padding:clamp(18px,3vw,34px);color:#e5e7eb}.order-history>header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.order-history header span{color:#fb923c;font-size:11px;font-weight:900;letter-spacing:.1em}.order-history h1{margin:6px 0;font-size:clamp(28px,4vw,40px);color:#fff}.order-history header p{margin:0;color:#94a3b8}.order-history header button{display:flex;align-items:center;gap:7px;padding:10px 14px;border:1px solid #334155;border-radius:10px;background:#111827;color:#e2e8f0}.history-error{margin-bottom:15px;padding:12px;border-radius:10px;background:#fef2f2;color:#b91c1c}.history-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.history-summary>div{padding:16px;border:1px solid #283446;border-radius:14px;background:#111827}.history-summary small{display:block;color:#94a3b8}.history-summary strong{display:block;margin-top:6px;color:#fff;font-size:23px}.history-tools{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.history-tools label{min-width:280px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #334155;border-radius:10px;background:#111827;color:#94a3b8}.history-tools input{width:100%;height:42px;border:0;outline:0;background:transparent;color:#fff}.history-tools>div{display:flex;gap:6px}.history-tools button{padding:8px 13px;border:1px solid #334155;border-radius:999px;background:#111827;color:#94a3b8;text-transform:capitalize}.history-tools button.active{border-color:#f97316;background:#431407;color:#fdba74}.history-table{overflow:auto;border:1px solid #d8dee8;border-radius:16px;background:#fff;color:#0f172a}.history-table table{width:100%;min-width:960px;border-collapse:collapse}.history-table th{padding:13px 15px;background:#f8fafc;color:#475569;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.history-table td{padding:15px;border-top:1px solid #e2e8f0;font-size:13px}.history-table td>small,.history-table td>strong+small,.payment small{display:block;margin-top:3px;color:#94a3b8;font-size:10px}.status{display:inline-flex;padding:4px 8px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:10px;font-weight:900;text-transform:capitalize}.status--cancelled{background:#fee2e2;color:#991b1b}.status--closed,.status--paid{background:#dcfce7;color:#166534}.status--ready{background:#dbeafe;color:#1e40af}.payment{display:flex;gap:7px;align-items:flex-start}.payment.paid{color:#166534}.payment.open{color:#9a3412}.payment.cancelled{color:#991b1b}.history-empty{padding:44px!important;text-align:center;color:#64748b}@media(max-width:720px){.history-summary{grid-template-columns:1fr}.history-tools,.order-history>header{flex-direction:column}.history-tools label{width:100%;min-width:0}.history-tools>div{overflow:auto;width:100%}}
        `}</style>
    </div>;
};
