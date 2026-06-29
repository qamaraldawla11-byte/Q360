import { useNavigate } from 'react-router-dom';
import { Sparkles, BrainCircuit } from 'lucide-react';

export const AiView = () => {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: '100vh', background: 'black', color: 'white', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(8,47,73,0.45))' }} />

            <div style={{ maxWidth: '600px', textAlign: 'center', zIndex: 1, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                    <BrainCircuit size={64} style={{ opacity: 0.9 }} />
                </div>

                <h1 style={{ fontSize: '56px', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Meet Q
                </h1>

                <p style={{ fontSize: '20px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '48px' }}>
                    Q is your business assistant inside Q360. It helps you spot what may need attention next using the activity already recorded in your workspace.
                </p>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #333', padding: '8px 16px', borderRadius: '100px', fontSize: '14px', color: '#cbd5e1' }}>
                        <Sparkles size={14} style={{ display: 'inline', marginRight: '8px' }} />
                        Keeps track, so you do not have to.
                    </span>
                    <button onClick={() => navigate('/')} style={{ background: 'white', color: 'black', border: 'none', padding: '10px 24px', borderRadius: '100px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        Back to Q360
                    </button>
                </div>
            </div>
        </div>
    );
};
