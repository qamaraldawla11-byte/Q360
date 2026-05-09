import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Store,
    Truck,
    Users,
    Settings,
    LogOut,
    Box
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';

export const Sidebar = () => {
    const { logout } = useAuthStore();
    const { sidebarCollapsed } = useConfigStore();

    const navItems = [
        { icon: LayoutDashboard, label: 'Segments Hub', path: '/app/segments' },
        { icon: Store, label: 'Marketplace', path: '/app/marketplace' },
        { icon: Truck, label: 'Logistics', path: '/app/logistics' },
        { icon: Users, label: 'Merchants', path: '/app/merchants' },
        { icon: LayoutDashboard, label: 'Admin Ops', path: '/app/admin' },
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
                <Box size={24} color="var(--accent-primary)" />
                {!sidebarCollapsed && (
                    <span style={{ marginLeft: '12px', fontWeight: 600, fontSize: '16px', letterSpacing: '-0.02em' }}>
                        One OS
                    </span>
                )}
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
