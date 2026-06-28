import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    Bot,
    BriefcaseBusiness,
    ChevronRight,
    ClipboardCheck,
    Clock3,
    FileText,
    ListChecks,
    Pill,
    Radio,
    Receipt,
    ShieldCheck,
    ShoppingCart,
    UtensilsCrossed,
    WalletCards,
    Users,
} from 'lucide-react';
import { LogoFull } from '@/components/ui/Logo';

export const LandingView = () => {
    const navigate = useNavigate();
    const [activeWorkspace, setActiveWorkspace] = useState('Restaurant operations');

    const painPoints = [
        'Quotes get forgotten',
        'Customer follow-up is delayed',
        'Tasks are spread across WhatsApp and paper',
        'Payments are difficult to track',
        'Orders and work updates are unclear',
        'Owners carry too much in their heads',
    ];

    const workflows = [
        {
            title: 'Commerce flow',
            steps: ['Customer', 'Quote', 'Order', 'Invoice', 'Payment follow-up'],
            icon: ShoppingCart,
        },
        {
            title: 'Services flow',
            steps: ['Customer', 'Request', 'Quote', 'Job or project', 'Tasks and materials', 'Invoice', 'Payment follow-up'],
            icon: BriefcaseBusiness,
        },
        {
            title: 'Restaurant flow',
            steps: ['Menu and tables', 'Order', 'Kitchen workflow', 'Payment', 'Daily operations'],
            icon: UtensilsCrossed,
        },
    ];

    const workspaces = [
        {
            name: 'Restaurant operations',
            icon: UtensilsCrossed,
            color: '#f59e0b',
            title: 'Restaurant operations',
            desc: 'Manage restaurant orders, kitchen workflows, tables, and daily operations.',
            note: 'Currently the most developed Q360 workflow.',
            preview: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=1200',
        },
        {
            name: 'Retail and Commerce',
            icon: ShoppingCart,
            color: '#10b981',
            title: 'Retail and Commerce',
            desc: 'Organize products, customers, orders, invoices, and payment follow-up.',
            note: 'In active development.',
            preview: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200',
        },
        {
            name: 'Pharmacy workspace',
            icon: Pill,
            color: '#06b6d4',
            title: 'Pharmacy workspace',
            desc: 'Future beta direction for medicine retail operations.',
            note: 'Not currently marketed as prescription, clinical, or compliance software.',
            preview: 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?auto=format&fit=crop&q=80&w=1200',
        },
        {
            name: 'Services and Projects',
            icon: BriefcaseBusiness,
            color: '#8b5cf6',
            title: 'Services and Projects',
            desc: 'Manage customer requests, jobs, tasks, materials, and client follow-up.',
            note: 'Active development / beta scope.',
            preview: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1200',
        },
    ];

    const qCards = [
        {
            title: 'Spot overdue payments',
            desc: 'Q can highlight invoices that may need follow-up.',
            icon: Receipt,
        },
        {
            title: 'See daily priorities',
            desc: 'Q turns business activity into a clearer action list.',
            icon: ListChecks,
        },
        {
            title: 'Catch operational risks',
            desc: 'Q can flag delayed tasks, unconfirmed quotes, low stock, or missing materials where relevant data exists.',
            icon: ClipboardCheck,
        },
        {
            title: 'Prepare next steps',
            desc: 'Q can prepare summaries, suggested tasks, and draft follow-up messages.',
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
            desc: 'Use workspace capabilities as they become ready for beta use.',
            icon: WalletCards,
        },
        {
            title: 'Planned sync foundation',
            desc: 'Real-time sync and offline capability are planned.',
            icon: Radio,
        },
    ];

    const scrollToWorkspaces = () => {
        document.getElementById('workspaces')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-base)',
            color: 'var(--fg-primary)',
            fontFamily: 'var(--font-sans)',
            overflowX: 'hidden',
        }}>
            <div style={{
                position: 'fixed', top: '-10%', left: '10%', width: '40vw', height: '40vw',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />
            <div style={{
                position: 'fixed', bottom: '-10%', right: '10%', width: '50vw', height: '50vw',
                background: 'radial-gradient(circle, rgba(20, 184, 166, 0.06) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />

            <header className="landing-header" style={{
                padding: '14px 36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backdropFilter: 'blur(20px)',
                backgroundColor: 'var(--glass-bg)',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                borderBottom: '1px solid var(--glass-border)',
            }}>
                <div
                    onClick={() => navigate('/')}
                    className="brand-lockup"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '7px 10px',
                        borderRadius: '10px',
                        background: '#fff',
                        cursor: 'pointer',
                    }}
                >
                    <LogoFull height={32} />
                </div>

                <nav className="landing-nav" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                    <button onClick={scrollToWorkspaces} style={navButtonStyle}>Workspaces</button>
                    <button onClick={() => document.getElementById('q-ai')?.scrollIntoView({ behavior: 'smooth' })} style={navButtonStyle}>Q AI</button>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            background: 'var(--fg-primary)',
                            color: 'var(--bg-base)',
                            border: 'none',
                            padding: '10px 24px',
                            borderRadius: '100px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '14px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        Request beta access <ArrowRight size={16} />
                    </button>
                </nav>
            </header>

            <section className="landing-hero" style={{
                padding: '78px 20px 56px',
                textAlign: 'center',
                maxWidth: '1120px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 1,
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '100px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--surface-100)',
                    color: 'var(--fg-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '20px',
                }}>
                    <Clock3 size={15} />
                    Built with early businesses through founder-supported beta access.
                </div>

                <h1 style={{
                    fontSize: 'clamp(42px, 6.7vw, 76px)',
                    fontWeight: 900,
                    lineHeight: 0.98,
                    marginBottom: '18px',
                    letterSpacing: '-0.03em',
                }}>
                    Run daily business operations
                    <span style={{
                        background: 'linear-gradient(to right, #60a5fa, #14b8a6, #f59e0b)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'block',
                        padding: '6px 0',
                    }}>from one clear workspace.</span>
                </h1>

                <p style={{
                    fontSize: '20px',
                    color: 'var(--fg-secondary)',
                    maxWidth: '700px',
                    margin: '0 auto 28px',
                    lineHeight: 1.45,
                    fontWeight: 400,
                }}>
                    Q360 helps businesses organize customers, work, orders, invoices, payment follow-up, and team workflows in one place.
                </p>

                <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            padding: '16px 34px',
                            borderRadius: '14px',
                            fontSize: '16px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 20px 40px -12px var(--primary-glow)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'all 0.3s',
                        }}
                    >
                        Request beta access <ArrowRight size={20} />
                    </button>
                    <button
                        onClick={scrollToWorkspaces}
                        style={{
                            background: 'transparent',
                            color: 'var(--fg-primary)',
                            border: '1px solid var(--glass-border)',
                            padding: '16px 34px',
                            borderRadius: '14px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        Explore workspaces
                    </button>
                </div>
            </section>

            <section className="landing-section" style={{ padding: '60px 20px', maxWidth: '1120px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 style={sectionTitleStyle}>Less chasing. More clarity.</h2>
                    <p style={sectionCopyStyle}>Q360 is for everyday operating work that can otherwise disappear into messages, notebooks, and memory.</p>
                </div>
                <div className="pain-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '14px',
                }}>
                    {painPoints.map((point) => (
                        <div key={point} style={quietCardStyle}>
                            <ListChecks size={20} color="var(--primary)" />
                            <span style={{ fontWeight: 600, lineHeight: 1.4 }}>{point}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section" style={{ padding: '60px 20px', maxWidth: '1120px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 style={sectionTitleStyle}>One connected workflow.</h2>
                    <p style={sectionCopyStyle}>Start with the work you run every day, then connect the next step when the business is ready.</p>
                </div>
                <div className="workflow-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '18px',
                }}>
                    {workflows.map((flow) => (
                        <div key={flow.title} style={cardStyle}>
                            <div style={iconBoxStyle}>
                                <flow.icon size={24} />
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '18px' }}>{flow.title}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {flow.steps.map((step, index) => (
                                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--fg-secondary)' }}>
                                        <span style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'var(--surface-200)',
                                            color: 'var(--fg-primary)',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            flex: '0 0 auto',
                                        }}>{index + 1}</span>
                                        <span>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section id="workspaces" className="landing-section" style={{ padding: '64px 20px', maxWidth: '1120px', margin: '0 auto' }}>
                <div className="industry-shell" style={{
                    background: 'var(--surface-100)',
                    borderRadius: '26px',
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    display: 'flex',
                    minHeight: '500px',
                    boxShadow: 'var(--shadow-lg)',
                }}>
                    <div className="industry-menu" style={{
                        width: '320px',
                        borderRight: '1px solid var(--glass-border)',
                        padding: '26px',
                    }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '18px' }}>Workspaces</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {workspaces.map((workspace) => (
                                <button
                                    key={workspace.name}
                                    onClick={() => setActiveWorkspace(workspace.name)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        padding: '14px',
                                        borderRadius: '14px',
                                        background: activeWorkspace === workspace.name ? 'var(--surface-200)' : 'transparent',
                                        border: '1px solid',
                                        borderColor: activeWorkspace === workspace.name ? 'var(--glass-border)' : 'transparent',
                                        color: activeWorkspace === workspace.name ? 'white' : 'var(--fg-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'left',
                                    }}
                                >
                                    <div style={{
                                        padding: '8px',
                                        borderRadius: '10px',
                                        background: activeWorkspace === workspace.name ? workspace.color : 'var(--surface-300)',
                                        color: activeWorkspace === workspace.name ? 'white' : 'var(--fg-muted)',
                                        transition: 'all 0.2s',
                                    }}>
                                        <workspace.icon size={20} />
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: '16px' }}>{workspace.name}</span>
                                    {activeWorkspace === workspace.name && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="industry-content" style={{ flex: 1, padding: '42px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {workspaces.map((workspace) => activeWorkspace === workspace.name && (
                            <div key={workspace.name} style={{ animation: 'fadeIn 0.5s ease' }}>
                                <h2 className="industry-title" style={{ fontSize: '40px', fontWeight: 800, marginBottom: '14px', letterSpacing: '-0.02em' }}>{workspace.title}</h2>
                                <p className="industry-desc" style={{ fontSize: '18px', color: 'var(--fg-secondary)', lineHeight: 1.5, marginBottom: '14px', maxWidth: '560px' }}>{workspace.desc}</p>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderRadius: '100px',
                                    background: 'var(--surface-200)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--fg-secondary)',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    marginBottom: '28px',
                                }}>
                                    <ClipboardCheck size={15} />
                                    {workspace.note}
                                </div>
                                <div className="industry-image" style={{
                                    borderRadius: '18px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--glass-border)',
                                    height: '250px',
                                    background: `url(${workspace.preview}) center/cover`,
                                    boxShadow: 'var(--shadow-lg)',
                                    position: 'relative',
                                }}>
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.38))',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="q-ai" className="landing-section" style={{ padding: '64px 20px', maxWidth: '1120px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '34px' }}>
                    <div style={{ ...iconBoxStyle, margin: '0 auto 18px' }}>
                        <Bot size={26} />
                    </div>
                    <h2 style={sectionTitleStyle}>Meet Q, your AI operations teammate.</h2>
                    <p style={sectionCopyStyle}>
                        Q is your AI operations teammate inside Q360. Q helps owners understand what needs attention next using the activity already recorded in Q360.
                    </p>
                </div>

                <div className="q-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginBottom: '20px',
                }}>
                    {qCards.map((card) => (
                        <div key={card.title} style={cardStyle}>
                            <div style={iconBoxStyle}>
                                <card.icon size={22} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>{card.title}</h3>
                            <p style={{ color: 'var(--fg-secondary)', fontSize: '15px', lineHeight: 1.5 }}>{card.desc}</p>
                        </div>
                    ))}
                </div>

                <div style={{
                    padding: '18px 22px',
                    borderRadius: '18px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--surface-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '18px',
                    color: 'var(--fg-secondary)',
                }}>
                    <strong style={{ color: 'var(--fg-primary)' }}>Q prepares suggestions and drafts. Owners approve important actions.</strong>
                    <span style={{ fontSize: '14px' }}>Available for selected beta workflows.</span>
                </div>
            </section>

            <section className="landing-section" style={{ padding: '64px 20px', maxWidth: '1120px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '34px' }}>
                    <h2 style={sectionTitleStyle}>Built for practical business operations.</h2>
                    <p style={sectionCopyStyle}>Q360 is a modular operations workspace for businesses, with foundations for organized daily work.</p>
                </div>

                <div className="foundation-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '18px',
                }}>
                    {foundations.map((foundation) => (
                        <div key={foundation.title} style={cardStyle}>
                            <div style={iconBoxStyle}>
                                <foundation.icon size={22} />
                            </div>
                            <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>{foundation.title}</h3>
                            <p style={{ color: 'var(--fg-secondary)', fontSize: '15px', lineHeight: 1.5 }}>{foundation.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section landing-cta-section" style={{ padding: '72px 20px' }}>
                <div style={{
                    maxWidth: '920px',
                    margin: '0 auto',
                    padding: '58px 36px',
                    background: 'linear-gradient(135deg, #0a0a0a 0%, #171717 100%)',
                    borderRadius: '28px',
                    border: '1px solid var(--glass-border)',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '300px', height: '300px', background: 'var(--primary)', filter: 'blur(120px)',
                        opacity: 0.1, pointerEvents: 'none',
                    }} />
                    <h2 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '14px', letterSpacing: '-0.02em' }}>Join the Q360 beta.</h2>
                    <p style={{ color: 'var(--fg-secondary)', fontSize: '18px', margin: '0 auto 28px', maxWidth: '620px', lineHeight: 1.5 }}>
                        Q360 is being shaped with early businesses. Start with one important workflow and help us improve it.
                    </p>
                    <p style={{ color: 'var(--fg-muted)', fontSize: '14px', margin: '0 auto 28px', maxWidth: '640px' }}>
                        Best suited for businesses that manage customers, quotes, orders, jobs, invoices, or payment follow-up.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            background: 'var(--fg-primary)',
                            color: 'var(--bg-base)',
                            border: 'none',
                            padding: '16px 42px',
                            borderRadius: '14px',
                            fontSize: '16px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Request beta access
                    </button>
                </div>
            </section>

            <footer style={{
                padding: '54px 36px 32px',
                maxWidth: '1120px',
                margin: '0 auto',
                borderTop: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--fg-muted)',
                fontSize: '14px',
            }}>
                <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 9px', borderRadius: '9px', marginBottom: '12px', background: '#fff' }}>
                        <LogoFull height={24} />
                    </div>
                    <p>Copyright 2026 Qamar Technologies Ltd. All rights reserved.</p>
                </div>
                <div className="footer-links" style={{ display: 'flex', gap: '54px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <strong style={{ color: 'white' }}>Platform</strong>
                        <button onClick={scrollToWorkspaces} style={footerButtonStyle}>Workspaces</button>
                        <button onClick={() => document.getElementById('q-ai')?.scrollIntoView({ behavior: 'smooth' })} style={footerButtonStyle}>Q AI</button>
                        <button onClick={() => navigate('/login')} style={footerButtonStyle}>Beta access</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <strong style={{ color: 'white' }}>Company</strong>
                        <button onClick={() => navigate('/support')} style={footerButtonStyle}>Contact</button>
                        <span>Privacy</span>
                        <span>Terms</span>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 1000px) {
                    .q-grid,
                    .foundation-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .workflow-grid,
                    .pain-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
                @media (max-width: 900px) {
                    .landing-header {
                        padding: 14px 20px !important;
                    }
                    .landing-nav {
                        gap: 16px !important;
                    }
                    .landing-hero {
                        padding: 78px 18px 48px !important;
                    }
                    .landing-section {
                        padding: 46px 18px !important;
                    }
                    .industry-shell {
                        display: block !important;
                        min-height: 0 !important;
                    }
                    .industry-menu {
                        width: auto !important;
                        border-right: 0 !important;
                        border-bottom: 1px solid var(--glass-border) !important;
                        padding: 20px !important;
                    }
                    .industry-content {
                        padding: 28px !important;
                    }
                    .industry-title {
                        font-size: 32px !important;
                    }
                    .industry-desc {
                        font-size: 16px !important;
                        margin-bottom: 22px !important;
                    }
                    .industry-image {
                        height: 220px !important;
                    }
                }
                @media (max-width: 640px) {
                    .landing-nav button:first-child,
                    .landing-nav button:nth-child(2) {
                        display: none !important;
                    }
                    .landing-hero h1 {
                        font-size: 40px !important;
                    }
                    .landing-hero p {
                        font-size: 17px !important;
                    }
                    .industry-image {
                        height: 180px !important;
                    }
                    .q-grid,
                    .foundation-grid {
                        grid-template-columns: 1fr !important;
                    }
                    footer {
                        display: block !important;
                    }
                    footer > div:last-child {
                        margin-top: 28px !important;
                        gap: 36px !important;
                    }
                }
            `}</style>
        </div>
    );
};

const navButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--fg-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
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
    letterSpacing: '-0.02em',
};

const sectionCopyStyle: CSSProperties = {
    color: 'var(--fg-secondary)',
    fontSize: '18px',
    lineHeight: 1.5,
    maxWidth: '680px',
    margin: '0 auto',
};

const iconBoxStyle: CSSProperties = {
    width: '46px',
    height: '46px',
    borderRadius: '14px',
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
    borderRadius: '18px',
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
