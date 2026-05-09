import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box, UtensilsCrossed, Pill, ShoppingCart, Star, Zap, Shield, Globe, ChevronRight } from 'lucide-react';

export const LandingView = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Restaurant');

    const verticals = [
        {
            name: 'Restaurant',
            icon: UtensilsCrossed,
            color: '#f59e0b',
            title: 'Precision for Plates',
            desc: 'Real-time kitchen displays, inventory tracking, and seamless table management designed for high-paced dining.',
            preview: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=1200'
        },
        {
            name: 'Pharmacy',
            icon: Pill,
            color: '#06b6d4',
            title: 'Compliance & Care',
            desc: 'Secure prescription management, stock alerts, and patient history at your fingertips. Built for modern clinics.',
            preview: 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?auto=format&fit=crop&q=80&w=1200'
        },
        {
            name: 'Supermarket',
            icon: ShoppingCart,
            color: '#10b981',
            title: 'Scale your Sales',
            desc: 'Multi-aisle inventory, barcode integration, and loyalty programs that keep your customers coming back.',
            preview: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200'
        },
    ];

    const features = [
        {
            title: 'Lightning Performance',
            desc: 'Optimized with React 19 for sub-100ms interactions across the board.',
            icon: Zap,
            span: 'col-span-2 row-span-1'
        },
        {
            title: 'Vault Security',
            desc: 'End-to-end encryption for every transaction.',
            icon: Shield,
            span: 'col-span-1 row-span-1'
        },
        {
            title: 'Global Mesh',
            desc: 'Sync data across unlimited locations instantly.',
            icon: Globe,
            span: 'col-span-1 row-span-2'
        },
        {
            title: 'Hybrid Cloud',
            desc: 'Works offline, syncs when you\'re back.',
            icon: Box,
            span: 'col-span-2 row-span-1'
        }
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-base)',
            color: 'var(--fg-primary)',
            fontFamily: 'var(--font-sans)',
            overflowX: 'hidden'
        }}>
            {/* Background Effects */}
            <div style={{
                position: 'fixed', top: '-10%', left: '10%', width: '40vw', height: '40vw',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 0
            }} />
            <div style={{
                position: 'fixed', bottom: '-10%', right: '10%', width: '50vw', height: '50vw',
                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 0
            }} />

            {/* Header */}
            <header style={{
                padding: '20px 40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backdropFilter: 'blur(20px)',
                backgroundColor: 'var(--glass-bg)',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                borderBottom: '1px solid var(--glass-border)'
            }}>
                <div
                    onClick={() => navigate('/')}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                        padding: '8px',
                        borderRadius: '12px',
                        display: 'flex',
                        boxShadow: '0 0 20px var(--primary-glow)'
                    }}>
                        <Box color="white" size={20} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '22px', letterSpacing: '-0.02em' }}>One OS</span>
                </div>

                <nav style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                    <span onClick={() => navigate('/docs')} style={{ color: 'var(--fg-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }}>Docs</span>
                    <span onClick={() => navigate('/pricing')} style={{ color: 'var(--fg-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Pricing</span>

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
                            gap: '8px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        Sign In <ArrowRight size={16} />
                    </button>
                </nav>
            </header>

            {/* Hero Section */}
            <section style={{
                padding: '160px 20px 100px',
                textAlign: 'center',
                maxWidth: '1200px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 1
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 16px',
                    background: 'var(--surface-100)',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '40px',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}>
                    <span style={{ display: 'flex', padding: '4px', background: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 10px var(--success)' }} />
                    <span style={{ color: 'var(--fg-secondary)' }}>v7.0 with OneMesh™ Sync</span>
                </div>

                <h1 style={{
                    fontSize: 'clamp(48px, 8vw, 92px)',
                    fontWeight: 900,
                    lineHeight: 0.95,
                    marginBottom: '32px',
                    letterSpacing: '-0.05em',
                }}>
                    The Operating System<br />
                    <span style={{
                        background: 'linear-gradient(to right, #60a5fa, #c084fc, #f472b6)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'inline-block',
                        padding: '10px 0'
                    }}>for Modern Business</span>
                </h1>

                <p style={{
                    fontSize: '22px',
                    color: 'var(--fg-secondary)',
                    maxWidth: '700px',
                    margin: '0 auto 56px',
                    lineHeight: 1.6,
                    fontWeight: 400
                }}>
                    A unified core for the industries that power the world.
                    Manage everything from commerce to compliance in one place.
                </p>

                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            padding: '20px 48px',
                            borderRadius: '16px',
                            fontSize: '18px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 20px 40px -12px var(--primary-glow)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'all 0.3s'
                        }}
                    >
                        Start Free Trial <ArrowRight size={20} />
                    </button>
                    <button
                        onClick={() => navigate('/pricing')}
                        style={{
                            background: 'transparent',
                            color: 'var(--fg-primary)',
                            border: '1px solid var(--glass-border)',
                            padding: '20px 48px',
                            borderRadius: '16px',
                            fontSize: '18px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        Review Plans
                    </button>
                </div>
            </section>

            {/* Vertical Tabs Section */}
            <section style={{ padding: '100px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{
                    background: 'var(--surface-100)',
                    borderRadius: '32px',
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    display: 'flex',
                    minHeight: '600px',
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    {/* Tab Navigation */}
                    <div style={{
                        width: '320px',
                        borderRight: '1px solid var(--glass-border)',
                        padding: '32px'
                    }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Industries</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {verticals.map((v) => (
                                <button
                                    key={v.name}
                                    onClick={() => setActiveTab(v.name)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        padding: '20px',
                                        borderRadius: '16px',
                                        background: activeTab === v.name ? 'var(--surface-200)' : 'transparent',
                                        border: '1px solid',
                                        borderColor: activeTab === v.name ? 'var(--glass-border)' : 'transparent',
                                        color: activeTab === v.name ? 'white' : 'var(--fg-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div style={{
                                        padding: '10px',
                                        borderRadius: '10px',
                                        background: activeTab === v.name ? v.color : 'var(--surface-300)',
                                        color: activeTab === v.name ? 'white' : 'var(--fg-muted)',
                                        transition: 'all 0.2s'
                                    }}>
                                        <v.icon size={20} />
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: '16px' }}>{v.name}</span>
                                    {activeTab === v.name && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div style={{ flex: 1, padding: '60px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {verticals.map((v) => activeTab === v.name && (
                            <div key={v.name} style={{ animation: 'fadeIn 0.5s ease' }}>
                                <h2 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.02em' }}>{v.title}</h2>
                                <p style={{ fontSize: '20px', color: 'var(--fg-secondary)', lineHeight: 1.6, marginBottom: '40px', maxWidth: '500px' }}>{v.desc}</p>
                                <div style={{
                                    borderRadius: '24px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--glass-border)',
                                    aspectRatio: '16/9',
                                    background: `url(${v.preview}) center/cover`,
                                    boxShadow: 'var(--shadow-lg)',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))'
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bento Features Grid */}
            <section style={{ padding: '100px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <h2 style={{ fontSize: '44px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.03em' }}>Built for scale</h2>
                    <p style={{ color: 'var(--fg-secondary)', fontSize: '18px' }}>The underlying infrastructure that powers modern enterprise.</p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridAutoRows: 'minmax(200px, auto)',
                    gap: '24px'
                }}>
                    {features.map((f, i) => (
                        <div
                            key={i}
                            className={f.span}
                            style={{
                                padding: '40px',
                                borderRadius: '24px',
                                background: 'var(--surface-100)',
                                border: '1px solid var(--glass-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                gridColumn: f.span.includes('col-span-2') ? 'span 2' : 'span 1',
                                gridRow: f.span.includes('row-span-2') ? 'span 2' : 'span 1',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                e.currentTarget.style.transform = 'translateY(-5px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '16px',
                                background: 'var(--surface-200)',
                                border: '1px solid var(--glass-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--primary)', marginBottom: '32px'
                            }}>
                                <f.icon size={28} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>{f.title}</h3>
                                <p style={{ color: 'var(--fg-secondary)', fontSize: '16px', lineHeight: 1.6 }}>{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Testimonials */}
            <section style={{ padding: '100px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '32px'
                }}>
                    {[
                        { name: 'Sarah Chen', role: 'CEO, Zen Kitchen', quote: 'The only platform that truly bridges our POS with back-office intelligence.' },
                        { name: 'Dr. James Miller', role: 'Lead Pharmacist', quote: 'Compliance used to be a headache. With One OS, it\'s just a background task.' },
                        { name: 'Marcus Aurelius', role: 'Director, Global Retail', quote: 'Scalability is no longer a question. We added 50 locations in a month.' }
                    ].map((t, i) => (
                        <div key={i} style={{
                            padding: '40px',
                            borderRadius: '24px',
                            background: 'var(--surface-100)',
                            border: '1px solid var(--glass-border)',
                        }}>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
                                {[...Array(5)].map((_, j) => <Star key={j} size={14} fill="var(--warning)" color="var(--warning)" />)}
                            </div>
                            <p style={{ fontSize: '18px', lineHeight: 1.6, marginBottom: '24px', fontStyle: 'italic', color: 'var(--fg-primary)' }}>"{t.quote}"</p>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '16px' }}>{t.name}</div>
                                <div style={{ color: 'var(--fg-muted)', fontSize: '14px' }}>{t.role}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <section style={{ padding: '120px 20px' }}>
                <div style={{
                    maxWidth: '1000px',
                    margin: '0 auto',
                    padding: '80px 40px',
                    background: 'linear-gradient(135deg, #0a0a0a 0%, #171717 100%)',
                    borderRadius: '40px',
                    border: '1px solid var(--glass-border)',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '300px', height: '300px', background: 'var(--primary)', filter: 'blur(120px)',
                        opacity: 0.1, pointerEvents: 'none'
                    }} />
                    <h2 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>Ready to centralize?</h2>
                    <p style={{ color: 'var(--fg-secondary)', fontSize: '20px', marginBottom: '40px' }}>Join 500+ enterprises optimizing their core operations today.</p>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            background: 'var(--fg-primary)',
                            color: 'var(--bg-base)',
                            border: 'none',
                            padding: '20px 56px',
                            borderRadius: '16px',
                            fontSize: '18px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Get Started
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                padding: '80px 40px 40px',
                maxWidth: '1200px',
                margin: '0 auto',
                borderTop: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--fg-muted)',
                fontSize: '14px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Box size={20} color="var(--primary)" />
                        <span style={{ fontWeight: 800, fontSize: '18px', color: 'white' }}>One OS</span>
                    </div>
                    <p>© 2026 One OS Modern Business Systems.</p>
                </div>
                <div style={{ display: 'flex', gap: '64px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <strong style={{ color: 'white' }}>Platform</strong>
                        <span>Pricing</span>
                        <span>Enterprise</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <strong style={{ color: 'white' }}>Company</strong>
                        <span>About</span>
                        <span>Careers</span>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .col-span-2 { grid-column: span 2; }
                .row-span-2 { grid-row: span 2; }
            `}</style>
        </div>
    );
};
