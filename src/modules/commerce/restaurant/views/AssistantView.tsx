import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Bot, ChefHat, LockKeyhole, RefreshCw, Sparkles } from 'lucide-react';
import { restaurantApi, type RestaurantDashboard, type RestaurantRangeReport } from '@/api/restaurant.api';

const today = () => new Date().toISOString().slice(0, 10);

export const AssistantView = () => {
    const [dashboard, setDashboard] = useState<RestaurantDashboard | null>(null);
    const [report, setReport] = useState<RestaurantRangeReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const load = async () => {
        setLoading(true);
        try {
            const date = today();
            const [dashboardResult, reportResult] = await Promise.all([restaurantApi.getDashboard(), restaurantApi.getRangeReport(date, date)]);
            setDashboard(dashboardResult); setReport(reportResult); setError('');
        } catch { setError('Q could not read the latest restaurant snapshot.'); }
        finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, []);
    const insights = useMemo(() => {
        if (!dashboard || !report) return [];
        return [
            { icon: BarChart3, title: "Today's paid revenue", value: `$${(report.summary.paidRevenueCents / 100).toFixed(2)}`, detail: `${report.summary.paidOrders} paid of ${report.summary.totalOrders} orders` },
            { icon: ChefHat, title: 'Live operations', value: `${dashboard.active_orders_count} active`, detail: `Average preparation time ${dashboard.avg_prep_time_minutes} min` },
            { icon: AlertTriangle, title: 'Payment attention', value: `${report.summary.openOrders} open`, detail: report.summary.openOrders ? 'Review these orders in POS / Cashier.' : 'No open payments in today’s records.' },
        ];
    }, [dashboard, report]);
    return <div className="q-assistant">
        <header><div className="q-mark"><Bot size={28} /></div><div><span><Sparkles size={13} /> Q ASSISTANT · READ-ONLY FOUNDATION</span><h1>Your restaurant, explained clearly.</h1><p>Q can inspect current Restaurant records and highlight what needs attention. It cannot change payments, staff permissions or saved records.</p></div><button type="button" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button></header>
        {error && <div className="q-error">{error}</div>}
        <section className="q-safety"><LockKeyhole size={19} /><div><strong>Safe by design</strong><p>Answers are scoped to this business and the signed-in staff member. Action tools will require explicit confirmation and audit logging in a later phase.</p></div></section>
        <div className="q-grid">{loading ? <div className="q-loading">Q is reading today’s snapshot…</div> : insights.map(row => <article key={row.title}><row.icon size={20} /><small>{row.title}</small><strong>{row.value}</strong><p>{row.detail}</p></article>)}</div>
        <section className="q-next"><h2>Questions Q is being prepared to answer</h2><div>{['What sold best today?', 'Which orders are delayed?', 'What stock should I reorder?', 'Summarize today for the manager.', 'Which payments are still open?', 'Draft a supplier purchase order.'].map((question, index) => <button type="button" disabled key={question}>{question}{index === 5 && <span>Confirmation required</span>}</button>)}</div></section>
        <style>{`
        .q-assistant{max-width:1200px;margin:auto;padding:clamp(20px,4vw,40px);color:#e5e7eb}.q-assistant>header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:start;padding:28px;border:1px solid #2c3748;border-radius:22px;background:radial-gradient(circle at 90% 0,#1e3a5f,#101722 50%)}.q-mark{width:58px;height:58px;display:grid;place-items:center;border-radius:17px;background:#e0f2fe;color:#0369a1}.q-assistant header span{display:flex;align-items:center;gap:6px;color:#7dd3fc;font-size:11px;font-weight:900;letter-spacing:.08em}.q-assistant h1{margin:8px 0;color:#fff;font-size:clamp(27px,4vw,42px)}.q-assistant header p{max-width:730px;margin:0;color:#a8b3c3;line-height:1.55}.q-assistant header button{display:flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid #46556a;border-radius:10px;background:#172033;color:#dbeafe}.q-safety{display:flex;gap:10px;margin:16px 0;padding:15px;border:1px solid #365268;border-radius:13px;background:#0c2232;color:#bae6fd}.q-safety p{margin:4px 0 0;color:#94a3b8;font-size:12px}.q-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.q-grid article{padding:19px;border:1px solid #293444;border-radius:16px;background:#111827}.q-grid article>svg{color:#38bdf8}.q-grid small{display:block;margin:12px 0 5px;color:#94a3b8}.q-grid strong{display:block;color:#fff;font-size:26px}.q-grid p{margin:6px 0 0;color:#a8b3c3;font-size:12px}.q-loading,.q-error{grid-column:1/-1;padding:30px;border-radius:14px;background:#111827;color:#94a3b8}.q-error{margin:15px 0;background:#3f1519;color:#fecaca}.q-next{margin-top:24px;padding:22px;border:1px solid #293444;border-radius:16px;background:#0f141d}.q-next h2{margin-top:0;font-size:18px}.q-next>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.q-next button{display:flex;justify-content:space-between;gap:10px;padding:13px;border:1px solid #334155;border-radius:10px;background:#111827;color:#cbd5e1;text-align:left}.q-next button span{color:#7dd3fc;font-size:10px}@media(max-width:760px){.q-assistant>header{grid-template-columns:auto 1fr}.q-assistant header>button{grid-column:1/-1;width:max-content}.q-grid,.q-next>div{grid-template-columns:1fr}}
        `}</style>
    </div>;
};
