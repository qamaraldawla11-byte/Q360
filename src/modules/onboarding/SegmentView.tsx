import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { ShoppingCart, Briefcase, GraduationCap, Truck, Building2 } from 'lucide-react';

const CATEGORIES = [
    { id: 'commerce', label: 'Commerce', icon: ShoppingCart, color: '#10b981', description: 'Retail, Restaurants, Pharmacy' },
    { id: 'services', label: 'Services', icon: Briefcase, color: '#3b82f6', description: 'Clinics, Salons, Repair' },
    { id: 'education', label: 'Education', icon: GraduationCap, color: '#8b5cf6', description: 'Schools, Courses, Tutoring' },
    { id: 'marketplace', label: 'Marketplace', icon: Truck, color: '#ec4899', description: 'Logistics, Delivery, Apps' },
    { id: 'enterprise', label: 'Enterprise / Ops', icon: Building2, color: '#64748b', description: 'Office, Manufacturing' },
];

export const SegmentView = () => {
    const navigate = useNavigate();
    const { updateUser } = useAuthStore();
    const [selected, setSelected] = useState<string | null>(null);

    const handleContinue = () => {
        if (!selected) return;

        // Store category selection in temp field
        updateUser({
            // Using lastActiveWorkspace as temp storage for category ID initially
            lastActiveWorkspace: selected
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
                    <div
                        key={c.id}
                        onClick={() => setSelected(c.id)}
                        style={{
                            padding: '16px 20px',
                            borderRadius: '16px',
                            border: selected === c.id ? `2px solid ${c.color}` : '1px solid var(--border-subtle)',
                            background: selected === c.id ? `${c.color}05` : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            transition: 'all 0.2s',
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
                    </div>
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
