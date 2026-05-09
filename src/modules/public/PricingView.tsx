import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

export const PricingView = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', fontFamily: 'var(--font-sans)', padding: '60px 20px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--fg-secondary)', cursor: 'pointer', marginBottom: '40px' }}>← Back to Home</button>

            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontSize: '42px', fontWeight: 800, color: 'var(--fg-primary)', marginBottom: '16px' }}>Simple, transparent pricing</h1>
                <p style={{ fontSize: '18px', color: 'var(--fg-secondary)' }}>Choose the plan that scales with your business.</p>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                {[
                    { name: 'Starter', price: 'Free', desc: 'For testing and small prototypes.', btn: 'Start Free', outline: true },
                    { name: 'Business', price: '$49', desc: 'For growing companies with active operations.', btn: 'Get Started', primary: true, outline: false },
                    { name: 'Enterprise', price: 'Custom', desc: 'For large-scale organizations needing full control.', btn: 'Contact Sales', outline: true }
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
                        }}>MOST POPULAR</div>}

                        <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--fg-primary)', marginBottom: '8px' }}>{plan.name}</h3>
                        <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--fg-primary)', marginBottom: '16px' }}>{plan.price}<span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--fg-secondary)' }}>/mo</span></div>
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
                            {['Unlimited Projects', 'Basic Analytics', '24/7 Support', 'API Access'].map(feat => (
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
