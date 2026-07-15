import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    BriefcaseBusiness,
    ChefHat,
    ClipboardList,
    FileText,
    Info,
    Moon,
    Pill,
    Receipt,
    Sparkles,
    Sun,
} from 'lucide-react';

type WorkspaceKey = 'restaurant' | 'retail' | 'supermarket' | 'autoParts' | 'services' | 'clinic' | 'pharmacy' | 'other';

type WorkspaceImage = {
    src: string;
    alt: string;
    available: boolean;
};

type WorkspaceSummary = {
    key: WorkspaceKey;
    label: string;
    title: string;
    description: string;
    sections: string[];
    futureDirection?: boolean;
    image?: WorkspaceImage;
    rows: Array<{
        label: string;
        meta: string;
        tone: 'blue' | 'green' | 'amber' | 'muted';
    }>;
    qNote: string;
};

const workspaceSummaries: Record<WorkspaceKey, WorkspaceSummary> = {
    restaurant: {
        key: 'restaurant',
        label: 'Restaurant',
        title: 'Run every service with confidence.',
        description: 'Keep tables, orders, kitchen activity, and daily service clear from opening to close.',
        sections: ['Tables', 'Orders', 'Kitchen', 'Close of day'],
        image: {
            src: '/landing/workspaces/restaurant-counter.webp',
            alt: 'Restaurant counter and service area',
            available: false,
        },
        rows: [
            { label: 'Tables', meta: 'Active', tone: 'blue' },
            { label: 'Orders', meta: 'Moving', tone: 'green' },
            { label: 'Kitchen', meta: 'Updated', tone: 'amber' },
            { label: 'Close of day', meta: 'Review', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
    retail: {
        key: 'retail',
        label: 'Retail',
        title: 'Keep every sale and customer interaction in view.',
        description: 'Bring products, customers, sales activity, and follow-up into one daily workspace.',
        sections: ['Products', 'Sales', 'Customers', 'Follow-up'],
        image: {
            src: '/landing/workspaces/retail-shelves.webp',
            alt: 'Retail shelves and product display',
            available: false,
        },
        rows: [
            { label: 'Products', meta: 'Organized', tone: 'green' },
            { label: 'Sales', meta: 'Visible', tone: 'blue' },
            { label: 'Customers', meta: 'Clear', tone: 'amber' },
            { label: 'Follow-up', meta: 'Queued', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
    supermarket: {
        key: 'supermarket',
        label: 'Supermarket',
        title: 'Stay on top of stock and daily movement.',
        description: 'See products, inventory activity, sales, and team tasks in one place.',
        sections: ['Stock', 'Products', 'Sales', 'Team tasks'],
        image: {
            src: '/landing/workspaces/supermarket-stock.webp',
            alt: 'Supermarket stock shelves and daily inventory area',
            available: false,
        },
        rows: [
            { label: 'Stock', meta: 'Current', tone: 'blue' },
            { label: 'Products', meta: 'Tracked', tone: 'green' },
            { label: 'Sales', meta: 'Daily', tone: 'amber' },
            { label: 'Team tasks', meta: 'Assigned', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
    autoParts: {
        key: 'autoParts',
        label: 'Auto Parts',
        title: 'Keep parts, customers, and orders moving.',
        description: 'Organize products, customer requests, sales activity, and supplier follow-up.',
        sections: ['Parts', 'Customer requests', 'Orders', 'Suppliers'],
        image: {
            src: '/landing/workspaces/auto-parts-tools.webp',
            alt: 'Organized auto parts shelves and workshop tools',
            available: false,
        },
        rows: [
            { label: 'Parts', meta: 'Organized', tone: 'blue' },
            { label: 'Customer requests', meta: 'Open', tone: 'amber' },
            { label: 'Orders', meta: 'Moving', tone: 'green' },
            { label: 'Suppliers', meta: 'Follow-up', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
    services: {
        key: 'services',
        label: 'Services',
        title: 'Keep every request moving toward completion.',
        description: 'Give your team a clear place for requests, jobs, tasks, and customer follow-up.',
        sections: ['Requests', 'Jobs', 'Tasks', 'Follow-up'],
        image: {
            src: '/landing/workspaces/services-workspace.webp',
            alt: 'Service desk and technician work environment',
            available: false,
        },
        rows: [
            { label: 'Requests', meta: 'Open', tone: 'blue' },
            { label: 'Jobs', meta: 'Active', tone: 'green' },
            { label: 'Tasks', meta: 'Assigned', tone: 'amber' },
            { label: 'Follow-up', meta: 'Queued', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
    clinic: {
        key: 'clinic',
        label: 'Clinic',
        title: 'A future workspace for organized appointments and daily operations.',
        description: 'Q360 is exploring how its workspace model can support clinics responsibly.',
        sections: ['Future direction', 'Appointments', 'Daily operations', 'Owner review'],
        futureDirection: true,
        rows: [
            { label: 'Future direction', meta: 'Exploring', tone: 'blue' },
            { label: 'Appointments', meta: 'Concept', tone: 'green' },
            { label: 'Daily operations', meta: 'Concept', tone: 'amber' },
            { label: 'Owner review', meta: 'Required', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
    pharmacy: {
        key: 'pharmacy',
        label: 'Pharmacy',
        title: 'A future workspace for controlled daily operations.',
        description: 'Q360 is exploring how its workspace model can support pharmacy operations responsibly.',
        sections: ['Future direction', 'Daily operations', 'Team activity', 'Owner review'],
        futureDirection: true,
        rows: [
            { label: 'Future direction', meta: 'Exploring', tone: 'blue' },
            { label: 'Daily operations', meta: 'Concept', tone: 'green' },
            { label: 'Team activity', meta: 'Concept', tone: 'amber' },
            { label: 'Owner review', meta: 'Required', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
    other: {
        key: 'other',
        label: 'Other',
        title: 'Start with the work your business does every day.',
        description: 'Use a flexible workspace for customers, requests, tasks, follow-up, and team activity.',
        sections: ['Customers', 'Requests', 'Tasks', 'Team activity'],
        image: {
            src: '/landing/workspaces/other-small-business.webp',
            alt: 'Neutral small business workspace',
            available: false,
        },
        rows: [
            { label: 'Customers', meta: 'Organized', tone: 'blue' },
            { label: 'Requests', meta: 'Open', tone: 'green' },
            { label: 'Tasks', meta: 'Assigned', tone: 'amber' },
            { label: 'Team activity', meta: 'Visible', tone: 'muted' },
        ],
        qNote: 'Q prepares insights and suggested next steps. You approve important actions.',
    },
};

const workspaceOrder: WorkspaceKey[] = ['restaurant', 'retail', 'supermarket', 'autoParts', 'services', 'clinic', 'pharmacy', 'other'];

const workspaceIcons: Record<WorkspaceKey, typeof ChefHat> = {
    restaurant: ChefHat,
    retail: Receipt,
    supermarket: Receipt,
    autoParts: BriefcaseBusiness,
    services: BriefcaseBusiness,
    clinic: ClipboardList,
    pharmacy: Pill,
    other: FileText,
};

export const LandingView = () => {
    const navigate = useNavigate();
    const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey>('restaurant');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('q360-landing-theme') === 'dark' ? 'dark' : 'light');
    const [heroPrompt, setHeroPrompt] = useState('');
    const activeSummary = workspaceSummaries[activeWorkspace];

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        localStorage.setItem('q360-landing-theme', theme);
    }, [theme]);

    return (
        <div className="landing-page" data-theme={theme}>
            <header className="landing-header">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="brand-lockup"
                    aria-label="Q360 Home"
                >
                    <BrandMark size={28} />
                    <span>Q360</span>
                </button>

                <nav className="landing-nav" aria-label="Main Navigation">
                    <button type="button" onClick={() => scrollToSection('workspaces')} className="nav-btn">Platform</button>
                    <button type="button" onClick={() => scrollToSection('workspaces')} className="nav-btn">Solutions</button>
                    <button type="button" onClick={() => scrollToSection('meet-q')} className="nav-btn">Meet Q</button>
                    <button
                        type="button"
                        className="theme-toggle"
                        onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
                        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                    >
                        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    </button>
                    <button type="button" onClick={() => navigate('/login')} className="nav-cta">
                        Start with Q360 <ArrowRight size={14} />
                    </button>
                </nav>
            </header>

            <main>
                <section className="hero-section">
                    <div className="hero-inner">
                        <div className="hero-content">
                            <span className="hero-badge">
                                <Sparkles size={14} />
                                <span>AI agent workspace for small businesses</span>
                            </span>

                            <h1>
                                <span className="hero-intro">Hello, I&apos;m <span className="hero-q-name">Q.</span></span>
                                <span className="highlight-text">One AI workspace to run your business.</span>
                            </h1>

                            <p className="hero-subtitle">
                                Meet Q, your calm AI co-founder for operations, insights, and growth.
                            </p>

                            <p className="hero-local-note">Orders, customers, inventory, payments, and insights — connected in one simple workspace.</p>

                            <div className="hero-actions">
                                <button type="button" onClick={() => navigate('/login')} className="btn-primary">
                                    Start with Q360 <ArrowRight size={16} />
                                </button>
                                <button type="button" onClick={() => scrollToSection('meet-q')} className="btn-secondary">
                                    Meet Q Agent
                                </button>
                            </div>
                        </div>

                        <div className="hero-q-stage" aria-label="Q360 AI workspace preview">
                            <span className="q-orbit q-orbit-one" aria-hidden="true"></span>
                            <span className="q-orbit q-orbit-two" aria-hidden="true"></span>
                            <span className="q-orbit-dot q-dot-one" aria-hidden="true"></span>
                            <span className="q-orbit-dot q-dot-two" aria-hidden="true"></span>
                            <span className="q-orbit-dot q-dot-three" aria-hidden="true"></span>
                            <div className="hero-q-core" aria-hidden="true">
                                <div><BrandMark size={148} /></div>
                            </div>
                            <div className="hero-agent-card">
                                <div className="hero-agent-heading">
                                    <span className="hero-q-mark"><BrandMark size={20} /></span>
                                    <strong>Q Agent</strong>
                                    <span className="agent-live-dot" aria-label="Online"></span>
                                </div>
                                <p>Good morning. Your sales are up 12% today.</p>
                                <p>Low-stock items need attention.</p>
                                <button type="button" onClick={() => scrollToSection('meet-q')}>Review &amp; approve <ArrowRight size={14} /></button>
                            </div>
                        </div>

                        <form
                            className="hero-chat-bar"
                            onSubmit={(event) => {
                                event.preventDefault();
                                navigate('/login', { state: { qPrompt: heroPrompt.trim() } });
                            }}
                        >
                            <span className="hero-chat-mark"><BrandMark size={24} /></span>
                            <input
                                value={heroPrompt}
                                onChange={(event) => setHeroPrompt(event.target.value)}
                                placeholder="Ask Q anything about your business..."
                                aria-label="Ask Q about your business"
                            />
                            <button type="submit" aria-label="Start with Q"><ArrowRight size={19} /></button>
                        </form>
                    </div>
                </section>

                <div className="section-separator" aria-hidden="true"></div>

                <section className="benefit-strip-section">
                    <div className="section-container">
                        <div className="benefit-grid">
                            <div className="benefit-card">
                                <h3>See what matters today</h3>
                                <p>Start each day with the work that needs attention.</p>
                            </div>
                            <div className="benefit-card">
                                <h3>Keep your team aligned</h3>
                                <p>Give everyone one clear place to follow daily work.</p>
                            </div>
                            <div className="benefit-card">
                                <h3>Keep work moving</h3>
                                <p>Track requests, tasks, and follow-up without losing the thread.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="section-separator" aria-hidden="true"></div>

                <section id="workspaces" className="workspaces-section">
                    <div className="section-container">
                        <div className="section-header">
                            <span className="section-kicker">YOUR BUSINESS, IN ONE PLACE</span>
                            <h2>Built around the way your business works.</h2>
                            <p>Choose your business type to see how Q360 can organize the work your team handles every day.</p>
                        </div>

                        <div className="mobile-tabs-bar" aria-label="Business type selector">
                            {workspaceOrder.map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setActiveWorkspace(key)}
                                    className={`mobile-tab ${activeWorkspace === key ? 'active' : ''}`}
                                >
                                    {workspaceSummaries[key].label}
                                    {workspaceSummaries[key].futureDirection && <span>Future direction</span>}
                                </button>
                            ))}
                        </div>

                        <div className="workspace-shell">
                            <aside className="workspace-menu" aria-label="Business type selector">
                                <span className="side-label">Business type</span>
                                {workspaceOrder.map((key) => {
                                    const Icon = workspaceIcons[key];
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setActiveWorkspace(key)}
                                            className={`workspace-menu-btn ${activeWorkspace === key ? 'active' : ''} ${workspaceSummaries[key].futureDirection ? 'future-tab' : ''}`}
                                        >
                                            <Icon size={16} />
                                            <span>{workspaceSummaries[key].label}</span>
                                            {workspaceSummaries[key].futureDirection && <em>Future direction</em>}
                                        </button>
                                    );
                                })}
                            </aside>

                            <WorkspacePanel summary={activeSummary} />
                        </div>
                    </div>
                </section>

                <div className="section-separator" aria-hidden="true"></div>

                <section id="meet-q" className="q-section">
                    <div className="section-container q-inner">
                        <div className="q-copy-block">
                            <span className="section-kicker">Q</span>
                            <h2>Meet Q, your business assistant.</h2>
                            <p className="q-desc-text">
                                Q helps you understand what may need attention next, using the activity already recorded in your workspace and the priorities you choose for your business.
                            </p>
                            <div className="trust-callout">
                                <Info size={16} />
                                <span>Q prepares insights and suggested next steps. You approve important actions.</span>
                            </div>
                        </div>

                        <div className="q-output-panel">
                            <div className="q-output-header">
                                <div className="q-output-title">
                                    <BrandMark size={20} />
                                    <span>Q insights</span>
                                </div>
                            </div>

                            <div className="q-output-body">
                                <div className="q-insight">
                                    <div className="q-insight-header">
                                        <span className="badge badge-blue">Needs attention</span>
                                    </div>
                                    <p>Several recorded updates may need a closer look. Q has prepared a short summary for review.</p>
                                </div>

                                <div className="q-insight">
                                    <div className="q-insight-header">
                                        <span className="badge badge-amber">Ready for review</span>
                                    </div>
                                    <p>Q can suggest what to check next, but important actions stay with the owner.</p>
                                </div>

                                <div className="q-insight quiet">
                                    <div className="q-insight-header">
                                        <span className="badge badge-muted">Today's summary</span>
                                    </div>
                                    <p>Q prepares insights and suggested next steps. You approve important actions.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="section-separator" aria-hidden="true"></div>

                <section className="final-cta-section">
                    <div className="section-container">
                        <div className="cta-box">
                            <span className="section-kicker">Q360</span>
                            <h2>See how Q360 can fit your business.</h2>
                            <p>Start with the workspace that matters most.</p>
                            <div className="cta-actions">
                                <button type="button" onClick={() => navigate('/support')} className="btn-primary">
                                    Talk to the Q360 team
                                </button>
                                <button type="button" onClick={() => scrollToSection('workspaces')} className="btn-secondary">
                                    Explore workspaces
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-brand">
                        <div className="footer-logo-lockup">
                            <BrandMark size={24} />
                            <span>Q360</span>
                        </div>
                        <p className="copyright-text">
                            (c) 2026 Qamar Technologies Ltd. All rights reserved.
                        </p>
                    </div>

                    <div className="footer-navigation">
                        <div className="footer-nav-col">
                            <strong>Platform</strong>
                            <button type="button" onClick={() => scrollToSection('workspaces')} className="footer-link">Workspaces</button>
                            <button type="button" onClick={() => scrollToSection('meet-q')} className="footer-link">Q Assistant</button>
                            <button type="button" onClick={() => navigate('/login')} className="footer-link">Sign In</button>
                        </div>
                        <div className="footer-nav-col">
                            <strong>Support</strong>
                            <button type="button" onClick={() => navigate('/support')} className="footer-link">Contact</button>
                            <span className="footer-link inactive">Privacy Policy</span>
                            <span className="footer-link inactive">Terms of Service</span>
                        </div>
                    </div>
                </div>
            </footer>

            <style>{landingStyles}</style>
        </div>
    );
};

const BrandMark = ({ size }: { size: number }) => (
    <img
        src="/brand/q360-icon-v2-512.png"
        alt="Q360"
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
    />
);

const WorkspacePanel = ({ summary }: { summary: WorkspaceSummary }) => {
    const Icon = workspaceIcons[summary.key];

    return (
        <div className={`workspace-panel ${summary.futureDirection ? 'future-panel' : ''}`}>
            <div className="workspace-panel-topbar">
                <div className="workspace-panel-name">
                    <Icon size={16} />
                    <span>{summary.title}</span>
                </div>
                <div className="workspace-panel-meta">
                    {summary.futureDirection ? 'Future direction' : 'Example workspace structure'}
                </div>
            </div>

            <div className="workspace-panel-body">
                <aside className="workspace-panel-nav">
                    {summary.sections.map((section, index) => (
                        <span key={section} className={index === 0 ? 'active' : ''}>{section}</span>
                    ))}
                </aside>

                <div className="workspace-panel-content">
                    {summary.image?.available && (
                        <div className="workspace-context-image">
                            <img src={summary.image.src} alt={summary.image.alt} />
                        </div>
                    )}

                    <div className="workspace-content-copy">
                        <span className="panel-label">{summary.label}</span>
                        <h3>{summary.title}</h3>
                        <p>{summary.description}</p>
                    </div>

                    <div className="fragment-rows">
                        {summary.rows.map((row) => (
                            <div className="fragment-row" key={row.label}>
                                <span className={`row-dot ${row.tone}`}></span>
                                <span>{row.label}</span>
                                <em>{row.meta}</em>
                            </div>
                        ))}
                    </div>

                    <div className="q-strip">
                        <strong>Q</strong>
                        <span>{summary.qNote}</span>
                        <em>Review</em>
                    </div>
                </div>
            </div>
        </div>
    );
};

const landingStyles = `
    .landing-page {
        --bg-zero: #f6f9ff;
        --bg-surface: #ffffff;
        --bg-raised: #f1f5fb;
        --bg-well: #e8eff9;
        --txt-primary: #10213c;
        --txt-secondary: #526782;
        --txt-muted: #71829a;
        --txt-tertiary: #8898ad;
        --blue: #1769e0;
        --blue-bright: #2782ff;
        --blue-ghost: rgba(23, 105, 224, 0.09);
        --green: #10b981;
        --green-ghost: rgba(16, 185, 129, 0.12);
        --amber: #f59e0b;
        --amber-ghost: rgba(245, 158, 11, 0.1);
        --border-1: rgba(35, 69, 109, 0.1);
        --border-2: rgba(35, 69, 109, 0.16);
        --border-3: rgba(35, 69, 109, 0.26);
        --max-w: 1100px;
        min-height: 100vh;
        background:
            radial-gradient(circle at 88% 10%, rgba(51, 133, 255, 0.13), transparent 30%),
            radial-gradient(circle at 8% 42%, rgba(19, 190, 163, 0.08), transparent 24%),
            var(--bg-zero);
        color: var(--txt-primary);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow-x: hidden;
        position: relative;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
    }

    .landing-page[data-theme='dark'] {
        --bg-zero: #080d17;
        --bg-surface: #101827;
        --bg-raised: #172235;
        --bg-well: #202e44;
        --txt-primary: #f7fbff;
        --txt-secondary: #afbdd0;
        --txt-muted: #8493a8;
        --txt-tertiary: #64748b;
        --blue: #3b82f6;
        --blue-bright: #75b2ff;
        --blue-ghost: rgba(59, 130, 246, 0.14);
        --border-1: rgba(226, 232, 240, 0.09);
        --border-2: rgba(226, 232, 240, 0.15);
        --border-3: rgba(226, 232, 240, 0.24);
    }

    .landing-page::before {
        content: '';
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        background-image:
            linear-gradient(rgba(88, 118, 153, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(88, 118, 153, 0.1) 1px, transparent 1px);
        background-size: 80px 80px;
        mask-image: radial-gradient(ellipse 120% 80% at 50% 0%, black 28%, transparent 100%);
        -webkit-mask-image: radial-gradient(ellipse 120% 80% at 50% 0%, black 28%, transparent 100%);
    }

    .landing-page::after {
        content: '';
        position: fixed;
        top: -280px;
        left: 50%;
        width: 900px;
        height: 600px;
        transform: translateX(-50%);
        background: radial-gradient(ellipse, rgba(59, 130, 246, 0.11) 0%, transparent 65%);
        pointer-events: none;
        z-index: 0;
    }

    .landing-page * {
        box-sizing: border-box;
    }

    .landing-page button {
        font: inherit;
    }

    .landing-header {
        position: sticky;
        top: 0;
        z-index: 100;
        height: 56px;
        padding: 0 max(24px, calc((100vw - var(--max-w)) / 2 + 48px));
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(246, 249, 255, 0.82);
        border-bottom: 1px solid var(--border-1);
        backdrop-filter: blur(24px);
    }

    .landing-page[data-theme='dark'] .landing-header { background: rgba(8, 13, 23, 0.86); }

    .brand-lockup {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--txt-primary);
        cursor: pointer;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.2px;
    }

    .landing-nav {
        display: flex;
        align-items: center;
        gap: 28px;
    }

    .theme-toggle {
        display: grid;
        width: 34px;
        height: 34px;
        place-items: center;
        padding: 0;
        color: var(--txt-secondary);
        background: var(--bg-raised);
        border: 1px solid var(--border-2);
        border-radius: 50%;
        cursor: pointer;
        transition: transform 160ms ease, color 160ms ease, border-color 160ms ease;
    }

    .theme-toggle:hover { color: var(--blue); border-color: var(--blue); transform: rotate(12deg); }

    .nav-btn,
    .footer-link {
        background: transparent;
        border: 0;
        color: var(--txt-secondary);
        cursor: pointer;
        padding: 0;
        transition: color 160ms ease;
    }

    .nav-btn {
        font-size: 13px;
    }

    .nav-btn:hover,
    .footer-link:hover {
        color: var(--txt-primary);
    }

    .nav-cta {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--txt-primary);
        background: transparent;
        border: 1px solid var(--border-2);
        border-radius: 4px;
        padding: 7px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
    }

    .nav-cta:hover {
        background: var(--bg-raised);
        border-color: var(--border-3);
        transform: translateY(-1px);
    }

    .hero-section,
    .benefit-strip-section,
    .workspaces-section,
    .q-section,
    .final-cta-section,
    .landing-footer {
        position: relative;
        z-index: 1;
    }

    .hero-section {
        min-height: calc(100vh - 56px);
        display: flex;
        align-items: center;
        padding: 66px 48px 80px;
    }

    .hero-inner {
        width: 100%;
        max-width: var(--max-w);
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, .84fr) minmax(440px, 1.16fr);
        align-items: center;
        gap: clamp(40px, 7vw, 108px);
    }

    .hero-content {
        max-width: 560px;
        animation: fade-up 520ms ease both;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 18px;
        margin-bottom: 38px;
        color: var(--blue-bright);
        background: var(--blue-ghost);
        border: 1px solid rgba(59, 130, 246, 0.24);
        border-radius: 999px;
        font-size: 14px;
        font-weight: 600;
    }

    .hero-section h1 {
        max-width: 660px;
        margin: 0;
        color: var(--txt-primary);
        font-size: clamp(42px, 5.8vw, 72px);
        font-weight: 650;
        letter-spacing: -1.8px;
        line-height: 1.06;
        overflow-wrap: break-word;
    }

    .highlight-text {
        display: block;
        color: var(--blue-bright);
    }

    .hero-q-name {
        color: var(--amber);
    }

    .hero-subtitle {
        max-width: 620px;
        margin: 28px 0 44px;
        color: var(--txt-secondary);
        font-size: 18px;
        font-weight: 300;
        line-height: 1.65;
    }

    .hero-local-note {
        display: flex;
        align-items: center;
        max-width: 600px;
        margin: -24px 0 30px;
        color: var(--txt-muted);
        font-size: 13px;
    }

    .hero-actions,
    .cta-actions {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
    }

    .btn-primary,
    .btn-secondary {
        border-radius: 4px;
        padding: 13px 24px;
        font-size: 14px;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 140ms ease, box-shadow 160ms ease;
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--blue);
        background: var(--blue);
        color: #fff;
        font-weight: 500;
        box-shadow: 0 0 0 rgba(59, 130, 246, 0);
    }

    .btn-primary:hover {
        background: var(--blue-bright);
        border-color: var(--blue-bright);
        transform: translateY(-1px);
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.25);
    }

    .btn-secondary {
        border: 1px solid var(--border-2);
        background: transparent;
        color: var(--txt-secondary);
    }

    .btn-secondary:hover {
        color: var(--txt-primary);
        border-color: var(--border-3);
        transform: translateY(-1px);
    }

    .hero-value-list {
        display: grid;
        gap: 9px;
        margin-top: 34px;
    }

    .hero-value-card {
        display: flex;
        align-items: center;
        gap: 11px;
        width: min(100%, 335px);
        padding: 9px 12px;
        background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
        border: 1px solid var(--border-1);
        border-radius: 13px;
        box-shadow: 0 10px 22px rgba(44, 70, 110, .05);
    }

    .hero-value-card > span {
        display: grid;
        width: 32px;
        height: 32px;
        flex: 0 0 auto;
        place-items: center;
        color: var(--blue);
        background: var(--blue-ghost);
        border-radius: 9px;
    }

    .hero-value-card strong,
    .hero-value-card small {
        display: block;
        line-height: 1.25;
    }

    .hero-value-card strong { font-size: 12px; }
    .hero-value-card small { margin-top: 2px; color: var(--txt-muted); font-size: 11px; }

    .hero-preview {
        margin-top: 78px;
        overflow: hidden;
        background: var(--bg-surface);
        border: 1px solid var(--border-2);
        border-radius: 8px;
        box-shadow: 0 38px 84px rgba(32, 63, 100, 0.17), 0 0 80px rgba(59, 130, 246, 0.08);
        animation: float-in 700ms ease 120ms both, drift 8s ease-in-out 1s infinite;
    }

    .hero-cafe-visual {
        position: relative;
        min-height: 560px;
        overflow: hidden;
        isolation: isolate;
        border: 1px solid rgba(52, 111, 188, .18);
        border-radius: 32px;
        background: #122340;
        box-shadow: 0 34px 82px rgba(26, 71, 137, .20), 0 0 100px rgba(59, 130, 246, .12);
        animation: float-in 700ms ease 120ms both, drift 8s ease-in-out 1s infinite;
    }

    .hero-cafe-visual img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 560px;
        object-fit: cover;
        object-position: center;
        transform: scale(1.015);
        transition: transform 700ms ease;
    }

    .hero-cafe-visual:hover img { transform: scale(1.045); }

    .hero-cafe-overlay {
        position: absolute;
        z-index: 1;
        inset: 0;
        background: linear-gradient(135deg, rgba(7, 20, 42, .18), transparent 48%), linear-gradient(0deg, rgba(7, 20, 42, .76), transparent 52%);
        pointer-events: none;
    }

    .hero-q-orbit {
        position: absolute;
        z-index: 2;
        top: 38px;
        right: 36px;
        display: grid;
        width: 124px;
        height: 124px;
        place-items: center;
        color: #fff;
        background: rgba(255, 255, 255, .12);
        border: 1px solid rgba(255, 255, 255, .32);
        border-radius: 50%;
        backdrop-filter: blur(12px);
        box-shadow: 0 20px 50px rgba(6, 19, 43, .23), inset 0 0 0 17px rgba(255, 255, 255, .07);
        animation: orbit-pulse 4s ease-in-out infinite;
    }

    .hero-agent-card {
        position: absolute;
        z-index: 2;
        right: 24px;
        bottom: 58px;
        left: 24px;
        display: flex;
        align-items: flex-start;
        gap: 13px;
        padding: 17px 18px;
        color: #f8fbff;
        background: rgba(11, 29, 58, .80);
        border: 1px solid rgba(184, 221, 255, .3);
        border-radius: 16px;
        backdrop-filter: blur(14px);
        box-shadow: 0 14px 28px rgba(3, 11, 25, .22);
    }

    .hero-q-mark {
        display: grid;
        flex: 0 0 auto;
        width: 38px;
        height: 38px;
        place-items: center;
        background: rgba(127, 212, 255, .17);
        border: 1px solid rgba(159, 224, 255, .32);
        border-radius: 12px;
    }

    .hero-agent-card strong,
    .hero-agent-card p,
    .hero-agent-card small { display: block; margin: 0; }
    .hero-agent-card small { color: #81caff; font-size: 10px; font-weight: 800; letter-spacing: .09em; }
    .hero-agent-card strong { margin-top: 4px; font-size: 14px; font-weight: 700; }
    .hero-agent-card p { margin-top: 5px; color: #c9ddf5; font-size: 12px; line-height: 1.45; }

    .hero-cafe-caption {
        position: absolute;
        z-index: 2;
        right: 24px;
        bottom: 24px;
        color: rgba(236, 246, 255, .86);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: .05em;
        text-transform: uppercase;
    }

    .preview-topbar,
    .workspace-panel-topbar,
    .q-output-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 40px;
        padding: 0 20px;
        background: var(--bg-raised);
        border-bottom: 1px solid var(--border-1);
    }

    .browser-dots {
        display: flex;
        gap: 6px;
    }

    .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
    }

    .preview-title,
    .workspace-panel-name,
    .q-output-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--txt-secondary);
        font-size: 12px;
        font-weight: 600;
    }

    .preview-chip,
    .label-screenshot,
    .workspace-panel-meta {
        border: 1px solid var(--border-1);
        border-radius: 3px;
        color: var(--txt-muted);
        font-size: 9px;
        letter-spacing: 1.2px;
        padding: 2px 7px;
        text-transform: uppercase;
    }

    .preview-body {
        display: grid;
        grid-template-columns: 200px minmax(0, 1fr);
        min-height: 378px;
    }

    .preview-sidenav,
    .workspace-menu,
    .workspace-panel-nav {
        border-right: 1px solid var(--border-1);
    }

    .preview-sidenav,
    .workspace-menu {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 18px 8px;
    }

    .side-label,
    .section-kicker,
    .panel-label {
        color: var(--txt-tertiary);
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 2px;
        text-transform: uppercase;
    }

    .side-label {
        padding: 0 12px 8px;
    }

    .section-kicker {
        color: var(--blue);
    }

    .sidebar-tab,
    .workspace-menu-btn,
    .mobile-tab,
    .workspace-panel-nav span {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        min-height: 36px;
        padding: 8px 12px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        color: var(--txt-muted);
        cursor: pointer;
        font-size: 12px;
        text-align: left;
        transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
    }

    .workspace-menu-btn {
        min-height: 44px;
        font-size: 14px;
        font-weight: 500;
    }

    .sidebar-tab:hover,
    .workspace-menu-btn:hover,
    .mobile-tab:hover {
        background: var(--bg-well);
        color: var(--txt-secondary);
    }

    .sidebar-tab.active,
    .workspace-menu-btn.active,
    .mobile-tab.active,
    .workspace-panel-nav span.active {
        background: var(--blue-ghost);
        border-color: rgba(59, 130, 246, 0.18);
        color: var(--blue-bright);
    }

    .workspace-menu-btn em,
    .mobile-tab span {
        margin-left: auto;
        color: var(--txt-tertiary);
        font-size: 9px;
        font-style: normal;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }

    .preview-main {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 24px;
    }

    .preview-header-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
    }

    .preview-header-row h2,
    .workspace-content-copy h3 {
        margin: 3px 0 0;
        color: var(--txt-primary);
        font-size: 16px;
        line-height: 1.25;
    }

    .stat-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
    }

    .stat-block {
        padding: 14px 16px;
        background: var(--bg-raised);
        border: 1px solid var(--border-1);
        border-radius: 4px;
    }

    .stat-block span {
        display: block;
        margin-bottom: 10px;
        color: var(--txt-tertiary);
        font-size: 9px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
    }

    .stat-bar {
        height: 3px;
        overflow: hidden;
        border-radius: 3px;
        background: var(--bg-well);
    }

    .stat-bar i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--blue);
        opacity: 0.75;
    }

    .abstract-table,
    .fragment-rows {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .abstract-row,
    .fragment-row {
        display: grid;
        grid-template-columns: 14px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        min-height: 36px;
        padding: 8px 10px;
        color: var(--txt-secondary);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 12px;
    }

    .fragment-row {
        min-height: 42px;
        background: rgba(255, 255, 255, 0.01);
        border-color: var(--border-1);
    }

    .abstract-row:hover,
    .fragment-row:hover {
        background: var(--bg-raised);
    }

    .abstract-row em,
    .fragment-row em,
    .q-strip em {
        color: var(--txt-tertiary);
        font-size: 10px;
        font-style: normal;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .row-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--txt-tertiary);
    }

    .row-dot.blue { background: var(--blue); }
    .row-dot.green { background: var(--green); }
    .row-dot.amber { background: var(--amber); }
    .row-dot.muted { background: var(--txt-tertiary); }

    .q-strip {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 9px 10px;
        background: rgba(59, 130, 246, 0.045);
        border: 1px solid rgba(59, 130, 246, 0.14);
        border-radius: 4px;
    }

    .q-strip strong {
        color: var(--blue);
        font-size: 10px;
        letter-spacing: 1.5px;
    }

    .q-strip span {
        color: var(--txt-secondary);
        font-size: 12px;
    }

    .section-separator {
        position: relative;
        z-index: 1;
        height: 1px;
        background: var(--border-1);
    }

    .section-container {
        max-width: var(--max-w);
        margin: 0 auto;
        padding: 0 48px;
    }

    .workspaces-section,
    .q-section,
    .final-cta-section {
        padding: 126px 0;
    }

    .benefit-strip-section {
        padding: 54px 0;
    }

    .section-header {
        max-width: 620px;
        margin-bottom: 48px;
    }

    .section-header.compact {
        max-width: 760px;
    }

    .section-header h2,
    .q-copy-block h2,
    .cta-box h2 {
        margin: 14px 0 0;
        color: var(--txt-primary);
        font-size: clamp(30px, 3.8vw, 44px);
        font-weight: 620;
        letter-spacing: -1.1px;
        line-height: 1.15;
    }

    .section-header p,
    .q-desc-text,
    .cta-box p {
        max-width: 620px;
        margin: 18px 0 0;
        color: var(--txt-secondary);
        font-size: 16px;
        font-weight: 300;
        line-height: 1.65;
    }

    .benefit-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
    }

    .benefit-card,
    .cta-box,
    .trust-callout {
        background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
        border: 1px solid var(--border-1);
        border-radius: 8px;
    }

    .benefit-card {
        padding: 22px;
    }

    .benefit-card h3 {
        margin: 0 0 10px;
        color: var(--txt-primary);
        font-size: 16px;
    }

    .benefit-card p {
        margin: 0;
        color: var(--txt-secondary);
        font-size: 13px;
        line-height: 1.55;
    }

    .workspace-shell {
        display: grid;
        grid-template-columns: 230px minmax(0, 1fr);
        border: 1px solid var(--border-2);
        border-radius: 8px;
        overflow: hidden;
        background: var(--bg-surface);
        box-shadow: 0 32px 72px rgba(32, 63, 100, 0.16);
    }

    .mobile-tabs-bar {
        display: none;
    }

    .workspace-panel {
        min-width: 0;
    }

    .workspace-panel-body {
        display: grid;
        grid-template-columns: 190px minmax(0, 1fr);
        min-height: 390px;
    }

    .workspace-panel-nav {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 18px 10px;
        background: rgba(255, 255, 255, 0.01);
    }

    .workspace-panel-nav span {
        cursor: default;
    }

    .workspace-panel-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 28px;
    }

    .workspace-context-image {
        position: relative;
        height: 190px;
        overflow: hidden;
        background: var(--bg-well);
        border: 1px solid rgba(59, 130, 246, 0.16);
        border-radius: 6px;
        animation: fade-up 240ms ease both;
    }

    .workspace-context-image::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(8, 8, 8, 0.12), rgba(8, 8, 8, 0.58));
        pointer-events: none;
    }

    .workspace-context-image img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .workspace-content-copy p {
        max-width: 640px;
        margin: 10px 0 0;
        color: var(--txt-secondary);
        font-size: 14px;
        line-height: 1.65;
    }

    .future-panel {
        opacity: 0.86;
    }

    .q-inner {
        display: grid;
        grid-template-columns: 0.92fr 1.08fr;
        gap: 72px;
        align-items: center;
    }

    .q-copy-block {
        min-width: 0;
    }

    .trust-callout {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-top: 34px;
        padding: 16px 18px;
        color: var(--txt-secondary);
        font-size: 13px;
        line-height: 1.5;
    }

    .trust-callout svg {
        flex: 0 0 auto;
        color: var(--blue);
        margin-top: 2px;
    }

    .q-output-panel {
        overflow: hidden;
        background: var(--bg-surface);
        border: 1px solid var(--border-2);
        border-radius: 8px;
        box-shadow: 0 30px 68px rgba(32, 63, 100, 0.15);
    }

    .q-output-body {
        display: flex;
        flex-direction: column;
        padding: 22px;
    }

    .q-insight {
        padding: 18px 0;
        border-bottom: 1px solid var(--border-1);
    }

    .q-insight:first-child {
        padding-top: 0;
    }

    .q-insight:last-child {
        padding-bottom: 0;
        border-bottom: 0;
    }

    .q-insight.quiet {
        opacity: 0.9;
    }

    .q-insight-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 10px;
    }

    .q-insight p {
        margin: 0;
        color: var(--txt-secondary);
        font-size: 13px;
        line-height: 1.55;
    }

    .badge {
        border-radius: 3px;
        font-size: 10px;
        font-weight: 600;
        padding: 3px 7px;
    }

    .badge-blue {
        background: var(--blue-ghost);
        color: var(--blue-bright);
    }

    .badge-amber {
        background: var(--amber-ghost);
        color: var(--amber);
    }

    .badge-muted {
        background: var(--bg-well);
        color: var(--txt-muted);
    }

    .cta-box {
        max-width: 860px;
        margin: 0 auto;
        padding: 56px 44px;
        text-align: center;
    }

    .cta-box p {
        margin-left: auto;
        margin-right: auto;
    }

    .cta-actions {
        justify-content: center;
        margin-top: 34px;
    }

    .landing-footer {
        border-top: 1px solid var(--border-1);
        background: rgba(241, 246, 253, 0.88);
        padding: 52px 0 42px;
    }

    .landing-page[data-theme='dark'] .landing-footer { background: rgba(8, 13, 23, 0.9); }

    .footer-container {
        max-width: var(--max-w);
        margin: 0 auto;
        padding: 0 48px;
        display: flex;
        justify-content: space-between;
        gap: 60px;
    }

    .footer-brand {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
    }

    .footer-logo-lockup {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--txt-primary);
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.2px;
    }

    .copyright-text {
        margin: 0;
        color: var(--txt-tertiary);
        font-size: 12px;
    }

    .footer-navigation {
        display: flex;
        gap: 76px;
    }

    .footer-nav-col {
        display: flex;
        flex-direction: column;
        gap: 11px;
    }

    .footer-nav-col strong {
        margin-bottom: 4px;
        color: var(--txt-primary);
        font-size: 13px;
    }

    .footer-link {
        font-size: 13px;
        text-align: left;
    }

    .footer-link.inactive,
    .footer-link.inactive:hover {
        color: var(--txt-tertiary);
        cursor: default;
    }

    button:focus-visible,
    .footer-link:focus-visible {
        outline: 2px solid var(--blue);
        outline-offset: 4px;
    }

    @keyframes fade-up {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes float-in {
        from { opacity: 0; transform: translateY(18px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes drift {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-9px); }
    }

    @keyframes orbit-pulse {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-6px) scale(1.025); }
    }

    /* Q-first landing hero: intentionally declared last to keep the public
       first impression focused while preserving the mature sections below. */
    .landing-page {
        --hero-ink: #111317;
        --hero-muted: #626875;
        --hero-orange: #ff8a1c;
        --hero-line: rgba(17, 19, 23, 0.08);
        --max-w: 1260px;
    }

    .landing-header {
        height: 72px;
        border-bottom-color: var(--hero-line);
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(20px) saturate(140%);
    }

    .landing-page[data-theme='dark'] .landing-header {
        background: rgba(9, 12, 18, 0.9);
        border-bottom-color: rgba(255, 255, 255, 0.08);
    }

    .brand-lockup {
        color: var(--hero-ink);
        font-weight: 800;
        letter-spacing: -0.4px;
    }

    .landing-page[data-theme='dark'] .brand-lockup { color: #fff; }

    .nav-cta {
        min-height: 42px;
        padding: 0 18px;
        border-radius: 11px;
        background: #111317;
        color: #fff;
        box-shadow: 0 9px 26px rgba(17, 19, 23, 0.12);
    }

    .nav-cta:hover { background: #292c32; }

    .hero-section {
        min-height: calc(100vh - 72px);
        padding: 68px 48px 44px;
        background:
            radial-gradient(circle at 70% 42%, rgba(255, 187, 113, 0.15), transparent 28%),
            radial-gradient(circle at 58% 46%, rgba(255, 255, 255, 0.96), transparent 47%),
            linear-gradient(145deg, #fff 0%, #fbfaf8 58%, #fff8f0 100%);
    }

    .hero-section::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.36;
        background-image:
            linear-gradient(var(--hero-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--hero-line) 1px, transparent 1px);
        background-size: 78px 78px;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.25), transparent 78%);
    }

    .landing-page[data-theme='dark'] .hero-section {
        background:
            radial-gradient(circle at 68% 42%, rgba(255, 138, 28, 0.13), transparent 31%),
            linear-gradient(145deg, #0a0d12 0%, #10141b 100%);
    }

    .hero-inner {
        position: relative;
        z-index: 1;
        max-width: 1260px;
        grid-template-columns: minmax(390px, 0.9fr) minmax(520px, 1.1fr);
        align-items: center;
        gap: 30px 64px;
    }

    .hero-content {
        position: relative;
        z-index: 3;
        padding: 12px 0 16px;
    }

    .hero-badge {
        margin-bottom: 27px;
        border-color: rgba(255, 138, 28, 0.24);
        background: rgba(255, 255, 255, 0.78);
        color: #a34a00;
        box-shadow: 0 10px 30px rgba(121, 71, 23, 0.06);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 11px;
        font-weight: 800;
    }

    .landing-page[data-theme='dark'] .hero-badge {
        background: rgba(255, 255, 255, 0.05);
        color: #ffae5f;
    }

    .hero-section h1 {
        max-width: 585px;
        color: var(--hero-ink);
        font-size: clamp(50px, 5vw, 76px);
        line-height: 0.99;
        letter-spacing: -0.058em;
    }

    .landing-page[data-theme='dark'] .hero-section h1 { color: #fff; }

    .hero-intro,
    .hero-section .highlight-text {
        display: block;
    }

    .hero-intro {
        margin-bottom: 15px;
        font-size: 0.58em;
        line-height: 1.12;
        letter-spacing: -0.035em;
    }

    .hero-q-name {
        color: var(--hero-orange);
        -webkit-text-fill-color: var(--hero-orange);
    }

    .hero-section .highlight-text {
        color: inherit;
        -webkit-text-fill-color: currentColor;
        background: none;
    }

    .hero-subtitle {
        max-width: 500px;
        margin-top: 29px;
        color: var(--hero-muted);
        font-size: 19px;
        line-height: 1.55;
    }

    .hero-local-note {
        max-width: 530px;
        margin-top: 12px;
        color: #7b8089;
        font-size: 14px;
        line-height: 1.6;
    }

    .hero-actions { margin-top: 30px; }

    .hero-actions .btn-primary,
    .hero-actions .btn-secondary {
        min-height: 50px;
        border-radius: 11px;
        padding: 0 21px;
    }

    .hero-actions .btn-primary {
        background: var(--hero-ink);
        color: #fff;
        box-shadow: 0 16px 32px rgba(17, 19, 23, 0.14);
    }

    .hero-actions .btn-primary:hover { background: #292c32; }

    .hero-actions .btn-secondary {
        border-color: rgba(17, 19, 23, 0.11);
        background: rgba(255, 255, 255, 0.78);
        color: var(--hero-ink);
    }

    .hero-q-stage {
        position: relative;
        min-height: 520px;
        isolation: isolate;
    }

    .hero-q-stage::before {
        content: '';
        position: absolute;
        z-index: -2;
        top: 50%;
        left: 50%;
        width: 510px;
        height: 510px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.98) 0 34%, rgba(255, 226, 193, 0.42) 52%, transparent 72%);
        transform: translate(-50%, -50%);
        filter: blur(2px);
    }

    .q-orbit {
        position: absolute;
        z-index: -1;
        top: 49%;
        left: 50%;
        border: 1px solid rgba(224, 155, 85, 0.25);
        border-radius: 50%;
        transform: translate(-50%, -50%) rotate(-12deg);
    }

    .q-orbit-one { width: 620px; height: 315px; }
    .q-orbit-two { width: 520px; height: 410px; transform: translate(-50%, -50%) rotate(28deg); }

    .q-orbit-dot {
        position: absolute;
        z-index: 2;
        width: 13px;
        height: 13px;
        border: 3px solid rgba(255, 255, 255, 0.92);
        border-radius: 50%;
        background: var(--hero-orange);
        box-shadow: 0 0 24px rgba(255, 138, 28, 0.55);
    }

    .q-dot-one { top: 19%; left: 18%; }
    .q-dot-two { top: 25%; right: 7%; width: 9px; height: 9px; }
    .q-dot-three { right: 20%; bottom: 13%; width: 8px; height: 8px; }

    .hero-q-core {
        position: absolute;
        top: 47%;
        left: 48%;
        width: 320px;
        height: 320px;
        padding: 23px;
        border: 1px solid rgba(17, 19, 23, 0.045);
        border-radius: 50%;
        background: linear-gradient(145deg, #fff, #e9e6e2);
        box-shadow:
            -22px -22px 60px rgba(255, 255, 255, 0.95),
            30px 36px 70px rgba(104, 87, 68, 0.19),
            inset 8px 8px 16px rgba(255, 255, 255, 0.9),
            inset -8px -8px 18px rgba(124, 109, 92, 0.1);
        transform: translate(-50%, -50%);
        animation: q-float 6s ease-in-out infinite;
    }

    .hero-q-core > div {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        border: 1px solid rgba(17, 19, 23, 0.04);
        border-radius: 50%;
        background: linear-gradient(145deg, #f3f0ec, #fff);
        box-shadow: inset 12px 12px 25px rgba(121, 102, 83, 0.08), inset -10px -10px 24px #fff;
    }

    .hero-q-core svg {
        width: 148px;
        height: 148px;
        color: #111317;
        filter: drop-shadow(0 13px 13px rgba(17, 19, 23, 0.12));
    }

    .hero-agent-card {
        position: absolute;
        z-index: 5;
        right: -12px;
        bottom: 42px;
        width: 270px;
        display: block;
        padding: 21px;
        border: 1px solid rgba(17, 19, 23, 0.07);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.92);
        color: var(--hero-ink);
        box-shadow: 0 28px 64px rgba(84, 65, 44, 0.18);
        backdrop-filter: blur(18px);
    }

    .hero-agent-heading {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 18px;
    }

    .hero-agent-heading strong { font-size: 14px; }

    .agent-live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #24b56d;
        box-shadow: 0 0 0 3px rgba(36, 181, 109, 0.13);
    }

    .hero-q-mark {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #111317;
        color: #fff;
    }

    .hero-agent-card p {
        margin: 0 0 9px;
        color: #363a41;
        font-size: 13px;
        line-height: 1.45;
    }

    .hero-agent-card button {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 16px;
        padding: 13px 0 0;
        border: 0;
        border-top: 1px solid rgba(17, 19, 23, 0.08);
        background: transparent;
        color: #d86800;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
    }

    .hero-chat-bar {
        grid-column: 1 / -1;
        width: min(720px, 100%);
        min-height: 68px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 13px;
        margin: -8px auto 0;
        padding: 8px 9px 8px 17px;
        border: 1px solid rgba(17, 19, 23, 0.08);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 22px 60px rgba(94, 72, 47, 0.14);
        backdrop-filter: blur(18px);
    }

    .hero-chat-mark {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        color: var(--hero-ink);
    }

    .hero-chat-bar input {
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--hero-ink);
        font: inherit;
        font-size: 15px;
    }

    .hero-chat-bar input::placeholder { color: #8a8f98; }

    .hero-chat-bar button {
        width: 50px;
        height: 50px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 50%;
        background: var(--hero-ink);
        color: #fff;
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease;
    }

    .hero-chat-bar button:hover { transform: translateX(2px); background: #292c32; }

    .landing-page[data-theme='dark'] .hero-subtitle,
    .landing-page[data-theme='dark'] .hero-local-note { color: #a9b0bc; }

    .landing-page[data-theme='dark'] .hero-q-stage::before {
        background: radial-gradient(circle, rgba(255, 255, 255, 0.09) 0 30%, rgba(255, 138, 28, 0.09) 52%, transparent 72%);
    }

    .landing-page[data-theme='dark'] .hero-q-core {
        border-color: rgba(255, 255, 255, 0.1);
        background: linear-gradient(145deg, #2a303a, #11151b);
        box-shadow: -20px -20px 55px rgba(255, 255, 255, 0.025), 28px 34px 70px rgba(0, 0, 0, 0.48);
    }

    .landing-page[data-theme='dark'] .hero-q-core > div {
        background: linear-gradient(145deg, #1e242c, #11151b);
        box-shadow: inset 10px 10px 22px rgba(0, 0, 0, 0.25), inset -8px -8px 20px rgba(255, 255, 255, 0.03);
    }

    .landing-page[data-theme='dark'] .hero-q-core svg { color: #fff; }

    .landing-page[data-theme='dark'] .hero-agent-card,
    .landing-page[data-theme='dark'] .hero-chat-bar {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgba(19, 24, 32, 0.92);
        color: #fff;
        box-shadow: 0 26px 65px rgba(0, 0, 0, 0.35);
    }

    .landing-page[data-theme='dark'] .hero-agent-card p { color: #c4cad4; }
    .landing-page[data-theme='dark'] .hero-chat-bar input { color: #fff; }

    @keyframes q-float {
        0%, 100% { transform: translate(-50%, -50%) translateY(0); }
        50% { transform: translate(-50%, -50%) translateY(-10px); }
    }

    @media (max-width: 1024px) {
        .hero-section { padding-top: 64px; }
        .hero-inner { grid-template-columns: 1fr; gap: 22px; }
        .hero-content { max-width: 690px; margin: 0 auto; text-align: center; }
        .hero-section h1,
        .hero-subtitle,
        .hero-local-note { margin-right: auto; margin-left: auto; }
        .hero-actions { justify-content: center; }
        .hero-q-stage { width: min(680px, 100%); min-height: 475px; margin: 0 auto; }
        .hero-chat-bar { margin-top: -14px; }
    }

    @media (max-width: 720px) {
        .landing-header { height: 64px; padding: 0 18px; }
        .landing-nav .nav-btn { display: none; }
        .brand-lockup span { display: inline; }
        .nav-cta { padding: 0 13px; font-size: 12px; }
        .hero-section { min-height: auto; padding: 58px 18px 54px; }
        .hero-badge { margin-bottom: 22px; }
        .hero-section h1 { font-size: clamp(40px, 13vw, 58px); }
        .hero-intro { font-size: 0.62em; }
        .hero-subtitle { margin-top: 22px; font-size: 17px; }
        .hero-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .hero-actions .btn-primary,
        .hero-actions .btn-secondary { min-width: 0; padding: 0 12px; font-size: 12px; }
        .hero-q-stage { min-height: 390px; }
        .hero-q-stage::before { width: 360px; height: 360px; }
        .q-orbit-one { width: 390px; height: 210px; }
        .q-orbit-two { width: 330px; height: 270px; }
        .hero-q-core { left: 46%; width: 220px; height: 220px; padding: 17px; }
        .hero-q-core svg { width: 100px; height: 100px; }
        .hero-agent-card { right: 0; bottom: 25px; width: 210px; padding: 15px; border-radius: 16px; }
        .hero-agent-heading { margin-bottom: 11px; }
        .hero-agent-card p { font-size: 11px; }
        .hero-chat-bar { min-height: 60px; gap: 8px; margin-top: -2px; padding-left: 12px; }
        .hero-chat-bar input { font-size: 13px; }
        .hero-chat-bar button { width: 44px; height: 44px; }
    }

    @media (prefers-reduced-motion: reduce) {
        .landing-page *, .landing-page *::before, .landing-page *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
        }
    }

    @media (max-width: 1024px) {
        .landing-header {
            padding: 0 28px;
        }

        .hero-section {
            padding: 76px 28px 88px;
        }

        .section-container,
        .footer-container {
            padding-left: 28px;
            padding-right: 28px;
        }

        .preview-body,
        .workspace-shell,
        .workspace-panel-body,
        .q-inner,
        .hero-inner {
            grid-template-columns: 1fr;
        }

        .hero-inner { gap: 46px; }

        .preview-sidenav,
        .workspace-menu,
        .workspace-panel-nav {
            border-right: 0;
            border-bottom: 1px solid var(--border-1);
        }

        .preview-sidenav {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            padding: 12px;
        }

        .preview-sidenav .side-label {
            display: none;
        }

        .workspace-menu {
            display: none;
        }

        .mobile-tabs-bar {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            margin: -18px 0 24px;
            padding-bottom: 14px;
            -webkit-overflow-scrolling: touch;
        }

        .mobile-tab {
            width: auto;
            flex: 0 0 auto;
            padding: 9px 12px;
        }

        .workspace-panel-nav {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .q-inner {
            gap: 42px;
        }

    }

    @media (max-width: 720px) {
        .landing-header {
            height: 60px;
            padding: 0 18px;
        }

        .brand-lockup span,
        .nav-btn {
            display: none;
        }

        .landing-nav {
            gap: 12px;
        }

        .nav-cta {
            padding: 8px 14px;
        }

        .hero-section {
            min-height: auto;
            padding: 70px 18px 74px;
        }

        .hero-badge {
            max-width: 100%;
            margin-bottom: 28px;
            font-size: 12px;
            line-height: 1.35;
            white-space: normal;
        }

        .hero-badge span {
            min-width: 0;
        }

        .hero-section h1 {
            max-width: 100%;
            font-size: clamp(32px, 9.8vw, 40px);
            letter-spacing: -0.6px;
            line-height: 1.12;
        }

        .hero-subtitle {
            font-size: 16px;
            margin-bottom: 32px;
        }

        .hero-actions,
        .cta-actions {
            align-items: stretch;
            flex-direction: column;
        }

        .btn-primary,
        .btn-secondary {
            width: 100%;
        }

        .hero-preview {
            margin-top: 52px;
        }

        .hero-cafe-visual,
        .hero-cafe-visual img {
            min-height: 360px;
        }

        .hero-cafe-visual { border-radius: 20px; }

        .hero-q-orbit {
            top: 20px;
            right: 18px;
            width: 84px;
            height: 84px;
        }

        .hero-q-orbit svg {
            width: 46px;
            height: 46px;
        }

        .hero-agent-card {
            right: 14px;
            bottom: 50px;
            left: 14px;
            gap: 10px;
            padding: 13px 14px;
        }

        .hero-agent-card strong { font-size: 13px; }
        .hero-agent-card p { font-size: 12px; }

        .hero-cafe-caption {
            right: auto;
            bottom: 18px;
            left: 16px;
            font-size: 10px;
        }

        .hero-value-list { margin-top: 26px; }
        .hero-value-card { width: 100%; }

        .preview-topbar,
        .workspace-panel-topbar,
        .q-output-header {
            padding: 0 12px;
        }

        .preview-chip,
        .label-screenshot,
        .workspace-panel-meta {
            display: none;
        }

        .preview-sidenav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .preview-main,
        .workspace-context-image,
        .workspace-panel-content,
        .q-output-body {
            padding: 18px;
        }

        .workspace-context-image {
            height: 160px;
            padding: 0;
        }

        .preview-header-row {
            flex-direction: column;
        }

        .stat-row,
        .benefit-grid {
            grid-template-columns: 1fr;
        }

        .section-container,
        .footer-container {
            padding-left: 18px;
            padding-right: 18px;
        }

        .benefit-strip-section,
        .workspaces-section,
        .q-section,
        .final-cta-section {
            padding: 82px 0;
        }

        .benefit-strip-section {
            padding: 42px 0;
        }

        .section-header {
            margin-bottom: 34px;
        }

        .section-header h2,
        .q-copy-block h2,
        .cta-box h2 {
            font-size: 30px;
            letter-spacing: -0.7px;
        }

        .workspace-panel-nav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .abstract-row,
        .fragment-row,
        .q-strip {
            grid-template-columns: 10px minmax(0, 1fr);
        }

        .abstract-row em,
        .fragment-row em,
        .q-strip em {
            grid-column: 2;
        }

        .q-strip strong {
            grid-row: span 2;
        }

        .cta-box {
            padding: 34px 18px;
        }

        .footer-container {
            flex-direction: column;
            gap: 36px;
        }

        .footer-navigation {
            gap: 44px;
        }
    }

    @media (max-width: 420px) {
        .preview-title span {
            display: none;
        }

        .preview-sidenav,
        .workspace-panel-nav {
            grid-template-columns: 1fr;
        }

        .footer-navigation {
            flex-direction: column;
            gap: 28px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
        }
    }
`;
