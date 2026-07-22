import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Store,
    Truck,
    Users,
    Settings,
    LogOut,
    ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import { LogoFull, LogoMark } from '@/components/ui/Logo';
import { PLATFORM_APP_URL } from '@/utils/host';

export const Sidebar = () => {
    const { logout, user } = useAuthStore();
    const { sidebarCollapsed } = useConfigStore();

    // The Platform Console link is visible only to platform operators and
    // points at the Platform origin — the console never renders inside the
    // tenant workspace (ADR: docs/adr/ADR_PLATFORM_OPERATIONS_EXPERIENCE.md).
    const navItems = [
        { icon: LayoutDashboard, label: 'Segments Hub', path: '/app/segments' },
        { icon: Store, label: 'Marketplace', path: '/app/marketplace' },
        { icon: Truck, label: 'Logistics', path: '/app/logistics' },
        { icon: Users, label: 'Merchants', path: '/app/merchants' },
        { icon: Settings, label: 'Settings', path: '/app/settings' },
    ];

    return (
        <aside
            style={{
                width: sidebarCollapsed ? '64px' : '260px',
                transition: 'width 0.3s ease',
                background: 'var(--bg-panel)',
                backdropFilter: 'blur(var(--blur-glass))',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                zIndex: 50,
            }}
        >
            {/* Brand */}
            <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                {sidebarCollapsed ? <LogoMark size={28} /> : <LogoFull height={24} />}
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            color: isActive ? 'var(--fg-primary)' : 'var(--fg-secondary)',
                            background: isActive ? 'var(--bg-card)' : 'transparent',
                            transition: 'background 0.2s, color 0.2s',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        })}
                    >
                        <item.icon size={20} />
                        {!sidebarCollapsed && <span style={{ marginLeft: '12px', fontSize: '14px' }}>{item.label}</span>}
                    </NavLink>
                ))}

                {user?.role === 'admin' && (
                    <a
                        href={PLATFORM_APP_URL}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            color: '#ef4444',
                            background: 'transparent',
                            transition: 'background 0.2s, color 0.2s',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        }}
                    >
                        <ShieldAlert size={20} />
                        {!sidebarCollapsed && <span style={{ marginLeft: '12px', fontSize: '14px' }}>Platform Console</span>}
                    </a>
                )}
            </nav>

            {/* Footer / User */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                    onClick={logout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--fg-muted)',
                        cursor: 'pointer',
                        padding: '8px',
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    }}
                >
                    <LogOut size={20} />
                    {!sidebarCollapsed && <span style={{ marginLeft: '12px', fontSize: '14px' }}>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
};
