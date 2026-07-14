import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, Check, ClipboardList, FileText, LockKeyhole, MessageCircle, RefreshCw, Send, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { restaurantApi, type RestaurantQChatMessage, type RestaurantQConversation, type RestaurantQDraft, type RestaurantQPulse, type RestaurantQUsage } from '@/api/restaurant.api';

const suggestedQuestions = ['What needs attention right now?', 'Which orders are delayed?', 'Which payments are still open?', 'What bookings are upcoming?', 'Which stock needs attention?', 'Summarize today\'s sales.'];

export const AssistantView = () => {
    const location = useLocation();
    const [pulse, setPulse] = useState<RestaurantQPulse | null>(null);
    const [drafts, setDrafts] = useState<RestaurantQDraft[]>([]);
    const [usage, setUsage] = useState<RestaurantQUsage | null>(null);
    const [conversations, setConversations] = useState<RestaurantQConversation[]>([]);
    const [messages, setMessages] = useState<RestaurantQChatMessage[]>([]);
    const [activeConversation, setActiveConversation] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'pulse' | 'chat'>(() => new URLSearchParams(location.search).get('tab') === 'chat' ? 'chat' : 'pulse');
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [pulseResult, draftResult, usageResult, conversationsResult] = await Promise.all([
                restaurantApi.getBusinessPulse(), restaurantApi.getQDrafts(), restaurantApi.getQUsage().catch(() => null), restaurantApi.getQConversations(),
            ]);
            setPulse(pulseResult); setDrafts(draftResult.drafts); setUsage(usageResult); setConversations(conversationsResult.conversations); setError('');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Q could not read the latest Restaurant records.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        if (new URLSearchParams(location.search).get('tab') === 'chat') setActiveTab('chat');
    }, [location.search]);

    const askPulse = async (question: string) => {
        const value = question.trim(); if (!value) return;
        setBusy('pulse'); setNotice('');
        try { setPulse(await restaurantApi.askBusinessPulse(value)); setPrompt(''); setError(''); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Q could not answer that question.'); }
        finally { setBusy(''); }
    };

    const openConversation = async (id: string) => {
        setBusy('conversation');
        try { const result = await restaurantApi.getQConversation(id); setActiveConversation(id); setMessages(result.messages); setError(''); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Q could not open this conversation.'); }
        finally { setBusy(''); }
    };

    const sendChat = async (question: string) => {
        const value = question.trim(); if (!value) return;
        setBusy('chat'); setNotice('');
        try {
            if (activeConversation) {
                const result = await restaurantApi.sendQMessage(activeConversation, value);
                setMessages(current => [...current, ...result.messages]);
                setConversations(current => current.map(item => item.id === activeConversation ? { ...item, updatedAt: new Date().toISOString() } : item).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
            } else {
                const result = await restaurantApi.createQConversation(value);
                setActiveConversation(result.conversation.id); setMessages(result.messages); setConversations(current => [result.conversation, ...current]);
            }
            setPrompt(''); setError('');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Q could not answer that question.'); }
        finally { setBusy(''); }
    };

    const rateMessage = async (message: RestaurantQChatMessage, feedback: 'helpful' | 'not_helpful') => {
        setBusy(`feedback-${message.id}`);
        try {
            const result = await restaurantApi.giveQMessageFeedback(message.id, feedback);
            setMessages(current => current.map(item => item.id === message.id ? result.message : item));
            setNotice('Thank you. This feedback is private to your business and helps improve Q.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Feedback could not be saved.'); }
        finally { setBusy(''); }
    };

    const createDraft = async (type: RestaurantQDraft['type']) => {
        setBusy(type); setNotice('');
        try { const result = await restaurantApi.createQDraft(type); setDrafts(current => [result.draft, ...current]); setNotice('Draft prepared for review. Nothing was sent or changed.'); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Q could not prepare the draft.'); }
        finally { setBusy(''); }
    };

    const decide = async (draft: RestaurantQDraft, decision: 'approve' | 'reject') => {
        setBusy(`${decision}-${draft.id}`); setNotice('');
        try { const result = await restaurantApi.decideQDraft(draft.id, { decision }); setDrafts(current => current.map(item => item.id === draft.id ? result.draft : item)); setNotice(result.message); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'The draft decision could not be recorded.'); }
        finally { setBusy(''); }
    };

    return <div className="q-assistant">
        <header className="q-hero"><div className="q-mark"><Bot size={28} /></div><div><span><Sparkles size={13} /> Q ASSISTANT</span><h1>Your calm restaurant co-founder.</h1><p>Q reads only this business&apos;s saved records, gives evidence-backed guidance, and asks for approval before any future action.</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button></header>
        <section className="q-safety"><LockKeyhole size={20} /><div><strong>Advice first. Your team stays in control.</strong><p>Q can explain, recommend and prepare drafts. It cannot move money, alter orders, change stock, edit staff access, send messages or delete data.</p></div></section>
        {error && <div className="q-alert error"><AlertTriangle size={17} />{error}<button type="button" onClick={() => setError('')}><X size={15} /></button></div>}
        {notice && <div className="q-alert success"><Check size={17} />{notice}<button type="button" onClick={() => setNotice('')}><X size={15} /></button></div>}
        <nav className="q-tabs"><button className={activeTab === 'pulse' ? 'active' : ''} type="button" onClick={() => setActiveTab('pulse')}><Sparkles size={16} /> Business Pulse</button><button className={activeTab === 'chat' ? 'active' : ''} type="button" onClick={() => setActiveTab('chat')}><MessageCircle size={16} /> Chat with Q</button></nav>

        {activeTab === 'chat' ? <section className="q-chat-shell">
            <aside className="q-chat-list"><div><b>Conversations</b><button type="button" onClick={() => { setActiveConversation(null); setMessages([]); setPrompt(''); }}>New chat</button></div>{conversations.length === 0 ? <p>Start a conversation with Q.</p> : conversations.map(conversation => <button type="button" className={activeConversation === conversation.id ? 'selected' : ''} key={conversation.id} onClick={() => void openConversation(conversation.id)}><b>{conversation.title}</b><small>{new Date(conversation.updatedAt).toLocaleDateString()}</small></button>)}</aside>
            <div className="q-chat-main"><header><div><small>Q · PRIVATE BUSINESS ADVISOR</small><h2>{activeConversation ? 'Continue the conversation' : 'How can I help today?'}</h2><p>Q answers from your restaurant&apos;s saved records. Model cost is currently $0 while rules-only chat is active.</p></div></header>
                <div className="q-messages">{messages.length === 0 ? <div className="q-chat-empty"><Bot size={30} /><h3>Ask Q like a co-founder.</h3><p>Try a quick question, or ask in your own words. Q will show what business records support its answer.</p></div> : messages.map(message => <article className={message.role} key={message.id}><small>{message.role === 'assistant' ? 'Q' : 'YOU'} · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small><p>{message.content}</p>{message.role === 'assistant' && <><div className="q-message-evidence">{message.evidenceCards.slice(0, 3).map(card => <span key={card.id}>{card.label}</span>)}</div><footer><button type="button" aria-label="Helpful" className={message.feedback === 'helpful' ? 'rated' : ''} disabled={busy === `feedback-${message.id}`} onClick={() => void rateMessage(message, 'helpful')}><ThumbsUp size={15} /> Helpful</button><button type="button" aria-label="Not helpful" className={message.feedback === 'not_helpful' ? 'rated' : ''} disabled={busy === `feedback-${message.id}`} onClick={() => void rateMessage(message, 'not_helpful')}><ThumbsDown size={15} /> Improve</button></footer></>}</article>)}</div>
                <div className="q-suggestions">{suggestedQuestions.slice(0, 4).map(question => <button type="button" key={question} disabled={busy === 'chat'} onClick={() => void sendChat(question)}>{question}</button>)}</div>
                <form onSubmit={event => { event.preventDefault(); void sendChat(prompt); }}><input value={prompt} maxLength={500} onChange={event => setPrompt(event.target.value)} placeholder="Ask Q about sales, Kitchen, orders or payments..." /><button type="submit" disabled={!prompt.trim() || busy === 'chat'}><Send size={17} /> Send</button></form>
            </div>
        </section> : <>
            <section className="q-question"><form onSubmit={event => { event.preventDefault(); void askPulse(prompt); }}><input value={prompt} maxLength={300} onChange={event => setPrompt(event.target.value)} placeholder="Ask Q about sales, Kitchen, orders, or payments..." /><button type="submit" disabled={!prompt.trim() || busy === 'pulse'}><Send size={17} /> Ask Q</button></form><div>{suggestedQuestions.map(question => <button type="button" key={question} onClick={() => void askPulse(question)} disabled={busy === 'pulse'}>{question}</button>)}</div></section>
            {loading ? <div className="q-loading">Q is building a tenant-safe Restaurant Pulse...</div> : pulse && <><section className="q-usage"><div><small>THIS MONTH</small><b>{usage?.requests ?? 0}</b><span>Q requests</span></div><div><small>COMPLETED</small><b>{usage?.completed ?? 0}</b><span>safe responses</span></div><div><small>MODEL COST</small><b>${usage?.estimatedCostUsd.toFixed(2) ?? '0.00'}</b><span>rules-only Q is currently $0</span></div></section><section className="q-answer"><small>Q&apos;S ANSWER</small><h2>{pulse.summary}</h2><p>Updated {new Date(pulse.generatedAt).toLocaleString()}</p></section><div className="q-grid">{pulse.insights.map(insight => <article className={insight.severity} key={insight.id}><span>{insight.severity}</span><h3>{insight.title}</h3><p>{insight.recommendation}</p><small>{insight.evidenceIds.length} evidence reference</small></article>)}</div><details className="q-evidence"><summary>View supporting evidence ({pulse.evidenceCards.length})</summary><div>{pulse.evidenceCards.map(card => <article key={card.id}><b>{card.label}</b><span>{card.type.replace('_', ' ')}</span><ul>{card.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></article>)}</div></details></>}
            <section className="q-draft-tools"><div><small>OWNER-REVIEWED DRAFTS</small><h2>Prepare, review, then decide.</h2><p>Q can prepare a daily summary or manager task. Approval does not send it or perform an operational action.</p></div><div><button type="button" onClick={() => void createDraft('daily_report')} disabled={Boolean(busy)}><FileText size={17} /> Daily report draft</button><button type="button" onClick={() => void createDraft('manager_task')} disabled={Boolean(busy)}><ClipboardList size={17} /> Manager task draft</button></div></section><div className="q-drafts">{drafts.length === 0 ? <p>No Q drafts yet.</p> : drafts.map(draft => <article key={draft.id}><header><div><small>{draft.type.replace('_', ' ')}</small><h3>{draft.title}</h3></div><span className={draft.status}>{draft.status}</span></header><pre>{draft.ownerEditedBody || draft.body}</pre><footer><small>{draft.evidenceIds.length} evidence references</small>{draft.status === 'pending' && <div><button type="button" className="reject" disabled={Boolean(busy)} onClick={() => void decide(draft, 'reject')}><X size={15} /> Reject</button><button type="button" className="approve" disabled={Boolean(busy)} onClick={() => void decide(draft, 'approve')}><Check size={15} /> Approve record</button></div>}</footer></article>)}</div>
        </>}
        <style>{`
        .q-assistant{max-width:1200px;margin:auto;padding:clamp(18px,4vw,40px);color:#e5e7eb}.q-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:start;padding:28px;border:1px solid #2c3748;border-radius:22px;background:radial-gradient(circle at 90% 0,#1e3a5f,#101722 50%)}.q-mark{width:58px;height:58px;display:grid;place-items:center;border-radius:17px;background:#e0f2fe;color:#0369a1}.q-hero span,.q-draft-tools small,.q-answer small,.q-chat-main header small{display:flex;align-items:center;gap:6px;color:#7dd3fc;font-size:11px;font-weight:900;letter-spacing:.08em}.q-hero h1{margin:8px 0;color:#fff;font-size:clamp(27px,4vw,42px)}.q-hero p{max-width:730px;margin:0;color:#a8b3c3;line-height:1.55}.q-hero button{display:flex;align-items:center;gap:6px;padding:10px 13px;border:1px solid #46556a;border-radius:10px;background:#172033;color:#dbeafe}.q-safety{display:flex;gap:11px;margin:16px 0;padding:15px;border:1px solid #365268;border-radius:13px;background:#0c2232;color:#bae6fd}.q-safety p{margin:4px 0 0;color:#94a3b8;font-size:12px}.q-alert{display:flex;gap:9px;align-items:center;padding:13px;margin:12px 0;border-radius:11px}.q-alert button{margin-left:auto;border:0;background:transparent;color:inherit}.q-alert.error{background:#3f1519;color:#fecaca}.q-alert.success{background:#0b352a;color:#a7f3d0}.q-tabs{display:flex;gap:8px;margin:18px 0}.q-tabs button{display:flex;gap:7px;align-items:center;padding:10px 14px;border:1px solid #334155;border-radius:10px;background:#111827;color:#cbd5e1;font-weight:800}.q-tabs .active{background:#0b74a7;border-color:#38bdf8;color:white}.q-question{padding:16px;margin:18px 0;border:1px solid #293444;border-radius:16px;background:#0f141d}.q-question form,.q-chat-main form{display:flex;gap:9px}.q-question input,.q-chat-main input{flex:1;min-width:0;padding:13px;border:1px solid #3a485c;border-radius:10px;background:#111827;color:#fff;font-size:15px}.q-question form button,.q-chat-main form button,.q-draft-tools button{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border:0;border-radius:10px;background:#0284c7;color:#fff;font-weight:800}.q-question>div,.q-suggestions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.q-question>div button,.q-suggestions button{padding:8px 10px;border:1px solid #334155;border-radius:99px;background:#172033;color:#cbd5e1}.q-loading,.q-answer{padding:28px;border:1px solid #293444;border-radius:16px;background:#111827}.q-answer h2{margin:8px 0;color:#fff;font-size:clamp(21px,3vw,30px)}.q-answer p{margin:0;color:#64748b;font-size:12px}.q-usage{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:13px}.q-usage>div{padding:14px;border:1px solid #293444;border-radius:13px;background:#101722}.q-usage small,.q-usage span{display:block;color:#94a3b8;font-size:11px}.q-usage b{display:block;margin:5px 0;color:#e0f2fe;font-size:25px}.q-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:13px 0}.q-grid article{padding:18px;border:1px solid #293444;border-radius:14px;background:#111827}.q-grid article>span{font-size:10px;font-weight:900;text-transform:uppercase}.q-grid article.info>span{color:#7dd3fc}.q-grid article.attention>span{color:#fbbf24}.q-grid article.urgent>span{color:#fca5a5}.q-grid h3{margin:8px 0;color:#fff}.q-grid p{color:#a8b3c3;font-size:13px}.q-grid small{color:#64748b}.q-evidence{margin:14px 0;padding:16px;border:1px solid #293444;border-radius:14px;background:#0f141d}.q-evidence summary{cursor:pointer;font-weight:800}.q-evidence>div{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:13px}.q-evidence article{padding:13px;border-radius:10px;background:#111827}.q-evidence article>span{float:right;color:#7dd3fc;font-size:10px;text-transform:uppercase}.q-evidence ul{padding-left:18px;color:#a8b3c3;font-size:12px}.q-draft-tools{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-top:24px;padding:20px;border:1px solid #293444;border-radius:16px;background:#111827}.q-draft-tools h2{margin:5px 0}.q-draft-tools p{margin:0;color:#94a3b8;font-size:13px}.q-draft-tools>div:last-child{display:flex;gap:8px}.q-drafts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.q-drafts>p{color:#94a3b8}.q-drafts>article{padding:17px;border:1px solid #293444;border-radius:14px;background:#111827}.q-drafts header,.q-drafts footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.q-drafts h3{margin:4px 0}.q-drafts header small{color:#7dd3fc;text-transform:uppercase}.q-drafts header>span{padding:5px 8px;border-radius:99px;font-size:10px;text-transform:uppercase}.q-drafts .pending{background:#422006;color:#fde68a}.q-drafts .approved{background:#052e24;color:#a7f3d0}.q-drafts .rejected{background:#3f1519;color:#fecaca}.q-drafts pre{min-height:110px;white-space:pre-wrap;font:inherit;color:#cbd5e1;line-height:1.55}.q-drafts footer small{color:#64748b}.q-drafts footer>div{display:flex;gap:7px}.q-drafts footer button{display:flex;align-items:center;gap:5px;padding:8px 10px;border-radius:8px;font-weight:800}.q-drafts .reject{border:1px solid #7f1d1d;background:transparent;color:#fca5a5}.q-drafts .approve{border:0;background:#047857;color:#fff}.q-chat-shell{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:580px;border:1px solid #293444;border-radius:16px;overflow:hidden;background:#101722}.q-chat-list{padding:12px;border-right:1px solid #293444;background:#0f141d}.q-chat-list>div{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.q-chat-list>div button{padding:6px 9px;border:1px solid #3d4b5f;border-radius:7px;background:#172033;color:#bae6fd;font-weight:800}.q-chat-list>p{font-size:13px;color:#64748b}.q-chat-list>button{display:block;width:100%;padding:10px;margin:5px 0;border:0;border-radius:9px;background:transparent;color:#cbd5e1;text-align:left}.q-chat-list>button:hover,.q-chat-list>button.selected{background:#1c2b42}.q-chat-list small{display:block;margin-top:3px;color:#64748b}.q-chat-main{display:flex;flex-direction:column;padding:22px}.q-chat-main header h2{margin:4px 0;color:white}.q-chat-main header p{margin:0;color:#94a3b8;font-size:13px}.q-messages{flex:1;min-height:310px;margin:18px 0}.q-chat-empty{text-align:center;max-width:460px;margin:70px auto;color:#94a3b8}.q-chat-empty svg{color:#7dd3fc}.q-chat-empty h3{color:white}.q-messages article{max-width:84%;padding:13px;margin:10px 0;border-radius:13px;background:#172033}.q-messages article.user{margin-left:auto;background:#075985}.q-messages article small{color:#93c5fd;font-weight:800;font-size:10px}.q-messages article p{margin:7px 0;line-height:1.5}.q-message-evidence{display:flex;flex-wrap:wrap;gap:5px}.q-message-evidence span{padding:4px 6px;border-radius:999px;background:#0f2942;color:#bae6fd;font-size:11px}.q-messages footer{display:flex;gap:6px;margin-top:10px}.q-messages footer button{display:flex;align-items:center;gap:4px;padding:5px 7px;border:1px solid #3a485c;border-radius:7px;background:transparent;color:#94a3b8;font-size:11px}.q-messages footer .rated{border-color:#38bdf8;color:#e0f2fe}button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:760px){.q-hero{grid-template-columns:auto 1fr}.q-hero>button{grid-column:1/-1}.q-question form,.q-draft-tools,.q-draft-tools>div:last-child,.q-chat-main form{align-items:stretch;flex-direction:column}.q-grid,.q-evidence>div,.q-drafts,.q-usage{grid-template-columns:1fr}.q-drafts footer{align-items:flex-start;flex-direction:column}.q-chat-shell{grid-template-columns:1fr}.q-chat-list{border-right:0;border-bottom:1px solid #293444;max-height:180px;overflow:auto}.q-chat-main{padding:15px}.q-messages article{max-width:95%}}
        `}</style>
    </div>;
};
