import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    Bot,
    BriefcaseBusiness,
    CalendarDays,
    ChefHat,
    ChevronRight,
    ClipboardCheck,
    FileText,
    ListChecks,
    PackageCheck,
    Pill,
    Receipt,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Table2,
    UtensilsCrossed,
    WalletCards,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { LogoFull } from '@/components/ui/Logo';

type WorkspaceKey = 'Q360 Restaurant' | 'Q360 Commerce' | 'Q360 Services' | 'Projects' | 'Q360 Pharmacy';

type WorkspacePreview = {
    label: string;
    value: string;
    tone: 'green' | 'amber' | 'blue';
};

type Workspace = {
    name: WorkspaceKey;
    icon: LucideIcon;
    color: string;
    title: string;
    desc: string;
    note: string;
    visualLabel: string;
    visualStatus: string;
    rows: WorkspacePreview[];
};

export const LandingView = () => {
    const navigate = useNavigate();
    const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey>('Q360 Restaurant');

    const painPoints = [
        'Quotes waiting for follow-up',
        'Payments that need attention',
        'Orders and jobs without clear status',
        'Tasks spread across WhatsApp and paper',
        'Team updates that are hard to track',
        'Owners carrying too much in their head',
    ];

    const workflows = [
        {
            title: 'Commerce flow',
            steps: ['Customer', 'Quote', 'Order', 'Invoice', 'Payment follow-up'],
            note: 'In active development.',
            icon: ShoppingCart,
        },
        {
            title: 'Services flow',
            steps: ['Customer', 'Request', 'Quote', 'Job or Project', 'Tasks / Materials', 'Invoice', 'Payment follow-up'],
            note: 'In active development.',
            icon: BriefcaseBusiness,
        },
        {
            title: 'Restaurant flow',
            steps: ['Tables', 'Orders', 'Kitchen workflow', 'Payment', 'Daily operations'],
            note: 'Currently the most developed workflow.',
            icon: UtensilsCrossed,
        },
    ];

    const workspaces: Workspace[] = [
        {
            name: 'Q360 Restaurant',
            icon: UtensilsCrossed,
            color: '#f59e0b',
            title: 'Q360 Restaurant',
            desc: 'Manage restaurant orders, kitchen workflows, tables, payments, and daily operations.',
            note: 'Currently the most developed Q360 workflow.',
            visualLabel: 'Sample restaurant workspace visual',
            visualStatus: 'Sample visual based on Q360 workflow structure.',
            rows: [
                { label: 'Tables', value: '12 active', tone: 'green' },
                { label: 'Kitchen workflow', value: '8 in progress', tone: 'amber' },
                { label: 'Payments', value: '3 need review', tone: 'blue' },
            ],
        },
        {
            name: 'Q360 Commerce',
            icon: ShoppingCart,
            color: '#10b981',
            title: 'Q360 Commerce',
            desc: 'Organize products, customers, quotes, orders, invoices, and payment follow-up.',
            note: 'In active development.',
            visualLabel: 'Sample commerce quote-to-payment visual',
            visualStatus: 'Sample visual for active development workflow.',
            rows: [
                { label: 'Quotes', value: '5 waiting', tone: 'amber' },
                { label: 'Orders', value: '11 open', tone: 'blue' },
                { label: 'Invoices', value: '4 follow-ups', tone: 'green' },
            ],
        },
        {
            name: 'Q360 Services',
            icon: BriefcaseBusiness,
            color: '#8b5cf6',
            title: 'Q360 Services',
            desc: 'Manage customer requests, jobs, tasks, materials, invoices, and client follow-up.',
            note: 'In active development.',
            visualLabel: 'Sample services workflow visual',
            visualStatus: 'Sample visual for active development workflow.',
            rows: [
                { label: 'Requests', value: '6 open', tone: 'blue' },
                { label: 'Jobs', value: '4 scheduled', tone: 'green' },
                { label: 'Materials', value: '2 checks', tone: 'amber' },
            ],
        },
        {
            name: 'Projects',
            icon: FileText,
            color: '#3b82f6',
            title: 'Projects',
            desc: 'Keep milestones, tasks, materials, team updates, and client work connected.',
            note: 'In active development.',
            visualLabel: 'Sample project workspace visual',
            visualStatus: 'Sample visual for active development workflow.',
            rows: [
                { label: 'Milestones', value: '3 active', tone: 'blue' },
                { label: 'Tasks', value: '14 open', tone: 'green' },
                { label: 'Updates', value: '5 new', tone: 'amber' },
            ],
        },
        {
            name: 'Q360 Pharmacy',
            icon: Pill,
            color: '#06b6d4',
            title: 'Q360 Pharmacy',
            desc: 'Future direction for medicine retail operations.',
            note: 'Not currently marketed as prescription, clinical, or compliance software.',
            visualLabel: 'Concept pharmacy direction visual',
            visualStatus: 'Concept visual for future direction.',
            rows: [
                { label: 'Retail stock', value: 'Future', tone: 'blue' },
                { label: 'Daily work', value: 'Future', tone: 'green' },
                { label: 'Follow-up', value: 'Future', tone: 'amber' },
            ],
        },
    ];

    const activeWorkspaceData = workspaces.find((workspace) => workspace.name === activeWorkspace) ?? workspaces[0];

    const qCards = [
        {
            title: 'Spot overdue payments',
            desc: 'Q can highlight invoices that may need follow-up.',
            icon: Receipt,
        },
        {
            title: 'See daily priorities',
            desc: 'Q can turn business activity into a focused list of priorities.',
            icon: ListChecks,
        },
        {
            title: 'Catch issues early',
            desc: 'Q can flag delayed tasks, unconfirmed quotes, low stock, or missing materials where relevant data exists.',
            icon: ClipboardCheck,
        },
        {
            title: 'Prepare the next action',
            desc: 'Q can prepare summaries, task suggestions, and draft follow-up messages.',
            icon: Bot,
        },
    ];

    const foundations = [
        {
            title: 'Role-based access',
            desc: 'Give owners and team members access that matches their operational role.',
            icon: Users,
        },
        {
            title: 'Business workspaces',
            desc: 'Keep business identity, team work, and selected workflows together.',
            icon: BriefcaseBusiness,
        },
        {
            title: 'Operational workflows',
            desc: 'Start with practical flows for customers, orders, invoices, and daily work.',
            icon: FileText,
        },
        {
            title: 'Audit foundations',
            desc: 'Build on activity records that can support clearer operational oversight.',
            icon: ShieldCheck,
        },
        {
            title: 'Modular feature access',
            desc: 'Use workspace capabilities as they become ready for supported workflows.',
            icon: WalletCards,
        },
        {
            title: 'Business operations dashboard',
            desc: 'Review daily activity, priorities, and workflow status from one place.',
            icon: ClipboardCheck,
        },
    ];

    const scrollToWorkspaces = () => {
        document.getElementById('workspaces')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="landing-page">
            <header className="landing-header">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="brand-lockup"
                    aria-label="Q360 home"
                >
                    <LogoFull height={32} />
                </button>

                <nav className="landing-nav" aria-label="Landing page navigation">
                    <button type="button" onClick={scrollToWorkspaces} style={navButtonStyle}>Workspaces</button>
                    <button type="button" onClick={() => document.getElementById('q')?.scrollIntoView({ behavior: 'smooth' })} style={navButtonStyle}>Q</button>
                    <button type="button" onClick={() => navigate('/login')} className="nav-cta">
                        Request access <ArrowRight size={16} />
                    </button>
                </nav>
            </header>

            <main>
                <section className="landing-hero reveal-section">
                    <div className="hero-copy">
                        <div className="hero-kicker">
                            Built for businesses that sell products, deliver services, or manage daily operational work.
                        </div>

                        <h1>
                            One place for your business.
                            <span>Nothing falls through.</span>
                        </h1>

                        <p>
                            Keep customers, work, orders, invoices, payments, and priorities connected in one clear workspace.
                        </p>

                        <div className="hero-actions">
                            <button type="button" onClick={() => navigate('/login')} className="primary-cta">
                                Request access <ArrowRight size={20} />
                            </button>
                            <button type="button" onClick={scrollToWorkspaces} className="secondary-cta">
                                Explore workspaces
                            </button>
                        </div>
                    </div>

                    <div className="hero-visual" aria-label="Sample Q360 business workspace visual">
                        <WorkspacePreviewPanel
                            title="Today in Q360"
                            label="Sample workspace visual"
                            note="No customer data shown"
                            rows={[
                                { label: 'Orders moving', value: '18', tone: 'green' },
                                { label: 'Invoices to review', value: '4', tone: 'amber' },
                                { label: 'Team priorities', value: '7', tone: 'blue' },
                            ]}
                            compact={false}
                        />
                    </div>
                </section>

                <section className="landing-section reveal-section">
                    <div className="section-heading">
                        <p style={sectionLabelStyle}>Daily business gets scattered.</p>
                        <h2 style={sectionTitleStyle}>Important work should not live across messages, paper, and memory.</h2>
                        <p style={sectionCopyStyle}>Quotes get forgotten. Payments need follow-up. Tasks move between people. Customer updates get lost. Q360 helps bring the daily work of your business into one clear place.</p>
                    </div>
                    <div className="pain-grid">
                        {painPoints.map((point) => (
                            <div key={point} style={quietCardStyle} className="polish-card">
                                <ListChecks size={20} color="var(--primary)" />
                                <span>{point}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="landing-section reveal-section">
                    <div className="section-heading">
                        <p style={sectionLabelStyle}>One connected workflow</p>
                        <h2 style={sectionTitleStyle}>From customer request to payment follow-up.</h2>
                    </div>
                    <div className="workflow-grid">
                        {workflows.map((flow) => (
                            <div key={flow.title} className="workflow-card polish-card">
                                <div className="workflow-card__top">
                                    <div style={iconBoxStyle}>
                                        <flow.icon size={24} />
                                    </div>
                                    <span className="maturity-pill">{flow.note}</span>
                                </div>
                                <h3>{flow.title}</h3>
                                <div className="workflow-rail" aria-label={`${flow.title} steps`}>
                                    {flow.steps.map((step, index) => (
                                        <div key={step} className="workflow-step">
                                            <span>{index + 1}</span>
                                            <strong>{step}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="workspaces" className="landing-section reveal-section">
                    <div className="industry-shell">
                        <div className="industry-menu">
                            <h3>Workspaces</h3>
                            <div>
                                {workspaces.map((workspace) => (
                                    <button
                                        type="button"
                                        key={workspace.name}
                                        onClick={() => setActiveWorkspace(workspace.name)}
                                        className={activeWorkspace === workspace.name ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
                                    >
                                        <div style={{ background: activeWorkspace === workspace.name ? workspace.color : 'var(--surface-300)' }}>
                                            <workspace.icon size={20} />
                                        </div>
                                        <span>{workspace.name}</span>
                                        {activeWorkspace === workspace.name && <ChevronRight size={16} aria-hidden="true" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="industry-content">
                            <div className="industry-copy">
                                <h2>{activeWorkspaceData.title}</h2>
                                <p>{activeWorkspaceData.desc}</p>
                                <div className="maturity-note">
                                    <ClipboardCheck size={15} />
                                    {activeWorkspaceData.note}
                                </div>
                            </div>
                            <WorkspacePreviewPanel
                                title={activeWorkspaceData.title}
                                label={activeWorkspaceData.visualLabel}
                                note={activeWorkspaceData.visualStatus}
                                rows={activeWorkspaceData.rows}
                                compact
                            />
                        </div>
                    </div>
                </section>

                <section id="q" className="landing-section reveal-section">
                    <div className="q-layout">
                        <div className="q-copy">
                            <div style={iconBoxStyle}>
                                <Bot size={26} />
                            </div>
                            <p style={sectionLabelStyle}>Meet Q</p>
                            <h2 style={sectionTitleStyle}>Keeps track, so you do not have to.</h2>
                            <p style={qCopyStyle}>
                                Q is your business assistant inside Q360. It helps you spot what may need attention next using the activity already recorded in your workspace.
                            </p>
                        </div>

                        <div className="q-panel polish-card" aria-label="Concept Today with Q panel">
                            <div className="q-panel__header">
                                <div>
                                    <span>Concept</span>
                                    <h3>Today with Q</h3>
                                </div>
                                <Sparkles size={22} />
                            </div>
                            <div className="q-insights">
                                <InsightRow icon={Receipt} title="Overdue invoices" detail="4 invoices may need follow-up." tone="amber" />
                                <InsightRow icon={AlertTriangle} title="Delayed tasks" detail="2 jobs moved past planned date." tone="blue" />
                                <InsightRow icon={CalendarDays} title="Daily priorities" detail="7 items prepared for owner review." tone="green" />
                            </div>
                            <div className="q-panel__footer">
                                Q prepares insights and suggested next steps. You approve important actions.
                            </div>
                        </div>
                    </div>

                    <div className="q-grid">
                        {qCards.map((card) => (
                            <div key={card.title} style={cardStyle} className="polish-card">
                                <div style={iconBoxStyle}>
                                    <card.icon size={22} />
                                </div>
                                <h3>{card.title}</h3>
                                <p>{card.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="trust-strip">
                        <strong>Q prepares insights and suggested next steps. You approve important actions.</strong>
                        <span>Q capabilities are being introduced gradually across Q360 workflows.</span>
                    </div>
                </section>

                <section className="landing-section reveal-section">
                    <div className="section-heading">
                        <h2 style={sectionTitleStyle}>Built for practical business operations.</h2>
                        <p style={sectionCopyStyle}>Q360 helps businesses keep customers, work, orders, invoices, payments, and priorities in one place.</p>
                    </div>

                    <div className="foundation-grid">
                        {foundations.map((foundation) => (
                            <div key={foundation.title} style={cardStyle} className="polish-card">
                                <div style={iconBoxStyle}>
                                    <foundation.icon size={22} />
                                </div>
                                <h3>{foundation.title}</h3>
                                <p>{foundation.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="landing-section landing-cta-section reveal-section">
                    <div className="cta-panel">
                        <h2>See how Q360 works.</h2>
                        <p>Less chasing. More clarity.</p>
                        <span>Best suited for businesses that manage customers, quotes, orders, jobs, invoices, or payment follow-up.</span>
                        <button type="button" onClick={() => navigate('/login')}>
                            Request access
                        </button>
                    </div>
                </section>
            </main>

            <footer className="landing-footer">
                <div>
                    <div className="footer-logo">
                        <LogoFull height={24} />
                    </div>
                    <p>Copyright 2026 Qamar Technologies Ltd. All rights reserved.</p>
                </div>
                <div className="footer-links">
                    <div>
                        <strong>Platform</strong>
                        <button type="button" onClick={scrollToWorkspaces} style={footerButtonStyle}>Workspaces</button>
                        <button type="button" onClick={() => document.getElementById('q')?.scrollIntoView({ behavior: 'smooth' })} style={footerButtonStyle}>Q</button>
                        <button type="button" onClick={() => navigate('/login')} style={footerButtonStyle}>Request access</button>
                    </div>
                    <div>
                        <strong>Company</strong>
                        <button type="button" onClick={() => navigate('/support')} style={footerButtonStyle}>Contact</button>
                        <span>Privacy</span>
                        <span>Terms</span>
                    </div>
                </div>
            </footer>

            <style>{landingStyles}</style>
        </div>
    );
};

const WorkspacePreviewPanel = ({
    title,
    label,
    note,
    rows,
    compact,
}: {
    title: string;
    label: string;
    note: string;
    rows: WorkspacePreview[];
    compact: boolean;
}) => (
    <div className={compact ? 'workspace-preview workspace-preview--compact' : 'workspace-preview'}>
        <div className="preview-topbar">
            <div>
                <span>{label}</span>
                <h3>{title}</h3>
            </div>
            <div className="preview-dots" aria-hidden="true">
                <i />
                <i />
                <i />
            </div>
        </div>
        <div className="preview-grid">
            <div className="preview-main">
                <div className="preview-main__toolbar">
                    <span>Business day</span>
                    <strong>{note}</strong>
                </div>
                <div className="preview-lanes">
                    <PreviewLane icon={Table2} title="Workspace" items={['Customer request', 'Work in progress', 'Owner review']} />
                    <PreviewLane icon={ChefHat} title="Operations" items={['Orders', 'Tasks', 'Materials']} />
                    <PreviewLane icon={PackageCheck} title="Follow-up" items={['Invoice', 'Payment', 'Priority']} />
                </div>
            </div>
            <div className="preview-side">
                {rows.map((row) => (
                    <div key={row.label} className={`preview-stat preview-stat--${row.tone}`}>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const PreviewLane = ({ icon: Icon, title, items }: { icon: LucideIcon; title: string; items: string[] }) => (
    <div className="preview-lane">
        <div>
            <Icon size={16} />
            <strong>{title}</strong>
        </div>
        {items.map((item) => (
            <span key={item}>{item}</span>
        ))}
    </div>
);

const InsightRow = ({
    icon: Icon,
    title,
    detail,
    tone,
}: {
    icon: LucideIcon;
    title: string;
    detail: string;
    tone: 'green' | 'amber' | 'blue';
}) => (
    <div className={`insight-row insight-row--${tone}`}>
        <div>
            <Icon size={18} />
        </div>
        <span>
            <strong>{title}</strong>
            {detail}
        </span>
    </div>
);

const navButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--fg-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    padding: 0,
};

const footerButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--fg-muted)',
    cursor: 'pointer',
    font: 'inherit',
    padding: 0,
    textAlign: 'left',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '38px',
    fontWeight: 800,
    marginBottom: '10px',
    letterSpacing: 0,
};

const sectionCopyStyle: CSSProperties = {
    color: 'var(--fg-secondary)',
    fontSize: '18px',
    lineHeight: 1.5,
    maxWidth: '720px',
    margin: '0 auto',
};

const qCopyStyle: CSSProperties = {
    ...sectionCopyStyle,
    margin: 0,
};

const sectionLabelStyle: CSSProperties = {
    color: 'var(--primary)',
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: 'uppercase',
    margin: '0 0 10px',
};

const iconBoxStyle: CSSProperties = {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    background: 'var(--surface-200)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--primary)',
    marginBottom: '20px',
};

const cardStyle: CSSProperties = {
    padding: '26px',
    borderRadius: '8px',
    background: 'var(--surface-100)',
    border: '1px solid var(--glass-border)',
    minHeight: '100%',
};

const quietCardStyle: CSSProperties = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '88px',
};

const landingStyles = `
    .landing-page {
        min-height: 100vh;
        background:
            linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px),
            radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.16), transparent 34rem),
            radial-gradient(circle at 85% 18%, rgba(20, 184, 166, 0.11), transparent 28rem),
            var(--bg-base);
        background-size: 42px 42px, 42px 42px, auto, auto, auto;
        color: var(--fg-primary);
        font-family: var(--font-sans);
        overflow-x: hidden;
    }

    .landing-header {
        padding: 14px 36px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        backdrop-filter: blur(20px);
        background-color: rgba(8, 12, 20, 0.78);
        position: sticky;
        top: 0;
        z-index: 100;
        border-bottom: 1px solid var(--glass-border);
    }

    .brand-lockup {
        display: inline-flex;
        align-items: center;
        padding: 7px 10px;
        border-radius: 8px;
        background: #fff;
        border: 0;
        cursor: pointer;
    }

    .landing-nav {
        display: flex;
        gap: 32px;
        align-items: center;
    }

    .nav-cta,
    .primary-cta,
    .secondary-cta,
    .cta-panel button {
        transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
    }

    .nav-cta {
        background: var(--fg-primary);
        color: var(--bg-base);
        border: none;
        padding: 10px 24px;
        border-radius: 999px;
        cursor: pointer;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .landing-nav button:hover,
    .footer-links button:hover {
        color: var(--fg-primary) !important;
    }

    .nav-cta:hover,
    .primary-cta:hover,
    .secondary-cta:hover,
    .cta-panel button:hover,
    .workspace-tab:hover,
    .polish-card:hover {
        transform: translateY(-2px);
    }

    .landing-page button:focus-visible,
    .workspace-tab:focus-visible {
        outline: 3px solid rgba(96, 165, 250, 0.42);
        outline-offset: 4px;
    }

    .landing-hero {
        padding: 82px 20px 68px;
        max-width: 1180px;
        margin: 0 auto;
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 0.95fr) minmax(420px, 1.05fr);
        gap: 44px;
        align-items: center;
    }

    .hero-copy {
        text-align: left;
    }

    .hero-kicker {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--glass-border);
        background: rgba(15, 23, 42, 0.72);
        color: var(--fg-secondary);
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 20px;
    }

    .landing-hero h1 {
        font-size: 64px;
        font-weight: 900;
        line-height: 1;
        margin: 0 0 18px;
        letter-spacing: 0;
    }

    .landing-hero h1 span {
        background: linear-gradient(to right, #60a5fa, #14b8a6, #f59e0b);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        display: block;
        padding: 6px 0;
    }

    .landing-hero p {
        font-size: 20px;
        color: var(--fg-secondary);
        max-width: 650px;
        margin: 0 0 28px;
        line-height: 1.45;
    }

    .hero-actions {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
    }

    .primary-cta {
        background: var(--primary);
        color: white;
        border: none;
        padding: 16px 34px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 20px 40px -12px var(--primary-glow);
        display: inline-flex;
        align-items: center;
        gap: 12px;
    }

    .secondary-cta {
        background: rgba(15, 23, 42, 0.4);
        color: var(--fg-primary);
        border: 1px solid var(--glass-border);
        padding: 16px 34px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        backdrop-filter: blur(10px);
    }

    .hero-visual {
        position: relative;
    }

    .hero-visual::before {
        content: '';
        position: absolute;
        inset: 6% 3%;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.28), rgba(20, 184, 166, 0.18));
        filter: blur(42px);
        opacity: 0.72;
        z-index: -1;
    }

    .landing-section {
        padding: 66px 20px;
        max-width: 1180px;
        margin: 0 auto;
    }

    .section-heading {
        text-align: center;
        margin-bottom: 34px;
    }

    .pain-grid,
    .workflow-grid,
    .foundation-grid,
    .q-grid {
        display: grid;
        gap: 16px;
    }

    .pain-grid {
        grid-template-columns: repeat(3, 1fr);
    }

    .workflow-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
    }

    .foundation-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
    }

    .q-grid {
        grid-template-columns: repeat(4, 1fr);
        margin-top: 24px;
    }

    .polish-card {
        box-shadow: 0 18px 55px -36px rgba(0, 0, 0, 0.8);
        transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
    }

    .polish-card:hover {
        border-color: rgba(148, 163, 184, 0.32) !important;
        box-shadow: 0 22px 60px -34px rgba(59, 130, 246, 0.38);
    }

    .polish-card h3 {
        font-size: 18px;
        font-weight: 800;
        margin: 0 0 10px;
        letter-spacing: 0;
    }

    .polish-card p {
        color: var(--fg-secondary);
        font-size: 15px;
        line-height: 1.5;
        margin: 0;
    }

    .workflow-card {
        padding: 26px;
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(23, 23, 23, 0.94), rgba(16, 20, 28, 0.94));
        border: 1px solid var(--glass-border);
    }

    .workflow-card__top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }

    .workflow-card h3 {
        font-size: 20px;
        font-weight: 800;
        margin: 0 0 16px;
        letter-spacing: 0;
    }

    .maturity-pill,
    .maturity-note {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-primary);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--glass-border);
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        padding: 7px 10px;
    }

    .workflow-rail {
        display: grid;
        gap: 10px;
        position: relative;
    }

    .workflow-step {
        min-height: 42px;
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        color: var(--fg-secondary);
        position: relative;
    }

    .workflow-step:not(:last-child)::after {
        content: '';
        position: absolute;
        left: 13px;
        top: 33px;
        width: 2px;
        height: 20px;
        background: linear-gradient(to bottom, rgba(96, 165, 250, 0.58), rgba(20, 184, 166, 0.16));
        animation: guidePulse 2.8s ease-in-out infinite;
    }

    .workflow-step span {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-200);
        color: var(--fg-primary);
        font-size: 12px;
        font-weight: 800;
        border: 1px solid var(--glass-border);
    }

    .workflow-step strong {
        font-size: 14px;
        font-weight: 700;
        color: var(--fg-secondary);
        line-height: 1.35;
    }

    .industry-shell {
        background: rgba(15, 23, 42, 0.6);
        border-radius: 8px;
        border: 1px solid var(--glass-border);
        overflow: hidden;
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        min-height: 520px;
        box-shadow: var(--shadow-lg);
    }

    .industry-menu {
        border-right: 1px solid var(--glass-border);
        padding: 26px;
        background: rgba(2, 6, 23, 0.32);
    }

    .industry-menu h3 {
        font-size: 13px;
        font-weight: 800;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0;
        margin: 0 0 18px;
    }

    .industry-menu > div {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .workspace-tab {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 58px;
        padding: 12px;
        border-radius: 8px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--fg-secondary);
        cursor: pointer;
        text-align: left;
        transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
    }

    .workspace-tab--active {
        background: var(--surface-200);
        border-color: var(--glass-border);
        color: var(--fg-primary);
    }

    .workspace-tab div {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        color: white;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
    }

    .workspace-tab span {
        font-weight: 800;
        font-size: 15px;
        flex: 1;
    }

    .industry-content {
        padding: 42px;
        display: grid;
        grid-template-columns: minmax(0, 0.72fr) minmax(360px, 1fr);
        gap: 30px;
        align-items: center;
    }

    .industry-copy h2 {
        font-size: 40px;
        font-weight: 900;
        margin: 0 0 14px;
        letter-spacing: 0;
    }

    .industry-copy p {
        font-size: 18px;
        color: var(--fg-secondary);
        line-height: 1.5;
        margin: 0 0 18px;
    }

    .workspace-preview {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(8, 12, 20, 0.98));
        box-shadow: 0 28px 80px -42px rgba(96, 165, 250, 0.55);
        overflow: hidden;
        min-height: 420px;
    }

    .workspace-preview--compact {
        min-height: 360px;
    }

    .preview-topbar {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        padding: 18px 20px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(255, 255, 255, 0.035);
    }

    .preview-topbar span,
    .q-panel__header span {
        display: inline-flex;
        margin-bottom: 7px;
        color: #93c5fd;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0;
    }

    .preview-topbar h3,
    .q-panel__header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 0;
    }

    .preview-dots {
        display: flex;
        gap: 6px;
        padding-top: 4px;
    }

    .preview-dots i {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.46);
    }

    .preview-grid {
        padding: 20px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 150px;
        gap: 16px;
    }

    .preview-main,
    .preview-side,
    .preview-lane {
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(255, 255, 255, 0.035);
        border-radius: 8px;
    }

    .preview-main {
        padding: 16px;
    }

    .preview-main__toolbar {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: center;
        margin-bottom: 16px;
        color: var(--fg-muted);
        font-size: 12px;
    }

    .preview-main__toolbar strong {
        color: var(--fg-secondary);
        font-weight: 700;
        text-align: right;
    }

    .preview-lanes {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
    }

    .preview-lane {
        padding: 12px;
        min-height: 210px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .preview-lane div {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--fg-primary);
        margin-bottom: 4px;
    }

    .preview-lane strong {
        font-size: 13px;
    }

    .preview-lane span {
        display: block;
        padding: 10px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.12);
        color: var(--fg-secondary);
        font-size: 12px;
        font-weight: 700;
    }

    .preview-side {
        display: grid;
        gap: 10px;
        padding: 12px;
        align-content: start;
    }

    .preview-stat {
        border-radius: 8px;
        padding: 13px 12px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(15, 23, 42, 0.7);
    }

    .preview-stat span {
        display: block;
        color: var(--fg-muted);
        font-size: 12px;
        margin-bottom: 6px;
    }

    .preview-stat strong {
        font-size: 18px;
        color: var(--fg-primary);
    }

    .preview-stat--green {
        box-shadow: inset 3px 0 0 rgba(16, 185, 129, 0.8);
    }

    .preview-stat--amber {
        box-shadow: inset 3px 0 0 rgba(245, 158, 11, 0.85);
    }

    .preview-stat--blue {
        box-shadow: inset 3px 0 0 rgba(59, 130, 246, 0.85);
    }

    .q-layout {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(380px, 1.1fr);
        gap: 34px;
        align-items: center;
        margin-bottom: 28px;
    }

    .q-panel {
        padding: 24px;
        border-radius: 8px;
        background:
            linear-gradient(135deg, rgba(59, 130, 246, 0.12), transparent 36%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(8, 12, 20, 0.98));
        border: 1px solid var(--glass-border);
        position: relative;
        overflow: hidden;
    }

    .q-panel::after {
        content: '';
        position: absolute;
        inset: auto 22px 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.7), transparent);
        animation: qSignal 3.4s ease-in-out infinite;
    }

    .q-panel__header {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 18px;
    }

    .q-panel__header svg {
        color: #93c5fd;
    }

    .q-insights {
        display: grid;
        gap: 12px;
    }

    .insight-row {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        padding: 13px;
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.035);
    }

    .insight-row > div {
        width: 42px;
        height: 42px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        background: rgba(15, 23, 42, 0.82);
    }

    .insight-row--green > div {
        color: #34d399;
    }

    .insight-row--amber > div {
        color: #fbbf24;
    }

    .insight-row--blue > div {
        color: #60a5fa;
    }

    .insight-row span {
        color: var(--fg-secondary);
        font-size: 14px;
        line-height: 1.45;
    }

    .insight-row strong {
        display: block;
        color: var(--fg-primary);
        margin-bottom: 2px;
    }

    .q-panel__footer {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
        color: var(--fg-secondary);
        font-size: 14px;
        line-height: 1.45;
    }

    .trust-strip {
        margin-top: 20px;
        padding: 18px 22px;
        border-radius: 8px;
        border: 1px solid var(--glass-border);
        background: var(--surface-100);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        color: var(--fg-secondary);
    }

    .trust-strip strong {
        color: var(--fg-primary);
    }

    .trust-strip span {
        font-size: 14px;
    }

    .cta-panel {
        max-width: 920px;
        margin: 0 auto;
        padding: 58px 36px;
        background:
            linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(20, 184, 166, 0.08)),
            linear-gradient(135deg, #0a0a0a 0%, #171717 100%);
        border-radius: 8px;
        border: 1px solid var(--glass-border);
        text-align: center;
        position: relative;
        overflow: hidden;
    }

    .cta-panel h2 {
        font-size: 40px;
        font-weight: 900;
        margin: 0 0 14px;
        letter-spacing: 0;
    }

    .cta-panel p {
        color: var(--fg-secondary);
        font-size: 18px;
        margin: 0 auto 14px;
        max-width: 620px;
        line-height: 1.5;
    }

    .cta-panel span {
        display: block;
        color: var(--fg-muted);
        font-size: 14px;
        margin: 0 auto 28px;
        max-width: 640px;
        line-height: 1.5;
    }

    .cta-panel button {
        background: var(--fg-primary);
        color: var(--bg-base);
        border: none;
        padding: 16px 42px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 800;
        cursor: pointer;
    }

    .landing-footer {
        padding: 54px 36px 32px;
        max-width: 1180px;
        margin: 0 auto;
        border-top: 1px solid var(--glass-border);
        display: flex;
        justify-content: space-between;
        color: var(--fg-muted);
        font-size: 14px;
    }

    .footer-logo {
        display: inline-flex;
        align-items: center;
        padding: 6px 9px;
        border-radius: 8px;
        margin-bottom: 12px;
        background: #fff;
    }

    .footer-links {
        display: flex;
        gap: 54px;
    }

    .footer-links > div {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .footer-links strong {
        color: white;
    }

    .reveal-section {
        animation: sectionIn 560ms ease both;
        animation-timeline: view();
        animation-range: entry 0% cover 24%;
    }

    @keyframes sectionIn {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
    }

    @keyframes guidePulse {
        0%, 100% { opacity: 0.28; transform: scaleY(0.75); transform-origin: top; }
        50% { opacity: 0.9; transform: scaleY(1); transform-origin: top; }
    }

    @keyframes qSignal {
        0%, 100% { opacity: 0.18; transform: translateX(-18%); }
        50% { opacity: 0.8; transform: translateX(18%); }
    }

    @media (max-width: 1080px) {
        .landing-hero,
        .industry-content,
        .q-layout {
            grid-template-columns: 1fr;
        }

        .hero-copy {
            text-align: center;
        }

        .landing-hero p,
        .hero-actions {
            margin-left: auto;
            margin-right: auto;
            justify-content: center;
        }

        .industry-content {
            align-items: stretch;
        }
    }

    @media (max-width: 1000px) {
        .q-grid,
        .foundation-grid {
            grid-template-columns: repeat(2, 1fr);
        }

        .workflow-grid,
        .pain-grid {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 900px) {
        .landing-header {
            padding: 14px 20px;
        }

        .landing-nav {
            gap: 16px;
        }

        .landing-hero {
            padding: 64px 18px 46px;
        }

        .landing-hero h1 {
            font-size: 48px;
        }

        .landing-section {
            padding: 48px 18px;
        }

        .industry-shell {
            grid-template-columns: 1fr;
            min-height: 0;
        }

        .industry-menu {
            border-right: 0;
            border-bottom: 1px solid var(--glass-border);
            padding: 20px;
        }

        .industry-content {
            padding: 28px;
        }

        .industry-copy h2 {
            font-size: 32px;
        }

        .preview-grid {
            grid-template-columns: 1fr;
        }

        .preview-side {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    @media (max-width: 640px) {
        .landing-nav button:first-child,
        .landing-nav button:nth-child(2) {
            display: none;
        }

        .nav-cta {
            padding: 10px 16px;
        }

        .landing-hero h1 {
            font-size: 39px;
        }

        .landing-hero p {
            font-size: 17px;
        }

        .hero-kicker {
            border-radius: 8px;
            line-height: 1.4;
        }

        .primary-cta,
        .secondary-cta {
            width: 100%;
            justify-content: center;
        }

        .preview-lanes,
        .preview-side,
        .q-grid,
        .foundation-grid {
            grid-template-columns: 1fr;
        }

        .workspace-preview {
            min-height: 0;
        }

        .preview-lane {
            min-height: 0;
        }

        .q-layout {
            grid-template-columns: 1fr;
        }

        .trust-strip {
            align-items: flex-start;
            flex-direction: column;
        }

        .cta-panel {
            padding: 42px 22px;
        }

        .cta-panel h2 {
            font-size: 32px;
        }

        .landing-footer {
            display: block;
            padding-left: 20px;
            padding-right: 20px;
        }

        .footer-links {
            margin-top: 28px;
            gap: 36px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 1ms !important;
        }

        .reveal-section {
            animation: none;
        }
    }
`;
