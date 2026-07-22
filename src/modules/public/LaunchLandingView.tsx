import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestQConcierge, type GuestSetup } from './GuestQConcierge';
import { createGuestBrief, currencyForCountry } from '@/api/qGuestBrief.api';
import { ArrowRight, Check, Moon, Sun } from 'lucide-react';

type MomentKind = 'inventory' | 'customer' | 'supplier';

type Moment = {
    id: string;
    kind: MomentKind;
    chapter: string;
    title: string;
    caption: string;
    human: string;
    minutesAgo: number;
    working: string;
    done: string;
};

const MOMENTS: Moment[] = [
    {
        id: 'inventory',
        kind: 'inventory',
        chapter: '02 — Stock',
        title: 'Inventory Ready',
        caption: 'Checked while the lights were off.',
        human: 'Reorder drafts are written — send them when you’re ready.',
        minutesAgo: 33,
        working: 'Q is checking stock…',
        done: 'Stock checked',
    },
    {
        id: 'customer',
        kind: 'customer',
        chapter: '03 — Customer',
        title: 'Customer Waiting',
        caption: 'Drafted in your voice, not a template.',
        human: 'A reply is drafted in your words. Read it, then send.',
        minutesAgo: 26,
        working: 'Q is writing in your words…',
        done: 'Reply drafted',
    },
    {
        id: 'supplier',
        kind: 'supplier',
        chapter: '04 — Supplier',
        title: 'Supplier Follow-up',
        caption: 'Invoice 214, unanswered for four days.',
        human: 'The follow-up is written. Firm, polite, yours.',
        minutesAgo: 19,
        working: 'Q is chasing invoice 214…',
        done: 'Follow-up written',
    },
];

const CHAPTERS = [
    { scene: 'arrival', num: '01', label: 'Arrival' },
    { scene: 'inventory', num: '02', label: 'Stock' },
    { scene: 'customer', num: '03', label: 'Customer' },
    { scene: 'supplier', num: '04', label: 'Supplier' },
    { scene: 'signature', num: '05', label: 'Review' },
    { scene: 'door', num: '06', label: 'Talk to Q' },
] as const;

const daypartOf = (hour: number): 'morning' | 'afternoon' | 'evening' | 'night' =>
    hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 21 ? 'evening' : 'night';

const DAYPART_LABEL = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening shift',
    night: 'Night shift',
} as const;

const GREETINGS = {
    morning: 'Good morning.',
    afternoon: 'Good afternoon.',
    evening: 'Good evening.',
    night: 'Good evening.',
} as const;

const clockOf = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const useReducedMotion = () =>
    useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)[0];

const useInView = <T extends HTMLElement>() => {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setInView(true);
                        observer.disconnect();
                    }
                });
            },
            { threshold: 0.4 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return { ref, inView };
};

const useTypewriter = (text: string, start: boolean, speed = 24) => {
    const reduced = useReducedMotion();
    const [length, setLength] = useState(0);
    useEffect(() => {
        if (!start || reduced || length >= text.length) return;
        const timer = window.setTimeout(() => setLength((current) => current + 1), speed);
        return () => window.clearTimeout(timer);
    }, [start, reduced, length, text, speed]);
    const shown = reduced ? text : text.slice(0, length);
    return { shown, done: reduced || length >= text.length };
};

const useCountUp = (target: number, start: boolean, duration = 900) => {
    const reduced = useReducedMotion();
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start || reduced) return;
        let frame = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1) frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, [start, reduced, target, duration]);
    return reduced ? target : value;
};

const InventoryArtifact = () => {
    const { ref, inView } = useInView<HTMLDivElement>();
    return (
        <div className={'d2-art d2-art-workspace' + (inView ? ' is-live' : '')} ref={ref} aria-hidden="true">
            <span className="d2-art-progress" />
            <div className="d2-art-row">
                <span className="d2-art-key">
                    <span className="d2-pop d2-d1">
                        <Check size={13} />
                    </span>
                    Sourdough flour
                </span>
                <span>fine</span>
            </div>
            <div className="d2-art-row">
                <span className="d2-art-key">
                    <span className="d2-pop d2-d2">
                        <Check size={13} />
                    </span>
                    Oat milk
                </span>
                <span>fine</span>
            </div>
            <div className="d2-art-row d2-art-low">
                <span className="d2-art-key">
                    <span className="d2-art-dot" /> Espresso beans
                </span>
                <span>low</span>
            </div>
            <div className="d2-art-row d2-art-emerge d2-d4">
                <span className="d2-art-key">Reorder draft · Alba Foods</span>
                <span>ready</span>
            </div>
        </div>
    );
};

const CUSTOMER_DRAFT = 'Hi Layla — Friday at 7:30 works. You’re confirmed, and everything will be ready.';

const CustomerArtifact = () => {
    const { ref, inView } = useInView<HTMLDivElement>();
    const { shown, done } = useTypewriter(CUSTOMER_DRAFT, inView);
    return (
        <div className={'d2-art d2-art-workspace' + (inView ? ' is-live' : '')} ref={ref} aria-hidden="true">
            <span className="d2-art-progress" />
            <p className="d2-art-stamp">Draft — in your words</p>
            <p className="d2-art-text d2-art-typed">
                <span className="d2-art-ghost">{CUSTOMER_DRAFT}</span>
                <span className="d2-art-typed-live">
                    {shown}
                    {done ? null : <span className="d2-caret" />}
                </span>
            </p>
        </div>
    );
};

const SupplierArtifact = () => {
    const { ref, inView } = useInView<HTMLDivElement>();
    const total = useCountUp(2340, inView);
    return (
        <div className={'d2-art d2-art-workspace' + (inView ? ' is-live' : '')} ref={ref} aria-hidden="true">
            <span className="d2-art-progress" />
            <div className="d2-art-row">
                <span className="d2-art-key">Invoice 214</span>
                <span>{total.toLocaleString()}</span>
            </div>
            <div className="d2-art-row d2-art-low">
                <span className="d2-art-key">Unanswered</span>
                <span>4 days</span>
            </div>
            <div className="d2-art-row d2-art-emerge d2-d3">
                <span className="d2-art-key">
                    <span className="d2-pop d2-d3">
                        <Check size={13} />
                    </span>
                    Follow-up drafted
                </span>
                <span>ready to send</span>
            </div>
        </div>
    );
};

const MomentArtifact = ({ kind }: { kind: MomentKind }) => {
    if (kind === 'inventory') return <InventoryArtifact />;
    if (kind === 'customer') return <CustomerArtifact />;
    return <SupplierArtifact />;
};

const QStatus = ({ working, done, time }: { working: string; done: string; time: string }) => {
    const { ref, inView } = useInView<HTMLParagraphElement>();
    const reduced = useReducedMotion();
    const [settledByTimer, setSettledByTimer] = useState(false);
    useEffect(() => {
        if (!inView || reduced) return;
        const timer = window.setTimeout(() => setSettledByTimer(true), 2100);
        return () => window.clearTimeout(timer);
    }, [inView, reduced]);
    const settled = settledByTimer || (reduced && inView);
    return (
        <p className={'d2-q-status' + (inView ? ' is-on' : '') + (settled ? ' is-done' : '')} ref={ref} aria-hidden="true">
            <span className="d2-q-dot" />
            {settled ? `${done} · ${time}` : working}
        </p>
    );
};

const BrandMark = ({ size }: { size: number }) => (
    <img
        src="/brand/q360-icon-v2-512.png"
        alt="Q360"
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: Math.round(size * 0.24) }}
    />
);

const Arc = ({ className, d, head }: { className: string; d: string; head: [number, number] }) => (
    <svg className={'d2-arc ' + className} viewBox="0 0 380 200" aria-hidden="true">
        <path d={d} pathLength={100} />
        <circle className="d2-arc-head" cx={head[0]} cy={head[1]} r={4} />
    </svg>
);

const ConciergeCard = ({
    id,
    value,
    onChange,
    onSubmit,
    inputRef,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: (prompt: string) => void;
    inputRef?: React.RefObject<HTMLInputElement | null>;
}) => (
    <form
        className="d2-concierge"
        onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) onSubmit(value.trim());
        }}
    >
        <label className="d2-concierge-label" htmlFor={id}>
            Tell Q about your business
        </label>
        <div className="d2-concierge-row">
            <input
                id={id}
                ref={inputRef}
                className="d2-concierge-input"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Tell Q about your business…"
                aria-label="Tell Q about your business"
            />
            <button className="d2-concierge-send" type="submit" aria-label="Send to Q">
                <ArrowRight size={18} />
            </button>
        </div>
    </form>
);

export const LaunchLandingView = () => {
    const navigate = useNavigate();
    const pageRef = useRef<HTMLDivElement>(null);
    const doorInputRef = useRef<HTMLInputElement>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() =>
        localStorage.getItem('q360-landing-v2-theme') === 'dark' ? 'dark' : 'light',
    );
    const [now] = useState(() => new Date());
    const [scene, setScene] = useState('arrival');
    const [heroPrompt, setHeroPrompt] = useState('');
    const [doorPrompt, setDoorPrompt] = useState('');
    const [guestPrompt, setGuestPrompt] = useState('');
    const [guestChatOpen, setGuestChatOpen] = useState(false);
    const [approved, setApproved] = useState<ReadonlySet<string>>(new Set());
    const [departed, setDeparted] = useState<ReadonlySet<string>>(new Set());
    const [signed, setSigned] = useState(false);
    const continueInFlight = useRef(false);

    const daypart = daypartOf(now.getHours());
    const preparedAt = (minutesAgo: number) => clockOf(new Date(now.getTime() - minutesAgo * 60000));

    useEffect(() => {
        localStorage.setItem('q360-landing-v2-theme', theme);
    }, [theme]);

    useEffect(() => {
        const root = pageRef.current;
        if (!root) return;
        const acts = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'));
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const act = entry.target as HTMLElement;
                    act.classList.add('is-visible');
                    if (act.dataset.scene) setScene(act.dataset.scene);
                    if (act.dataset.scene === 'door' && window.matchMedia('(pointer: fine)').matches) {
                        window.setTimeout(() => doorInputRef.current?.focus({ preventScroll: true }), 700);
                    }
                });
            },
            { threshold: 0.45 },
        );
        acts.forEach((act) => observer.observe(act));
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const root = pageRef.current;
        if (!root) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let frame = 0;
        let sunFrame = 0;
        const sun = { tx: 30, ty: 22, x: 30, y: 22 };
        const move = (event: PointerEvent) => {
            sun.tx = (event.clientX / window.innerWidth) * 100;
            sun.ty = (event.clientY / window.innerHeight) * 100;
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                root.style.setProperty('--lx', `${sun.tx}%`);
                root.style.setProperty('--ly', `${sun.ty}%`);
            });
        };
        window.addEventListener('pointermove', move, { passive: true });
        if (!reduced) {
            const drift = () => {
                const dx = sun.tx - sun.x;
                const dy = sun.ty - sun.y;
                if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) {
                    sun.x += dx * 0.045;
                    sun.y += dy * 0.045;
                    root.style.setProperty('--sunx', `${sun.x}%`);
                    root.style.setProperty('--suny', `${sun.y}%`);
                    root.style.setProperty('--shx', `${((sun.x - 50) * -0.1).toFixed(2)}px`);
                }
                sunFrame = window.requestAnimationFrame(drift);
            };
            sunFrame = window.requestAnimationFrame(drift);
        }
        return () => {
            window.removeEventListener('pointermove', move);
            if (frame) window.cancelAnimationFrame(frame);
            if (sunFrame) window.cancelAnimationFrame(sunFrame);
        };
    }, []);

    useEffect(() => {
        const root = pageRef.current;
        if (!root) return;
        let frame = 0;
        const scroll = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                root.style.setProperty('--sy', `${window.scrollY}px`);
                const max = document.documentElement.scrollHeight - window.innerHeight;
                root.style.setProperty('--sp', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
            });
        };
        window.addEventListener('scroll', scroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', scroll);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);

    const openConcierge = (prompt: string) => {
        setGuestPrompt(prompt);
        setGuestChatOpen(true);
    };

    const handleGuestContinue = async (setup: GuestSetup, modules: string[]) => {
        if (continueInFlight.current) return;
        continueInFlight.current = true;
        try {
            sessionStorage.setItem('q360_guest_setup', JSON.stringify(setup));
            if (setup.businessType === 'restaurant') {
                try {
                    const brief = await createGuestBrief({
                        businessType: setup.businessType,
                        businessName: setup.businessName,
                        country: setup.country,
                        currency: currencyForCountry(setup.country),
                        services: setup.services,
                        tables: setup.tables,
                        priorities: setup.priorities,
                        recommendedModules: modules,
                        initialRequest: setup.initialRequest,
                    });
                    sessionStorage.setItem('q360_guest_brief_token', brief.briefToken);
                } catch {
                    // Brief creation is best-effort: manual onboarding stays the fallback.
                }
            }
            navigate('/login', { state: { guestSetup: setup } });
        } finally {
            continueInFlight.current = false;
        }
    };

    const approveMoment = (id: string) => {
        setApproved((current) => new Set(current).add(id));
        if (id === 'brief') return;
        window.setTimeout(() => {
            setDeparted((current) => new Set(current).add(id));
        }, 900);
    };

    return (
        <div className="d2-page" data-d2-theme={theme} data-scene={scene} ref={pageRef}>
            <div className="d2-grain" aria-hidden="true" />
            <div className="d2-ambient" aria-hidden="true" />
            <div className="d2-progress" aria-hidden="true">
                <span />
            </div>

            <nav className="d2-rail" aria-label="Chapters">
                {CHAPTERS.map((chapter) => (
                    <button
                        key={chapter.scene}
                        type="button"
                        className={'d2-rail-item' + (scene === chapter.scene ? ' is-active' : '')}
                        onClick={() =>
                            document.getElementById(`d2-scene-${chapter.scene}`)?.scrollIntoView({ behavior: 'smooth' })
                        }
                        aria-current={scene === chapter.scene ? 'true' : undefined}
                    >
                        <span className="d2-rail-dot" aria-hidden="true" />
                        <span className="d2-rail-num">{chapter.num}</span>
                        <span className="d2-rail-label">{chapter.label}</span>
                    </button>
                ))}
            </nav>

            <header className="d2-header">
                <button
                    type="button"
                    className="d2-brand"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    aria-label="Q360 — back to top"
                >
                    <span className="d2-brand-chip">
                        <BrandMark size={20} />
                    </span>
                    Q360
                </button>
                <div className="d2-header-actions">
                    <button
                        type="button"
                        className="d2-icon-btn"
                        onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
                        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                    >
                        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    </button>
                    <button type="button" className="d2-signin" onClick={() => navigate('/login')}>
                        Sign in
                    </button>
                </div>
            </header>

            <main>
                <section id="d2-scene-arrival" data-scene="arrival" className="d2-act d2-hero" aria-label="Arrival">
                    <div className="d2-hero-copy">
                        <p className="d2-eyebrow">An AI workspace for operations, customers and decisions</p>
                        <h1 className="d2-headline">
                            Your business
                            <br />
                            is already <em className="d2-accent">prepared.</em>
                        </h1>
                        <p className="d2-support">While you focus on what matters, Q gets everything else ready.</p>
                        <ConciergeCard id="d2-hero-input" value={heroPrompt} onChange={setHeroPrompt} onSubmit={openConcierge} />
                        <button type="button" className="d2-create" onClick={() => navigate('/login')}>
                            Start with Q
                        </button>
                        <div className="d2-hero-chips" aria-hidden="true">
                            <span className="d2-chip">
                                <i />
                                <i />
                                <i className="d2-chip-low" />
                                <b className="d2-chip-tick">
                                    <Check size={9} />
                                </b>
                            </span>
                            <span className="d2-chip">
                                <i />
                                <i />
                                <b className="d2-chip-tick">
                                    <Check size={9} />
                                </b>
                            </span>
                            <span className="d2-chip">
                                <i />
                                <i className="d2-chip-low" />
                                <b className="d2-chip-tick">
                                    <Check size={9} />
                                </b>
                            </span>
                            <span className="d2-chip">
                                <i />
                                <i />
                                <b className="d2-chip-tick">
                                    <Check size={9} />
                                </b>
                            </span>
                            <span className="d2-chip">
                                <svg viewBox="0 0 26 14" aria-hidden="true">
                                    <path d="M1 11 C 6 10, 8 4, 13 6 S 21 11, 25 3" pathLength={100} />
                                </svg>
                                <b className="d2-chip-tick">
                                    <Check size={9} />
                                </b>
                            </span>
                        </div>
                    </div>
                    <div className="d2-hero-desk">
                        <p className="d2-dateline">
                            <span className="d2-dateline-dot" aria-hidden="true" />
                            {`${clockOf(now)} · ${DAYPART_LABEL[daypart]} — Q has been working for you.`}
                        </p>
                        <article className={'d2-doc d2-doc-hero' + (approved.has('brief') ? ' is-approved' : '')}>
                            <span className="d2-pin" aria-hidden="true" />
                            <span className="d2-scan" aria-hidden="true" />
                            <p className="d2-doc-label">The Daily Brief</p>
                            <p className="d2-doc-status">
                                <span className="d2-q-dot" aria-hidden="true" />
                                {`Prepared ${preparedAt(45)} — before you arrived`}
                            </p>
                            <p className="d2-doc-body">
                                {`${GREETINGS[daypart]}\nYesterday closed clean — 47 orders, no loose ends.\nToday: 12 customers expected, one supplier waiting on you.`}
                            </p>
                            <p className="d2-human">Everything else is ready.</p>
                            <p className="d2-doc-note">Prepared by Q. Nothing happens without you.</p>
                            <div className="d2-doc-foot">
                                {approved.has('brief') ? (
                                    <span className="d2-approved-tag">
                                        <Check size={14} /> Approved
                                    </span>
                                ) : (
                                    <button type="button" className="d2-approve" onClick={() => approveMoment('brief')}>
                                        Approve
                                    </button>
                                )}
                            </div>
                        </article>
                        <div className="d2-peek d2-peek-one" aria-hidden="true">
                            <p className="d2-peek-title">Inventory Ready</p>
                            <i />
                            <i />
                            <i className="d2-peek-low" />
                        </div>
                        <div className="d2-peek d2-peek-two" aria-hidden="true">
                            <p className="d2-peek-title">Supplier Follow-up</p>
                            <i />
                            <i className="d2-peek-low" />
                        </div>
                        <Arc className="d2-arc-hero" d="M36 16 C 130 66, 250 92, 344 170" head={[344, 170]} />
                    </div>
                </section>

                {MOMENTS.map((moment, index) => (
                    <section
                        key={moment.id}
                        id={`d2-scene-${moment.id}`}
                        data-scene={moment.id}
                        className={'d2-act d2-moment' + (index % 2 ? ' d2-flip' : '')}
                        aria-label={moment.title}
                    >
                        <div className="d2-moment-caption">
                            <p className="d2-chapter">
                                <span className="d2-chapter-num">{moment.chapter.slice(0, 2)}</span>
                                {moment.chapter.slice(2)}
                            </p>
                            <h2 className="d2-moment-title">{moment.title}</h2>
                            <p className="d2-moment-quiet">{moment.caption}</p>
                        </div>
                        <article
                            className={
                                'd2-doc d2-doc-moment d2-doc--' + moment.kind +
                                (approved.has(moment.id) ? ' is-approved' : '') +
                                (departed.has(moment.id) ? ' is-departed' : '')
                            }
                        >
                            <span className="d2-pin" aria-hidden="true" />
                            <span className="d2-scan" aria-hidden="true" />
                            <p className="d2-doc-label">{moment.title}</p>
                            <QStatus working={moment.working} done={moment.done} time={preparedAt(moment.minutesAgo)} />
                            <MomentArtifact kind={moment.kind} />
                            <p className="d2-human">{moment.human}</p>
                            <p className="d2-doc-note">Prepared by Q. Nothing happens without you.</p>
                            <div className="d2-doc-foot">
                                {approved.has(moment.id) ? (
                                    <span className="d2-approved-tag">
                                        <Check size={14} /> Approved
                                    </span>
                                ) : (
                                    <button type="button" className="d2-approve" onClick={() => approveMoment(moment.id)}>
                                        Approve
                                    </button>
                                )}
                            </div>
                        </article>
                        {departed.has(moment.id) ? <p className="d2-slot-note">Approved — Q will handle it.</p> : null}
                        <Arc
                            className="d2-arc-moment"
                            d={index % 2 ? 'M316 14 C 260 90, 130 100, 56 178' : 'M64 14 C 120 90, 250 100, 324 178'}
                            head={index % 2 ? [56, 178] : [324, 178]}
                        />
                    </section>
                ))}

                <section id="d2-scene-signature" data-scene="signature" className="d2-act d2-signature" aria-label="The signature">
                    <p className="d2-chapter">
                        <span className="d2-chapter-num">05</span> — The Review
                    </p>
                    <article className={'d2-doc d2-doc-review' + (signed ? ' is-approved' : '')}>
                        <span className="d2-pin" aria-hidden="true" />
                        <p className="d2-doc-label">The Daily Review</p>
                        <h2 className="d2-review-title">
                            Q prepares. <em className="d2-accent">You approve.</em>
                        </h2>
                        <p className="d2-doc-body">That will never change.</p>
                        <div className="d2-sign-row">
                            <div>
                                <span className="d2-sign-deboss" aria-hidden="true">
                                    <BrandMark size={22} />
                                </span>
                                <span className="d2-sign-caption">Signed — Q, {preparedAt(3)}</span>
                            </div>
                            <div>
                                {signed ? (
                                    <span className="d2-signed-name">You — just now</span>
                                ) : (
                                    <button type="button" className="d2-sign-line" onClick={() => setSigned(true)}>
                                        Your signature
                                    </button>
                                )}
                                <span className="d2-sign-caption">{signed ? 'Countersigned' : 'Waiting for the owner'}</span>
                            </div>
                        </div>
                    </article>
                    {signed ? <span className="d2-swell" aria-hidden="true" /> : null}
                </section>

                <section id="d2-scene-door" data-scene="door" className="d2-act d2-door" aria-label="A conversation with Q">
                    <p className="d2-chapter">
                        <span className="d2-chapter-num">06</span> — Talk to Q
                    </p>
                    <h2 className="d2-door-title">
                        What business are you <em className="d2-accent">running?</em>
                    </h2>
                    <ConciergeCard
                        id="d2-door-input"
                        value={doorPrompt}
                        onChange={setDoorPrompt}
                        onSubmit={openConcierge}
                        inputRef={doorInputRef}
                    />
                </section>
            </main>

            <footer className="d2-footer">
                <span>(c) 2026 Qamar Technologies Ltd. All rights reserved.</span>
                <button type="button" className="d2-quiet-link" onClick={() => navigate('/support')}>
                    Contact
                </button>
            </footer>

            {approved.size > 0 ? (
                <div className="d2-counter" role="status" aria-label={`${approved.size} prepared documents approved`}>
                    <Check size={13} />
                    Approved · {approved.size}
                </div>
            ) : null}

            {guestChatOpen && (
                <GuestQConcierge
                    initialPrompt={guestPrompt}
                    theme={theme}
                    onClose={() => setGuestChatOpen(false)}
                    onContinue={(setup: GuestSetup, modules: string[]) => {
                        void handleGuestContinue(setup, modules);
                    }}
                />
            )}

            <style>{d2Styles}</style>
        </div>
    );
};

const d2Styles = `
.d2-page{--ease:cubic-bezier(.16,1,.3,1);--orange:#e4572e;--paper-ink:#26211a;--paper-soft:#857a68;--paper-hair:rgba(38,33,26,.13);--r-doc:22px;--r-card:18px;--r-inset:14px;--lx:50%;--ly:36%;--sunx:30%;--suny:22%;--shx:0px;--sy:0px;--sp:0;position:relative;min-height:100dvh;background:var(--bg);color:var(--ink);overflow-x:hidden;transition:background-color .45s ease,color .45s ease;}
.d2-page[data-d2-theme='light']{--bg:#f3ede2;--elev:#faf6ec;--paper:#fdfbf5;--ink:#1c1813;--soft:#7d7364;--hair:rgba(28,24,19,.12);--doc-shadow:inset 0 1px 0 rgba(255,255,255,.7),var(--shx,0px) 18px 42px rgba(96,74,44,.14),var(--shx,0px) 64px 110px rgba(96,74,44,.10);--chip-shadow:0 10px 28px rgba(96,74,44,.15);}
.d2-page[data-d2-theme='dark']{--bg:#12100c;--elev:#1a1611;--paper:#f7f1e5;--ink:#f3efe8;--soft:#a89f92;--hair:rgba(243,239,232,.14);--doc-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 24px 50px rgba(0,0,0,.5),0 80px 140px rgba(0,0,0,.42);--chip-shadow:0 12px 30px rgba(0,0,0,.5);}

.d2-grain{position:fixed;inset:-90px 0;z-index:0;pointer-events:none;opacity:.05;mix-blend-mode:multiply;transform:translateY(calc(var(--sy) * -.04));background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");}
.d2-page[data-d2-theme='dark'] .d2-grain{mix-blend-mode:soft-light;opacity:.14;}
.d2-ambient{position:fixed;inset:0;z-index:0;pointer-events:none;transition:opacity .45s ease;}
.d2-page[data-d2-theme='light'] .d2-ambient{background:radial-gradient(720px 560px at var(--sunx) var(--suny),rgba(255,214,150,.14),transparent 70%),radial-gradient(980px 640px at 10% -10%,rgba(255,214,150,.32),transparent 64%),radial-gradient(130% 100% at 50% 112%,rgba(150,110,60,.09),transparent 60%);}
.d2-page[data-d2-theme='dark'] .d2-ambient{background:radial-gradient(560px 460px at var(--lx) var(--ly),rgba(255,196,130,.11),transparent 70%),radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(0,0,0,.34));}

.d2-progress{display:none;position:fixed;top:0;left:0;right:0;height:2px;z-index:36;background:color-mix(in srgb,var(--soft) 18%,transparent);}
.d2-progress span{display:block;height:100%;width:calc(var(--sp) * 100%);background:var(--orange);transition:width .15s linear;}

.d2-rail{position:fixed;left:clamp(14px,2.4vw,38px);top:50%;transform:translateY(-50%);z-index:30;display:flex;flex-direction:column;gap:18px;}
.d2-rail-item{display:flex;align-items:center;gap:9px;background:none;border:0;padding:0;color:var(--soft);font:inherit;cursor:pointer;}
.d2-rail-dot{width:5px;height:5px;border-radius:50%;background:color-mix(in srgb,var(--soft) 55%,transparent);transition:background-color .25s ease,box-shadow .25s ease;}
.d2-rail-num{font-size:11px;font-weight:800;letter-spacing:.12em;}
.d2-rail-label{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:0;transform:translateX(-4px);transition:opacity .25s ease,transform .25s ease;}
.d2-rail-item:hover .d2-rail-label,.d2-rail-item.is-active .d2-rail-label{opacity:1;transform:none;}
.d2-rail-item.is-active{color:var(--orange);}
.d2-rail-item.is-active .d2-rail-dot{background:var(--orange);box-shadow:0 0 10px rgba(228,87,46,.55);}

.d2-header{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(18px,4vw,44px);color:var(--ink);transition:color .45s ease;}
.d2-brand{display:flex;align-items:center;gap:10px;background:none;border:0;color:inherit;font:inherit;font-weight:800;font-size:16px;letter-spacing:.02em;cursor:pointer;padding:0;}
.d2-brand-chip{display:grid;place-items:center;background:#fdfcf9;border-radius:9px;padding:3px;box-shadow:0 2px 8px rgba(20,18,14,.18);}
.d2-header-actions{display:flex;align-items:center;gap:8px;}
.d2-icon-btn{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;border:1px solid transparent;background:transparent;color:inherit;cursor:pointer;}
.d2-icon-btn:hover{border-color:color-mix(in srgb,currentColor 22%,transparent);}
.d2-signin{border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:transparent;color:inherit;border-radius:999px;padding:9px 18px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;}
.d2-signin:hover{border-color:color-mix(in srgb,currentColor 55%,transparent);}
.d2-icon-btn:focus-visible,.d2-signin:focus-visible,.d2-create:focus-visible,.d2-approve:focus-visible,.d2-sign-line:focus-visible,.d2-concierge-send:focus-visible,.d2-brand:focus-visible,.d2-rail-item:focus-visible,.d2-quiet-link:focus-visible{outline:2px solid color-mix(in srgb,currentColor 45%,transparent);outline-offset:2px;}

.d2-act{position:relative;z-index:1;}

.d2-hero{min-height:100dvh;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:clamp(28px,4vw,72px);align-items:center;max-width:1280px;margin:0 auto;padding:120px clamp(20px,4vw,56px) 80px clamp(88px,9.5vw,150px);}
.d2-hero-copy>*{opacity:0;transform:translateY(24px);}
.d2-act.is-visible .d2-hero-copy>*{animation:d2Rise 1.1s var(--ease) forwards;}
.d2-act.is-visible .d2-hero-copy>*:nth-child(1){animation-delay:.2s;}
.d2-act.is-visible .d2-hero-copy>*:nth-child(2){animation-delay:.38s;}
.d2-act.is-visible .d2-hero-copy>*:nth-child(3){animation-delay:.56s;}
.d2-act.is-visible .d2-hero-copy>*:nth-child(4){animation-delay:.74s;}
.d2-act.is-visible .d2-hero-copy>*:nth-child(5){animation-delay:.92s;}
.d2-eyebrow{margin:0 0 20px;font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--soft);}
.d2-headline{margin:0;font-size:clamp(32px,3.8vw,61px);font-weight:640;letter-spacing:-.025em;line-height:1.07;}
.d2-accent{font-family:Georgia,'Iowan Old Style','Times New Roman',serif;font-style:italic;font-weight:500;color:var(--orange);}
.d2-support{margin:22px 0 34px;font-size:clamp(15px,1.4vw,18px);line-height:1.6;color:var(--soft);max-width:38ch;}

.d2-concierge{width:100%;max-width:440px;background:var(--elev);border:1px solid var(--hair);border-radius:var(--r-card);padding:16px 18px 14px;box-shadow:var(--chip-shadow);transition:background-color .45s ease,border-color .45s ease;}
.d2-concierge-label{display:block;margin:0 0 9px;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--soft);}
.d2-concierge-row{display:flex;align-items:center;gap:10px;}
.d2-concierge-input{flex:1;min-width:0;background:transparent;border:0;border-bottom:1px solid var(--hair);color:inherit;font:inherit;font-size:15.5px;padding:9px 2px;transition:border-color .2s ease;}
.d2-concierge-input::placeholder{color:color-mix(in srgb,var(--soft) 72%,transparent);}
.d2-concierge-input:focus{outline:none;border-color:var(--orange);}
.d2-concierge-send{display:grid;place-items:center;width:42px;height:42px;flex:0 0 auto;border:0;border-radius:50%;background:var(--orange);color:#fff;cursor:pointer;transition:transform .15s ease,box-shadow .2s ease;}
.d2-concierge-send:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(228,87,46,.35);}
.d2-create{display:inline-block;margin-top:18px;background:var(--ink);color:var(--bg);border:0;border-radius:999px;padding:11px 24px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:background-color .2s ease,color .2s ease,transform .15s ease;}
.d2-create:hover{background:var(--orange);color:#fff;transform:translateY(-1px);}
.d2-act.is-visible .d2-hero-copy>*:nth-child(6){animation-delay:1.1s;}

.d2-hero-chips{display:flex;align-items:center;gap:12px;margin-top:34px;}
.d2-chip{--r:0deg;position:relative;display:flex;flex-direction:column;justify-content:center;gap:4px;width:48px;height:60px;background:var(--paper);color:var(--paper-ink);border-radius:10px;padding:12px 10px;box-shadow:var(--doc-shadow);opacity:0;animation:d2ChipIn .9s var(--ease) both;}
.d2-chip:nth-child(1){--r:-6deg;animation-delay:1.2s;}
.d2-chip:nth-child(2){--r:-2deg;animation-delay:1.4s;}
.d2-chip:nth-child(3){--r:1.5deg;animation-delay:1.6s;}
.d2-chip:nth-child(4){--r:5deg;animation-delay:1.8s;}
.d2-chip:nth-child(5){--r:9deg;animation-delay:2s;}
.d2-chip i{display:block;height:3px;border-radius:2px;background:color-mix(in srgb,var(--paper-ink) 18%,transparent);}
.d2-chip i:nth-child(2){width:72%;}
.d2-chip i:nth-child(3){width:48%;}
.d2-chip i.d2-chip-low{background:var(--orange);}
.d2-chip svg{width:24px;height:13px;}
.d2-chip svg path{fill:none;stroke:var(--paper-soft);stroke-width:2;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;animation:d2Spark 1s var(--ease) 2.7s both;}
.d2-chip-tick{position:absolute;top:-5px;right:-5px;display:grid;place-items:center;width:15px;height:15px;border-radius:50%;background:var(--orange);color:#fff;transform:scale(0);box-shadow:0 2px 5px rgba(0,0,0,.25);animation:d2Pop .4s var(--ease) both;}
.d2-chip:nth-child(1) .d2-chip-tick{animation-delay:2.6s;}
.d2-chip:nth-child(2) .d2-chip-tick{animation-delay:2.75s;}
.d2-chip:nth-child(3) .d2-chip-tick{animation-delay:2.9s;}
.d2-chip:nth-child(4) .d2-chip-tick{animation-delay:3.05s;}
.d2-chip:nth-child(5) .d2-chip-tick{animation-delay:3.2s;}

.d2-hero-desk{position:relative;padding:6px 0 44px;}
.d2-dateline{display:flex;align-items:center;gap:9px;margin:0 0 20px;font-size:13px;letter-spacing:.04em;color:var(--soft);opacity:0;transform:translateY(12px);}
.d2-act.is-visible .d2-dateline{animation:d2Rise 1s var(--ease) .7s forwards;}
.d2-dateline-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);box-shadow:0 0 10px rgba(228,87,46,.5);animation:d2QPulse 2.4s ease-in-out infinite;flex:0 0 auto;}

.d2-doc{isolation:isolate;position:relative;width:100%;background:var(--paper);color:var(--paper-ink);border-radius:var(--r-doc);padding:36px 40px;box-shadow:var(--doc-shadow);transform:rotate(var(--tilt,0deg));transition:transform 1.15s var(--ease),box-shadow .9s var(--ease),opacity .9s ease,background-color .45s ease;}
.d2-act:not(.is-visible) .d2-doc{opacity:0;transform:translate(var(--enter-x,0px),56px) rotate(var(--tilt,0deg));}
.d2-act.is-visible .d2-doc{transition-delay:.15s;}
.d2-doc:hover{transform:translateY(-3px) rotate(var(--tilt,0deg));}
.d2-doc-hero{max-width:560px;margin-left:auto;--tilt:.4deg;--float-y:-4px;--float-r:.12deg;}
.d2-pin{position:absolute;top:20px;right:22px;width:22px;height:22px;border-radius:50%;background:var(--orange);box-shadow:inset 0 2px 5px rgba(60,15,0,.35),0 3px 7px rgba(0,0,0,.25);animation:d2Pin 10s ease-in-out infinite;}
.d2-doc-label{margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--paper-soft);}
.d2-doc-status{display:flex;align-items:center;gap:8px;margin:0 0 20px;font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--paper-soft);}
.d2-doc-body{margin:0;font-size:16.5px;line-height:1.65;font-weight:450;white-space:pre-line;}
.d2-human{margin:20px 0 0;font-family:Georgia,'Iowan Old Style','Times New Roman',serif;font-style:italic;font-size:19px;line-height:1.5;color:var(--paper-ink);}
.d2-doc-note{margin:16px 0 0;font-size:12.5px;color:var(--paper-soft);}
.d2-doc-foot{display:flex;align-items:center;justify-content:flex-end;gap:14px;margin-top:24px;padding-top:20px;border-top:1px solid var(--paper-hair);}
.d2-approve{border:1px solid var(--paper-hair);background:transparent;color:var(--paper-ink);border-radius:999px;padding:9px 20px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.04em;cursor:pointer;opacity:.6;transition:opacity .25s ease,border-color .2s ease,color .2s ease;animation:d2ApprovePulse 12s ease-in-out 2s infinite;}
.d2-doc:hover .d2-approve,.d2-doc:focus-within .d2-approve{opacity:1;}
.d2-approve:hover{border-color:var(--orange);color:var(--orange);}
.d2-approved-tag{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--orange);}
.is-approved .d2-pin{animation:d2Stamp .7s var(--ease);}

.d2-peek{position:absolute;z-index:0;background:var(--paper);color:var(--paper-ink);border-radius:var(--r-card);padding:20px 24px;box-shadow:var(--doc-shadow);pointer-events:none;transition:opacity .9s ease 1s,transform 1s var(--ease) 1s,background-color .45s ease;}
.d2-peek-title{margin:0 0 4px;font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--paper-soft);}
.d2-peek i{display:block;height:3px;border-radius:2px;margin-top:11px;background:color-mix(in srgb,var(--paper-ink) 16%,transparent);}
.d2-peek i:nth-child(3){width:74%;}
.d2-peek i:nth-child(4){width:52%;}
.d2-peek i.d2-peek-low{background:var(--orange);opacity:.7;}
.d2-peek-one{right:-40px;bottom:-6px;width:62%;opacity:.55;filter:saturate(.85);transform:rotate(3deg);}
.d2-peek-two{right:-78px;top:34px;width:55%;opacity:.36;filter:saturate(.8);transform:rotate(-2.5deg);}
.d2-act:not(.is-visible) .d2-peek{opacity:0;transform:rotate(0deg) translateY(26px);}
.d2-hero-desk .d2-doc-hero{z-index:1;}

.d2-arc{position:absolute;z-index:0;pointer-events:none;overflow:visible;}
.d2-arc path{fill:none;stroke:var(--orange);stroke-width:2.5;stroke-linecap:round;stroke-dasharray:.6 7.9;opacity:.5;filter:drop-shadow(0 0 6px rgba(228,87,46,.55));animation:d2ArcFlow 3.4s linear infinite;}
.d2-arc-head{fill:var(--orange);filter:drop-shadow(0 0 8px rgba(228,87,46,.85));}
.d2-arc-hero{right:1%;bottom:-56px;width:232px;height:122px;z-index:2;opacity:0;transition:opacity 1s ease 1.5s;}
.d2-act.is-visible .d2-arc-hero{opacity:1;}
.d2-arc-moment{left:50%;bottom:-14px;width:min(380px,54%);height:200px;transform:translateX(-50%);opacity:.8;}

.d2-moment{min-height:100dvh;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:clamp(28px,4vw,72px);align-items:center;max-width:1280px;margin:0 auto;padding:90px clamp(20px,4vw,56px) 130px clamp(88px,9.5vw,150px);}
.d2-moment.d2-flip{grid-template-columns:minmax(0,6fr) minmax(0,5fr);}
.d2-moment.d2-flip .d2-moment-caption{order:2;}
.d2-moment.d2-flip .d2-doc{order:1;}
.d2-chapter{margin:0 0 14px;font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--soft);}
.d2-chapter-num{color:var(--orange);}
.d2-moment-title{margin:0 0 14px;font-size:clamp(28px,3vw,44px);font-weight:640;letter-spacing:-.02em;line-height:1.1;}
.d2-moment-quiet{margin:0;font-size:15px;line-height:1.6;color:var(--soft);max-width:34ch;}
.d2-moment-caption{opacity:0;transform:translateY(22px);}
.d2-act.is-visible .d2-moment-caption{animation:d2Rise 1.05s var(--ease) .3s forwards;}

.d2-doc-moment{max-width:520px;--float-y:-4px;--float-r:.15deg;}
.d2-doc-moment::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--paper);border-radius:var(--r-doc);transform:rotate(2.3deg) translate(12px,9px);opacity:.45;box-shadow:var(--doc-shadow);transition:background-color .45s ease;}
.d2-flip .d2-doc-moment::before{transform:rotate(-2.3deg) translate(-12px,9px);}
.d2-doc--inventory{--tilt:-.5deg;--enter-x:-40px;}
.d2-doc--customer{--tilt:.6deg;--enter-x:40px;--float-y:-6px;--float-r:-.2deg;}
.d2-doc--supplier{--tilt:-.35deg;--enter-x:-40px;--float-y:-3px;--float-r:.1deg;}
.d2-flip .d2-doc--customer{--enter-x:-40px;}
.d2-doc-moment.is-departed{transform:translate(30vw,-4vh) scale(.5) !important;opacity:0;pointer-events:none;animation:none;}
.d2-act.is-visible .d2-doc-moment{animation:d2Float 9.5s ease-in-out 1.6s infinite alternate;}
.d2-act.is-visible .d2-doc--customer{animation-duration:10.5s;animation-delay:1.8s;}
.d2-act.is-visible .d2-doc--supplier{animation-duration:11.5s;animation-delay:2s;}
.d2-act.is-visible .d2-doc-hero{animation:d2Float 11s ease-in-out 1.9s infinite alternate;}
.d2-slot-note{position:absolute;bottom:14%;left:50%;transform:translateX(-50%);margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--soft);animation:d2Rise .8s var(--ease) both;}

.d2-art{margin:0 0 20px;background:color-mix(in srgb,var(--paper-ink) 4%,var(--paper));border:1px solid var(--paper-hair);border-radius:var(--r-inset);padding:14px 18px;font-size:14px;}
.d2-art-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;color:var(--paper-ink);}
.d2-art-row+.d2-art-row{border-top:1px solid var(--paper-hair);}
.d2-art-row>span:last-child{color:var(--paper-soft);font-size:12px;font-weight:700;letter-spacing:.04em;}
.d2-art-key{display:inline-flex;align-items:center;gap:8px;}
.d2-art-low,.d2-art-low>span:last-child{color:var(--orange);}
.d2-art-dot{width:8px;height:8px;border-radius:50%;background:var(--orange);flex:0 0 auto;}
.d2-art-stamp{margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);}
.d2-art-text{margin:0;font-style:italic;line-height:1.55;}
.d2-art-typed{position:relative;}
.d2-art-ghost{visibility:hidden;}
.d2-art-typed-live{position:absolute;inset:0;}
.d2-art-workspace{position:relative;overflow:hidden;padding-top:18px;}
.d2-art-progress{position:absolute;top:0;left:0;height:2px;width:0;border-radius:2px;background:linear-gradient(90deg,var(--orange),color-mix(in srgb,var(--orange) 18%,transparent));}
.d2-art.is-live .d2-art-progress{animation:d2Progress 2s var(--ease) .15s both;}
.d2-pop{display:inline-flex;transform:scale(0);opacity:0;}
.d2-art.is-live .d2-pop{animation:d2Pop .55s var(--ease) both;}
.d2-art.is-live .d2-pop.d2-d1{animation-delay:.35s;}
.d2-art.is-live .d2-pop.d2-d2{animation-delay:.7s;}
.d2-art.is-live .d2-pop.d2-d3{animation-delay:1.15s;}
.d2-art.is-live .d2-pop.d2-d4{animation-delay:1.6s;}
.d2-art-emerge{opacity:0;transform:translateY(6px);}
.d2-art.is-live .d2-art-emerge{animation:d2Emerge .65s var(--ease) both;}
.d2-art.is-live .d2-art-emerge.d2-d3{animation-delay:1.15s;}
.d2-art.is-live .d2-art-emerge.d2-d4{animation-delay:1.5s;}
.d2-art.is-live .d2-art-low .d2-art-dot{animation:d2QPulse 1.6s ease-in-out 1s 2;}
.d2-caret{display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:var(--orange);animation:d2Caret 1s steps(2) infinite;}

.d2-q-status{display:flex;align-items:center;gap:8px;margin:-4px 0 16px;font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--paper-soft);opacity:0;transition:opacity .6s ease;}
.d2-q-status.is-on{opacity:1;}
.d2-q-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);flex:0 0 auto;animation:d2QPulse 1.1s ease-in-out infinite;}
.d2-q-status.is-done .d2-q-dot{animation:none;opacity:.5;}

.d2-scan{position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:inherit;overflow:hidden;}
.d2-scan::before{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 38%,rgba(255,244,220,.32) 50%,transparent 62%);transform:translateX(-80%);opacity:0;}
.d2-act.is-visible .d2-scan::before{animation:d2Scan 1.9s var(--ease) .5s both;}

.d2-signature{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:110px 24px 100px;}
.d2-doc-review{max-width:640px;--tilt:-.3deg;--float-y:-3px;--float-r:0deg;}
.d2-act.is-visible .d2-doc-review{animation:d2Float 11s ease-in-out 1.9s infinite alternate;}
.d2-review-title{margin:0 0 10px;font-size:clamp(26px,3.2vw,40px);font-weight:640;letter-spacing:-.02em;color:var(--paper-ink);}
.d2-sign-row{display:flex;justify-content:space-between;gap:28px;margin-top:32px;padding-top:24px;border-top:1px solid var(--paper-hair);}
.d2-sign-deboss{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:13px;box-shadow:inset 0 3px 9px rgba(20,18,14,.22);filter:grayscale(1);opacity:.6;}
.d2-sign-caption{display:block;margin-top:8px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--paper-soft);}
.d2-sign-line{border:0;border-bottom:2px dashed var(--paper-hair);background:transparent;color:var(--paper-soft);font:inherit;font-size:16px;font-style:italic;padding:6px 4px;cursor:pointer;min-width:180px;text-align:left;transition:color .2s ease,border-color .2s ease;}
.d2-sign-line:hover{color:var(--orange);border-color:var(--orange);}
.d2-signed-name{display:block;font-style:italic;font-size:18px;color:var(--paper-ink);padding:6px 4px;border-bottom:2px solid var(--orange);}
.d2-swell{position:fixed;inset:0;z-index:20;pointer-events:none;background:radial-gradient(circle at 50% 45%,rgba(228,87,46,.14),transparent 55%);animation:d2Swell .9s ease-out both;}

.d2-door{min-height:90dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:110px 24px 110px;}
.d2-door-title{margin:0 0 40px;font-size:clamp(30px,4vw,58px);font-weight:640;letter-spacing:-.025em;line-height:1.1;}
.d2-door .d2-concierge{text-align:left;}

.d2-footer{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:26px clamp(18px,4vw,44px);color:var(--soft);font-size:13px;}
.d2-quiet-link{background:none;border:0;color:var(--soft);font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-color:color-mix(in srgb,currentColor 30%,transparent);padding:0;}
.d2-quiet-link:hover{color:var(--ink);}

.d2-counter{position:fixed;right:26px;bottom:26px;z-index:30;display:inline-flex;align-items:center;gap:8px;background:var(--elev);border:1px solid var(--hair);color:var(--ink);border-radius:999px;padding:10px 18px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;box-shadow:var(--chip-shadow);animation:d2Rise .7s var(--ease);transition:background-color .45s ease,border-color .45s ease,color .45s ease;}
.d2-counter svg{color:var(--orange);}

@keyframes d2Rise{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
@keyframes d2Pop{from{transform:scale(0);opacity:0;}to{transform:scale(1);opacity:1;}}
@keyframes d2Emerge{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
@keyframes d2Progress{from{width:0;}to{width:100%;}}
@keyframes d2Caret{0%,49%{opacity:1;}50%,100%{opacity:0;}}
@keyframes d2QPulse{0%,100%{transform:scale(1);opacity:.7;}50%{transform:scale(1.35);opacity:1;}}
@keyframes d2Scan{0%{transform:translateX(-80%);opacity:0;}15%{opacity:1;}85%{opacity:1;}100%{transform:translateX(80%);opacity:0;}}
@keyframes d2Float{from{translate:0 0;rotate:0deg;}to{translate:0 var(--float-y,-4px);rotate:var(--float-r,.15deg);}}
@keyframes d2Stamp{0%{transform:scale(1);}40%{transform:scale(1.35);}100%{transform:scale(1);}}
@keyframes d2Pin{0%,100%{transform:rotate(0deg) scale(1);}50%{transform:rotate(7deg) scale(1.05);}}
@keyframes d2ApprovePulse{0%,90%,100%{border-color:var(--paper-hair);}95%{border-color:color-mix(in srgb,var(--orange) 55%,transparent);}}
@keyframes d2Swell{from{opacity:0;}30%{opacity:1;}to{opacity:0;}}
@keyframes d2ArcFlow{to{stroke-dashoffset:-8.5;}}
@keyframes d2ChipIn{from{opacity:0;transform:translateY(18px) rotate(var(--r,0deg)) scale(.92);}to{opacity:1;transform:translateY(0) rotate(var(--r,0deg)) scale(1);}}
@keyframes d2Spark{from{stroke-dashoffset:100;}to{stroke-dashoffset:0;}}

@media(max-width:900px){
.d2-rail{display:none;}
.d2-progress{display:block;}
.d2-hero{grid-template-columns:1fr;gap:40px;padding:104px 20px 64px;}
.d2-doc-hero{margin-left:0;}
.d2-peek-one{right:-12px;width:70%;}
.d2-peek-two{right:-26px;width:60%;}
.d2-arc-hero{right:-14px;bottom:-42px;}
.d2-moment{grid-template-columns:1fr;gap:30px;padding:76px 20px 120px;}
.d2-moment.d2-flip{grid-template-columns:1fr;}
.d2-moment.d2-flip .d2-moment-caption{order:0;}
.d2-moment.d2-flip .d2-doc{order:1;}
.d2-doc-moment{max-width:100%;}
.d2-doc{padding:28px 24px;}
.d2-approve{opacity:.8;}
.d2-sign-row{flex-direction:column;}
.d2-counter{right:16px;bottom:16px;}
.d2-headline{font-size:clamp(32px,9.4vw,52px);}
.d2-hero-chips{gap:10px;margin-top:28px;}
.d2-chip{width:42px;height:54px;padding:10px 9px;}
}

@media(prefers-reduced-motion:reduce){
.d2-page *,.d2-page *::before,.d2-page *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;}
.d2-act:not(.is-visible) .d2-doc{opacity:1;transform:none;}
.d2-act:not(.is-visible) .d2-peek{opacity:.4;transform:rotate(2deg);}
.d2-hero-copy>*,.d2-moment-caption,.d2-dateline{opacity:1;transform:none;animation:none;}
.d2-arc path{animation:none;opacity:.3;}
.d2-arc-hero{opacity:.6;}
.d2-ambient{display:none;}
}
`;
