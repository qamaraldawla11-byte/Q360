import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestQConcierge, type GuestSetup } from './GuestQConcierge';
import { BrandLogo } from './BrandLogo';
import { createGuestBrief, currencyForCountry } from '@/api/qGuestBrief.api';
import { ArrowDown, ArrowRight, Check, Moon, Sparkle, Sun } from 'lucide-react';

type MomentRow = { text: string; alert?: boolean };

type Moment = {
    id: 'business' | 'relationships' | 'attention';
    label: string;
    rows: MomentRow[];
    minutesAgo: number;
    working: string;
    done: string;
    depth: number;
};

const MOMENTS: Moment[] = [
    {
        id: 'business',
        label: 'Your business',
        rows: [
            { text: 'Espresso beans — running low', alert: true },
            { text: 'Reorder draft ready · Alba Foods' },
        ],
        minutesAgo: 33,
        working: 'Q is checking stock…',
        done: 'Inventory checked',
        depth: 0.05,
    },
    {
        id: 'relationships',
        label: 'Your relationships',
        rows: [
            { text: 'Customer waiting · Layla', alert: true },
            { text: 'Reply drafted — in your words' },
        ],
        minutesAgo: 26,
        working: 'Q is writing in your words…',
        done: 'Reply drafted',
        depth: 0.08,
    },
    {
        id: 'attention',
        label: 'Your attention',
        rows: [
            { text: 'Invoice 214 · 2,340 — unanswered 4 days', alert: true },
            { text: 'Next step prepared — ready to send' },
        ],
        minutesAgo: 19,
        working: 'Q is preparing the follow-up…',
        done: 'Next step prepared',
        depth: 0.04,
    },
];

const CHAPTERS = [
    { scene: 'arrival', num: '01', label: 'Meet Q' },
    { scene: 'prepare', num: '02', label: 'What Q prepares' },
    { scene: 'door', num: '03', label: 'Talk to Q' },
] as const;

const CHECK_IN_PLACEHOLDER = 'Tell Q about your business...';

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
        src="/brand/q360-icon.svg"
        alt="Q360"
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: Math.round(size * 0.24) }}
    />
);

const ConciergeCard = ({
    id,
    value,
    onChange,
    onSubmit,
    inputRef,
    placeholder,
    microcopy,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: (prompt: string) => void;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    placeholder: string;
    microcopy?: string;
}) => (
    <div className="d2-desk">
        <form
            className="d2-concierge"
            onSubmit={(event) => {
                event.preventDefault();
                if (value.trim()) onSubmit(value.trim());
            }}
        >
            <span className="d2-concierge-glow" aria-hidden="true" />
            <svg className="d2-concierge-orbit" viewBox="0 0 620 66" preserveAspectRatio="none" aria-hidden="true">
                <rect x="1.2" y="1.2" width="617.6" height="63.6" rx="31.8" pathLength={100} />
            </svg>
            <Sparkle size={18} className="d2-concierge-spark" aria-hidden="true" />
            <input
                id={id}
                ref={inputRef}
                className="d2-concierge-input"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label="Tell Q about your business"
            />
            <button className="d2-concierge-send" type="submit" aria-label="Send to Q">
                <ArrowRight size={18} />
            </button>
        </form>
        {microcopy ? <p className="d2-trust">{microcopy}</p> : null}
    </div>
);

export const LaunchLandingView = () => {
    const navigate = useNavigate();
    const pageRef = useRef<HTMLDivElement>(null);
    const arrivalInputRef = useRef<HTMLInputElement>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() =>
        localStorage.getItem('q360-landing-v2-theme') === 'dark' ? 'dark' : 'light',
    );
    const [now] = useState(() => new Date());
    const [scene, setScene] = useState('arrival');
    const [arrivalPrompt, setArrivalPrompt] = useState('');
    const [doorPrompt, setDoorPrompt] = useState('');
    const [guestPrompt, setGuestPrompt] = useState('');
    const [guestChatOpen, setGuestChatOpen] = useState(false);
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
                    if (act.dataset.scene === 'arrival' && window.matchMedia('(pointer: fine)').matches) {
                        window.setTimeout(() => arrivalInputRef.current?.focus({ preventScroll: true }), 700);
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
            const isRestaurantFamily = (type: string) => type === 'restaurant' || type === 'cafe' || type === 'café';
            if (isRestaurantFamily(setup.businessType)) {
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

    return (
        <div className="d2-page" data-d2-theme={theme} data-scene={scene} ref={pageRef}>
            <div className="d2-grain" aria-hidden="true" />
            <div className="d2-ambient" aria-hidden="true" />
            <div className="d2-moon" aria-hidden="true" />
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
                    <BrandLogo height={34} theme={theme} />
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
                <section id="d2-scene-arrival" data-scene="arrival" className="d2-act d2-arrival" aria-label="Arrival">
                    <div className="d2-arrival-inner">
                        <h1 className="d2-hero">
                            <span className="d2-hero-line d2-hero-line--time">
                                <span className="d2-hero-clock">{clockOf(now)}</span>
                                {` · ${GREETINGS[daypart]}`}
                            </span>
                            <span className="d2-hero-line">
                                Build your <span className="d2-hero-q">Q</span> workspace.
                            </span>
                            <span className="d2-hero-line d2-hero-italic">
                                Create your <em className="d2-hero-freedom">freedom.</em>
                            </span>
                        </h1>
                        <p className="d2-support">
                            Q360 is an AI workspace that takes care of your business, so you have more control over
                            your life.
                        </p>
                        <div className="d2-desk-stage">
                            <div className="d2-orbits" aria-hidden="true">
                                <span className="d2-orbit d2-orbit-one" />
                                <span className="d2-orbit d2-orbit-two" />
                                <span className="d2-orbit-dot d2-od1" />
                                <span className="d2-orbit-dot d2-od2" />
                                <span className="d2-orbit-dot d2-od3" />
                                <span className="d2-orbit-dot d2-od4" />
                            </div>
                            <ConciergeCard
                                id="d2-arrival-input"
                                value={arrivalPrompt}
                                onChange={setArrivalPrompt}
                                onSubmit={openConcierge}
                                inputRef={arrivalInputRef}
                                placeholder={CHECK_IN_PLACEHOLDER}
                                microcopy="Know more. Live more."
                            />
                        </div>
                        <div className="d2-signals" aria-hidden="true">
                            <div className="d2-signals-drift">
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
                        <div className="d2-direction">
                            <p className="d2-chapter">
                                <span className="d2-chapter-num">01</span> — Meet Q
                            </p>
                            <p className="d2-direction-line d2-direction-dim">Q learns how your business works.</p>
                        </div>
                        <button
                            type="button"
                            className="d2-scrollcue"
                            onClick={() =>
                                document.getElementById('d2-scene-prepare')?.scrollIntoView({ behavior: 'smooth' })
                            }
                        >
                            See what Q prepares
                            <ArrowDown size={14} aria-hidden="true" />
                        </button>
                    </div>
                </section>

                <section id="d2-scene-prepare" data-scene="prepare" className="d2-act d2-prepare" aria-label="What Q prepares">
                    <header className="d2-prepare-head">
                        <p className="d2-chapter">
                            <span className="d2-chapter-num">02</span> — Illustrated
                        </p>
                        <h2 className="d2-prepare-title">What Q prepares</h2>
                        <p className="d2-prepare-quiet">While you run your business, Q prepares what matters.</p>
                    </header>
                    <div className="d2-stage">
                        <article className="d2-doc d2-doc-brief">
                            <span className="d2-pin" aria-hidden="true" />
                            <span className="d2-scan" aria-hidden="true" />
                            <p className="d2-doc-label">The Daily Business Brief</p>
                            <p className="d2-doc-status">
                                <span className="d2-q-dot" aria-hidden="true" />
                                {`Prepared ${preparedAt(45)} — before you arrived`}
                            </p>
                            <p className="d2-doc-body">
                                {`${GREETINGS[daypart]}\nYesterday closed clean — 47 orders completed.\nToday: 12 customers expected. One supplier needs attention.`}
                            </p>
                            <p className="d2-human">Everything else is ready.</p>
                            <p className="d2-doc-note">Prepared by Q. Nothing happens without you.</p>
                        </article>
                        {MOMENTS.map((moment) => (
                            <div
                                key={moment.id}
                                className={'d2-moment-par d2-moment-par--' + moment.id}
                                style={{ '--depth': moment.depth } as React.CSSProperties}
                            >
                                <article className={'d2-doc d2-moment d2-moment--' + moment.id}>
                                    <span className="d2-scan" aria-hidden="true" />
                                    <p className="d2-doc-label">{moment.label}</p>
                                    <QStatus working={moment.working} done={moment.done} time={preparedAt(moment.minutesAgo)} />
                                    <div className="d2-moment-rows">
                                        {moment.rows.map((row) => (
                                            <div key={row.text} className={'d2-moment-row' + (row.alert ? ' is-alert' : '')}>
                                                <span className="d2-moment-dot" aria-hidden="true" />
                                                {row.text}
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="d2-scene-door" data-scene="door" className="d2-act d2-close" aria-label="Check in with Q">
                    <p className="d2-chapter">
                        <span className="d2-chapter-num">03</span> — Talk to Q
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
                    <div className="d2-door">
                        <h2 className="d2-door-title">
                            Tell Q what you are <em className="d2-accent">building.</em>
                        </h2>
                        <ConciergeCard
                            id="d2-door-input"
                            value={doorPrompt}
                            onChange={setDoorPrompt}
                            onSubmit={openConcierge}
                            placeholder={CHECK_IN_PLACEHOLDER}
                        />
                    </div>
                </section>
            </main>

            <footer className="d2-footer">
                <span>(c) 2026 Qamar Technologies Ltd. All rights reserved.</span>
                <button type="button" className="d2-quiet-link" onClick={() => navigate('/support')}>
                    Contact
                </button>
            </footer>

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
.d2-page{--ease:cubic-bezier(.16,1,.3,1);--orange:#FF6A00;--paper-ink:#26211a;--paper-soft:#857a68;--paper-hair:rgba(38,33,26,.13);--r-doc:22px;--r-card:18px;--r-inset:14px;--lx:50%;--ly:36%;--sunx:30%;--suny:22%;--shx:0px;--sy:0px;--sp:0;position:relative;min-height:100dvh;background:var(--bg);color:var(--ink);overflow-x:hidden;transition:background-color .45s ease,color .45s ease;}
.d2-page[data-d2-theme='light']{--bg:#fbf8f1;--elev:#fefcf7;--paper:#fdfbf5;--ink:#1c1813;--soft:#7d7364;--hair:rgba(28,24,19,.09);--doc-shadow:inset 0 1px 0 rgba(255,255,255,.7),var(--shx,0px) 18px 42px rgba(96,74,44,.12),var(--shx,0px) 64px 110px rgba(96,74,44,.08);--lift-shadow:inset 0 1px 0 rgba(255,255,255,.7),var(--shx,0px) 28px 56px rgba(96,74,44,.10),var(--shx,0px) 78px 132px rgba(96,74,44,.06);--chip-shadow:0 10px 28px rgba(96,74,44,.13);}
.d2-page[data-d2-theme='dark']{--bg:#12100c;--elev:#1a1611;--paper:#f7f1e5;--ink:#f3efe8;--soft:#a89f92;--hair:rgba(243,239,232,.14);--doc-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 24px 50px rgba(0,0,0,.5),0 80px 140px rgba(0,0,0,.42);--lift-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 32px 62px rgba(0,0,0,.44),0 92px 160px rgba(0,0,0,.36);--chip-shadow:0 12px 30px rgba(0,0,0,.5);}

.d2-grain{position:fixed;inset:-90px 0;z-index:0;pointer-events:none;opacity:.03;mix-blend-mode:multiply;transform:translateY(calc(var(--sy) * -.04));background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");}
.d2-page[data-d2-theme='dark'] .d2-grain{mix-blend-mode:soft-light;opacity:.14;}
.d2-ambient{position:fixed;inset:0;z-index:0;pointer-events:none;transition:opacity .45s ease;}
.d2-page[data-d2-theme='light'] .d2-ambient{background:radial-gradient(720px 560px at var(--sunx) var(--suny),rgba(255,214,150,.10),transparent 70%),radial-gradient(980px 640px at 10% -10%,rgba(255,214,150,.22),transparent 64%),radial-gradient(130% 100% at 50% 112%,rgba(150,110,60,.05),transparent 60%);}
.d2-page[data-d2-theme='dark'] .d2-ambient{background:radial-gradient(560px 460px at var(--lx) var(--ly),rgba(255,196,130,.11),transparent 70%),radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(0,0,0,.34));}
.d2-moon{position:fixed;top:-28vmin;right:-20vmin;width:94vmin;height:94vmin;border-radius:50%;z-index:0;pointer-events:none;background:radial-gradient(circle at 44% 44%,rgba(255,194,124,.26),rgba(255,194,124,.07) 48%,transparent 70%);transform:translateY(calc(var(--sy) * .05));}
.d2-page[data-d2-theme='dark'] .d2-moon{background:radial-gradient(circle at 44% 44%,rgba(255,180,105,.16),rgba(255,180,105,.05) 48%,transparent 70%);}

.d2-progress{display:none;position:fixed;top:0;left:0;right:0;height:2px;z-index:36;background:color-mix(in srgb,var(--soft) 18%,transparent);}
.d2-progress span{display:block;height:100%;width:calc(var(--sp) * 100%);background:var(--orange);transition:width .15s linear;}

.d2-rail{position:fixed;left:clamp(14px,2.4vw,38px);top:50%;transform:translateY(-50%);z-index:30;display:flex;flex-direction:column;gap:18px;}
.d2-rail-item{display:flex;align-items:center;gap:9px;background:none;border:0;padding:0;color:var(--soft);font:inherit;cursor:pointer;}
.d2-rail-dot{width:5px;height:5px;border-radius:50%;background:color-mix(in srgb,var(--soft) 55%,transparent);transition:background-color .25s ease,box-shadow .25s ease;}
.d2-rail-num{font-size:11px;font-weight:800;letter-spacing:.12em;}
.d2-rail-label{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:0;transform:translateX(-4px);transition:opacity .25s ease,transform .25s ease;}
.d2-rail-item:hover .d2-rail-label,.d2-rail-item.is-active .d2-rail-label{opacity:1;transform:none;}
.d2-rail-item.is-active{color:var(--orange);}
.d2-rail-item.is-active .d2-rail-dot{background:var(--orange);box-shadow:0 0 10px rgba(255,106,0,.55);}

.d2-header{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:20px clamp(18px,4vw,44px);color:var(--ink);transition:color .45s ease;}
.d2-brand{display:flex;align-items:center;background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0;}
.d2-header-actions{display:flex;align-items:center;gap:8px;}
.d2-icon-btn{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;border:1px solid transparent;background:transparent;color:inherit;cursor:pointer;}
.d2-icon-btn:hover{border-color:color-mix(in srgb,currentColor 22%,transparent);}
.d2-signin{border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:transparent;color:inherit;border-radius:999px;padding:9px 18px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;}
.d2-signin:hover{border-color:color-mix(in srgb,currentColor 55%,transparent);}
.d2-icon-btn:focus-visible,.d2-signin:focus-visible,.d2-sign-line:focus-visible,.d2-concierge-send:focus-visible,.d2-brand:focus-visible,.d2-rail-item:focus-visible,.d2-quiet-link:focus-visible,.d2-scrollcue:focus-visible{outline:2px solid color-mix(in srgb,currentColor 45%,transparent);outline-offset:2px;}

.d2-act{position:relative;z-index:1;}

.d2-arrival{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:72px clamp(20px,4vw,56px) 44px;}
.d2-arrival-inner{width:100%;max-width:1060px;margin:0 auto;text-align:center;}
.d2-arrival-inner>*{opacity:0;transform:translateY(24px);}
.d2-act.is-visible .d2-arrival-inner>*{animation:d2Rise 1.1s var(--ease) forwards;}
.d2-act.is-visible .d2-arrival-inner>*:nth-child(1){animation-delay:.12s;}
.d2-act.is-visible .d2-arrival-inner>*:nth-child(2){animation-delay:.3s;}
.d2-act.is-visible .d2-arrival-inner>*:nth-child(3){animation-delay:.48s;}
.d2-act.is-visible .d2-arrival-inner>*:nth-child(4){animation-delay:.66s;}
.d2-act.is-visible .d2-arrival-inner>*:nth-child(5){animation-delay:.86s;}
.d2-act.is-visible .d2-arrival-inner>*:nth-child(6){animation-delay:1.04s;}

.d2-hero{margin:0;font-family:Georgia,'Iowan Old Style','Times New Roman',serif;font-weight:500;letter-spacing:-.01em;}
.d2-hero-line{display:block;font-size:clamp(32px,5.1vw,66px);line-height:1.14;color:var(--ink);}
.d2-hero-line--time{font-size:clamp(36px,5.8vw,78px);line-height:1.1;white-space:nowrap;}
.d2-hero-clock{color:var(--orange);}
.d2-hero-q{color:var(--orange);}
.d2-hero-italic{font-style:italic;color:var(--soft);}
.d2-hero-freedom{color:var(--orange);}
.d2-accent{font-family:Georgia,'Iowan Old Style','Times New Roman',serif;font-style:italic;font-weight:500;color:var(--orange);}
.d2-support{margin:22px auto 28px;font-size:clamp(15px,1.4vw,17.5px);line-height:1.65;color:var(--soft);max-width:56ch;}

.d2-desk-stage{position:relative;max-width:620px;margin:0 auto;}
.d2-orbits{position:absolute;inset:0;pointer-events:none;}
.d2-orbit{position:absolute;left:50%;top:50%;border:1px solid rgba(255,106,0,.17);border-radius:50%;}
.d2-orbit-one{width:880px;height:290px;transform:translate(-50%,-50%) rotate(-7deg);}
.d2-orbit-two{width:1040px;height:370px;transform:translate(-50%,-50%) rotate(5deg);opacity:.4;}
.d2-orbit-dot{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--orange);box-shadow:0 0 12px rgba(255,106,0,.8);animation:d2QPulse 3.4s ease-in-out infinite;}
.d2-od1{left:5%;top:36%;}
.d2-od2{right:6%;top:66%;animation-delay:1.1s;}
.d2-od3{left:23%;top:92%;animation-delay:2s;}
.d2-od4{right:21%;top:2%;animation-delay:.6s;}

.d2-desk{position:relative;}
.d2-concierge{position:relative;display:flex;align-items:center;gap:12px;width:100%;max-width:620px;margin:0 auto;padding:10px 12px 10px 24px;background:var(--elev);border:1px solid var(--hair);border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 18px 48px rgba(96,74,44,.14);transition:border-color .25s ease,box-shadow .25s ease,background-color .45s ease;}
.d2-concierge-glow{position:absolute;inset:-3px;z-index:-1;border-radius:inherit;background:linear-gradient(100deg,rgba(255,106,0,.55),rgba(255,178,102,.28),rgba(255,106,0,.5));filter:blur(16px);opacity:.24;animation:d2Breathe 5.2s ease-in-out infinite;transition:opacity .3s ease;}
.d2-concierge:hover .d2-concierge-glow{opacity:.38;}
.d2-concierge:focus-within{border-color:color-mix(in srgb,var(--orange) 45%,transparent);}
.d2-concierge:focus-within .d2-concierge-glow{opacity:.5;}
.d2-concierge-orbit{position:absolute;inset:-1px;width:calc(100% + 2px);height:calc(100% + 2px);pointer-events:none;opacity:.75;}
.d2-concierge-orbit rect{fill:none;stroke:rgba(255,106,0,.8);stroke-width:1.6;stroke-linecap:round;stroke-dasharray:6 94;filter:drop-shadow(0 0 5px rgba(255,106,0,.55));animation:d2BarTravel 9s linear infinite;}
.d2-concierge:focus-within .d2-concierge-orbit rect{animation-duration:5.5s;stroke:rgba(255,106,0,.95);}
.d2-concierge-spark{color:var(--orange);flex:0 0 auto;animation:d2QPulse 3.6s ease-in-out infinite;}
.d2-concierge-input{flex:1;min-width:0;background:transparent;border:0;color:inherit;font:inherit;font-size:16.5px;padding:12px 0;caret-color:var(--orange);}
.d2-concierge-input::placeholder{color:color-mix(in srgb,var(--soft) 78%,transparent);}
.d2-concierge-input:focus{outline:none;}
.d2-concierge-send{display:grid;place-items:center;width:46px;height:46px;flex:0 0 auto;border:0;border-radius:50%;background:var(--orange);color:#fff;cursor:pointer;transition:transform .15s ease,box-shadow .2s ease;}
.d2-concierge-send:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(255,106,0,.35);}
.d2-trust{margin:20px 0 0;font-size:13.5px;font-weight:600;letter-spacing:.03em;color:var(--soft);text-align:center;}

.d2-signals{margin:28px auto 0;}
.d2-signals-drift{display:flex;justify-content:center;align-items:flex-start;gap:14px;transform:translate(calc((50% - var(--lx)) * .04), calc((50% - var(--ly)) * .06));will-change:transform;}
.d2-chip{position:relative;display:flex;flex-direction:column;justify-content:center;gap:4px;width:46px;height:58px;background:var(--paper);color:var(--paper-ink);border-radius:10px;padding:12px 10px;box-shadow:0 8px 22px rgba(96,74,44,.13);animation:d2ChipFloat 7.6s ease-in-out infinite alternate;}
.d2-chip:nth-child(2){animation-delay:.9s;animation-duration:8.4s;}
.d2-chip:nth-child(3){animation-delay:1.7s;animation-duration:7.1s;}
.d2-chip:nth-child(4){animation-delay:2.5s;animation-duration:8.8s;}
.d2-chip:nth-child(5){animation-delay:3.2s;animation-duration:7.9s;}
.d2-chip i{display:block;height:3px;border-radius:2px;background:color-mix(in srgb,var(--paper-ink) 18%,transparent);}
.d2-chip i:nth-child(2){width:72%;}
.d2-chip i:nth-child(3){width:48%;}
.d2-chip i.d2-chip-low{background:var(--orange);}
.d2-chip svg{width:24px;height:13px;}
.d2-chip svg path{fill:none;stroke:var(--paper-soft);stroke-width:2;stroke-linecap:round;}
.d2-chip-tick{position:absolute;top:-5px;right:-5px;display:grid;place-items:center;width:15px;height:15px;border-radius:50%;background:var(--orange);color:#fff;box-shadow:0 2px 5px rgba(0,0,0,.22);animation:d2QPulse 4.2s ease-in-out infinite;}
.d2-chip:nth-child(2) .d2-chip-tick{animation-delay:.7s;}
.d2-chip:nth-child(3) .d2-chip-tick{animation-delay:1.4s;}
.d2-chip:nth-child(4) .d2-chip-tick{animation-delay:2.1s;}
.d2-chip:nth-child(5) .d2-chip-tick{animation-delay:2.8s;}

.d2-direction{margin:30px auto 0;}
.d2-direction-line{margin:0;font-size:15.5px;font-weight:600;letter-spacing:.01em;line-height:1.65;color:var(--ink);}
.d2-direction-dim{color:var(--soft);font-weight:500;}

.d2-scrollcue{display:inline-flex;align-items:center;gap:8px;margin:20px auto 0;background:none;border:0;color:var(--soft);font:inherit;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;padding:8px 4px;transition:color .2s ease;}
.d2-scrollcue:hover{color:var(--orange);}
.d2-scrollcue svg{animation:d2Cue 2.2s ease-in-out infinite;}

.d2-prepare{max-width:1280px;margin:0 auto;padding:110px clamp(16px,2.5vw,32px) 90px;text-align:center;}
.d2-prepare-head{max-width:640px;margin:0 auto 64px;}
.d2-prepare-title{margin:0 0 16px;font-size:clamp(30px,3.6vw,50px);font-weight:640;letter-spacing:-.025em;line-height:1.08;}
.d2-prepare-quiet{margin:0;font-size:15px;line-height:1.6;color:var(--soft);}
.d2-chapter{margin:0 0 14px;font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--soft);}
.d2-chapter-num{color:var(--orange);}

.d2-doc{isolation:isolate;position:relative;width:100%;background:var(--paper);color:var(--paper-ink);border-radius:var(--r-doc);padding:36px 40px;box-shadow:var(--doc-shadow);transform:rotate(var(--tilt,0deg));transition:transform 1.15s var(--ease),box-shadow .9s var(--ease),opacity .9s ease,background-color .45s ease;}
.d2-act:not(.is-visible) .d2-doc{opacity:0;transform:translate(var(--enter-x,0px),56px) rotate(var(--tilt,0deg));}
.d2-act.is-visible .d2-doc{transition-delay:.15s;}
.d2-doc:hover{transform:translateY(-3px) rotate(var(--tilt,0deg));}
.d2-doc-brief{max-width:600px;margin:0 auto;text-align:left;--tilt:.4deg;--float-y:-4px;--float-r:.12deg;}
.d2-act.is-visible .d2-doc-brief{animation:d2Float 11s ease-in-out 1.9s infinite alternate;}
.d2-pin{position:absolute;top:20px;right:22px;width:22px;height:22px;border-radius:50%;background:var(--orange);box-shadow:inset 0 2px 5px rgba(60,15,0,.35),0 3px 7px rgba(0,0,0,.25);animation:d2Pin 10s ease-in-out infinite;}
.d2-doc-label{margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--paper-soft);}
.d2-doc-status{display:flex;align-items:center;gap:8px;margin:0 0 20px;font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--paper-soft);}
.d2-doc-body{margin:0;font-size:16.5px;line-height:1.65;font-weight:450;white-space:pre-line;}
.d2-human{margin:20px 0 0;font-family:Georgia,'Iowan Old Style','Times New Roman',serif;font-style:italic;font-size:19px;line-height:1.5;color:var(--paper-ink);}
.d2-doc-note{margin:16px 0 0;font-size:12.5px;color:var(--paper-soft);}
.is-approved .d2-pin{animation:d2Stamp .7s var(--ease);}

.d2-stage{position:relative;max-width:1200px;margin:0 auto;padding:36px 0 64px;}
.d2-stage .d2-doc-brief{margin:0 auto;}
.d2-moment-par{position:absolute;width:244px;z-index:2;transform:translate(calc((var(--lx) - 50%) * var(--depth,.05)),calc((var(--ly) - 50%) * var(--depth,.05)));will-change:transform;}
.d2-moment-par--business{left:3.5%;top:2%;--enter-x:-30px;width:212px;}
.d2-moment-par--relationships{right:5%;top:27%;--enter-x:30px;}
.d2-moment-par--attention{left:6%;bottom:-2%;--enter-x:-24px;width:212px;}
.d2-moment{max-width:none;padding:22px 24px;border-radius:var(--r-card);text-align:left;}
.d2-moment--business{--tilt:-.5deg;--float-y:-9px;--float-r:.12deg;}
.d2-moment--relationships{--tilt:.5deg;--float-y:-7px;--float-r:-.14deg;}
.d2-moment--attention{--tilt:-.3deg;--float-y:-11px;--float-r:.1deg;}
.d2-moment--business,.d2-moment--attention{--doc-shadow:inset 0 1px 0 rgba(255,255,255,.7),var(--shx,0px) 12px 30px rgba(96,74,44,.08),var(--shx,0px) 44px 80px rgba(96,74,44,.05);--lift-shadow:inset 0 1px 0 rgba(255,255,255,.7),var(--shx,0px) 18px 40px rgba(96,74,44,.07),var(--shx,0px) 54px 96px rgba(96,74,44,.04);}
.d2-page[data-d2-theme='dark'] .d2-moment--business,.d2-page[data-d2-theme='dark'] .d2-moment--attention{--doc-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 16px 36px rgba(0,0,0,.38),0 56px 100px rgba(0,0,0,.3);--lift-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 22px 44px rgba(0,0,0,.34),0 64px 116px rgba(0,0,0,.26);}
.d2-moment--business,.d2-moment--attention{padding:18px 20px;}
.d2-moment--business .d2-moment-row,.d2-moment--attention .d2-moment-row{font-size:12.5px;}
.d2-act.is-visible .d2-moment--business{animation:d2MomentFloat 5.6s ease-in-out 1.4s infinite alternate;}
.d2-act.is-visible .d2-moment--relationships{animation:d2MomentFloat 6.6s ease-in-out 1.8s infinite alternate;}
.d2-act.is-visible .d2-moment--attention{animation:d2MomentFloat 4.8s ease-in-out 2.2s infinite alternate;}
.d2-moment-rows{display:flex;flex-direction:column;gap:8px;margin-top:12px;}
.d2-moment-row{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;line-height:1.45;color:var(--paper-ink);}
.d2-moment-row.is-alert{color:var(--orange);}
.d2-moment-dot{width:6px;height:6px;border-radius:50%;background:color-mix(in srgb,var(--paper-ink) 30%,transparent);flex:0 0 auto;}
.d2-moment-row.is-alert .d2-moment-dot{background:var(--orange);animation:d2QPulse 2.8s ease-in-out infinite;}

.d2-q-status{display:flex;align-items:center;gap:8px;margin:-4px 0 16px;font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--paper-soft);opacity:0;transition:opacity .6s ease;}
.d2-q-status.is-on{opacity:1;}
.d2-q-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);flex:0 0 auto;animation:d2QPulse 1.1s ease-in-out infinite;}
.d2-q-status.is-done .d2-q-dot{animation:none;opacity:.5;}

.d2-scan{position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:inherit;overflow:hidden;}
.d2-scan::before{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 38%,rgba(255,244,220,.32) 50%,transparent 62%);transform:translateX(-80%);opacity:0;}
.d2-act.is-visible .d2-scan::before{animation:d2Scan 1.9s var(--ease) .5s both;}

.d2-close{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:96px 24px 80px;text-align:center;}
.d2-close .d2-chapter{margin-bottom:22px;}
.d2-doc-review{max-width:560px;--tilt:-.3deg;--float-y:-3px;--float-r:0deg;text-align:left;padding:30px 34px;}
.d2-act.is-visible .d2-doc-review{animation:d2Float 11s ease-in-out 1.9s infinite alternate;}
.d2-review-title{margin:0 0 10px;font-size:clamp(24px,2.8vw,34px);font-weight:640;letter-spacing:-.02em;color:var(--paper-ink);}
.d2-sign-row{display:flex;justify-content:space-between;gap:28px;margin-top:24px;padding-top:20px;border-top:1px solid var(--paper-hair);}
.d2-sign-deboss{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:13px;box-shadow:inset 0 3px 9px rgba(20,18,14,.22);filter:grayscale(1);opacity:.6;}
.d2-sign-caption{display:block;margin-top:8px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--paper-soft);}
.d2-sign-line{border:0;border-bottom:2px dashed var(--paper-hair);background:transparent;color:var(--paper-soft);font:inherit;font-size:16px;font-style:italic;padding:6px 4px;cursor:pointer;min-width:180px;text-align:left;transition:color .2s ease,border-color .2s ease;}
.d2-sign-line:hover{color:var(--orange);border-color:var(--orange);}
.d2-signed-name{display:block;font-style:italic;font-size:18px;color:var(--paper-ink);padding:6px 4px;border-bottom:2px solid var(--orange);}
.d2-swell{position:fixed;inset:0;z-index:20;pointer-events:none;background:radial-gradient(circle at 50% 45%,rgba(255,106,0,.14),transparent 55%);animation:d2Swell .9s ease-out both;}

.d2-door{margin-top:64px;display:flex;flex-direction:column;align-items:center;width:100%;}
.d2-door .d2-desk{width:100%;}
.d2-door-title{margin:0 0 34px;font-size:clamp(28px,3.4vw,46px);font-weight:640;letter-spacing:-.025em;line-height:1.1;}

.d2-footer{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:26px clamp(18px,4vw,44px);color:var(--soft);font-size:13px;}
.d2-quiet-link{background:none;border:0;color:var(--soft);font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-color:color-mix(in srgb,currentColor 30%,transparent);padding:0;}
.d2-quiet-link:hover{color:var(--ink);}

@keyframes d2Rise{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
@keyframes d2MomentFloat{from{translate:0 0;rotate:0deg;box-shadow:var(--doc-shadow);}to{translate:0 var(--float-y,-8px);rotate:var(--float-r,.12deg);box-shadow:var(--lift-shadow);}}
@keyframes d2QPulse{0%,100%{transform:scale(1);opacity:.7;}50%{transform:scale(1.35);opacity:1;}}
@keyframes d2Scan{0%{transform:translateX(-80%);opacity:0;}15%{opacity:1;}85%{opacity:1;}100%{transform:translateX(80%);opacity:0;}}
@keyframes d2Float{from{translate:0 0;rotate:0deg;}to{translate:0 var(--float-y,-4px);rotate:var(--float-r,.15deg);}}
@keyframes d2Stamp{0%{transform:scale(1);}40%{transform:scale(1.35);}100%{transform:scale(1);}}
@keyframes d2Pin{0%,100%{transform:rotate(0deg) scale(1);}50%{transform:rotate(7deg) scale(1.05);}}
@keyframes d2Swell{from{opacity:0;}30%{opacity:1;}to{opacity:0;}}
@keyframes d2Cue{0%,100%{transform:translateY(0);opacity:.7;}50%{transform:translateY(4px);opacity:1;}}
@keyframes d2Breathe{0%,100%{opacity:.2;}50%{opacity:.42;}}
@keyframes d2ChipFloat{from{transform:translateY(3px) rotate(-.9deg);box-shadow:0 8px 20px rgba(96,74,44,.17);}to{transform:translateY(-5px) rotate(.9deg);box-shadow:0 18px 34px rgba(96,74,44,.10);}}
@keyframes d2BarTravel{to{stroke-dashoffset:-100;}}

@media(max-width:1150px){
.d2-stage{display:flex;flex-direction:column;gap:18px;max-width:520px;margin:0 auto;}
.d2-moment-par{position:static;width:100%;transform:none !important;}
}

@media(max-width:900px){
.d2-rail{display:none;}
.d2-progress{display:block;}
.d2-arrival{padding:104px 20px 64px;}
.d2-hero-line{font-size:clamp(30px,8.4vw,48px);}
.d2-hero-line--time{font-size:clamp(26px,8.2vw,52px);}
.d2-orbits{display:none;}
.d2-signals{margin-top:32px;}
.d2-signals-drift{gap:10px;}
.d2-chip{width:42px;height:54px;padding:10px 9px;}
.d2-direction{margin-top:26px;}
.d2-prepare{padding:84px 20px 72px;}
.d2-prepare-head{margin-bottom:44px;}
.d2-doc{padding:28px 24px;}
.d2-sign-row{flex-direction:column;}
.d2-door{margin-top:72px;}
}

@media(prefers-reduced-motion:reduce){
.d2-page *,.d2-page *::before,.d2-page *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;}
.d2-act:not(.is-visible) .d2-doc{opacity:1;transform:none;}
.d2-arrival-inner>*{opacity:1;transform:none;animation:none;}
.d2-concierge-orbit{display:none;}
.d2-moment-par{transform:none !important;}
.d2-ambient{display:none;}
}
`;
