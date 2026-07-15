import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, Send, X } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';

export interface GuestSetup {
    initialRequest: string;
    businessType: string;
    businessName: string;
    country: string;
    services: string[];
    tables?: number;
    employees?: number;
    priorities: string[];
    email: string;
}

type Stage = 'businessType' | 'businessName' | 'country' | 'services' | 'tables' | 'employees' | 'priorities' | 'email' | 'complete';
type Message = { id: number; from: 'q' | 'user'; text: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hospitalityTypes = ['restaurant', 'cafe', 'coffee shop', 'bakery'];

const stageQuestion: Record<Exclude<Stage, 'complete'>, string> = {
    businessType: 'What kind of business do you run? For example: restaurant, café, retail shop, pharmacy, or service business.',
    businessName: 'What is the name of your business?',
    country: 'Which country does the business operate in?',
    services: 'How do you serve customers? Choose or describe dine-in, takeaway, delivery, bookings, or another service.',
    tables: 'How many tables do you have? Enter 0 if you do not offer dine-in.',
    employees: 'How many employees or team members will use the workspace?',
    priorities: 'What would you most like Q360 to improve first?',
    email: 'What email should we use to save this setup and send the secure sign-in code?',
};

const quickReplies: Partial<Record<Stage, string[]>> = {
    businessType: ['Restaurant', 'Café', 'Retail shop', 'Pharmacy', 'Service business'],
    services: ['Dine-in & takeaway', 'Takeaway only', 'Delivery', 'Bookings'],
    priorities: ['Orders & payments', 'Stock & purchasing', 'Team management', 'Customers & delivery', 'Reports & finance'],
};

const faqAnswer = (value: string) => {
    const text = value.toLowerCase();
    if (/price|pricing|cost|plan|quote/.test(text)) return 'Q360 prepares a setup brief first. Final pricing is confirmed only after your country, team size, and required modules are reviewed—so we do not invent a price.';
    if (/secure|security|privacy|data/.test(text)) return 'Your guest answers stay in this browser until you sign in. Workspace data is private to the business, and Q remains approval-first for sensitive actions.';
    if (/manual|touch|without ai|control/.test(text)) return 'Yes. Every normal Q360 screen remains available manually. Q helps and prepares recommendations; it does not replace the touch workflow.';
    if (/booking|reservation|birthday/.test(text)) return 'Q360 supports bookings and reservations, including occasions such as birthdays, table assignment, guest details, date, time, and notes.';
    if (/delivery|customer|crm/.test(text)) return 'Customers and delivery can store names, phone numbers, addresses, notes, and order history, with access limited to the business.';
    if (/qr|menu/.test(text)) return 'The public QR menu can show the business logo, available items, descriptions, and prices without requiring customer sign-in.';
    return null;
};

const isHospitality = (type: string) => hospitalityTypes.some(item => type.toLowerCase().includes(item));

export const GuestQConcierge = ({
    initialPrompt,
    theme,
    onClose,
    onContinue,
}: {
    initialPrompt: string;
    theme: 'light' | 'dark';
    onClose: () => void;
    onContinue: (setup: GuestSetup) => void;
}) => {
    const [stage, setStage] = useState<Stage>('businessType');
    const [input, setInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [setup, setSetup] = useState<GuestSetup>({
        initialRequest: initialPrompt,
        businessType: '',
        businessName: '',
        country: '',
        services: [],
        priorities: [],
        email: '',
    });
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, from: 'user', text: initialPrompt },
        { id: 2, from: 'q', text: `Hello—I'm Q. I can help you plan the right workspace before you create an account. ${stageQuestion.businessType}` },
    ]);
    const messagesEnd = useRef<HTMLDivElement>(null);

    useEffect(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

    const modules = useMemo(() => {
        const result = ['Dashboard', 'Sales', 'Customers', 'Reports', 'Finance', 'Q Assistant'];
        if (isHospitality(setup.businessType)) result.splice(2, 0, 'Menu', 'Kitchen');
        if ((setup.tables || 0) > 0 || setup.services.some(item => /dine/i.test(item))) result.push('Tables & bookings');
        if (setup.services.some(item => /delivery/i.test(item))) result.push('Delivery');
        if ((setup.employees || 0) > 0) result.push('Team');
        if (setup.priorities.some(item => /stock|purchas/i.test(item))) result.push('Stock & purchasing');
        return [...new Set(result)];
    }, [setup]);

    const addQ = (text: string) => setMessages(current => [...current, { id: Date.now() + 1, from: 'q', text }]);

    const moveNext = (current: Stage, nextSetup: GuestSetup) => {
        const sequence: Stage[] = ['businessType', 'businessName', 'country', 'services', 'tables', 'employees', 'priorities', 'email', 'complete'];
        let next = sequence[sequence.indexOf(current) + 1];
        if (next === 'tables' && !isHospitality(nextSetup.businessType)) next = 'employees';
        setStage(next);
        if (next === 'complete') {
            addQ('Your Q360 setup brief is ready. Review the recommended workspace below, then continue securely to save it. No payment is taken now.');
        } else {
            addQ(stageQuestion[next]);
        }
    };

    const submit = (raw: string) => {
        const value = raw.trim();
        if (!value) return;
        setInput('');
        setMessages(current => [...current, { id: Date.now(), from: 'user', text: value }]);

        const faq = faqAnswer(value);
        if (faq && stage !== 'complete') {
            addQ(`${faq} ${stageQuestion[stage as Exclude<Stage, 'complete'>]}`);
            return;
        }

        const next = { ...setup };
        if (stage === 'businessType') next.businessType = value;
        if (stage === 'businessName') next.businessName = value;
        if (stage === 'country') next.country = value;
        if (stage === 'services') next.services = value.split(/,|&| and /i).map(item => item.trim()).filter(Boolean);
        if (stage === 'tables') {
            const count = value.match(/\d+/)?.[0];
            if (!count) return addQ('Please enter the number of tables, such as 4—or enter 0 for no tables.');
            next.tables = Number(count);
        }
        if (stage === 'employees') {
            const count = value.match(/\d+/)?.[0];
            if (!count) return addQ('Please enter the number of employees or team members, such as 3.');
            next.employees = Number(count);
        }
        if (stage === 'priorities') next.priorities = value.split(/,|&| and /i).map(item => item.trim()).filter(Boolean);
        if (stage === 'email') {
            if (!emailPattern.test(value)) return addQ('Please enter a valid business email address so the setup can be saved securely.');
            next.email = value;
        }
        setSetup(next);
        moveNext(stage, next);
    };

    const brief = `Q360 setup brief\nBusiness: ${setup.businessName}\nType: ${setup.businessType}\nCountry: ${setup.country}\nServices: ${setup.services.join(', ')}\nTables: ${setup.tables ?? 'Not applicable'}\nTeam: ${setup.employees ?? 0}\nPriorities: ${setup.priorities.join(', ')}\nRecommended workspace: ${modules.join(', ')}\nPricing: To be confirmed after setup review.`;

    return (
        <div className="guest-q-overlay" data-theme={theme} role="dialog" aria-modal="true" aria-label="Chat with Q">
            <section className="guest-q-dialog">
                <header>
                    <div className="guest-q-title"><span><LogoMark size={25} /></span><div><strong>Q Concierge</strong><small>Plan your workspace before sign-in</small></div></div>
                    <button type="button" onClick={onClose} aria-label="Close Q concierge"><X size={21} /></button>
                </header>
                <div className="guest-q-body">
                    <div className="guest-q-messages">
                        {messages.map(message => <div key={message.id} className={`guest-message ${message.from}`}>{message.text}</div>)}
                        <div ref={messagesEnd} />
                    </div>

                    {stage === 'complete' ? (
                        <aside className="guest-q-brief">
                            <span className="brief-ready"><Check size={15} /> Setup brief ready</span>
                            <h3>{setup.businessName || 'Your business'} workspace</h3>
                            <p>{setup.businessType} · {setup.country} · {setup.employees} team member{setup.employees === 1 ? '' : 's'}</p>
                            <div className="module-list">{modules.map(module => <span key={module}>{module}</span>)}</div>
                            <p className="quotation-note"><strong>Quotation:</strong> exact pricing will be confirmed after the setup is reviewed. No payment is taken at this stage.</p>
                            <div className="brief-actions">
                                <button type="button" className="copy-brief" onClick={async () => { await navigator.clipboard.writeText(brief); setCopied(true); }}><Copy size={15} /> {copied ? 'Copied' : 'Copy brief'}</button>
                                <button type="button" className="continue-brief" onClick={() => onContinue(setup)}>Continue securely <ArrowRight size={16} /></button>
                            </div>
                        </aside>
                    ) : (
                        <>
                            {!!quickReplies[stage]?.length && <div className="guest-q-chips">{quickReplies[stage]!.map(reply => <button type="button" key={reply} onClick={() => submit(reply)}>{reply}</button>)}</div>}
                            <form className="guest-q-composer" onSubmit={event => { event.preventDefault(); submit(input); }}>
                                <input autoFocus value={input} onChange={event => setInput(event.target.value)} placeholder="Reply to Q..." aria-label="Reply to Q" />
                                <button type="submit" aria-label="Send reply"><Send size={18} /></button>
                            </form>
                        </>
                    )}
                </div>
            </section>
            <style>{`
                .guest-q-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.5);backdrop-filter:blur(10px)}
                .guest-q-dialog{width:min(960px,100%);height:min(760px,calc(100vh - 40px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #e2e8f0;border-radius:28px;background:#fff;color:#101827;box-shadow:0 28px 90px rgba(15,23,42,.25)}
                .guest-q-overlay[data-theme=dark] .guest-q-dialog{background:#0b111d;color:#f8fafc;border-color:#263244}
                .guest-q-dialog>header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e2e8f0}.guest-q-overlay[data-theme=dark] header{border-color:#263244}
                .guest-q-title{display:flex;gap:12px;align-items:center}.guest-q-title>span{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#0a0a0a}.guest-q-title div{display:flex;flex-direction:column;gap:3px}.guest-q-title strong{font-size:18px}.guest-q-title small{color:#64748b}
                .guest-q-dialog header button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:12px;background:transparent;color:inherit;cursor:pointer}
                .guest-q-body{display:flex;flex:1;min-height:0;flex-direction:column;padding:24px;background:linear-gradient(145deg,#f8fafc,#fff7ed)}.guest-q-overlay[data-theme=dark] .guest-q-body{background:linear-gradient(145deg,#0b111d,#111827)}
                .guest-q-messages{display:flex;flex:1;min-height:0;overflow:auto;flex-direction:column;gap:12px;padding:3px 4px 18px}.guest-message{max-width:75%;padding:14px 17px;border-radius:18px;line-height:1.55;white-space:pre-wrap}.guest-message.q{align-self:flex-start;background:#fff;border:1px solid #e2e8f0}.guest-message.user{align-self:flex-end;background:#111827;color:#fff}.guest-q-overlay[data-theme=dark] .guest-message.q{background:#172033;border-color:#2b3a52}
                .guest-q-chips{display:flex;gap:8px;overflow:auto;padding:4px 0 12px}.guest-q-chips button{flex:0 0 auto;padding:9px 13px;border:1px solid #cbd5e1;border-radius:999px;background:rgba(255,255,255,.8);color:#334155;cursor:pointer}.guest-q-overlay[data-theme=dark] .guest-q-chips button{background:#172033;color:#e2e8f0;border-color:#334155}
                .guest-q-composer{display:flex;gap:10px;padding:10px;border:1px solid #cbd5e1;border-radius:18px;background:#fff}.guest-q-overlay[data-theme=dark] .guest-q-composer{background:#111827;border-color:#334155}.guest-q-composer input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit;padding:8px}.guest-q-composer button,.continue-brief{display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:13px;background:#111827;color:white;padding:12px 17px;font-weight:700;cursor:pointer}
                .guest-q-brief{margin-top:auto;padding:22px;border:1px solid #fed7aa;border-radius:20px;background:#fff}.guest-q-overlay[data-theme=dark] .guest-q-brief{background:#172033;border-color:#7c2d12}.brief-ready{display:inline-flex;align-items:center;gap:6px;color:#15803d;font-weight:700}.guest-q-brief h3{font-size:24px;margin:12px 0 4px}.guest-q-brief p{margin:6px 0;color:#64748b}.module-list{display:flex;flex-wrap:wrap;gap:7px;margin:16px 0}.module-list span{padding:7px 10px;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:13px;font-weight:700}.quotation-note{padding-top:13px;border-top:1px solid #e2e8f0}.brief-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.copy-brief{display:flex;align-items:center;gap:7px;border:1px solid #cbd5e1;border-radius:13px;background:white;padding:11px 15px;cursor:pointer}.guest-q-overlay[data-theme=dark] .copy-brief{background:#111827;color:white;border-color:#334155}
                @media(max-width:640px){.guest-q-overlay{padding:0}.guest-q-dialog{height:100vh;border-radius:0}.guest-q-body{padding:16px}.guest-message{max-width:88%}.brief-actions{flex-direction:column}.brief-actions button{width:100%}}
            `}</style>
        </div>
    );
};
