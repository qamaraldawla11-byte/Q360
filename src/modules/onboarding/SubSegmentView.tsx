import { useMemo, useState, type CSSProperties } from 'react';
import {
    Briefcase,
    Building2,
    Car,
    Check,
    Pill,
    Search,
    ShoppingBag,
    ShoppingCart,
    Stethoscope,
    UtensilsCrossed,
    type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import type { UserSegment } from '@/types/user';

interface Segment {
    id: UserSegment;
    name: string;
    icon: LucideIcon;
    bgColor: string;
    iconColor: string;
    sub: string;
    keywords: string[];
    path: string;
}

const segments: Segment[] = [
    {
        id: 'restaurant',
        name: 'Restaurant',
        icon: UtensilsCrossed,
        bgColor: '#fff7ed',
        iconColor: '#f97316',
        sub: 'POS, kitchen, tables',
        keywords: ['restaurant', 'cafe', 'food', 'kitchen', 'bar', 'dining', 'bistro', 'takeaway', 'fast food'],
        path: '/app/restaurant',
    },
    {
        id: 'pharmacy',
        name: 'Pharmacy',
        icon: Pill,
        bgColor: '#f0fdf4',
        iconColor: '#16a34a',
        sub: 'Prescriptions, compliance',
        keywords: ['pharmacy', 'medicine', 'drugs', 'dispensing', 'chemist', 'health', 'pharmacist'],
        path: '/app/pharmacy',
    },
    {
        id: 'supermarket',
        name: 'Supermarket',
        icon: ShoppingCart,
        bgColor: '#eff6ff',
        iconColor: '#3b82f6',
        sub: 'Barcode, inventory',
        keywords: ['supermarket', 'grocery', 'food store', 'convenience', 'hypermarket', 'mini market'],
        path: '/app/supermarket',
    },
    {
        id: 'retail',
        name: 'Retail',
        icon: ShoppingBag,
        bgColor: '#faf5ff',
        iconColor: '#8b5cf6',
        sub: 'Products, customers',
        keywords: ['retail', 'shop', 'store', 'fashion', 'clothes', 'electronics', 'products', 'clothing', 'boutique'],
        path: '/app/retail',
    },
    {
        id: 'autoparts',
        name: 'Auto Parts',
        icon: Car,
        bgColor: '#fdf2f8',
        iconColor: '#ec4899',
        sub: 'Multi-POS, B2B accounts',
        keywords: ['auto', 'car', 'spare parts', 'vehicle', 'automotive', 'garage', 'mechanic', 'workshop'],
        path: '/app/retail', // TODO: Replace with the dedicated auto parts workspace.
    },
    {
        id: 'clinic',
        name: 'Clinic',
        icon: Stethoscope,
        bgColor: '#fef9ee',
        iconColor: '#f59e0b',
        sub: 'Patients, appointments',
        keywords: ['clinic', 'doctor', 'medical', 'hospital', 'dentist', 'patient', 'health', 'gp'],
        path: '/app/pharmacy', // TODO: Replace with the dedicated clinic workspace.
    },
    {
        id: 'services',
        name: 'Services',
        icon: Briefcase,
        bgColor: '#f0f9ff',
        iconColor: '#0ea5e9',
        sub: 'Quotes, jobs, invoicing',
        keywords: ['service', 'solar', 'contractor', 'consultant', 'trade', 'agency', 'installation', 'engineer'],
        path: '/app/personal', // TODO: Replace with the dedicated services workspace.
    },
    {
        id: 'other',
        name: 'Other',
        icon: Building2,
        bgColor: '#f8fafc',
        iconColor: '#64748b',
        sub: 'General business',
        keywords: ['other', 'general', 'business'],
        path: '/app/segments',
    },
];

export const SubSegmentView = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const initialSelection = segments.some((segment) => segment.id === user?.segment)
        ? user?.segment ?? null
        : null;
    const [selected, setSelected] = useState<UserSegment | null>(initialSelection);
    const [query, setQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const filteredSegments = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return segments;

        return segments.filter((segment) =>
            [segment.name, ...segment.keywords].some((term) =>
                term.toLowerCase().includes(normalizedQuery),
            ),
        );
    }, [query]);

    const selectedSegment = segments.find((segment) => segment.id === selected);

    const continueWith = (segment: Segment) => {
        updateUser({ userType: 'sme', segment: segment.id, lastActiveWorkspace: segment.path });
        navigate('/onboarding/workspace');
    };

    const handleContinue = () => {
        if (selectedSegment) continueWith(selectedSegment);
    };

    const handleUseDefaults = () => {
        const defaultSegment = segments[0];
        continueWith(defaultSegment);
    };

    return (
        <div>
            <style>{`
                .segment-picker-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }

                .segment-picker-card:hover {
                    border-color: #93c5fd !important;
                }

                .segment-picker-card:focus-visible,
                .segment-picker-action:focus-visible {
                    outline: 3px solid rgba(59, 130, 246, 0.25);
                    outline-offset: 2px;
                }

                @media (max-width: 480px) {
                    .segment-picker-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .segment-picker-actions {
                        flex-wrap: wrap;
                    }

                    .segment-picker-continue {
                        order: -1;
                        width: 100%;
                        flex-basis: 100% !important;
                    }
                }
            `}</style>

            <p style={{
                color: 'var(--fg-secondary)',
                fontSize: '14px',
                margin: '-24px 0 20px',
                textAlign: 'center',
            }}>
                Search or select - we&apos;ll configure your workspace
            </p>

            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search
                    size={19}
                    aria-hidden="true"
                    style={{
                        color: isSearchFocused ? '#3b82f6' : '#94a3b8',
                        left: '14px',
                        pointerEvents: 'none',
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                    }}
                />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Search your business type..."
                    aria-label="Search business types"
                    style={{
                        width: '100%',
                        border: `1.5px solid ${isSearchFocused ? '#3b82f6' : '#cbd5e1'}`,
                        borderRadius: '50px',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        outline: 'none',
                        padding: '12px 16px 12px 44px',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxShadow: isSearchFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                    }}
                />
            </div>

            {filteredSegments.length > 0 ? (
                <div className="segment-picker-grid">
                    {filteredSegments.map((segment) => {
                        const Icon = segment.icon;
                        const isSelected = selected === segment.id;
                        const cardStyle: CSSProperties = {
                            position: 'relative',
                            minHeight: '116px',
                            padding: '16px 10px',
                            textAlign: 'center',
                            border: isSelected ? '2px solid #3b82f6' : '0.5px solid #cbd5e1',
                            borderRadius: '12px',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'border-color 0.2s, background-color 0.2s, transform 0.2s',
                        };

                        return (
                            <button
                                key={segment.id}
                                type="button"
                                className="segment-picker-card"
                                onClick={() => setSelected(segment.id)}
                                aria-pressed={isSelected}
                                style={cardStyle}
                            >
                                {isSelected && (
                                    <span style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '8px',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: '#3b82f6',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Check size={12} strokeWidth={3} aria-hidden="true" />
                                    </span>
                                )}
                                <span style={{
                                    width: '40px',
                                    height: '40px',
                                    margin: '0 auto 9px',
                                    borderRadius: '10px',
                                    background: segment.bgColor,
                                    color: segment.iconColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Icon size={20} aria-hidden="true" />
                                </span>
                                <span style={{
                                    display: 'block',
                                    color: '#1e293b',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    lineHeight: 1.3,
                                }}>
                                    {segment.name}
                                </span>
                                <span style={{
                                    display: 'block',
                                    color: '#94a3b8',
                                    fontSize: '10px',
                                    lineHeight: 1.35,
                                    marginTop: '3px',
                                }}>
                                    {segment.sub}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div role="status" style={{
                    minHeight: '116px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    fontSize: '14px',
                    textAlign: 'center',
                }}>
                    No match - try a different term
                </div>
            )}

            <button
                type="button"
                className="segment-picker-action segment-picker-continue"
                onClick={handleContinue}
                disabled={!selectedSegment}
                style={{
                    width: '100%',
                    marginTop: '24px',
                    padding: '14px 20px',
                    border: 'none',
                    borderRadius: '50px',
                    background: selectedSegment ? '#3b82f6' : '#cbd5e1',
                    color: '#ffffff',
                    cursor: selectedSegment ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    fontWeight: 700,
                    transition: 'background-color 0.2s',
                }}
            >
                {selectedSegment ? `Continue with ${selectedSegment.name} ->` : 'Select a business type to continue'}
            </button>

            <div className="segment-picker-actions" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '18px',
            }}>
                <button
                    type="button"
                    className="segment-picker-action"
                    onClick={() => navigate('/onboarding/segment')}
                    style={linkButtonStyle}
                >
                    Back
                </button>
                <button
                    type="button"
                    className="segment-picker-action"
                    onClick={handleUseDefaults}
                    style={{ ...linkButtonStyle, color: '#3b82f6' }}
                >
                    Use Defaults
                </button>
            </div>
        </div>
    );
};

const linkButtonStyle: CSSProperties = {
    padding: '4px',
    border: 'none',
    background: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
};
