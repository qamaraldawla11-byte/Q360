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
import { Button } from '@/components/design-system';
import type { UserSegment } from '@/types/user';

interface Segment {
    id: UserSegment;
    name: string;
    icon: LucideIcon;
    iconColor: string;
    sub: string;
    keywords: string[];
    path: string;
    availability: 'active' | 'coming-soon' | 'internal-preview';
}

const segments: Segment[] = [
    {
        id: 'restaurant',
        name: 'Restaurant',
        icon: UtensilsCrossed,
        iconColor: 'var(--q-color-accent)',
        sub: 'POS, kitchen, tables',
        keywords: ['restaurant', 'cafe', 'food', 'kitchen', 'bar', 'dining', 'bistro', 'takeaway', 'fast food'],
        path: '/app/restaurant',
        availability: 'active',
    },
    {
        id: 'pharmacy',
        name: 'Pharmacy',
        icon: Pill,
        iconColor: '#16a34a',
        sub: 'Prescriptions, compliance',
        keywords: ['pharmacy', 'medicine', 'drugs', 'dispensing', 'chemist', 'health', 'pharmacist'],
        path: '/app/pharmacy',
        availability: 'coming-soon',
    },
    {
        id: 'supermarket',
        name: 'Supermarket',
        icon: ShoppingCart,
        iconColor: '#3b82f6',
        sub: 'Barcode, inventory',
        keywords: ['supermarket', 'grocery', 'food store', 'convenience', 'hypermarket', 'mini market'],
        path: '/app/supermarket',
        availability: 'internal-preview',
    },
    {
        id: 'retail',
        name: 'Retail',
        icon: ShoppingBag,
        iconColor: '#8b5cf6',
        sub: 'Products, customers',
        keywords: ['retail', 'shop', 'store', 'fashion', 'clothes', 'electronics', 'products', 'clothing', 'boutique'],
        path: '/app/retail',
        availability: 'active',
    },
    {
        id: 'autoparts',
        name: 'Auto Parts',
        icon: Car,
        iconColor: '#ec4899',
        sub: 'Multi-POS, B2B accounts',
        keywords: ['auto', 'car', 'spare parts', 'vehicle', 'automotive', 'garage', 'mechanic', 'workshop'],
        path: '/app/retail',
        availability: 'coming-soon',
    },
    {
        id: 'clinic',
        name: 'Clinic',
        icon: Stethoscope,
        iconColor: '#f59e0b',
        sub: 'Patients, appointments',
        keywords: ['clinic', 'doctor', 'medical', 'hospital', 'dentist', 'patient', 'health', 'gp'],
        path: '/app/pharmacy',
        availability: 'coming-soon',
    },
    {
        id: 'services',
        name: 'Services',
        icon: Briefcase,
        iconColor: '#0ea5e9',
        sub: 'Quotes, jobs, invoicing',
        keywords: ['service', 'solar', 'contractor', 'consultant', 'trade', 'agency', 'installation', 'engineer'],
        path: '/app/personal',
        availability: 'coming-soon',
    },
    {
        id: 'other',
        name: 'Other',
        icon: Building2,
        iconColor: '#64748b',
        sub: 'General business',
        keywords: ['other', 'general', 'business'],
        path: '/app/segments',
        availability: 'coming-soon',
    },
];

const availabilityLabels = {
    active: '',
    'coming-soon': 'Coming soon',
    'internal-preview': 'Internal preview',
} satisfies Record<Segment['availability'], string>;

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

    const selectedSegment = segments.find((segment) => segment.id === selected && segment.availability === 'active');

    const continueWith = (segment: Segment) => {
        if (segment.availability !== 'active') return;
        updateUser({ userType: 'sme', segment: segment.id, lastActiveWorkspace: segment.path });
        navigate('/onboarding/workspace');
    };

    const handleContinue = () => {
        if (selectedSegment) continueWith(selectedSegment);
    };

    return (
        <div>
            <style>{`
                .segment-picker-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }

                .segment-picker-card {
                    position: relative;
                    min-height: 116px;
                    padding: 16px 10px;
                    text-align: center;
                    border: 1px solid var(--q-color-border);
                    border-radius: var(--q-radius-md);
                    background: var(--q-color-surface);
                    color: var(--q-color-text);
                    font-family: inherit;
                    cursor: pointer;
                    transition: border-color var(--q-duration-fast) var(--q-ease-standard),
                        background-color var(--q-duration-fast) var(--q-ease-standard),
                        box-shadow var(--q-duration-fast) var(--q-ease-standard);
                }

                .segment-picker-card:not(:disabled):hover {
                    border-color: var(--q-color-border-strong);
                    box-shadow: var(--q-shadow-sm);
                }

                .segment-picker-card--selected {
                    border-color: var(--q-color-accent) !important;
                    background: var(--q-color-accent-soft) !important;
                }

                .segment-picker-card:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .segment-picker-card:focus-visible {
                    outline: none;
                    box-shadow: var(--q-focus-ring);
                }

                .segment-picker-icon {
                    width: 40px;
                    height: 40px;
                    margin: 0 auto 9px;
                    border-radius: var(--q-radius-sm);
                    background: var(--q-color-surface-muted);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .segment-picker-name {
                    display: block;
                    color: var(--q-color-text);
                    font-size: 0.75rem;
                    font-weight: 500;
                    line-height: 1.3;
                }

                .segment-picker-sub {
                    display: block;
                    color: var(--q-color-text-muted);
                    font-size: 0.625rem;
                    line-height: 1.35;
                    margin-top: 3px;
                }

                .segment-picker-badge {
                    display: inline-flex;
                    margin-top: 8px;
                    min-height: 20px;
                    align-items: center;
                    border-radius: var(--q-radius-pill);
                    background: var(--q-color-surface-muted);
                    color: var(--q-color-text-secondary);
                    font-size: 0.625rem;
                    font-weight: 700;
                    padding: 3px 8px;
                }

                .segment-picker-search {
                    width: 100%;
                    border: 1.5px solid var(--q-color-border);
                    border-radius: var(--q-radius-pill);
                    box-sizing: border-box;
                    font-family: inherit;
                    font-size: 0.875rem;
                    outline: none;
                    padding: 12px 16px 12px 44px;
                    background: var(--q-color-surface);
                    color: var(--q-color-text);
                    transition: border-color var(--q-duration-fast) var(--q-ease-standard),
                        box-shadow var(--q-duration-fast) var(--q-ease-standard);
                }

                .segment-picker-search::placeholder {
                    color: var(--q-color-text-muted);
                }

                .segment-picker-search:focus {
                    border-color: var(--q-color-text);
                    box-shadow: var(--q-focus-ring);
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

                @media (prefers-reduced-motion: reduce) {
                    .segment-picker-card {
                        transition: none;
                    }
                }
            `}</style>

            <p style={{
                color: 'var(--q-color-text-secondary)',
                fontSize: '0.875rem',
                margin: 'calc(var(--q-space-6) * -1) 0 var(--q-space-5)',
                textAlign: 'center',
            }}>
                Search or select — we&apos;ll configure your workspace
            </p>

            <div style={{ position: 'relative', marginBottom: 'var(--q-space-4)' }}>
                <Search
                    size={19}
                    aria-hidden="true"
                    style={{
                        color: isSearchFocused ? 'var(--q-color-text)' : 'var(--q-color-text-muted)',
                        left: '14px',
                        pointerEvents: 'none',
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        transition: 'color var(--q-duration-fast) var(--q-ease-standard)',
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
                    className="segment-picker-search"
                />
            </div>

            {filteredSegments.length > 0 ? (
                <div className="segment-picker-grid" role="list" aria-label="Business types">
                    {filteredSegments.map((segment) => {
                        const Icon = segment.icon;
                        const isSelected = selected === segment.id;
                        const isActive = segment.availability === 'active';

                        return (
                            <button
                                key={segment.id}
                                type="button"
                                className={[
                                    'segment-picker-card',
                                    isSelected ? 'segment-picker-card--selected' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={() => {
                                    if (isActive) setSelected(segment.id);
                                }}
                                disabled={!isActive}
                                aria-pressed={isSelected}
                                role="listitem"
                            >
                                {isSelected && (
                                    <span style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '8px',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: 'var(--q-color-accent)',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Check size={12} strokeWidth={3} aria-hidden="true" />
                                    </span>
                                )}
                                <span className="segment-picker-icon" style={{ color: segment.iconColor }}>
                                    <Icon size={20} aria-hidden="true" />
                                </span>
                                <span className="segment-picker-name">
                                    {segment.name}
                                </span>
                                <span className="segment-picker-sub">
                                    {segment.sub}
                                </span>
                                {!isActive && (
                                    <span className="segment-picker-badge">
                                        {availabilityLabels[segment.availability]}
                                    </span>
                                )}
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
                    color: 'var(--q-color-text-secondary)',
                    fontSize: '0.875rem',
                    textAlign: 'center',
                }}>
                    No match — try a different term
                </div>
            )}

            <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={handleContinue}
                disabled={!selectedSegment}
                className="segment-picker-continue"
                style={{ marginTop: 'var(--q-space-6)' }}
            >
                {selectedSegment ? `Continue with ${selectedSegment.name}` : 'Select a business type to continue'}
            </Button>

            <div className="segment-picker-actions" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 'var(--q-space-4)',
            }}>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/onboarding/identity')}
                >
                    Back
                </Button>
            </div>
        </div>
    );
};
