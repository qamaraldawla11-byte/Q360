import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestQConcierge, type GuestSetup } from './GuestQConcierge';
import { ArrowRight, Check, Moon, Sun } from 'lucide-react';

type MomentKind = 'inventory' | 'customer' | 'supplier';

type Moment = {
    id: string;
    kind: MomentKind;
    title: string;
    body: string;
    minutesAgo: number;
    working: string;
    done: string;
};

const MOMENTS: Moment[] = [
    {
        id: 'inventory',
        kind: 'inventory',
        title: 'Inventory Ready',
        body: 'Reorder drafts are written — send them when you’re ready.',
        minutesAgo: 33,
        working: 'Q is checking stock…',
        done: 'Stock checked',
    },
    {
        id: 'customer',
        kind: 'customer',
        title: 'Customer Waiting',
        body: 'A reply is drafted in your words. Read it, then send.',
        minutesAgo: 26,
        working: 'Q is writing in your words…',
        done: 'Reply drafted',
    },
    {
        id: 'supplier',
        kind: 'supplier',
        title: 'Supplier Follow-up',
        body: 'The follow-up is written. Firm, polite, yours.',
        minutesAgo: 19,
        working: 'Q is chasing invoice 214…',
        done: 'Follow-up written',
    },
];

const daypartOf = (hour: number): 'morning' | 'afternoon' | 'evening' | 'night' =>
    hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 21 ? 'evening' : 'night';

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
        <div className={'fm-art fm-art-workspace' + (inView ? ' is-live' : '')} ref={ref} aria-hidden="true">
            <span className="fm-art-progress" />
            <div className="fm-art-row">
                <span className="fm-art-key">
                    <span className="fm-pop fm-d1">
                        <Check size={13} />
                    </span>
                    Sourdough flour
                </span>
                <span>fine</span>
            </div>
            <div className="fm-art-row">
                <span className="fm-art-key">
                    <span className="fm-pop fm-d2">
                        <Check size={13} />
                    </span>
                    Oat milk
                </span>
                <span>fine</span>
            </div>
            <div className="fm-art-row fm-art-low">
                <span className="fm-art-key">
                    <span className="fm-art-dot" /> Espresso beans
                </span>
                <span>low</span>
            </div>
            <div className="fm-art-row fm-art-emerge fm-d4">
                <span className="fm-art-key">Reorder draft · Alba Foods</span>
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
        <div className={'fm-art fm-art-workspace' + (inView ? ' is-live' : '')} ref={ref} aria-hidden="true">
            <span className="fm-art-progress" />
            <p className="fm-art-stamp">Draft — in your words</p>
            <p className="fm-art-text fm-art-typed">
                <span className="fm-art-ghost">{CUSTOMER_DRAFT}</span>
                <span className="fm-art-typed-live">
                    {shown}
                    {done ? null : <span className="fm-caret" />}
                </span>
            </p>
        </div>
    );
};

const SupplierArtifact = () => {
    const { ref, inView } = useInView<HTMLDivElement>();
    const total = useCountUp(2340, inView);
    return (
        <div className={'fm-art fm-art-workspace' + (inView ? ' is-live' : '')} ref={ref} aria-hidden="true">
            <span className="fm-art-progress" />
            <div className="fm-art-row">
                <span className="fm-art-key">Invoice 214</span>
                <span>{total.toLocaleString()}</span>
            </div>
            <div className="fm-art-row fm-art-low">
                <span className="fm-art-key">Unanswered</span>
                <span>4 days</span>
            </div>
            <div className="fm-art-row fm-art-emerge fm-d3">
                <span className="fm-art-key">
                    <span className="fm-pop fm-d3">
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
        <p className={'fm-q-status' + (inView ? ' is-on' : '') + (settled ? ' is-done' : '')} ref={ref} aria-hidden="true">
            <span className="fm-q-dot" />
            {settled ? `${done} · ${time}` : working}
        </p>
    );
};

export const LandingView = () => {
    const navigate = useNavigate();
    const pageRef = useRef<HTMLDivElement>(null);
    const doorInputRef = useRef<HTMLInputElement>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() =>
        localStorage.getItem('q360-landing-theme') === 'dark' ? 'dark' : 'light',
    );
    const [now] = useState(() => new Date());
    const [heroPrompt, setHeroPrompt] = useState('');
    const [guestChatOpen, setGuestChatOpen] = useState(false);
    const [approved, setApproved] = useState<ReadonlySet<string>>(new Set());
    const [departed, setDeparted] = useState<ReadonlySet<string>>(new Set());
    const [signed, setSigned] = useState(false);

    const daypart = daypartOf(now.getHours());
    const preparedAt = (minutesAgo: number) => clockOf(new Date(now.getTime() - minutesAgo * 60000));

    useEffect(() => {
        localStorage.setItem('q360-landing-theme', theme);
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
                    if (act.dataset.scene) root.dataset.scene = act.dataset.scene;
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
        let frame = 0;
        const move = (event: PointerEvent) => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                root.style.setProperty('--lx', `${(event.clientX / window.innerWidth) * 100}%`);
                root.style.setProperty('--ly', `${(event.clientY / window.innerHeight) * 100}%`);
            });
        };
        window.addEventListener('pointermove', move, { passive: true });
        return () => {
            window.removeEventListener('pointermove', move);
            if (frame) window.cancelAnimationFrame(frame);
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

    const approveMoment = (id: string) => {
        setApproved((current) => new Set(current).add(id));
        window.setTimeout(() => {
            setDeparted((current) => new Set(current).add(id));
        }, 900);
    };

    return (
        <div className="fm-page" data-theme={theme} data-daypart={daypart} data-scene="arrival" ref={pageRef}>
            <div className="fm-grain" aria-hidden="true" />
            <div className="fm-ambient" aria-hidden="true" />
            <div className="fm-motes" aria-hidden="true">
                <span className="fm-mote fm-mote-one" />
                <span className="fm-mote fm-mote-two" />
                <span className="fm-mote fm-mote-three" />
            </div>
            <div className="fm-spine" aria-hidden="true">
                <span className="fm-spine-bead" />
                <span className="fm-spine-drop" />
            </div>

            <header className="fm-header">
                <button
                    type="button"
                    className="fm-brand"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    aria-label="Q360 — back to top"
                >
                    <span className="fm-brand-chip">
                        <BrandMark size={20} />
                    </span>
                    Q360
                </button>
                <div className="fm-header-actions">
                    <button
                        type="button"
                        className="fm-icon-btn"
                        onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
                        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                    >
                        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    </button>
                    <button type="button" className="fm-signin" onClick={() => navigate('/login')}>
                        Sign in
                    </button>
                </div>
            </header>

            <main>
                <section data-scene="arrival" className="fm-act fm-act-arrival" aria-label="Arrival">
                    <div className="fm-arrival-mark" aria-hidden="true">
                        <BrandMark size={104} />
                    </div>
                    <h1 className="fm-display">
                        <span className="fm-line fm-line-dim">{clockOf(now)}</span>
                        <span className="fm-line">Your business is already prepared.</span>
                    </h1>
                    <p className="fm-orientation">
                        <span className="fm-line">An AI workspace for operations, customers and decisions.</span>
                    </p>
                    <div className="fm-arrival-desk" aria-hidden="true">
                        <span className="fm-chip fm-chip--inventory">
                            <i />
                            <i />
                            <i className="fm-chip-low" />
                            <b className="fm-chip-tick">
                                <Check size={9} />
                            </b>
                        </span>
                        <span className="fm-chip fm-chip--customer">
                            <i />
                            <i />
                            <b className="fm-chip-tick">
                                <Check size={9} />
                            </b>
                        </span>
                        <span className="fm-chip fm-chip--supplier">
                            <i />
                            <i className="fm-chip-low" />
                            <b className="fm-chip-tick">
                                <Check size={9} />
                            </b>
                        </span>
                        <span className="fm-chip fm-chip--kitchen">
                            <i />
                            <i />
                            <b className="fm-chip-tick">
                                <Check size={9} />
                            </b>
                        </span>
                        <span className="fm-chip fm-chip--review">
                            <svg viewBox="0 0 26 14" aria-hidden="true">
                                <path d="M1 11 C 6 10, 8 4, 13 6 S 21 11, 25 3" pathLength={100} />
                            </svg>
                            <b className="fm-chip-tick">
                                <Check size={9} />
                            </b>
                        </span>
                    </div>
                </section>

                <section data-scene="brief" className="fm-act" aria-label="The daily brief">
                    <article className="fm-object fm-brief">
                        <span className="fm-thread" aria-hidden="true" />
                        <p className="fm-object-label">The Daily Brief</p>
                        <p className="fm-object-body">
                            {`${GREETINGS[daypart]}\nYesterday closed clean — 47 orders, no loose ends.\nToday: 12 customers expected, one supplier waiting on you.\nEverything else is ready.`}
                        </p>
                        <div className="fm-object-foot">
                            <span className="fm-caption">Prepared {preparedAt(45)} — before you arrived</span>
                        </div>
                    </article>
                </section>

                {MOMENTS.map((moment, index) => (
                    <section
                        key={moment.id}
                        data-scene="morning"
                        className={'fm-act fm-act-moment ' + (index % 2 ? 'fm-right' : 'fm-left')}
                        aria-label={moment.title}
                    >
                        <article
                            className={
                                'fm-object fm-moment fm-moment--' + moment.kind +
                                (approved.has(moment.id) ? ' is-approved' : '') +
                                (departed.has(moment.id) ? ' is-departed' : '')
                            }
                        >
                            <span className="fm-seal" aria-hidden="true" />
                            <span className="fm-thread" aria-hidden="true" />
                            <span className="fm-scan" aria-hidden="true" />
                            <p className="fm-object-label">{moment.title}</p>
                            <QStatus working={moment.working} done={moment.done} time={preparedAt(moment.minutesAgo)} />
                            <MomentArtifact kind={moment.kind} />
                            <p className="fm-object-body">{moment.body}</p>
                            <p className="fm-object-note">Prepared by Q. Nothing happens without you.</p>
                            <div className="fm-object-foot">
                                {approved.has(moment.id) ? (
                                    <span className="fm-approved-tag">
                                        <Check size={14} /> Approved
                                    </span>
                                ) : (
                                    <button type="button" className="fm-approve" onClick={() => approveMoment(moment.id)}>
                                        Approve
                                    </button>
                                )}
                            </div>
                        </article>
                        {departed.has(moment.id) ? <p className="fm-slot-note">Approved — Q will handle it.</p> : null}
                    </section>
                ))}

                <section data-scene="signature" className="fm-act" aria-label="The signature">
                    <article className={'fm-object fm-document' + (signed ? ' is-approved' : '')}>
                        <span className="fm-seal" aria-hidden="true" />
                        <p className="fm-object-label">The Daily Review</p>
                        <h2 className="fm-display-small">Q prepares. You approve.</h2>
                        <p className="fm-object-body">That will never change.</p>
                        <div className="fm-sign-row">
                            <div>
                                <span className="fm-sign-deboss" aria-hidden="true">
                                    <BrandMark size={22} />
                                </span>
                                <span className="fm-sign-caption">Signed — Q, {preparedAt(3)}</span>
                            </div>
                            <div>
                                {signed ? (
                                    <span className="fm-signed-name">You — just now</span>
                                ) : (
                                    <button type="button" className="fm-sign-line" onClick={() => setSigned(true)}>
                                        Your signature
                                    </button>
                                )}
                                <span className="fm-sign-caption">{signed ? 'Countersigned' : 'Waiting for the owner'}</span>
                            </div>
                        </div>
                    </article>
                    {signed ? <span className="fm-swell" aria-hidden="true" /> : null}
                </section>

                <section data-scene="door" className="fm-act fm-act-door" aria-label="A conversation with Q">
                    <div className="fm-door-copy">
                        <h2 className="fm-display fm-display-mid">
                            <span className="fm-line">What business are you running?</span>
                        </h2>
                    </div>
                    <article className="fm-door-cta">
                        <form
                            className="fm-door-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (heroPrompt.trim()) setGuestChatOpen(true);
                            }}
                        >
                            <input
                                ref={doorInputRef}
                                className="fm-door-input"
                                value={heroPrompt}
                                onChange={(event) => setHeroPrompt(event.target.value)}
                                placeholder="Tell Q about your business…"
                                aria-label="Tell Q about your business"
                            />
                            <button className="fm-door-send" type="submit" aria-label="Send to Q">
                                <ArrowRight size={19} />
                            </button>
                        </form>
                    </article>
                </section>
            </main>

            <footer className="fm-footer">
                <span>(c) 2026 Qamar Technologies Ltd. All rights reserved.</span>
                <button type="button" className="fm-quiet-link" onClick={() => navigate('/support')}>
                    Contact
                </button>
            </footer>

            {approved.size > 0 ? (
                <div className="fm-stack" role="status" aria-label={`${approved.size} prepared moments approved`}>
                    <span className="fm-stack-slabs" aria-hidden="true">
                        {Array.from({ length: approved.size }).map((_, index) => (
                            <span
                                key={index}
                                className="fm-stack-slab"
                                style={{ transform: `translateY(${-index * 4}px) rotate(${(index % 2 ? -1 : 1) * (2 + index)}deg)` }}
                            />
                        ))}
                    </span>
                    <span className="fm-stack-label">Approved · {approved.size}</span>
                </div>
            ) : null}

            {guestChatOpen && (
                <GuestQConcierge
                    initialPrompt={heroPrompt.trim()}
                    theme={theme}
                    onClose={() => setGuestChatOpen(false)}
                    onContinue={(setup: GuestSetup) => {
                        sessionStorage.setItem('q360_guest_setup', JSON.stringify(setup));
                        navigate('/login', { state: { guestSetup: setup } });
                    }}
                />
            )}

            <style>{fmStyles}</style>
        </div>
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

const fmStyles = `
.fm-page{--ease:cubic-bezier(.22,1,.36,1);--orange:#e4572e;--paper:#fdfcf9;--paper-ink:#14161a;--paper-soft:#6f6960;--hair:rgba(20,22,26,.14);--edge:rgba(255,255,255,.45);--scene:#171410;--ink:#f3efe8;--ink-soft:#a89f92;--lx:50%;--ly:40%;--sy:0px;position:relative;min-height:100dvh;background:var(--scene);color:var(--ink);transition:background-color 1.1s ease,color 1.1s ease;overflow-x:hidden;}

.fm-page[data-daypart='morning'][data-scene='arrival']{--scene:#171410;--ink:#f3efe8;--ink-soft:#a89f92;}
.fm-page[data-daypart='morning'][data-scene='brief']{--scene:#26211a;--ink:#f3efe8;--ink-soft:#b0a695;}
.fm-page[data-daypart='morning'][data-scene='morning']{--scene:#efe9df;--ink:#17140f;--ink-soft:#7c7466;}
.fm-page[data-daypart='morning'][data-scene='signature']{--scene:#f5f1e8;--ink:#17140f;--ink-soft:#7c7466;}
.fm-page[data-daypart='morning'][data-scene='door']{--scene:#faf9f7;--ink:#14161a;--ink-soft:#6f6960;}

.fm-page[data-daypart='afternoon'][data-scene='arrival']{--scene:#e4e0d8;--ink:#17140f;--ink-soft:#7c7466;}
.fm-page[data-daypart='afternoon'][data-scene='brief']{--scene:#ece8e0;--ink:#17140f;--ink-soft:#7c7466;}
.fm-page[data-daypart='afternoon'][data-scene='morning']{--scene:#f3f0e9;--ink:#17140f;--ink-soft:#7c7466;}
.fm-page[data-daypart='afternoon'][data-scene='signature']{--scene:#f7f4ed;--ink:#17140f;--ink-soft:#7c7466;}
.fm-page[data-daypart='afternoon'][data-scene='door']{--scene:#fcfbfa;--ink:#14161a;--ink-soft:#6f6960;}

.fm-page[data-daypart='evening'][data-scene='arrival']{--scene:#251b12;--ink:#f6ecdc;--ink-soft:#c2a184;}
.fm-page[data-daypart='evening'][data-scene='brief']{--scene:#33241a;--ink:#f6ecdc;--ink-soft:#c2a184;}
.fm-page[data-daypart='evening'][data-scene='morning']{--scene:#f0e4d3;--ink:#1c150e;--ink-soft:#857050;}
.fm-page[data-daypart='evening'][data-scene='signature']{--scene:#f6ecdc;--ink:#1c150e;--ink-soft:#857050;}
.fm-page[data-daypart='evening'][data-scene='door']{--scene:#fbf5ea;--ink:#14161a;--ink-soft:#6f6960;}

.fm-page[data-daypart='night'][data-scene='arrival']{--scene:#0f0d0b;--ink:#f3efe8;--ink-soft:#a89f92;}
.fm-page[data-daypart='night'][data-scene='brief']{--scene:#171310;--ink:#f3efe8;--ink-soft:#a89f92;}
.fm-page[data-daypart='night'][data-scene='morning']{--scene:#1c1914;--ink:#f3efe8;--ink-soft:#a89f92;}
.fm-page[data-daypart='night'][data-scene='signature']{--scene:#201c16;--ink:#f3efe8;--ink-soft:#a89f92;}
.fm-page[data-daypart='night'][data-scene='door']{--scene:#242019;--ink:#f3efe8;--ink-soft:#a89f92;}

.fm-page[data-theme='dark']{--paper:#26221b;--paper-ink:#f3efe8;--paper-soft:#a89f92;--hair:rgba(243,239,232,.16);--edge:rgba(255,255,255,.06);}
.fm-page[data-theme='dark'][data-scene='morning'],.fm-page[data-theme='dark'][data-scene='signature'],.fm-page[data-theme='dark'][data-scene='door']{--scene:#12100c;--ink:#f3efe8;--ink-soft:#a89f92;}

.fm-grain{position:fixed;inset:-90px 0;z-index:0;pointer-events:none;opacity:.05;mix-blend-mode:multiply;transform:translateY(calc(var(--sy) * -.04));background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");}
.fm-page::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 42%,transparent 58%,rgba(0,0,0,.16));}
.fm-ambient{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(520px 420px at var(--lx) var(--ly),rgba(228,135,46,.10),transparent 70%);animation:fmAmbient 9s ease-in-out infinite;}
.fm-motes{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity 1.4s ease;}
.fm-page[data-scene='arrival'] .fm-motes,.fm-page[data-scene='brief'] .fm-motes{opacity:1;}
.fm-mote{position:absolute;width:3px;height:3px;border-radius:50%;background:rgba(255,236,200,.55);animation:fmDrift 17s ease-in-out infinite alternate;}
.fm-mote-one{left:22%;top:34%;}
.fm-mote-two{left:68%;top:24%;animation-delay:-6s;}
.fm-mote-three{left:48%;top:62%;animation-delay:-11s;}

.fm-header{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(18px,4vw,44px);color:var(--ink);transition:color 1.1s ease;}
.fm-brand{display:flex;align-items:center;gap:10px;background:none;border:0;color:inherit;font:inherit;font-weight:800;font-size:16px;letter-spacing:.02em;cursor:pointer;padding:0;}
.fm-brand-chip{display:grid;place-items:center;background:#fdfcf9;border-radius:9px;padding:3px;box-shadow:0 2px 8px rgba(20,18,14,.18);}
.fm-header-actions{display:flex;align-items:center;gap:8px;}
.fm-icon-btn{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;border:1px solid transparent;background:transparent;color:inherit;cursor:pointer;}
.fm-icon-btn:hover{border-color:color-mix(in srgb,currentColor 22%,transparent);}
.fm-icon-btn:focus-visible,.fm-signin:focus-visible,.fm-quiet-link:focus-visible,.fm-approve:focus-visible,.fm-sign-line:focus-visible,.fm-door-send:focus-visible,.fm-brand:focus-visible{outline:2px solid color-mix(in srgb,currentColor 45%,transparent);outline-offset:2px;}
.fm-signin{border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:transparent;color:inherit;border-radius:999px;padding:9px 18px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;}
.fm-signin:hover{border-color:color-mix(in srgb,currentColor 55%,transparent);}

.fm-act{position:relative;z-index:1;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:120px 24px 80px;}

.fm-display{margin:0;font-size:clamp(47px,7.7vw,127px);font-weight:650;letter-spacing:-.03em;line-height:1.04;text-align:center;}
.fm-display-mid{font-size:clamp(34px,5.2vw,72px);max-width:16ch;margin:0 auto;}
.fm-line{display:block;}
.fm-line-dim{color:var(--ink-soft);}
.fm-act-arrival .fm-line-dim{font-size:clamp(19px,2vw,28px);font-weight:700;letter-spacing:.16em;margin-bottom:22px;}
.fm-orientation{margin:24px 0 0;font-size:clamp(15px,1.7vw,20px);font-weight:500;color:var(--ink-soft);text-align:center;}
.fm-act-arrival .fm-orientation .fm-line{animation-delay:1.35s;}
.fm-act-arrival .fm-line{opacity:0;transform:translateY(26px);animation:fmRise 1s var(--ease) .35s forwards;}
.fm-act-arrival .fm-line-dim{animation-delay:1s;}
.fm-arrival-mark{margin-bottom:44px;animation:fmWork 2.6s ease-out .4s both,fmBreathe 6s ease-in-out 3.4s 1 both;}

.fm-arrival-desk{display:flex;align-items:center;gap:14px;margin-top:44px;}
.fm-chip{--r:0deg;position:relative;display:flex;flex-direction:column;justify-content:center;gap:5px;width:56px;height:70px;background:var(--paper);border-radius:12px;padding:14px 12px;box-shadow:inset 0 1px 0 var(--edge),0 12px 26px rgba(0,0,0,.30);opacity:0;animation:fmChipIn .9s var(--ease) both;}
.fm-chip:nth-child(1){--r:-7deg;animation-delay:1.25s;}
.fm-chip:nth-child(2){--r:-2.5deg;animation-delay:1.45s;}
.fm-chip:nth-child(3){--r:1deg;animation-delay:1.65s;}
.fm-chip:nth-child(4){--r:4deg;animation-delay:1.85s;}
.fm-chip:nth-child(5){--r:8deg;animation-delay:2.05s;}
.fm-chip i{display:block;height:3px;border-radius:2px;background:color-mix(in srgb,var(--paper-ink) 20%,transparent);}
.fm-chip i:nth-child(2){width:72%;}
.fm-chip i:nth-child(3){width:48%;}
.fm-chip i.fm-chip-low{background:var(--orange);}
.fm-chip svg{width:26px;height:14px;}
.fm-chip svg path{fill:none;stroke:var(--paper-soft);stroke-width:2;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;animation:fmSpark 1s var(--ease) 2.9s both;}
.fm-chip-tick{position:absolute;top:-6px;right:-6px;display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:var(--orange);color:#fff;transform:scale(0);box-shadow:0 2px 6px rgba(0,0,0,.3);animation:fmPop .4s var(--ease) both;}
.fm-chip:nth-child(1) .fm-chip-tick{animation-delay:2.7s;}
.fm-chip:nth-child(2) .fm-chip-tick{animation-delay:2.85s;}
.fm-chip:nth-child(3) .fm-chip-tick{animation-delay:3s;}
.fm-chip:nth-child(4) .fm-chip-tick{animation-delay:3.15s;}
.fm-chip:nth-child(5) .fm-chip-tick{animation-delay:3.3s;}
.fm-act-arrival::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 32%,rgba(255,236,200,.07) 50%,transparent 68%);transform:translateX(-60%);animation:fmDawn 2.8s var(--ease) both;}
.fm-spine{position:fixed;top:0;bottom:0;left:clamp(18px,7vw,110px);z-index:2;width:1px;pointer-events:none;background:color-mix(in srgb,var(--ink) 13%,transparent);opacity:0;transition:opacity 1s ease;}
.fm-page[data-scene='arrival'] .fm-spine{opacity:1;background:transparent;}
.fm-page[data-scene='brief'] .fm-spine,.fm-page[data-scene='morning'] .fm-spine,.fm-page[data-scene='signature'] .fm-spine,.fm-page[data-scene='door'] .fm-spine{opacity:1;}
.fm-spine-bead{position:absolute;left:-3px;top:calc(8vh + var(--sp,0) * 78vh);width:7px;height:7px;border-radius:50%;background:var(--orange);box-shadow:0 0 14px rgba(228,87,46,.6);transition:top .25s linear;}
.fm-spine-drop{position:absolute;left:-1px;top:9vh;width:3px;height:3px;border-radius:50%;background:var(--ink-soft);opacity:0;animation:fmDrop 2.6s ease-in 1.8s infinite;}
.fm-page:not([data-scene='arrival']) .fm-spine-drop{display:none;}
.fm-spine::after{content:'';position:absolute;left:0;top:0;width:1px;height:90px;background:linear-gradient(transparent,color-mix(in srgb,var(--orange) 45%,transparent),transparent);opacity:0;animation:fmSpineFlow 7s ease-in-out 2.4s infinite;}

.fm-object{isolation:isolate;position:relative;width:100%;max-width:560px;background:var(--paper);color:var(--paper-ink);border-radius:28px;padding:46px 50px;box-shadow:inset 0 1px 0 var(--edge),0 8px 24px rgba(20,18,14,.08),0 40px 80px rgba(20,18,14,.05);transform:rotate(var(--tilt,0deg));transition:transform .95s cubic-bezier(.32,1.22,.4,1),box-shadow .8s var(--ease),opacity .9s ease;}
.fm-act:not(.is-visible) .fm-object{opacity:0;transform:translate(var(--enter-x,0px),64px) rotate(var(--tilt,0deg));}
.fm-act.is-visible .fm-object{transition-delay:.12s;}
.fm-object:hover{transform:translateY(-3px) rotate(var(--tilt,0deg));box-shadow:inset 0 1px 0 var(--edge),0 12px 28px rgba(20,18,14,.12),0 28px 56px rgba(20,18,14,.05);}
.fm-object-label{margin:0 0 16px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--paper-soft);}
.fm-object-body{margin:0;font-size:18px;line-height:1.6;font-weight:450;white-space:pre-line;}
.fm-object-note{margin:22px 0 0;font-size:13px;color:var(--paper-soft);}
.fm-object-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:26px;padding-top:20px;border-top:1px solid var(--hair);}
.fm-caption{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--paper-soft);}

.fm-art{margin:0 0 22px;background:color-mix(in srgb,var(--paper-ink) 4%,var(--paper));border:1px solid var(--hair);border-radius:16px;padding:14px 18px;font-size:14px;}
.fm-art-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;color:var(--paper-ink);}
.fm-art-row+.fm-art-row{border-top:1px solid var(--hair);}
.fm-art-row>span:last-child{color:var(--paper-soft);font-size:12px;font-weight:700;letter-spacing:.04em;}
.fm-art-key{display:inline-flex;align-items:center;gap:8px;}
.fm-art-low,.fm-art-low>span:last-child{color:var(--orange);}
.fm-art-dot{width:8px;height:8px;border-radius:50%;background:var(--orange);flex:0 0 auto;}
.fm-art-stamp{margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);}
.fm-art-text{margin:0;font-style:italic;line-height:1.55;}
.fm-art-typed{position:relative;}
.fm-art-ghost{visibility:hidden;}
.fm-art-typed-live{position:absolute;inset:0;}
.fm-art-workspace{position:relative;overflow:hidden;padding-top:18px;}
.fm-art-progress{position:absolute;top:0;left:0;height:2px;width:0;border-radius:2px;background:linear-gradient(90deg,var(--orange),color-mix(in srgb,var(--orange) 18%,transparent));}
.fm-art.is-live .fm-art-progress{animation:fmProgress 1.7s var(--ease) .15s both;}
.fm-pop{display:inline-flex;transform:scale(0);opacity:0;}
.fm-art.is-live .fm-pop{animation:fmPop .45s var(--ease) both;}
.fm-art.is-live .fm-pop.fm-d1{animation-delay:.35s;}
.fm-art.is-live .fm-pop.fm-d2{animation-delay:.7s;}
.fm-art.is-live .fm-pop.fm-d3{animation-delay:1.15s;}
.fm-art.is-live .fm-pop.fm-d4{animation-delay:1.6s;}
.fm-art-emerge{opacity:0;transform:translateY(6px);}
.fm-art.is-live .fm-art-emerge{animation:fmEmerge .5s var(--ease) both;}
.fm-art.is-live .fm-art-emerge.fm-d3{animation-delay:1.15s;}
.fm-art.is-live .fm-art-emerge.fm-d4{animation-delay:1.5s;}
.fm-art.is-live .fm-art-low .fm-art-dot{animation:fmQPulse 1.6s ease-in-out 1s 2;}
.fm-caret{display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:var(--orange);animation:fmCaret 1s steps(2) infinite;}

.fm-q-status{display:flex;align-items:center;gap:8px;margin:-8px 0 18px;font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--paper-soft);opacity:0;transition:opacity .6s ease;}
.fm-q-status.is-on{opacity:1;}
.fm-q-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);flex:0 0 auto;animation:fmQPulse 1.1s ease-in-out infinite;}
.fm-q-status.is-done .fm-q-dot{animation:none;opacity:.5;}

.fm-scan{position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:inherit;overflow:hidden;}
.fm-scan::before{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 38%,rgba(255,244,220,.30) 50%,transparent 62%);transform:translateX(-80%);opacity:0;}
.fm-act.is-visible .fm-scan::before{animation:fmScan 1.4s var(--ease) .35s both;}

.fm-moment .fm-object-foot{justify-content:flex-end;}

.fm-moment--inventory{max-width:500px;margin-top:10px;--tilt:-.4deg;--float-y:-4px;--float-r:.15deg;}
.fm-moment--inventory::before{content:'';position:absolute;top:-11px;left:50%;transform:translateX(-50%);width:76px;height:24px;border-radius:12px;background:radial-gradient(circle 4px at 50% 55%,rgba(20,18,14,.22) 96%,transparent),linear-gradient(#fdfcf9,#e6dfd1);box-shadow:0 4px 10px rgba(20,18,14,.16),inset 0 2px 3px var(--edge);}
.fm-moment--customer{max-width:450px;--tilt:-.8deg;--float-y:-6px;--float-r:-.25deg;}
.fm-moment--customer .fm-seal{display:none;}
.fm-moment--customer::after{content:'';position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 36px 36px 0;border-color:var(--scene) var(--scene) transparent transparent;filter:drop-shadow(-3px 3px 3px rgba(20,18,14,.10));}
.fm-moment--supplier{max-width:550px;--tilt:.5deg;--float-y:-3px;--float-r:.1deg;}
.fm-moment--supplier .fm-thread{display:none;}
.fm-moment--supplier::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--paper);border-radius:28px;transform:rotate(1.7deg);box-shadow:inset 0 1px 0 var(--edge),0 10px 26px rgba(20,18,14,.07);}
.fm-moment--supplier::after{content:'';position:absolute;left:16%;right:16%;bottom:-13px;height:16px;z-index:-1;background:color-mix(in srgb,var(--paper) 90%,var(--paper-ink));border-radius:0 0 14px 14px;transform:rotate(-1.1deg);box-shadow:0 10px 22px rgba(20,18,14,.07);}
.fm-brief{--float-y:-3px;--float-r:0deg;}

.fm-seal{position:absolute;top:26px;right:28px;width:24px;height:24px;border-radius:50%;background:var(--orange);box-shadow:inset 0 2px 5px rgba(60,15,0,.35),0 2px 6px rgba(20,18,14,.18);animation:fmPin 8s ease-in-out infinite;}
.fm-moment--supplier .fm-seal{animation-delay:-2.7s;}
.fm-thread{position:absolute;top:0;left:56px;width:2px;height:34px;background:linear-gradient(var(--orange),transparent);opacity:.55;border-radius:2px;}
.is-approved .fm-seal{animation:fmStamp .5s var(--ease);}

.fm-approve{border:1px solid var(--hair);background:transparent;color:var(--paper-ink);border-radius:999px;padding:8px 18px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.04em;cursor:pointer;opacity:.55;transition:opacity .25s ease,border-color .2s ease,color .2s ease;animation:fmApprovePulse 12s ease-in-out 2s infinite;}
.fm-object:hover .fm-approve,.fm-object:focus-within .fm-approve{opacity:1;}
.fm-approve:hover{border-color:var(--orange);color:var(--orange);}
.fm-approved-tag{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--orange);}

.fm-act-moment.fm-left .fm-object{align-self:flex-start;margin-left:clamp(8px,11vw,180px);--enter-x:-44px;}
.fm-act-moment.fm-right .fm-object{align-self:flex-end;margin-right:clamp(8px,11vw,180px);--enter-x:44px;}
.fm-moment.is-departed{transform:translate(32vw,-4vh) scale(.5) !important;opacity:0;pointer-events:none;animation:none;}
.fm-act.is-visible .fm-moment{animation:fmFloat 7s ease-in-out 1.5s infinite alternate;}
.fm-act.is-visible .fm-moment--customer{animation-duration:8.5s;animation-delay:1.7s;}
.fm-act.is-visible .fm-moment--supplier{animation-duration:9.5s;animation-delay:1.9s;}
.fm-act.is-visible .fm-brief{animation:fmFloat 9s ease-in-out 1.8s infinite alternate;}
.fm-slot-note{margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--ink-soft);animation:fmRise .6s var(--ease) both;}

.fm-document{max-width:640px;}
.fm-display-small{margin:0 0 10px;font-size:clamp(26px,3.4vw,40px);font-weight:650;letter-spacing:-.02em;color:var(--paper-ink);}
.fm-sign-row{display:flex;justify-content:space-between;gap:28px;margin-top:38px;padding-top:26px;border-top:1px solid var(--hair);}
.fm-sign-deboss{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:13px;box-shadow:inset 0 3px 9px rgba(20,18,14,.22);filter:grayscale(1);opacity:.6;}
.fm-sign-caption{display:block;margin-top:8px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--paper-soft);}
.fm-sign-line{border:0;border-bottom:2px dashed var(--hair);background:transparent;color:var(--paper-soft);font:inherit;font-size:16px;font-style:italic;padding:6px 4px;cursor:pointer;min-width:180px;text-align:left;transition:color .2s ease,border-color .2s ease;}
.fm-sign-line:hover{color:var(--orange);border-color:var(--orange);}
.fm-signed-name{display:block;font-style:italic;font-size:18px;color:var(--paper-ink);padding:6px 4px;border-bottom:2px solid var(--orange);}
.fm-swell{position:fixed;inset:0;z-index:20;pointer-events:none;background:radial-gradient(circle at 50% 45%,rgba(228,87,46,.14),transparent 55%);animation:fmSwell .9s ease-out both;}

.fm-act-door{text-align:center;}
.fm-door-copy{margin-bottom:46px;}
.fm-door-cta{position:relative;width:100%;max-width:620px;background:#14161a;color:#f6f3ec;border-radius:28px;padding:40px 44px;text-align:left;box-shadow:0 12px 30px rgba(20,18,14,.22),0 48px 90px rgba(20,18,14,.14);}
.fm-door-form{display:flex;gap:12px;align-items:center;}
.fm-door-input{flex:1;min-width:0;background:transparent;border:0;border-bottom:1px solid rgba(246,243,236,.25);color:inherit;font:inherit;font-size:17px;padding:12px 4px;transition:border-color .2s ease;}
.fm-door-input::placeholder{color:rgba(246,243,236,.45);}
.fm-door-input:focus{outline:none;border-color:var(--orange);}
.fm-door-send{display:grid;place-items:center;width:48px;height:48px;flex:0 0 auto;border-radius:50%;border:0;background:var(--orange);color:#fff;cursor:pointer;transition:transform .15s ease;}
.fm-door-send:hover{transform:translateY(-2px);}

.fm-quiet-link{background:none;border:0;color:var(--ink-soft);font:inherit;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-color:color-mix(in srgb,currentColor 30%,transparent);padding:0;}
.fm-quiet-link:hover{color:var(--ink);}

.fm-footer{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:28px clamp(18px,4vw,44px);color:var(--ink-soft);font-size:13px;}

.fm-stack{position:fixed;right:26px;bottom:26px;z-index:30;display:flex;align-items:center;gap:12px;color:var(--ink-soft);animation:fmRise .5s var(--ease);}
.fm-stack-slabs{position:relative;width:36px;height:28px;}
.fm-stack-slab{position:absolute;inset:0;background:var(--paper);border-radius:6px;box-shadow:0 4px 12px rgba(20,18,14,.16);}
.fm-stack-label{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}

@keyframes fmRise{from{opacity:0;transform:translateY(26px);}to{opacity:1;transform:translateY(0);}}
@keyframes fmWork{0%{filter:drop-shadow(0 0 0 rgba(228,87,46,0));transform:scale(1);}35%{filter:drop-shadow(0 0 30px rgba(228,87,46,.42));transform:scale(1.05);}70%{filter:drop-shadow(0 0 12px rgba(228,87,46,.18));transform:scale(.99);}100%{filter:drop-shadow(0 0 0 rgba(228,87,46,0));transform:scale(1);}}
@keyframes fmChipIn{from{opacity:0;transform:translateY(30px) rotate(var(--r,0deg));}to{opacity:1;transform:translateY(0) rotate(var(--r,0deg));}}
@keyframes fmPop{from{transform:scale(0);opacity:0;}to{transform:scale(1);opacity:1;}}
@keyframes fmEmerge{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
@keyframes fmProgress{from{width:0;}to{width:100%;}}
@keyframes fmCaret{0%,49%{opacity:1;}50%,100%{opacity:0;}}
@keyframes fmSpark{from{stroke-dashoffset:100;}to{stroke-dashoffset:0;}}
@keyframes fmQPulse{0%,100%{transform:scale(1);opacity:.7;}50%{transform:scale(1.35);opacity:1;}}
@keyframes fmScan{0%{transform:translateX(-80%);opacity:0;}15%{opacity:1;}85%{opacity:1;}100%{transform:translateX(80%);opacity:0;}}
@keyframes fmDrop{0%{transform:translateY(0);opacity:0;}18%{opacity:.85;}80%{transform:translateY(62vh);opacity:0;}100%{transform:translateY(62vh);opacity:0;}}
@keyframes fmFloat{from{translate:0 0;rotate:0deg;}to{translate:0 var(--float-y,-4px);rotate:var(--float-r,.15deg);}}
@keyframes fmDawn{from{transform:translateX(-60%);}to{transform:translateX(60%);}}
@keyframes fmBreathe{0%{filter:drop-shadow(0 0 0 rgba(228,87,46,0));transform:scale(1);}50%{filter:drop-shadow(0 0 24px rgba(228,87,46,.30));transform:scale(1.03);}100%{filter:drop-shadow(0 0 9px rgba(228,87,46,.12));transform:scale(1);}}
@keyframes fmStamp{0%{transform:scale(1);}40%{transform:scale(1.35);}100%{transform:scale(1);}}
@keyframes fmPin{0%,100%{transform:rotate(0deg) scale(1);}50%{transform:rotate(7deg) scale(1.05);}}
@keyframes fmSpineFlow{0%{transform:translateY(-90px);opacity:0;}15%{opacity:.7;}80%{opacity:.7;}100%{transform:translateY(100vh);opacity:0;}}
@keyframes fmApprovePulse{0%,90%,100%{border-color:var(--hair);}95%{border-color:color-mix(in srgb,var(--orange) 55%,transparent);}}
@keyframes fmSwell{from{opacity:0;}30%{opacity:1;}to{opacity:0;}}
@keyframes fmAmbient{0%,100%{opacity:.55;}50%{opacity:.8;}}
@keyframes fmDrift{from{transform:translate(0,0);}to{transform:translate(26px,-34px);}}

@media(max-width:640px){
.fm-act{padding:104px 16px 72px;}
.fm-object{padding:34px 26px;}
.fm-act-moment.fm-left .fm-object,.fm-act-moment.fm-right .fm-object{align-self:center;margin-left:0;margin-right:0;}
.fm-display{font-size:clamp(37px,11vw,60px);}
.fm-sign-row{flex-direction:column;}
.fm-door-cta{padding:30px 24px;}
.fm-stack{right:16px;bottom:16px;}
.fm-arrival-desk{gap:10px;margin-top:40px;}
.fm-chip{width:46px;height:58px;padding:11px 10px;border-radius:10px;}
}

@media(prefers-reduced-motion:reduce){
.fm-page *,.fm-page *::before,.fm-page *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;}
.fm-act:not(.is-visible) .fm-object{opacity:1;transform:none;}
.fm-act-arrival .fm-line{opacity:1;transform:none;animation:none;}
.fm-ambient,.fm-motes{display:none;}
}
`;
