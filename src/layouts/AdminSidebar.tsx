import { NavLink } from 'react-router-dom';
import {
    Users,
    Building2,
    FileText,
    Settings,
    LogOut,
    ArrowLeft,
    ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';

export const AdminSidebar = () => {
    const { logout } = useAuthStore();
    const { sidebarCollapsed } = useConfigStore();

    const navItems = [
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: Building2, label: 'Businesses', path: '/admin/businesses' },
        { icon: FileText, label: 'Audit Logs', path: '/admin/audit-logs' },
        { icon: Settings, label: 'System Settings', path: '/admin/settings' },
    ];

    return (
        <aside
            style={{
                width: sidebarCollapsed ? '64px' : '260px',
                transition: 'width 0.3s ease',
                background: '#111827', // Darker for admin distinction
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
            {/* Brand / Admin Header */}
            <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <ShieldAlert size={24} color="#ef4444" />
                {!sidebarCollapsed && (
                    <span style={{ marginLeft: '12px', fontWeight: 600, fontSize: '16px', letterSpacing: '-0.02em', color: '#ef4444' }}>
                        Admin Panel
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
                            color: isActive ? '#fff' : 'var(--fg-secondary)',
                            background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'transparent', // Red tint for active
                            border: isActive ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
                            transition: 'all 0.2s',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        })}
                    >
                        <item.icon size={20} />
                        {!sidebarCollapsed && <span style={{ marginLeft: '12px', fontSize: '14px' }}>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <NavLink
                    to="/app"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        textDecoration: 'none',
                        color: 'var(--fg-muted)',
                        transition: 'color 0.2s',
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    }}
                >
                    <ArrowLeft size={20} />
                    {!sidebarCollapsed && <span style={{ marginLeft: '12px', fontSize: '14px' }}>Back to App</span>}
                </NavLink>

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
