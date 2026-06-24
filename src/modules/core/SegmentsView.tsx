import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Truck, UtensilsCrossed, Settings, Pill, ArrowRight, Store, Users } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { useAuthStore } from '@/store/auth.store';

export const SegmentsView = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const displayName = user?.name?.trim()
        ? user.name.trim().split(' ')[0]
        : user?.email?.split('@')[0] ?? 'there';

    // Modules Definition
    const modules = [
        {
            id: 'restaurant', label: 'Restaurant OS',
            icon: UtensilsCrossed, color: '#f59e0b',
            desc: 'Table management, KDS, Menus', path: '/app/restaurant'
        },
        {
            id: 'pharmacy', label: 'Pharmacy OS',
            icon: Pill, color: '#06b6d4',
            desc: 'Prescriptions, Inventory, Compliance', path: '/app/pharmacy'
        },
        {
            id: 'retail', label: 'Retail Point',
            icon: ShoppingBag, color: '#ec4899',
            desc: 'POS, Inventory, Customers', path: '/app/retail'
        },
        {
            id: 'logistics', label: 'Logistics',
            icon: Truck, color: '#8b5cf6',
            desc: 'Fleet, Deliveries, Tracking', disabled: true, badge: 'Coming soon'
        },
        {
            id: 'marketplace', label: 'Marketplace',
            icon: Store, color: '#10b981',
            desc: 'Apps, integrations, and partner services', disabled: true, badge: 'Coming soon'
        },
        {
            id: 'merchants', label: 'Merchants',
            icon: Users, color: '#06b6d4',
            desc: 'Merchant directory and onboarding', disabled: true, badge: 'Coming soon'
        },
        {
            id: 'admin', label: 'Admin Console',
            icon: LayoutDashboard, color: '#3b82f6',
            desc: 'System Configuration & Users', path: '/app/admin'
        },
        {
            id: 'settings', label: 'Settings',
            icon: Settings, color: '#64748b',
            desc: 'Preferences & Security', path: '/app/settings'
        },
    ];

    return (
        <ModuleShell fullHeight>
            <div style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '40px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--fg-primary)', marginBottom: '12px' }}>
                        Welcome back, {displayName}
                    </h1>
                    <p style={{ fontSize: '18px', color: 'var(--fg-secondary)' }}>
                        Select a workspace to begin operations.
                    </p>
                </div>

                {/* Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '24px'
                }}>
                    {modules.map((m) => (
                        <div
                            key={m.id}
                            onClick={() => !m.disabled && m.path && navigate(m.path)}
                            style={{
                                background: 'white',
                                borderRadius: '24px',
                                padding: '32px',
                                border: '1px solid var(--border-subtle)',
                                cursor: m.disabled ? 'default' : 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: m.disabled ? 0.6 : 1,
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -1px rgba(0, 0, 0, 0.01)'
                            }}
                            onMouseEnter={(e) => {
                                if (!m.disabled) {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.01)';
                                    e.currentTarget.style.borderColor = m.color;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!m.disabled) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -1px rgba(0, 0, 0, 0.01)';
                                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                }
                            }}
                        >
                            {/* Icon Bubble */}
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '20px',
                                background: `${m.color}15`, // 15% opacity
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '24px', color: m.color
                            }}>
                                <m.icon size={32} />
                            </div>

                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--fg-primary)' }}>
                                {m.label}
                            </h3>
                            <p style={{ color: 'var(--fg-secondary)', fontSize: '15px', lineHeight: 1.5, marginBottom: '24px' }}>
                                {m.desc}
                            </p>

                            {!m.disabled && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '14px', fontWeight: 600, color: m.color
                                }}>
                                    Launch Workspace <ArrowRight size={16} />
                                </div>
                            )}

                            {m.disabled && (
                                <span style={{
                                    position: 'absolute', top: '24px', right: '24px',
                                    fontSize: '12px', fontWeight: 700, color: 'var(--fg-muted)',
                                    background: '#f1f5f9', padding: '4px 10px', borderRadius: '12px'
                                }}>
                                    {'badge' in m ? m.badge : 'Coming soon'}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </ModuleShell>
    );
};
