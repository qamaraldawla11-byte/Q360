import { useNavigate } from 'react-router-dom';
import { Book, Code, Cloud } from 'lucide-react';

export const DocsView = () => {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', fontFamily: 'var(--font-sans)', padding: '60px 20px' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--fg-secondary)', cursor: 'pointer', marginBottom: '40px' }}>Back to Home</button>
                <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--fg-primary)', marginBottom: '40px' }}>Documentation</h1>

                <div style={{ display: 'grid', gap: '24px' }}>
                    {[
                        { icon: Book, title: 'Q360 Overview', desc: 'Product direction, workspace concepts, and current beta scope.' },
                        { icon: Code, title: 'Workflow Notes', desc: 'How customers, orders, invoices, and follow-up fit together.' },
                        { icon: Cloud, title: 'Beta Foundations', desc: 'Authentication, onboarding, roles, business identity, and audit foundations.' },
                    ].map((item, idx) => (
                        <div key={idx} style={{
                            display: 'flex', gap: '20px', padding: '24px', background: 'white',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', cursor: 'pointer'
                        }}>
                            <item.icon size={24} color="var(--accent-primary)" style={{ marginTop: '2px' }} />
                            <div>
                                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>{item.title}</h3>
                                <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
