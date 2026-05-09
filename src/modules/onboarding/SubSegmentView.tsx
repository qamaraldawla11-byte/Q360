import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

const TYPES_BY_CATEGORY: Record<string, { id: string; label: string; path: string }[]> = {
    commerce: [
        { id: 'restaurant', label: 'Restaurant', path: '/app/restaurant' },
        { id: 'cafe', label: 'Café', path: '/app/restaurant' },
        { id: 'retail', label: 'Retail Shop', path: '/app/retail' },
        { id: 'supermarket', label: 'Supermarket / Grocery', path: '/app/supermarket' },
        { id: 'pharmacy', label: 'Pharmacy', path: '/app/pharmacy' },
    ],
    services: [
        { id: 'clinic', label: 'Medical Clinic', path: '/app/pharmacy' },
        { id: 'salon', label: 'Beauty Salon', path: '/app/retail' },
        { id: 'repair', label: 'Repair Shop', path: '/app/retail' },
    ],
    education: [
        { id: 'school', label: 'K-12 School', path: '/app/school' },
        { id: 'academy', label: 'Learning Academy', path: '/app/school' },
        { id: 'tutoring', label: 'Tutoring Center', path: '/app/school' },
    ],
    marketplace: [
        { id: 'logistics', label: 'Logistics / Delivery', path: '/app/supermarket' },
        { id: 'marketplace', label: 'Online Marketplace', path: '/app/retail' },
    ],
    enterprise: [
        { id: 'office', label: 'Corporate Office', path: '/app/admin' },
        { id: 'factory', label: 'Manufacturing', path: '/app/supermarket' },
    ],
};

export const SubSegmentView = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const [selected, setSelected] = useState<string | null>(null);

    // Get selected category from temp storage
    const categoryId = user?.lastActiveWorkspace || 'commerce';
    const types = TYPES_BY_CATEGORY[categoryId] || TYPES_BY_CATEGORY.commerce;

    const handleContinue = () => {
        if (!selected) return;

        const type = types.find(t => t.id === selected);
        if (!type) return;

        // Store selected path in temp storage
        updateUser({
            lastActiveWorkspace: type.path
        });

        navigate('/onboarding/workspace');
    };

    return (
        <div>
            <p style={{ fontSize: '14px', color: 'var(--fg-secondary)', marginBottom: '20px', textAlign: 'center' }}>
                Specific setup for <strong>{categoryId.charAt(0).toUpperCase() + categoryId.slice(1)}</strong>.
            </p>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '32px'
            }}>
                {types.map((t) => (
                    <div
                        key={t.id}
                        onClick={() => setSelected(t.id)}
                        style={{
                            padding: '16px 20px',
                            borderRadius: '12px',
                            border: selected === t.id ? `2px solid var(--accent-primary)` : '1px solid var(--border-subtle)',
                            background: selected === t.id ? `rgba(99, 102, 241, 0.05)` : 'white',
                            cursor: 'pointer',
                            fontWeight: selected === t.id ? 700 : 500,
                            color: selected === t.id ? 'var(--accent-primary)' : 'var(--fg-primary)',
                            transition: 'all 0.2s',
                            fontSize: '15px'
                        }}
                    >
                        {t.label}
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={() => navigate('/onboarding/segment')}
                    style={{
                        flex: 1,
                        padding: '16px',
                        background: 'white',
                        color: 'var(--fg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    Back
                </button>
                <button
                    onClick={handleContinue}
                    disabled={!selected}
                    style={{
                        flex: 2,
                        padding: '16px',
                        background: selected ? 'var(--accent-primary)' : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 700,
                        cursor: selected ? 'pointer' : 'not-allowed'
                    }}
                >
                    Finish Setup
                </button>
            </div>
        </div>
    );
};
