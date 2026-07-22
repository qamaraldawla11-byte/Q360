// Platform Operations navigation — used only inside the Platform shell on the
// Platform origin (ADR §6). Nothing here appears in the tenant workspace.
import { NavLink } from 'react-router-dom';
import {
    Users,
    Building2,
    FileText,
    Settings,
    LogOut,
    ExternalLink,
    ShieldAlert,
    LayoutDashboard,
    Bot
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import { TENANT_APP_URL, environmentLabel } from '@/utils/host';

export const AdminSidebar = () => {
    const { logout, user } = useAuthStore();
    const { sidebarCollapsed } = useConfigStore();

    const navItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/', end: true },
        { icon: Building2, label: 'Tenants', path: '/tenants', end: false },
        { icon: Users, label: 'People', path: '/people', end: false },
        { icon: Bot, label: 'AI Operations', path: '/ai-operations', end: false },
        { icon: FileText, label: 'Audit & Security', path: '/audit', end: false },
        { icon: Settings, label: 'Platform Settings', path: '/settings', end: false },
    ];

    return (
        <aside
            style={{
                width: sidebarCollapsed ? '64px' : '260px',
                transition: 'width 0.3s ease',
                background: '#111827', // Darker for platform distinction
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
            {/* Brand / Platform Header */}
            <div style={{ minHeight: '64px', display: 'flex', alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <ShieldAlert size={24} color="#ef4444" />
                {!sidebarCollapsed && (
                    <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.02em', color: '#f9fafb' }}>
                            Q360 Platform
                        </span>
                        <span style={{
                            alignSelf: 'flex-start',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#ef4444',
                        }}>
                            {environmentLabel()}
                        </span>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.end}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            color: isActive ? '#fff' : 'var(--fg-secondary)',
                            background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
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
                {!sidebarCollapsed && user?.email && (
                    <div style={{ padding: '0 8px 8px', fontSize: '12px', color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                    </div>
                )}
                <a
                    href={TENANT_APP_URL}
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
                    <ExternalLink size={20} />
                    {!sidebarCollapsed && <span style={{ marginLeft: '12px', fontSize: '14px' }}>Open tenant app</span>}
                </a>

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
