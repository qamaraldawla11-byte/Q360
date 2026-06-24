import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Building2, User } from 'lucide-react';
import type { UserType } from '@/types/user';

const CATEGORIES = [
    { id: 'sme' as const, label: 'Business', icon: Building2, color: '#10b981', description: 'Restaurant, pharmacy, supermarket, or retail' },
    { id: 'personal' as const, label: 'Personal', icon: User, color: '#3b82f6', description: 'Freelancer, consultant, or creative' },
];

export const SegmentView = () => {
    const navigate = useNavigate();
    const { updateUser } = useAuthStore();
    const [selected, setSelected] = useState<string | null>(null);

    const handleContinue = () => {
        if (!selected) return;

        updateUser({
            userType: selected as UserType,
            segment: null,
            lastActiveWorkspace: undefined,
        });

        navigate('/onboarding/type');
    };

    return (
        <div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(1, 1fr)',
                gap: '12px',
                marginBottom: '32px'
            }}>
                {CATEGORIES.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelected(c.id)}
                        aria-pressed={selected === c.id}
                        className="onboarding-option"
                        style={{
                            width: '100%',
                            padding: '16px 20px',
                            borderRadius: '16px',
                            border: selected === c.id ? `2px solid ${c.color}` : '1px solid var(--border-subtle)',
                            background: selected === c.id ? `${c.color}05` : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            transition: 'all 0.2s',
                            fontFamily: 'inherit',
                            textAlign: 'left',
                        }}
                    >
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: selected === c.id ? c.color : '#f1f5f9',
                            color: selected === c.id ? 'white' : 'var(--fg-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}>
                            <c.icon size={22} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontWeight: 700, fontSize: '15px',
                                color: selected === c.id ? c.color : 'var(--fg-primary)'
                            }}>
                                {c.label}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
                                {c.description}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <button
                onClick={handleContinue}
                disabled={!selected}
                style={{
                    width: '100%',
                    padding: '16px',
                    background: selected ? 'var(--accent-primary)' : '#cbd5e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 700,
                    cursor: selected ? 'pointer' : 'not-allowed',
                    fontSize: '15px'
                }}
            >
                Continue
            </button>
        </div>
    );
};
