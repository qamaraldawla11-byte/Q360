import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import type { VerticalManifest } from '@/types/vertical';

interface VerticalLayoutProps {
    manifest: VerticalManifest;
}

export const VerticalLayout = ({ manifest }: VerticalLayoutProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useAuthStore(s => s.logout);

    // Derive active colors from manifest
    const activeColor = manifest.color;
    const activeBg = `${manifest.color}15`; // 15% opacity

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            background: 'var(--bg-app)',
            fontFamily: 'var(--font-sans)'
        }}>
            {/* Sidebar */}
            <aside style={{
                width: '260px',
                background: 'white',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                height: '100vh',
                zIndex: 100
            }}>
                {/* Header with Vertical Identity */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: activeBg,
                        padding: '10px 14px',
                        borderRadius: '10px',
                        color: activeColor,
                        fontWeight: 700,
                        fontSize: '15px'
                    }}>
                        <manifest.icon size={20} />
                        {manifest.name}
                    </div>
                </div>

                {/* Navigation - Derived from Manifest Modules */}
                <nav style={{
                    flex: 1,
                    padding: '20px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    overflowY: 'auto'
                }}>
                    {manifest.modules.map(module => {
                        const fullPath = `${manifest.basePath}${module.path}`;
                        const isActive = module.path === ''
                            ? location.pathname === manifest.basePath
                            : location.pathname.startsWith(fullPath);

                        return (
                            <button
                                key={module.id}
                                onClick={() => navigate(fullPath)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    border: 'none',
                                    background: isActive ? activeBg : 'transparent',
                                    color: isActive ? activeColor : 'var(--fg-secondary)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 600 : 500,
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <module.icon size={18} />
                                {module.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer Actions */}
                <div style={{
                    padding: '16px 12px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <button
                        onClick={() => navigate('/app/segments')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--fg-secondary)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            borderRadius: '8px'
                        }}
                    >
                        <ArrowLeft size={18} /> Switch Workspace
                    </button>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--fg-secondary)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            borderRadius: '8px'
                        }}
                    >
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main style={{
                marginLeft: '260px',
                flex: 1,
                minHeight: '100vh',
                background: 'var(--bg-app)'
            }}>
                <Outlet />
            </main>
        </div>
    );
};
