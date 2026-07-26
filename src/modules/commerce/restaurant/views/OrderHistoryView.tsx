import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Printer, RefreshCw, Search, XCircle } from 'lucide-react';
import { Alert, Badge, Card, type BadgeVariant } from '@/components/design-system';
import { businessApi, type BusinessProfile } from '@/api/business.api';
import { restaurantApi, type RestaurantOrder, type RestaurantTable } from '@/api/restaurant.api';
import { printRestaurantInvoice } from '@/modules/commerce/restaurant/utils/printRestaurantInvoice';

type Filter = 'all' | 'open' | 'paid' | 'cancelled';
const formatMoney = (cents: number) => '$' + (cents / 100).toFixed(2);
const orderStatusVariant = (status: string): BadgeVariant => {
    if (status === 'cancelled') return 'danger';
    if (status === 'closed' || status === 'paid') return 'success';
    if (status === 'ready') return 'info';
    return 'default';
};

export const OrderHistoryView = () => {
    const [orders, setOrders] = useState<RestaurantOrder[]>([]);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [business, setBusiness] = useState<BusinessProfile | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [orderRows, tableRows, profile] = await Promise.all([
                restaurantApi.getOrders(),
                restaurantApi.getTables(),
                businessApi.getProfile().catch(() => null),
            ]);
            setOrders(orderRows);
            setTables(tableRows);
            setBusiness(profile);
            setError('');
        } catch {
            setError('Unable to load order history.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const visible = useMemo(() => orders.filter((order) => {
        if (filter === 'open' && (order.paymentStatus === 'paid' || order.status === 'cancelled')) return false;
        if (filter === 'paid' && order.paymentStatus !== 'paid') return false;
        if (filter === 'cancelled' && order.status !== 'cancelled') return false;
        const table = tables.find((item) => item.id === order.tableId)?.label || (order.orderType === 'delivery' ? 'Delivery' : 'Takeaway');
        return [order.displayOrderNumber, table, order.customerName || '', order.customerPhone || '', order.status, order.paymentStatus]
            .join(' ')
            .toLowerCase()
            .includes(query.trim().toLowerCase());
    }), [filter, orders, query, tables]);

    const paidTotal = visible.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0);

    return <div className="order-history">
        <header>
            <div><span>RESTAURANT RECORDS</span><h1>Order history</h1><p>Completed and open records are shown here. Print a European-format invoice after payment.</p></div>
            <button type="button" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button>
        </header>
        {error && <Alert variant="error" className="history-error">{error}</Alert>}
        <div className="history-summary">
            <div><small>Orders shown</small><strong>{visible.length}</strong></div>
            <div><small>Paid revenue shown</small><strong>{formatMoney(paidTotal)}</strong></div>
            <div><small>Open payments</small><strong>{visible.filter((order) => order.paymentStatus === 'unpaid' && order.status !== 'cancelled').length}</strong></div>
        </div>
        <div className="history-tools">
            <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, table or status" /></label>
            <div>{(['all', 'open', 'paid', 'cancelled'] as const).map((value) => <button type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div>
        </div>
        <Card className="history-table q-table"><table><thead><tr><th>Order</th><th>Service</th><th>Date & time</th><th>Items</th><th>Total</th><th>Service status</th><th>Payment record</th><th>Document</th></tr></thead><tbody>
            {visible.map((order) => {
                const payment = order.payments?.find((item) => item.status === 'completed');
                const table = tables.find((item) => item.id === order.tableId);
                const service = order.orderType === 'delivery' ? 'Delivery' : order.orderType === 'takeaway' ? 'Takeaway' : table?.label || 'Dine-in';
                const deliveryContact = [order.customerName, order.customerPhone].filter(Boolean).join(' · ');
                return <tr key={order.id}>
                    <td><strong>{order.displayOrderNumber}</strong><small>{order.id.slice(0, 8)}</small></td>
                    <td>{service}{order.orderType === 'delivery' && <small>{deliveryContact}<br />{order.deliveryAddress}{order.deliveryNotes && <><br />Note: {order.deliveryNotes}</>}</small>}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString('en-GB')}<small>{new Date(order.createdAt).toLocaleTimeString()}</small></td>
                    <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td><strong>{formatMoney(order.total)}</strong></td>
                    <td><Badge variant={orderStatusVariant(order.status)}>{order.status.replace('_', ' ')}</Badge>{order.cancellationReason && <small>{order.cancellationReason}</small>}</td>
                    <td>{payment ? <div className="payment paid"><CheckCircle2 size={15} /><span><strong>Paid · {payment.method}</strong><small>{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : ''}</small></span></div> : order.status === 'cancelled' ? <div className="payment cancelled"><XCircle size={15} /><span><strong>Cancelled</strong><small>No payment due</small></span></div> : <div className="payment open"><Clock3 size={15} /><span><strong>Open</strong><small>Complete in POS / Cashier</small></span></div>}</td>
                    <td><button className="print-order" type="button" disabled={order.status === 'cancelled'} onClick={() => printRestaurantInvoice(order, business, table)}><Printer size={15} />{payment ? 'Print invoice' : 'Print order'}</button></td>
                </tr>;
            })}
            {!loading && !visible.length && <tr><td colSpan={8} className="history-empty">No orders match this view.</td></tr>}
            {loading && <tr><td colSpan={8} className="history-empty">Loading order history…</td></tr>}
        </tbody></table></Card>
        <style>{`
        .order-history{max-width:1400px;margin:auto;padding:clamp(18px,3vw,34px);color:#e5e7eb}.order-history>header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.order-history header span{color:#fb923c;font-size:11px;font-weight:900;letter-spacing:.1em}.order-history h1{margin:6px 0;font-size:clamp(28px,4vw,40px);color:#fff}.order-history header p{margin:0;color:#94a3b8}.order-history header button,.print-order{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:1px solid #334155;border-radius:10px;background:#111827;color:#e2e8f0;font-weight:800}.print-order{padding:8px 10px;background:#fff;color:#334155;border-color:#cbd5e1;white-space:nowrap}.print-order:disabled{opacity:.45;cursor:not-allowed}.history-error{margin-bottom:15px}.history-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.history-summary>div{padding:16px;border:1px solid #283446;border-radius:14px;background:#111827}.history-summary small{display:block;color:#94a3b8}.history-summary strong{display:block;margin-top:6px;color:#fff;font-size:23px}.history-tools{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.history-tools label{min-width:280px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #334155;border-radius:10px;background:#111827;color:#94a3b8}.history-tools input{width:100%;height:42px;border:0;outline:0;background:transparent;color:#fff}.history-tools>div{display:flex;gap:6px}.history-tools button{padding:8px 13px;border:1px solid #334155;border-radius:999px;background:#111827;color:#94a3b8;text-transform:capitalize}.history-tools button.active{border-color:#f97316;background:#431407;color:#fdba74}.history-table table{min-width:1120px}.history-table td>small,.history-table td>strong+small,.payment small{display:block;margin-top:3px;color:#94a3b8;font-size:10px}.payment{display:flex;gap:7px;align-items:flex-start}.payment.paid{color:#166534}.payment.open{color:#9a3412}.payment.cancelled{color:#991b1b}.history-empty{padding:44px!important;text-align:center;color:#64748b}@media(max-width:720px){.history-summary{grid-template-columns:1fr}.history-tools,.order-history>header{flex-direction:column}.history-tools label{width:100%;min-width:0}.history-tools>div{overflow:auto;width:100%}}
        `}</style>
    </div>;
};
