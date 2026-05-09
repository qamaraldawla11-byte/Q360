import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useNavigate } from 'react-router-dom';
import { Box } from 'lucide-react';

export const LoginView = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const login = useAuthStore((state) => state.login);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email);
            // Check state directly after login if possible, or assume updated
            // Note: In a real app we'd get the user from the response or wait for store update
            // Here we assume the store is updated.
            const user = useAuthStore.getState().user;

            if (user?.onboardingCompleted) {
                navigate('/app');
            } else {
                navigate('/onboarding/identity');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f1f5f9', // Slate 100 for login background
            fontFamily: 'var(--font-sans)'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '48px',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)', // Soft SaaS shadow
                border: '1px solid #e2e8f0'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex',
                        background: 'var(--accent-primary)',
                        padding: '10px',
                        borderRadius: '10px',
                        marginBottom: '16px',
                        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
                    }}>
                        <Box size={24} color="white" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Welcome back</h1>
                    <p style={{ margin: '8px 0 0', color: '#64748b' }}>Enter your credentials to access the platform.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="admin@one-os.io"
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 'var(--radius-md)',
                                color: '#0f172a',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            transition: 'opacity 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)',
                            marginBottom: '16px'
                        }}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <button
                        type="button"
                        onClick={async () => {
                            // Preview Mode Bypass
                            await login('admin@one-os.io');
                            const { updateUser } = useAuthStore.getState();
                            updateUser({ onboardingCompleted: true }); // Mock onboarding complete
                            navigate('/app/segments');
                        }}
                        style={{
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '13px',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                        }}
                    >
                        Skip for now (Preview Mode)
                    </button>
                </form>
            </div>
        </div>
    );
};
