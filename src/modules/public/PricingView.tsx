import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

export const PricingView = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', fontFamily: 'var(--font-sans)', padding: '60px 20px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--fg-secondary)', cursor: 'pointer', marginBottom: '40px' }}>Back to Home</button>

            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontSize: '42px', fontWeight: 800, color: 'var(--fg-primary)', marginBottom: '16px' }}>Simple, transparent pricing</h1>
                <p style={{ fontSize: '18px', color: 'var(--fg-secondary)' }}>Talk to us about the workflow you want to run in Q360.</p>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                {[
                    { name: 'Access Request', price: 'Invite', desc: 'For businesses exploring one important workflow.', btn: 'Request access', primary: true, outline: false },
                    { name: 'Business Workspace', price: 'Planned', desc: 'For teams that manage customers, orders, invoices, and payment follow-up.', btn: 'Talk to us', outline: true },
                    { name: 'Modular Workspaces', price: 'Planned', desc: 'For businesses that need additional Q360 workspace modules as they become ready.', btn: 'Explore workspaces', outline: true }
                ].map((plan) => (
                    <div key={plan.name} style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        border: plan.primary ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        padding: '40px',
                        position: 'relative',
                        boxShadow: plan.primary ? '0 20px 40px -10px rgba(37, 99, 235, 0.15)' : 'none'
                    }}>
                        {plan.primary && <div style={{
                            position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--accent-primary)', color: 'white', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600
                        }}>WORKFLOW FOCUS</div>}

                        <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--fg-primary)', marginBottom: '8px' }}>{plan.name}</h3>
                        <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--fg-primary)', marginBottom: '16px' }}>{plan.price}</div>
                        <p style={{ color: 'var(--fg-secondary)', marginBottom: '32px' }}>{plan.desc}</p>

                        <button style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: 'var(--radius-md)',
                            border: plan.outline ? '1px solid var(--border-subtle)' : 'none',
                            background: plan.outline ? 'white' : 'var(--accent-primary)',
                            color: plan.outline ? 'var(--fg-primary)' : 'white',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginBottom: '32px'
                        }}>{plan.btn}</button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {['Founder-supported access conversations', 'Selected workflow setup', 'Daily operations workspace', 'Q suggestions where introduced'].map(feat => (
                                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--fg-secondary)', fontSize: '14px' }}>
                                    <Check size={16} color="var(--accent-primary)" /> {feat}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
