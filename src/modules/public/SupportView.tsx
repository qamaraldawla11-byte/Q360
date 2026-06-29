import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

export const SupportView = () => {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: '500px', width: '100%', padding: '40px', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-glass)' }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--fg-secondary)', cursor: 'pointer', marginBottom: '24px' }}>Back</button>

                <div style={{ background: '#eff6ff', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', color: 'var(--accent-primary)' }}>
                    <MessageSquare size={24} />
                </div>

                <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--fg-primary)', marginBottom: '16px' }}>Contact Support</h1>
                <p style={{ color: 'var(--fg-secondary)', marginBottom: '32px', lineHeight: 1.5 }}>
                    Tell us what workflow you want to run in Q360. We will review the best next step for your business.
                </p>

                <div style={{ display: 'grid', gap: '16px' }}>
                    <input type="text" placeholder="Work Email" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }} />
                    <textarea placeholder="How can we help?" rows={4} style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontFamily: 'inherit' }} />
                    <button style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>Send Message</button>
                </div>
            </div>
        </div>
    );
};
