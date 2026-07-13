import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, Check, ClipboardList, FileText, LockKeyhole, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { restaurantApi, type RestaurantQDraft, type RestaurantQPulse } from '@/api/restaurant.api';

const suggestedQuestions = [
    'What needs attention right now?',
    'Which orders are delayed?',
    'Which payments are still open?',
    'What sold best today?',
    'Summarize today\'s sales.',
];

export const AssistantView = () => {
    const [pulse, setPulse] = useState<RestaurantQPulse | null>(null);
    const [drafts, setDrafts] = useState<RestaurantQDraft[]>([]);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [pulseResult, draftResult] = await Promise.all([
                restaurantApi.getBusinessPulse(),
                restaurantApi.getQDrafts(),
            ]);
            setPulse(pulseResult);
            setDrafts(draftResult.drafts);
            setError('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Q could not read the latest Restaurant records.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const ask = async (question: string) => {
        const value = question.trim();
        if (!value) return;
        setBusy('ask'); setNotice('');
        try {
            setPulse(await restaurantApi.askBusinessPulse(value));
            setPrompt(''); setError('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Q could not answer that question.');
        } finally { setBusy(''); }
    };

    const createDraft = async (type: RestaurantQDraft['type']) => {
        setBusy(type); setNotice('');
        try {
            const result = await restaurantApi.createQDraft(type);
            setDrafts(current => [result.draft, ...current]);
            setNotice('Draft prepared for review. Nothing was sent or changed.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Q could not prepare the draft.');
        } finally { setBusy(''); }
    };

    const decide = async (draft: RestaurantQDraft, decision: 'approve' | 'reject') => {
        setBusy(`${decision}-${draft.id}`); setNotice('');
        try {
            const result = await restaurantApi.decideQDraft(draft.id, { decision });
            setDrafts(current => current.map(item => item.id === draft.id ? result.draft : item));
            setNotice(result.message);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'The draft decision could not be recorded.');
        } finally { setBusy(''); }
    };

    return <div className="q-assistant">
        <header className="q-hero">
            <div className="q-mark"><Bot size={28} /></div>
            <div><span><Sparkles size={13} /> Q ASSISTANT · BUSINESS PULSE</span><h1>Your restaurant, explained clearly.</h1><p>Ask Q about current operations. Every answer is built from this business&apos;s saved Restaurant records and includes supporting evidence.</p></div>
            <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        </header>

        <section className="q-safety"><LockKeyhole size={20} /><div><strong>Read-only and approval-first</strong><p>Q cannot change orders, payments, Kitchen, stock, staff access, or send messages. Draft approval only records your decision.</p></div></section>
        {error && <div className="q-alert error"><AlertTriangle size={17} />{error}<button type="button" onClick={() => setError('')}><X size={15} /></button></div>}
        {notice && <div className="q-alert success"><Check size={17} />{notice}<button type="button" onClick={() => setNotice('')}><X size={15} /></button></div>}

        <section className="q-question">
            <form onSubmit={event => { event.preventDefault(); void ask(prompt); }}>
                <input value={prompt} maxLength={300} onChange={event => setPrompt(event.target.value)} placeholder="Ask Q about sales, Kitchen, orders, or payments..." />
                <button type="submit" disabled={!prompt.trim() || busy === 'ask'}><Send size={17} /> Ask Q</button>
            </form>
            <div>{suggestedQuestions.map(question => <button type="button" key={question} onClick={() => void ask(question)} disabled={busy === 'ask'}>{question}</button>)}</div>
        </section>

        {loading ? <div className="q-loading">Q is building a tenant-safe Restaurant Pulse...</div> : pulse && <>
            <section className="q-answer"><small>Q&apos;S ANSWER</small><h2>{pulse.summary}</h2><p>Updated {new Date(pulse.generatedAt).toLocaleString()}</p></section>
            <div className="q-grid">{pulse.insights.map(insight => <article className={insight.severity} key={insight.id}><span>{insight.severity}</span><h3>{insight.title}</h3><p>{insight.recommendation}</p><small>{insight.evidenceIds.length} evidence reference</small></article>)}</div>
            <details className="q-evidence"><summary>View supporting evidence ({pulse.evidenceCards.length})</summary><div>{pulse.evidenceCards.map(card => <article key={card.id}><b>{card.label}</b><span>{card.type.replace('_', ' ')}</span><ul>{card.facts.map(fact => <li key={fact}>{fact}</li>)}</ul><small>Generated {new Date(card.freshness.generatedAt).toLocaleTimeString()}</small></article>)}</div></details>
        </>}

        <section className="q-draft-tools"><div><small>OWNER-REVIEWED DRAFTS</small><h2>Prepare, review, then decide.</h2><p>Q can prepare a daily summary or manager task. Approval does not send it or perform an operational action.</p></div><div><button type="button" onClick={() => void createDraft('daily_report')} disabled={Boolean(busy)}><FileText size={17} /> Daily report draft</button><button type="button" onClick={() => void createDraft('manager_task')} disabled={Boolean(busy)}><ClipboardList size={17} /> Manager task draft</button></div></section>
        <div className="q-drafts">{drafts.length === 0 ? <p>No Q drafts yet.</p> : drafts.map(draft => <article key={draft.id}><header><div><small>{draft.type.replace('_', ' ')}</small><h3>{draft.title}</h3></div><span className={draft.status}>{draft.status}</span></header><pre>{draft.ownerEditedBody || draft.body}</pre><footer><small>{draft.evidenceIds.length} evidence references</small>{draft.status === 'pending' && <div><button type="button" className="reject" disabled={Boolean(busy)} onClick={() => void decide(draft, 'reject')}><X size={15} /> Reject</button><button type="button" className="approve" disabled={Boolean(busy)} onClick={() => void decide(draft, 'approve')}><Check size={15} /> Approve record</button></div>}</footer></article>)}</div>

        <style>{`
        .q-assistant{max-width:1200px;margin:auto;padding:clamp(18px,4vw,40px);color:#e5e7eb}.q-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:start;padding:28px;border:1px solid #2c3748;border-radius:22px;background:radial-gradient(circle at 90% 0,#1e3a5f,#101722 50%)}.q-mark{width:58px;height:58px;display:grid;place-items:center;border-radius:17px;background:#e0f2fe;color:#0369a1}.q-hero span,.q-draft-tools small,.q-answer small{display:flex;align-items:center;gap:6px;color:#7dd3fc;font-size:11px;font-weight:900;letter-spacing:.08em}.q-hero h1{margin:8px 0;color:#fff;font-size:clamp(27px,4vw,42px)}.q-hero p{max-width:730px;margin:0;color:#a8b3c3;line-height:1.55}.q-hero button{display:flex;align-items:center;gap:6px;padding:10px 13px;border:1px solid #46556a;border-radius:10px;background:#172033;color:#dbeafe}.q-safety{display:flex;gap:11px;margin:16px 0;padding:15px;border:1px solid #365268;border-radius:13px;background:#0c2232;color:#bae6fd}.q-safety p{margin:4px 0 0;color:#94a3b8;font-size:12px}.q-alert{display:flex;gap:9px;align-items:center;padding:13px;margin:12px 0;border-radius:11px}.q-alert button{margin-left:auto;border:0;background:transparent;color:inherit}.q-alert.error{background:#3f1519;color:#fecaca}.q-alert.success{background:#0b352a;color:#a7f3d0}.q-question{padding:16px;margin:18px 0;border:1px solid #293444;border-radius:16px;background:#0f141d}.q-question form{display:flex;gap:9px}.q-question input{flex:1;min-width:0;padding:13px;border:1px solid #3a485c;border-radius:10px;background:#111827;color:#fff;font-size:15px}.q-question form button,.q-draft-tools button{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border:0;border-radius:10px;background:#0284c7;color:#fff;font-weight:800}.q-question>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.q-question>div button{padding:8px 10px;border:1px solid #334155;border-radius:99px;background:#172033;color:#cbd5e1}.q-loading,.q-answer{padding:28px;border:1px solid #293444;border-radius:16px;background:#111827}.q-answer h2{margin:8px 0;color:#fff;font-size:clamp(21px,3vw,30px)}.q-answer p{margin:0;color:#64748b;font-size:12px}.q-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:13px 0}.q-grid article{padding:18px;border:1px solid #293444;border-radius:14px;background:#111827}.q-grid article>span{font-size:10px;font-weight:900;text-transform:uppercase}.q-grid article.info>span{color:#7dd3fc}.q-grid article.attention>span{color:#fbbf24}.q-grid article.urgent>span{color:#fca5a5}.q-grid h3{margin:8px 0;color:#fff}.q-grid p{color:#a8b3c3;font-size:13px}.q-grid small{color:#64748b}.q-evidence{margin:14px 0;padding:16px;border:1px solid #293444;border-radius:14px;background:#0f141d}.q-evidence summary{cursor:pointer;font-weight:800}.q-evidence>div{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:13px}.q-evidence article{padding:13px;border-radius:10px;background:#111827}.q-evidence article>span{float:right;color:#7dd3fc;font-size:10px;text-transform:uppercase}.q-evidence ul{padding-left:18px;color:#a8b3c3;font-size:12px}.q-evidence small{color:#64748b}.q-draft-tools{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-top:24px;padding:20px;border:1px solid #293444;border-radius:16px;background:#111827}.q-draft-tools h2{margin:5px 0}.q-draft-tools p{margin:0;color:#94a3b8;font-size:13px}.q-draft-tools>div:last-child{display:flex;gap:8px}.q-drafts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.q-drafts>p{color:#94a3b8}.q-drafts>article{padding:17px;border:1px solid #293444;border-radius:14px;background:#111827}.q-drafts header,.q-drafts footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.q-drafts h3{margin:4px 0}.q-drafts header small{color:#7dd3fc;text-transform:uppercase}.q-drafts header>span{padding:5px 8px;border-radius:99px;font-size:10px;text-transform:uppercase}.q-drafts .pending{background:#422006;color:#fde68a}.q-drafts .approved{background:#052e24;color:#a7f3d0}.q-drafts .rejected{background:#3f1519;color:#fecaca}.q-drafts pre{min-height:110px;white-space:pre-wrap;font:inherit;color:#cbd5e1;line-height:1.55}.q-drafts footer small{color:#64748b}.q-drafts footer>div{display:flex;gap:7px}.q-drafts footer button{display:flex;align-items:center;gap:5px;padding:8px 10px;border-radius:8px;font-weight:800}.q-drafts .reject{border:1px solid #7f1d1d;background:transparent;color:#fca5a5}.q-drafts .approve{border:0;background:#047857;color:#fff}button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:760px){.q-hero{grid-template-columns:auto 1fr}.q-hero>button{grid-column:1/-1}.q-question form,.q-draft-tools,.q-draft-tools>div:last-child{align-items:stretch;flex-direction:column}.q-grid,.q-evidence>div,.q-drafts{grid-template-columns:1fr}.q-drafts footer{align-items:flex-start;flex-direction:column}}
        `}</style>
    </div>;
};
