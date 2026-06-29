import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    Table2,
    ChefHat,
    PackageCheck,
    Receipt,
    CalendarDays,
    Sparkles,
    Users,
    BriefcaseBusiness,
    FileText,
    Pill,
    CheckCircle2,
    Lock,
    Activity,
    Info,
} from 'lucide-react';
import { LogoFull, LogoMark } from '@/components/ui/Logo';

type WorkspaceKey = 'restaurant' | 'commerce' | 'services' | 'projects' | 'pharmacy';

export const LandingView = () => {
    const navigate = useNavigate();
    const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey>('restaurant');
    const [heroWorkspace, setHeroWorkspace] = useState<Exclude<WorkspaceKey, 'pharmacy'>>('restaurant');
    const [qApproved, setQApproved] = useState(false);

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="landing-page">
            {/* Header / Navigation */}
            <header className="landing-header">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="brand-lockup logo-white"
                    aria-label="Q360 Home"
                >
                    <LogoMark size={28} />
                </button>

                <nav className="landing-nav" aria-label="Main Navigation">
                    <button type="button" onClick={() => scrollToSection('workspaces')} className="nav-btn">Workspaces</button>
                    <button type="button" onClick={() => scrollToSection('meet-q')} className="nav-btn">Q</button>
                    <button type="button" onClick={() => navigate('/login')} className="nav-cta">
                        Sign In <ArrowRight size={14} />
                    </button>
                </nav>
            </header>

            <main>
                {/* 1. Hero Section */}
                <section className="hero-section">
                    <div className="hero-grid">
                        <div className="hero-content">
                            <span className="hero-badge">
                                <Sparkles size={12} />
                                <span>Quiet operations workspace for SMEs</span>
                            </span>
                            <h1>
                                One place for your business.
                                <span className="highlight-text">Nothing falls through.</span>
                            </h1>
                            <p className="hero-subtitle">
                                A clearer way to manage the work behind your business.
                            </p>
                            <div className="hero-actions">
                                <button type="button" onClick={() => scrollToSection('meet-q')} className="btn-primary">
                                    See Q360 in action
                                </button>
                                <button type="button" onClick={() => scrollToSection('workspaces')} className="btn-secondary">
                                    Explore workspaces
                                </button>
                            </div>
                        </div>

                        {/* Interactive Hero Visual */}
                        <div className="hero-visual">
                            <div className="mock-browser">
                                <div className="browser-header">
                                    <div className="browser-dots">
                                        <span className="dot"></span>
                                        <span className="dot"></span>
                                        <span className="dot"></span>
                                    </div>
                                    <div className="browser-title">
                                        <span className="logo-white"><LogoMark size={14} /></span>
                                        <span>Q360 Workspace</span>
                                    </div>
                                </div>
                                
                                <div className="mock-app-layout">
                                    {/* Sidebar */}
                                    <div className="mock-sidebar">
                                        <div className="sidebar-group">
                                            <span className="group-label">Workspaces</span>
                                            <button 
                                                type="button" 
                                                className={`sidebar-tab ${heroWorkspace === 'restaurant' ? 'active' : ''}`}
                                                onClick={() => setHeroWorkspace('restaurant')}
                                            >
                                                <ChefHat size={14} />
                                                <span>Restaurant</span>
                                            </button>
                                            <button 
                                                type="button" 
                                                className={`sidebar-tab ${heroWorkspace === 'commerce' ? 'active' : ''}`}
                                                onClick={() => setHeroWorkspace('commerce')}
                                            >
                                                <Receipt size={14} />
                                                <span>Commerce</span>
                                            </button>
                                            <button 
                                                type="button" 
                                                className={`sidebar-tab ${heroWorkspace === 'services' ? 'active' : ''}`}
                                                onClick={() => setHeroWorkspace('services')}
                                            >
                                                <BriefcaseBusiness size={14} />
                                                <span>Services</span>
                                            </button>
                                            <button 
                                                type="button" 
                                                className={`sidebar-tab ${heroWorkspace === 'projects' ? 'active' : ''}`}
                                                onClick={() => setHeroWorkspace('projects')}
                                            >
                                                <FileText size={14} />
                                                <span>Projects</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Main View Area */}
                                    <div className="mock-main-view">
                                        <div className="view-header">
                                            <h3>{heroWorkspace.toUpperCase()} WORKSPACE</h3>
                                            <span className="label-screenshot">Concept visual — example workflow</span>
                                        </div>

                                        <div className="view-body">
                                            {heroWorkspace === 'restaurant' && (
                                                <div className="restaurant-mock">
                                                    <div className="stats-row">
                                                        <div className="stat-pill">Active tables</div>
                                                        <div className="stat-pill warning-pill">Review needed</div>
                                                    </div>
                                                    <div className="order-ticket">
                                                        <div className="ticket-header">
                                                            <strong>Customer request</strong>
                                                            <span className="status-badge success-badge">Completed</span>
                                                        </div>
                                                        <div className="ticket-items">
                                                            <div className="ticket-item"><span>○</span> Example item</div>
                                                            <div className="ticket-item"><span>○</span> Example item</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {heroWorkspace === 'commerce' && (
                                                <div className="commerce-mock">
                                                    <div className="stats-row">
                                                        <div className="stat-pill">Quotes awaiting review</div>
                                                        <div className="stat-pill success-pill">Status sync</div>
                                                    </div>
                                                    <div className="quote-card">
                                                        <div className="card-top">
                                                            <strong>Quote awaiting review</strong>
                                                            <span className="status-badge progress-badge">Awaiting review</span>
                                                        </div>
                                                        <p className="card-desc">Example workflow</p>
                                                        <div className="card-value">Awaiting confirmation</div>
                                                    </div>
                                                </div>
                                            )}

                                            {heroWorkspace === 'services' && (
                                                <div className="services-mock">
                                                    <div className="stats-row">
                                                        <div className="stat-pill">Jobs scheduled</div>
                                                        <div className="stat-pill warning-pill">Unassigned jobs</div>
                                                    </div>
                                                    <div className="job-card">
                                                        <div className="card-top">
                                                            <strong>Customer request</strong>
                                                            <span className="status-badge success-badge">Scheduled</span>
                                                        </div>
                                                        <p className="card-desc">Service task details</p>
                                                    </div>
                                                </div>
                                            )}

                                            {heroWorkspace === 'projects' && (
                                                <div className="projects-mock">
                                                    <div className="stats-row">
                                                        <div className="stat-pill">Milestones open</div>
                                                        <div className="stat-pill success-pill">Tasks completed</div>
                                                    </div>
                                                    <div className="project-card">
                                                        <div className="card-top">
                                                            <strong>Milestone status</strong>
                                                            <span className="status-badge success-badge">Approved</span>
                                                        </div>
                                                        <div className="milestone-steps">
                                                            <div className="step done">✓ Task completed</div>
                                                            <div className="step done">✓ Task completed</div>
                                                            <div className="step progress">○ Task in progress</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Owner Problem Section */}
                <section className="problem-section">
                    <div className="spotlight-glow" aria-hidden="true"></div>
                    <div className="section-container">
                        <div className="problem-header">
                            <h2>Stop carrying your business in your head.</h2>
                            <p>Running a business shouldn’t mean chasing details across five different apps and disconnected messaging threads.</p>
                        </div>
                        <div className="problem-grid">
                            <div className="problem-card">
                                <div className="card-indicator warning-border"></div>
                                <h3>Chasing updates</h3>
                                <p>Checking status levels to verify if a task is completed, a customer is served, or an invoice was received.</p>
                            </div>
                            <div className="problem-card">
                                <div className="card-indicator warning-border"></div>
                                <h3>Missing follow-up</h3>
                                <p>Quotes that sit unanswered, invoice reminders that get forgotten, and clients waiting for simple callbacks.</p>
                            </div>
                            <div className="problem-card">
                                <div className="card-indicator warning-border"></div>
                                <h3>Work without a clear status</h3>
                                <p>Operational tasks that drop through the cracks because they live only on slips of paper or temporary messaging chats.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Workspace Selector Section */}
                <section id="workspaces" className="workspaces-section">
                    <div className="section-container">
                        <div className="workspaces-header">
                            <h2>Built around the way your business works.</h2>
                            <p>Select a workspace module to see how Q360 can illustrate workflow structures designed for your operations.</p>
                        </div>

                        <div className="workspace-tabs-container">
                            {/* Mobile Tabs Header */}
                            <div className="mobile-tabs-bar">
                                <button type="button" onClick={() => setActiveWorkspace('restaurant')} className={`mobile-tab ${activeWorkspace === 'restaurant' ? 'active' : ''}`}>Restaurant</button>
                                <button type="button" onClick={() => setActiveWorkspace('commerce')} className={`mobile-tab ${activeWorkspace === 'commerce' ? 'active' : ''}`}>Commerce</button>
                                <button type="button" onClick={() => setActiveWorkspace('services')} className={`mobile-tab ${activeWorkspace === 'services' ? 'active' : ''}`}>Services</button>
                                <button type="button" onClick={() => setActiveWorkspace('projects')} className={`mobile-tab ${activeWorkspace === 'projects' ? 'active' : ''}`}>Projects</button>
                                <button type="button" onClick={() => setActiveWorkspace('pharmacy')} className={`mobile-tab ${activeWorkspace === 'pharmacy' ? 'active' : ''}`}>Pharmacy</button>
                            </div>

                            <div className="workspace-interactive-layout">
                                {/* Desktop Sidebar Workspace Selector */}
                                <div className="desktop-workspace-menu">
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveWorkspace('restaurant')}
                                        className={`workspace-menu-btn ${activeWorkspace === 'restaurant' ? 'active' : ''}`}
                                    >
                                        <ChefHat size={18} />
                                        <span>Restaurant</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveWorkspace('commerce')}
                                        className={`workspace-menu-btn ${activeWorkspace === 'commerce' ? 'active' : ''}`}
                                    >
                                        <Receipt size={18} />
                                        <span>Commerce</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveWorkspace('services')}
                                        className={`workspace-menu-btn ${activeWorkspace === 'services' ? 'active' : ''}`}
                                    >
                                        <BriefcaseBusiness size={18} />
                                        <span>Services</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveWorkspace('projects')}
                                        className={`workspace-menu-btn ${activeWorkspace === 'projects' ? 'active' : ''}`}
                                    >
                                        <FileText size={18} />
                                        <span>Projects</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveWorkspace('pharmacy')}
                                        className={`workspace-menu-btn future-tab ${activeWorkspace === 'pharmacy' ? 'active' : ''}`}
                                    >
                                        <Lock size={16} />
                                        <span>Pharmacy</span>
                                        <span className="future-pill">Future direction</span>
                                    </button>
                                </div>

                                {/* Active Workspace Details Panel */}
                                <div className="workspace-preview-canvas">
                                    {activeWorkspace === 'restaurant' && (
                                        <div className="canvas-wrapper">
                                            <div className="canvas-info">
                                                <h3>Q360 Restaurant</h3>
                                                <p>Built specifically for hospitality operations, keeping your front-of-house tables, point of sale, and back-of-house kitchen workflows in sync.</p>
                                                <div className="module-specs">
                                                    <span className="spec-item"><Table2 size={14} /> Floor Plan Management</span>
                                                    <span className="spec-item"><ChefHat size={14} /> Kitchen Tickets</span>
                                                </div>
                                            </div>
                                            <div className="canvas-visual">
                                                <span className="label-visual">Concept visual — example workflow</span>
                                                <div className="mock-interface-pane">
                                                    <div className="pane-header">Floor Plan View</div>
                                                    <div className="table-grid">
                                                        <div className="table-node occupied"><span>T1</span><strong>Active</strong></div>
                                                        <div className="table-node paying"><span>T2</span><strong>Needs attention</strong></div>
                                                        <div className="table-node available"><span>T3</span><strong>Ready</strong></div>
                                                        <div className="table-node occupied"><span>T4</span><strong>Active</strong></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeWorkspace === 'commerce' && (
                                        <div className="canvas-wrapper">
                                            <div className="canvas-info">
                                                <h3>Q360 Commerce</h3>
                                                <p>Manage physical goods, stock balances, draft quotes, customer order flows, invoices, and payment tracking without losing control of inventory numbers.</p>
                                                <div className="module-specs">
                                                    <span className="spec-item"><PackageCheck size={14} /> Catalog & Inventory Sync</span>
                                                    <span className="spec-item"><Receipt size={14} /> Quote-to-Invoice Pipelines</span>
                                                </div>
                                            </div>
                                            <div className="canvas-visual">
                                                <span className="label-visual">Concept visual — example workflow</span>
                                                <div className="mock-interface-pane">
                                                    <div className="pane-header">Active Inventory Balances</div>
                                                    <div className="list-view">
                                                        <div className="list-item">
                                                            <span>Example item A</span>
                                                            <strong className="amber-text">Stock low</strong>
                                                        </div>
                                                        <div className="list-item">
                                                            <span>Example item B</span>
                                                            <strong className="green-text">Stock verified</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeWorkspace === 'services' && (
                                        <div className="canvas-wrapper">
                                            <div className="canvas-info">
                                                <h3>Q360 Services</h3>
                                                <p>Ideal for field service operators, contractors, and agency teams. Log customer requests, schedule service times, track tasks on site, and invoice immediately upon completion.</p>
                                                <div className="module-specs">
                                                    <span className="spec-item"><CalendarDays size={14} /> Job Dispatch & Schedules</span>
                                                    <span className="spec-item"><Users size={14} /> Team Task Tracking</span>
                                                </div>
                                            </div>
                                            <div className="canvas-visual">
                                                <span className="label-visual-concept">Concept visual — example workflow</span>
                                                <div className="mock-interface-pane">
                                                    <div className="pane-header">Work Scheduler</div>
                                                    <div className="list-view">
                                                        <div className="list-item">
                                                            <span>Customer request A</span>
                                                            <span className="badge-outline">Assigned</span>
                                                        </div>
                                                        <div className="list-item">
                                                            <span>Customer request B</span>
                                                            <span className="badge-outline">Assigned</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeWorkspace === 'projects' && (
                                        <div className="canvas-wrapper">
                                            <div className="canvas-info">
                                                <h3>Projects & Milestones</h3>
                                                <p>Keep longer, multi-step contracts structured. Track project tasks, record milestones, share logs with clients, and link deliverables directly to progress billings.</p>
                                                <div className="module-specs">
                                                    <span className="spec-item"><FileText size={14} /> Structured Milestones</span>
                                                    <span className="spec-item"><CheckCircle2 size={14} /> Client Progress Reports</span>
                                                </div>
                                            </div>
                                            <div className="canvas-visual">
                                                <span className="label-visual-concept">Concept visual — example workflow</span>
                                                <div className="mock-interface-pane">
                                                    <div className="pane-header">Project Roadmap</div>
                                                    <div className="list-view">
                                                        <div className="list-item">
                                                            <span>Milestone A</span>
                                                            <strong className="green-text">Completed</strong>
                                                        </div>
                                                        <div className="list-item">
                                                            <span>Milestone B</span>
                                                            <strong className="amber-text">Review needed</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeWorkspace === 'pharmacy' && (
                                        <div className="canvas-wrapper locked-canvas">
                                            <div className="canvas-info">
                                                <span className="locked-badge"><Lock size={12} /> Future Direction</span>
                                                <h3>Q360 Pharmacy</h3>
                                                <p>In-planning extension for medicine retail operations. This module is focused on future direction and is not currently sold or supported for clinical or prescription compliance.</p>
                                            </div>
                                            <div className="canvas-visual locked-visual">
                                                <span className="label-visual-concept">Concept visual — example workflow</span>
                                                <div className="mock-interface-pane locked-pane">
                                                    <Pill size={48} className="locked-icon" />
                                                    <p>Pharmacy Operations Concept</p>
                                                    <span className="lock-sub">Module in planning stages</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. Operational Clarity Section */}
                <section className="clarity-section">
                    <div className="section-container">
                        <div className="clarity-header">
                            <h2>What Q360 helps you stay on top of.</h2>
                            <p>Keep your business running cleanly with a focused set of operational foundations.</p>
                        </div>
                        
                        <div className="clarity-grid">
                            <div className="clarity-card">
                                <div className="clarity-icon"><Users size={20} /></div>
                                <h3>Customers and follow-up</h3>
                                <p>Store client contact histories, track sent quotes, and note diagnostic details in one central database.</p>
                            </div>
                            <div className="clarity-card">
                                <div className="clarity-icon"><Activity size={20} /></div>
                                <h3>Orders and jobs</h3>
                                <p>Manage active dining tables, coordinate field technician dispatches, or monitor open product sales.</p>
                            </div>
                            <div className="clarity-card">
                                <div className="clarity-icon"><CheckCircle2 size={20} /></div>
                                <h3>Tasks and team activity</h3>
                                <p>Assign check-sheets to teams, set milestones on projects, and view status changes as they are logged.</p>
                            </div>
                            <div className="clarity-card">
                                <div className="clarity-icon"><Receipt size={20} /></div>
                                <h3>Invoices and payments</h3>
                                <p>Generate invoices from order records, track outstanding debts, and note payment transactions.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. Meet Q Section */}
                <section id="meet-q" className="q-section">
                    <div className="section-container">
                        <div className="q-split-layout">
                            <div className="q-copy-block">
                                <div className="q-badge">
                                    <span className="logo-white"><LogoMark size={16} /></span>
                                    <span>Workspace Assistant</span>
                                </div>
                                <h2>Keeps track, so you do not have to.</h2>
                                <p className="q-desc-text">
                                    Q is your business assistant inside Q360. It helps you spot what may need attention next using the activity already recorded in your workspace.
                                </p>
                                <div className="trust-callout">
                                    <Info size={16} />
                                    <span>Q prepares insights and suggested next steps. You approve important actions.</span>
                                </div>
                            </div>

                            <div className="q-timeline-block">
                                <span className="label-visual-concept">Concept visual — example workflow</span>
                                <div className="mock-timeline-card">
                                    <div className="timeline-header">
                                        <div className="header-info">
                                            <h3>Activity Feed</h3>
                                            <p>System Logs & Suggestions</p>
                                        </div>
                                        <div className="active-glow-q"></div>
                                    </div>

                                    <div className="timeline-events">
                                        <div className="timeline-event">
                                            <div className="event-marker green-bg">✓</div>
                                            <div className="event-content">
                                                <strong>Payment Confirmed</strong>
                                                <p>Invoice payment received.</p>
                                            </div>
                                        </div>

                                        <div className="timeline-event suggestion-event">
                                            <div className="event-marker q-marker">Q</div>
                                            <div className="event-content">
                                                <div className="suggestion-badge">Insight Prepared</div>
                                                <strong>Suggested Next Step</strong>
                                                <p>Q highlights an item that may need attention.</p>
                                                
                                                <div className="suggestion-action-box">
                                                    {!qApproved ? (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setQApproved(true)} 
                                                            className="btn-approve"
                                                        >
                                                            Mark Suggestion Reviewed
                                                        </button>
                                                    ) : (
                                                        <div className="approved-indicator">
                                                            <CheckCircle2 size={14} />
                                                            <span>Suggestion Marked Reviewed</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. Final CTA Section */}
                <section className="final-cta-section">
                    <div className="section-container">
                        <div className="cta-box">
                            <h2>See how Q360 can fit your business.</h2>
                            <p>Less chasing. More clarity.</p>
                            <button type="button" onClick={() => navigate('/support')} className="btn-primary-cta">
                                Talk to the Q360 team
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-brand">
                        <div className="footer-logo logo-white">
                            <LogoFull height={24} />
                        </div>
                        <p className="copyright-text">
                            © 2026 Qamar Technologies Ltd. All rights reserved.
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
                            <strong>Support & Contact</strong>
                            <button type="button" onClick={() => navigate('/support')} className="footer-link">Contact Sales</button>
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

const landingStyles = `
    .landing-page {
        min-height: 100vh;
        background-color: #0A0B0D;
        background-image: 
            linear-gradient(rgba(255, 255, 255, 0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
        background-size: 40px 40px;
        color: #F8FAFC;
        font-family: var(--font-sans);
        overflow-x: hidden;
        position: relative;
    }

    .landing-header {
        padding: 20px 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        backdrop-filter: blur(20px);
        background-color: rgba(10, 11, 13, 0.85);
        position: sticky;
        top: 0;
        z-index: 100;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .brand-lockup {
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
    }

    .logo-white img {
        filter: brightness(0) invert(1);
    }

    .landing-nav {
        display: flex;
        gap: 28px;
        align-items: center;
    }

    .nav-btn {
        background: transparent;
        border: none;
        color: #94A3B8;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        padding: 8px 12px;
        transition: color 150ms ease;
    }

    .nav-btn:hover {
        color: #3B82F6;
    }

    .nav-cta {
        background: #F8FAFC;
        color: #0A0B0D;
        border: none;
        padding: 8px 20px;
        border-radius: 999px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 150ms ease, transform 150ms ease;
    }

    .nav-cta:hover {
        background: #E2E8F0;
        transform: translateY(-1px);
    }

    /* Accessibility Focus Styles */
    button:focus-visible,
    a:focus-visible,
    .nav-btn:focus-visible,
    .nav-cta:focus-visible,
    .btn-primary:focus-visible,
    .btn-secondary:focus-visible,
    .sidebar-tab:focus-visible,
    .workspace-menu-btn:focus-visible,
    .mobile-tab:focus-visible,
    .btn-approve:focus-visible,
    .btn-primary-cta:focus-visible,
    .footer-link:focus-visible {
        outline: 2px solid #D97706 !important;
        outline-offset: 4px !important;
        box-shadow: 0 0 8px rgba(217, 119, 6, 0.4) !important;
    }

    /* 1. Hero Section */
    .hero-section {
        max-width: 1200px;
        margin: 0 auto;
        padding: 80px 20px 100px;
        position: relative;
        z-index: 1;
    }

    .hero-grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 60px;
        align-items: center;
    }

    .hero-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.08);
        border: 1px solid rgba(59, 130, 246, 0.2);
        color: #3B82F6;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 24px;
    }

    .hero-section h1 {
        font-size: 52px;
        font-weight: 900;
        line-height: 1.15;
        margin: 0 0 20px;
        letter-spacing: -0.02em;
    }

    .highlight-text {
        background: linear-gradient(135deg, #60A5FA, #3B82F6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        display: block;
        padding: 4px 0;
    }

    .hero-subtitle {
        font-size: 18px;
        color: #94A3B8;
        line-height: 1.5;
        margin: 0 0 36px;
        max-width: 520px;
    }

    .hero-actions {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
    }

    .btn-primary {
        background: #3B82F6;
        color: #FFFFFF;
        border: none;
        padding: 14px 28px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease;
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.2);
    }

    .btn-primary:hover {
        background: #2563EB;
        transform: translateY(-1px);
        box-shadow: 0 6px 24px rgba(59, 130, 246, 0.3);
    }

    .btn-secondary {
        background: rgba(255, 255, 255, 0.04);
        color: #F8FAFC;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 14px 28px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease;
    }

    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .hero-visual {
        position: relative;
    }

    .mock-browser {
        background: #121316;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 30px 60px -15px rgba(0,0,0,0.8);
    }

    .browser-header {
        background: #1A1B1F;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .browser-dots {
        display: flex;
        gap: 6px;
        margin-right: 20px;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.2);
    }

    .browser-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #64748B;
        font-size: 11px;
        font-weight: 500;
    }

    .mock-app-layout {
        display: grid;
        grid-template-columns: 140px minmax(0, 1fr);
        height: 280px;
    }

    .mock-sidebar {
        background: #15161A;
        border-right: 1px solid rgba(255, 255, 255, 0.04);
        padding: 16px 10px;
    }

    .sidebar-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .group-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #475569;
        margin-bottom: 6px;
        padding-left: 6px;
    }

    .sidebar-tab {
        background: transparent;
        border: none;
        color: #64748B;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: background 150ms ease, color 150ms ease;
    }

    .sidebar-tab:hover {
        color: #94A3B8;
        background: rgba(255, 255, 255, 0.02);
    }

    .sidebar-tab.active {
        color: #F8FAFC;
        background: rgba(217, 119, 6, 0.15);
        border-left: 2px solid #D97706;
    }

    .mock-main-view {
        background: #111215;
        padding: 20px;
        display: flex;
        flex-direction: column;
    }

    .view-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        padding-bottom: 12px;
        margin-bottom: 16px;
    }

    .view-header h3 {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        color: #94A3B8;
        letter-spacing: 0.05em;
    }

    .label-screenshot {
        font-size: 9px;
        background: rgba(217, 119, 6, 0.05);
        color: #D97706;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(217, 119, 6, 0.2);
    }

    .view-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .stats-row {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
    }

    .stat-pill {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        padding: 4px 10px;
        border-radius: 99px;
        font-size: 11px;
        color: #94A3B8;
    }

    .stat-pill strong {
        color: #F8FAFC;
    }

    .warning-pill {
        border-color: rgba(217, 119, 6, 0.2);
        background: rgba(217, 119, 6, 0.05);
    }

    .warning-pill strong {
        color: #D97706;
    }

    .success-pill {
        border-color: rgba(16, 185, 129, 0.2);
        background: rgba(16, 185, 129, 0.05);
    }

    .success-pill strong {
        color: #10B981;
    }

    .order-ticket,
    .quote-card,
    .job-card,
    .project-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 14px;
    }

    .ticket-header,
    .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        font-size: 12px;
    }

    .status-badge {
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 99px;
    }

    .success-badge {
        background: rgba(16, 185, 129, 0.1);
        color: #10B981;
        border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .progress-badge {
        background: rgba(59, 130, 246, 0.1);
        color: #3B82F6;
        border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .ticket-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 11px;
        color: #94A3B8;
    }

    .ticket-item span {
        color: #D97706;
        font-weight: bold;
        margin-right: 4px;
    }

    .card-desc {
        margin: 0 0 8px;
        font-size: 11px;
        color: #64748B;
    }

    .card-value {
        font-size: 12px;
        font-weight: bold;
        color: #94A3B8;
    }

    .milestone-steps {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 11px;
    }

    .step.done {
        color: #10B981;
    }

    .step.progress {
        color: #D97706;
    }

    /* 2. Owner Problem Section */
    .problem-section {
        position: relative;
        padding: 100px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }

    .spotlight-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        height: 300px;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%);
        pointer-events: none;
    }

    .section-container {
        max-width: 1200px;
        margin: 0 auto;
        position: relative;
        z-index: 1;
    }

    .problem-header,
    .workspaces-header,
    .clarity-header {
        text-align: center;
        margin-bottom: 60px;
    }

    .problem-header h2,
    .workspaces-header h2,
    .clarity-header h2 {
        font-size: 36px;
        font-weight: 800;
        margin: 0 0 16px;
        letter-spacing: -0.01em;
    }

    .problem-header p,
    .workspaces-header p,
    .clarity-header p {
        font-size: 16px;
        color: #94A3B8;
        max-width: 600px;
        margin: 0 auto;
        line-height: 1.5;
    }

    .problem-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
    }

    .problem-card {
        background: rgba(255, 255, 255, 0.01);
        border: 1px solid rgba(255, 255, 255, 0.04);
        border-radius: 12px;
        padding: 32px;
        position: relative;
        overflow: hidden;
    }

    .card-indicator {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
    }

    .warning-border {
        background: #D97706;
    }

    .problem-card h3 {
        margin: 0 0 12px;
        font-size: 18px;
        font-weight: 700;
    }

    .problem-card p {
        margin: 0;
        font-size: 14px;
        color: #94A3B8;
        line-height: 1.5;
    }

    /* 3. Workspace Selector Section */
    .workspaces-section {
        padding: 100px 20px;
        background: rgba(0,0,0,0.1);
    }

    .workspace-tabs-container {
        margin-top: 40px;
    }

    .mobile-tabs-bar {
        display: none;
    }

    .workspace-interactive-layout {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 40px;
        align-items: flex-start;
    }

    .desktop-workspace-menu {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .workspace-menu-btn {
        background: transparent;
        border: 1px solid transparent;
        color: #64748B;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    }

    .workspace-menu-btn:hover {
        color: #94A3B8;
        background: rgba(255, 255, 255, 0.02);
    }

    .workspace-menu-btn.active {
        color: #F8FAFC;
        background: rgba(217, 119, 6, 0.12);
        border: 1px solid rgba(217, 119, 6, 0.25);
    }

    .future-tab {
        opacity: 0.7;
    }

    .future-tab.active {
        background: rgba(255, 255, 255, 0.03);
        border-color: rgba(255, 255, 255, 0.08);
    }

    .future-pill {
        font-size: 9px;
        background: rgba(255,255,255,0.05);
        color: #64748B;
        padding: 1px 6px;
        border-radius: 4px;
        margin-left: auto;
    }

    .workspace-preview-canvas {
        background: #111215;
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        min-height: 380px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        overflow: hidden;
    }

    .canvas-wrapper {
        padding: 40px;
        display: grid;
        grid-template-columns: 1fr 1.2fr;
        gap: 40px;
        align-items: center;
        height: 100%;
    }

    .canvas-info h3 {
        font-size: 24px;
        margin: 0 0 16px;
        font-weight: 800;
    }

    .canvas-info p {
        font-size: 15px;
        color: #94A3B8;
        line-height: 1.5;
        margin: 0 0 28px;
    }

    .module-specs {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .spec-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: #F8FAFC;
        font-weight: 500;
    }

    .spec-item svg {
        color: #3B82F6;
    }

    .canvas-visual {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
    }

    .label-visual,
    .label-visual-concept {
        font-size: 10px;
        background: rgba(217, 119, 6, 0.05);
        border: 1px solid rgba(217, 119, 6, 0.2);
        color: #D97706;
        padding: 4px 8px;
        border-radius: 4px;
        margin-bottom: 12px;
    }

    .mock-interface-pane {
        background: #16171C;
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        width: 100%;
        min-height: 200px;
        padding: 20px;
    }

    .pane-header {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: #475569;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        padding-bottom: 10px;
        margin-bottom: 16px;
    }

    .table-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .table-node {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        font-size: 12px;
    }

    .table-node span {
        font-size: 10px;
        color: #64748B;
    }

    .table-node.occupied {
        border-color: rgba(59, 130, 246, 0.2);
        background: rgba(59, 130, 246, 0.03);
    }

    .table-node.paying {
        border-color: rgba(217, 119, 6, 0.2);
        background: rgba(217, 119, 6, 0.03);
    }

    .table-node.paying strong {
        color: #D97706;
    }

    .table-node.available {
        border-color: rgba(16, 185, 129, 0.2);
        background: rgba(16, 185, 129, 0.03);
    }

    .table-node.available strong {
        color: #10B981;
    }

    .list-view {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .list-item {
        background: rgba(255, 255, 255, 0.01);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
    }

    .amber-text {
        color: #D97706;
    }

    .green-text {
        color: #10B981;
    }

    .badge-outline {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255,255,255,0.02);
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 10px;
        color: #94A3B8;
    }

    .locked-canvas {
        background: rgba(10, 11, 13, 0.5);
    }

    .locked-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255,255,255,0.05);
        color: #64748B;
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        margin-bottom: 12px;
    }

    .locked-visual {
        opacity: 0.5;
    }

    .locked-pane {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
    }

    .locked-icon {
        color: #64748B;
        margin-bottom: 12px;
    }

    .lock-sub {
        font-size: 10px;
        color: #475569;
    }

    /* 4. Operational Clarity Section */
    .clarity-section {
        padding: 100px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }

    .clarity-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
    }

    .clarity-card {
        background: rgba(255, 255, 255, 0.01);
        border: 1px solid rgba(255, 255, 255, 0.04);
        border-radius: 12px;
        padding: 28px;
        transition: border-color 150ms ease;
    }

    .clarity-card:hover {
        border-color: rgba(59, 130, 246, 0.2);
    }

    .clarity-icon {
        color: #3B82F6;
        margin-bottom: 20px;
    }

    .clarity-card h3 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 700;
    }

    .clarity-card p {
        margin: 0;
        font-size: 13px;
        color: #94A3B8;
        line-height: 1.5;
    }

    /* 5. Meet Q Section */
    .q-section {
        padding: 100px 20px;
        background: rgba(0,0,0,0.15);
    }

    .q-split-layout {
        display: grid;
        grid-template-columns: 0.95fr 1.05fr;
        gap: 60px;
        align-items: center;
    }

    .q-copy-block {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .q-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #F8FAFC;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 24px;
    }

    .q-section h2 {
        font-size: 40px;
        font-weight: 800;
        margin: 0 0 20px;
    }

    .q-desc-text {
        font-size: 16px;
        color: #94A3B8;
        line-height: 1.6;
        margin: 0 0 36px;
    }

    .trust-callout {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 16px 20px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 13px;
        color: #94A3B8;
        line-height: 1.45;
    }

    .trust-callout svg {
        color: #3B82F6;
        flex-shrink: 0;
        margin-top: 2px;
    }

    .q-timeline-block {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
    }

    .mock-timeline-card {
        background: #111215;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        width: 100%;
        overflow: hidden;
        box-shadow: 0 20px 45px rgba(0,0,0,0.5);
    }

    .timeline-header {
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .header-info h3 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 700;
    }

    .header-info p {
        margin: 0;
        font-size: 11px;
        color: #64748B;
    }

    .active-glow-q {
        width: 8px;
        height: 8px;
        border-radius: 99px;
        background: #3B82F6;
        box-shadow: 0 0 10px #3B82F6;
    }

    .timeline-events {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        position: relative;
    }

    .timeline-events::before {
        content: '';
        position: absolute;
        left: 35px;
        top: 40px;
        bottom: 40px;
        width: 1px;
        background: rgba(255, 255, 255, 0.05);
    }

    .timeline-event {
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr);
        gap: 16px;
        position: relative;
        z-index: 1;
    }

    .event-marker {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: bold;
    }

    .green-bg {
        background: rgba(16, 185, 129, 0.15);
        color: #10B981;
        border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .q-marker {
        background: rgba(255, 255, 255, 0.05);
        color: #F8FAFC;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
    }

    .event-content {
        font-size: 13px;
    }

    .event-content strong {
        color: #F8FAFC;
        display: block;
        margin-bottom: 4px;
    }

    .event-content p {
        margin: 0;
        color: #94A3B8;
        line-height: 1.45;
    }

    .suggestion-event {
        background: rgba(59, 130, 246, 0.02);
        border: 1px solid rgba(59, 130, 246, 0.1);
        border-radius: 8px;
        padding: 16px;
        margin-left: -8px;
    }

    .suggestion-badge {
        display: inline-block;
        font-size: 9px;
        background: rgba(59, 130, 246, 0.1);
        color: #3B82F6;
        border: 1px solid rgba(59, 130, 246, 0.25);
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: bold;
        margin-bottom: 8px;
    }

    .suggestion-action-box {
        margin-top: 14px;
    }

    .btn-approve {
        background: #3B82F6;
        color: #FFFFFF;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 150ms ease;
    }

    .btn-approve:hover {
        background: #2563EB;
    }

    .approved-indicator {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #10B981;
        font-size: 11px;
        font-weight: 600;
    }

    /* 6. Final CTA Section */
    .final-cta-section {
        padding: 100px 20px 120px;
        border-top: 1px solid rgba(255, 255, 255, 0.03);
    }

    .cta-box {
        max-width: 900px;
        margin: 0 auto;
        padding: 60px 40px;
        background: linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.02) 100%);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 16px;
        text-align: center;
    }

    .cta-box h2 {
        font-size: 36px;
        font-weight: 800;
        margin: 0 0 16px;
    }

    .cta-box p {
        font-size: 18px;
        color: #94A3B8;
        margin: 0 auto 36px;
    }

    .btn-primary-cta {
        background: #F8FAFC;
        color: #0A0B0D;
        border: none;
        padding: 14px 36px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background 150ms ease, transform 150ms ease;
    }

    .btn-primary-cta:hover {
        background: #E2E8F0;
        transform: translateY(-1px);
    }

    /* Footer */
    .landing-footer {
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        background: #060708;
        padding: 60px 20px 40px;
    }

    .footer-container {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        gap: 60px;
    }

    .footer-brand {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        max-width: 320px;
    }

    .footer-logo {
        margin-bottom: 16px;
    }

    .copyright-text {
        font-size: 13px;
        color: #475569;
        margin: 0;
    }

    .footer-navigation {
        display: flex;
        gap: 80px;
    }

    .footer-nav-col {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .footer-nav-col strong {
        color: #F8FAFC;
        font-size: 14px;
        margin-bottom: 6px;
    }

    .footer-link {
        background: transparent;
        border: none;
        color: #64748B;
        font-size: 13px;
        padding: 0;
        cursor: pointer;
        text-align: left;
        transition: color 150ms ease;
    }

    .footer-link:hover {
        color: #3B82F6;
    }

    .footer-link.inactive {
        cursor: default;
    }

    .footer-link.inactive:hover {
        color: #64748B;
    }

    /* Responsive adjustments */
    @media (max-width: 1024px) {
        .hero-grid,
        .workspace-interactive-layout,
        .q-split-layout {
            grid-template-columns: 1fr;
            gap: 40px;
        }

        .hero-content {
            align-items: center;
            text-align: center;
        }

        .hero-subtitle {
            margin-left: auto;
            margin-right: auto;
        }

        .hero-actions {
            justify-content: center;
        }

        .desktop-workspace-menu {
            display: none;
        }

        .mobile-tabs-bar {
            display: flex;
            overflow-x: auto;
            gap: 12px;
            padding-bottom: 16px;
            margin-bottom: 24px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            -webkit-overflow-scrolling: touch;
        }

        .mobile-tab {
            flex-shrink: 0;
        }

        .mobile-tab.active {
            color: #F8FAFC;
            background: rgba(217, 119, 6, 0.12);
            border-color: rgba(217, 119, 6, 0.25);
        }

        .problem-grid,
        .clarity-grid {
            grid-template-columns: 1fr;
            gap: 16px;
        }

        .canvas-wrapper {
            grid-template-columns: 1fr;
            padding: 30px;
        }
    }

    @media (max-width: 768px) {
        .landing-header {
            padding: 16px 20px;
        }

        .landing-nav {
            gap: 16px;
        }

        .nav-btn {
            display: none;
        }

        .hero-section h1 {
            font-size: 32px;
        }

        .problem-header h2,
        .workspaces-header h2,
        .clarity-header h2,
        .q-section h2,
        .cta-box h2 {
            font-size: 24px;
        }

        .footer-container {
            flex-direction: column;
            gap: 40px;
        }

        .footer-navigation {
            gap: 40px;
        }

        .hero-grid, .workspace-interactive-layout, .q-split-layout {
            display: flex;
            flex-direction: column;
            width: 100%;
            gap: 24px;
        }

        .hero-visual, .workspace-preview-canvas, .q-timeline-block {
            width: 100%;
            max-width: 100%;
            overflow: hidden;
        }

        .canvas-wrapper {
            padding: 20px;
        }
    }

    @media (max-width: 375px) {
        .hero-section h1 {
            font-size: 28px;
        }
        .problem-header h2,
        .workspaces-header h2,
        .clarity-header h2,
        .q-section h2,
        .cta-box h2 {
            font-size: 22px;
        }
        .hero-actions .btn-primary,
        .hero-actions .btn-secondary {
            width: 100%;
            text-align: center;
        }
    }

    /* Motion respects system settings */
    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
        }
    }
`;
