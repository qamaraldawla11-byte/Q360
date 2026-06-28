import { useNavigate } from 'react-router-dom';
import { Sparkles, BrainCircuit } from 'lucide-react';

export const AiView = () => {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: '100vh', background: 'black', color: 'white', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

            {/* Background Gradients */}
            <div style={{ position: 'absolute', top: '20%', left: '20%', width: '400px', height: '400px', background: 'purple', filter: 'blur(150px)', opacity: 0.4 }} />
            <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: '400px', height: '400px', background: 'blue', filter: 'blur(150px)', opacity: 0.4 }} />

            <div style={{ maxWidth: '600px', textAlign: 'center', zIndex: 1, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                    <BrainCircuit size={64} style={{ opacity: 0.9 }} />
                </div>

                <h1 style={{ fontSize: '56px', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Meet Q
                </h1>

                <p style={{ fontSize: '20px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '48px' }}>
                    Q is your AI operations teammate inside Q360. It helps owners spot overdue invoices, delayed tasks, low stock, unconfirmed quotes, and daily priorities using data already recorded in Q360.
                </p>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #333', padding: '8px 16px', borderRadius: '100px', fontSize: '14px', color: '#cbd5e1' }}>
                        <Sparkles size={14} style={{ display: 'inline', marginRight: '8px' }} />
                        Available for selected beta workflows
                    </span>
                    <button onClick={() => navigate('/')} style={{ background: 'white', color: 'black', border: 'none', padding: '10px 24px', borderRadius: '100px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        Back to Q360
                    </button>
                </div>
            </div>
        </div>
    );
};
