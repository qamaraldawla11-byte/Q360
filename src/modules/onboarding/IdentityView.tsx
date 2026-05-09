import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

export const IdentityView = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        updateUser({ name: name.trim() });
        navigate('/onboarding/segment');
    };

    return (
        <div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                    <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--fg-primary)'
                    }}>
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        required
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '14px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '15px',
                            outline: 'none',
                            transition: 'border 0.2s'
                        }}
                    />
                </div>

                <div>
                    <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--fg-primary)'
                    }}>
                        Email Address
                    </label>
                    <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        style={{
                            width: '100%',
                            padding: '14px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)',
                            background: '#f8fafc',
                            color: 'var(--fg-muted)',
                            fontSize: '15px',
                            cursor: 'not-allowed'
                        }}
                    />
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--fg-muted)' }}>
                        You signed in with this email.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={!name.trim()}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: name.trim() ? 'var(--accent-primary)' : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                        cursor: name.trim() ? 'pointer' : 'not-allowed',
                        marginTop: '8px'
                    }}
                >
                    Continue
                </button>
            </form>
        </div>
    );
};
