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
import { QGuidedStart } from './QGuidedStart';

type WorkspaceKey = 'restaurant' | 'retail' | 'supermarket' | 'autoParts' | 'services' | 'clinic' | 'pharmacy' | 'other';
type ActiveHeroWorkspace = Exclude<WorkspaceKey, 'clinic' | 'pharmacy' | 'other'>;

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

const heroWorkspaces: ActiveHeroWorkspace[] = ['restaurant', 'retail', 'supermarket', 'autoParts', 'services'];
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
    const [heroWorkspace, setHeroWorkspace] = useState<ActiveHeroWorkspace>('restaurant');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('q360-landing-theme') === 'dark' ? 'dark' : 'light');
    const activeSummary = workspaceSummaries[activeWorkspace];
    const heroSummary = workspaceSummaries[heroWorkspace];

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
                    <button type="button" onClick={() => scrollToSection('workspaces')} className="nav-btn">Workspaces</button>
                    <button type="button" onClick={() => scrollToSection('meet-q')} className="nav-btn">Q</button>
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
                        Sign In <ArrowRight size={14} />
                    </button>
                </nav>
            </header>

            <main>
                <section className="hero-section">
                    <div className="hero-inner">
                        <div className="hero-content">
                            <span className="hero-badge">
                                <Sparkles size={14} />
                                <span>Q-guided setup for growing businesses</span>
                            </span>

                            <h1>
                                Tell Q about your business.
                                <span className="highlight-text">Start with clarity.</span>
                            </h1>

                            <p className="hero-subtitle">
                                Describe the way you work in your own words. Q asks the useful questions, recommends the right setup, and keeps you in control.
                            </p>

                            <p className="hero-local-note">Built for local businesses, with your country, currency, time zone, and team in mind.</p>

                            <div className="hero-actions">
                                <button type="button" onClick={() => navigate('/login')} className="btn-primary">
                                    Start with Q
                                </button>
                                <button type="button" onClick={() => scrollToSection('workspaces')} className="btn-secondary">
                                    Explore workspaces
                                </button>
                            </div>

                            <QGuidedStart
                                onStart={() => navigate('/login')}
                                onExplore={() => scrollToSection('workspaces')}
                            />
                        </div>

                        <div className="hero-preview" aria-label="Q360 workspace concept preview">
                            <div className="preview-topbar">
                                <div className="browser-dots" aria-hidden="true">
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                </div>
                                <div className="preview-title">
                                    <BrandMark size={14} />
                                    <span>Q360 Workspace</span>
                                </div>
                                <span className="preview-chip">Concept visual</span>
                            </div>

                            <div className="preview-body">
                                <aside className="preview-sidenav">
                                    <span className="side-label">Workspaces</span>
                                    {heroWorkspaces.map((key) => {
                                        const Icon = workspaceIcons[key];
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                className={`sidebar-tab ${heroWorkspace === key ? 'active' : ''}`}
                                                onClick={() => setHeroWorkspace(key)}
                                            >
                                                <Icon size={14} />
                                                <span>{workspaceSummaries[key].label}</span>
                                            </button>
                                        );
                                    })}
                                </aside>

                                <div className="preview-main">
                                    <div className="preview-header-row">
                                        <div>
                                            <span className="panel-label">{heroSummary.label}</span>
                                            <h2>{heroSummary.title}</h2>
                                        </div>
                                        <span className="label-screenshot">Example workflow</span>
                                    </div>

                                    <div className="stat-row" aria-hidden="true">
                                        <div className="stat-block">
                                            <span>Activity</span>
                                            <div className="stat-bar"><i style={{ width: '68%' }}></i></div>
                                        </div>
                                        <div className="stat-block">
                                            <span>Team</span>
                                            <div className="stat-bar"><i style={{ width: '54%' }}></i></div>
                                        </div>
                                        <div className="stat-block">
                                            <span>Review</span>
                                            <div className="stat-bar"><i style={{ width: '42%' }}></i></div>
                                        </div>
                                    </div>

                                    <div className="abstract-table">
                                        {heroSummary.rows.slice(0, 3).map((row) => (
                                            <div className="abstract-row" key={`${heroWorkspace}-${row.label}`}>
                                                <span className={`row-dot ${row.tone}`}></span>
                                                <span>{row.label}</span>
                                                <em>{row.meta}</em>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="q-strip">
                                        <strong>Q</strong>
                                        <span>{heroSummary.qNote}</span>
                                        <em>Review</em>
                                    </div>
                                </div>
                            </div>
                        </div>
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
        padding: 92px 48px 96px;
    }

    .hero-inner {
        width: 100%;
        max-width: var(--max-w);
        margin: 0 auto;
    }

    .hero-content {
        max-width: 820px;
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
        max-width: 880px;
        margin: 0;
        color: var(--txt-primary);
        font-size: clamp(42px, 6vw, 76px);
        font-weight: 650;
        letter-spacing: -1.8px;
        line-height: 1.06;
        overflow-wrap: break-word;
    }

    .highlight-text {
        display: block;
        color: var(--blue-bright);
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

    .hero-preview {
        margin-top: 78px;
        overflow: hidden;
        background: var(--bg-surface);
        border: 1px solid var(--border-2);
        border-radius: 8px;
        box-shadow: 0 38px 84px rgba(32, 63, 100, 0.17), 0 0 80px rgba(59, 130, 246, 0.08);
        animation: float-in 700ms ease 120ms both, drift 8s ease-in-out 1s infinite;
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
        .q-inner {
            grid-template-columns: 1fr;
        }

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
