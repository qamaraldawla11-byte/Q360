import {
    ArrowLeft,
    CheckSquare,
    CircleDollarSign,
    FileText,
    Home,
    LogOut,
    Settings,
    Users,
    Zap,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogoFull } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth.store';
import './personal-layout.css';

const navItems = [
    { label: 'Home', path: '/app/personal', icon: Home, end: true },
    { label: 'Invoices', path: '/app/personal/invoices', icon: FileText },
    { label: 'Clients', path: '/app/personal/clients', icon: Users },
    { label: 'Expenses', path: '/app/personal/expenses', icon: CircleDollarSign },
    { label: 'Tasks', path: '/app/personal/tasks', icon: CheckSquare },
];

export const PersonalLayout = () => {
    const navigate = useNavigate();
    const logout = useAuthStore(state => state.logout);

    const signOut = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="personal-shell">
            <aside className="personal-sidebar">
                <div className="personal-sidebar__brand">
                    <LogoFull height={24} />
                </div>

                <nav className="personal-sidebar__nav" aria-label="Personal workspace">
                    {navItems.map(({ label, path, icon: Icon, end }) => (
                        <NavLink
                            key={path}
                            to={path}
                            end={end}
                            className={({ isActive }) => (
                                `personal-sidebar__link${isActive ? ' personal-sidebar__link--active' : ''}`
                            )}
                        >
                            <Icon size={17} strokeWidth={1.8} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="personal-sidebar__footer">
                    <div className="personal-sidebar__footer-row">
                        <NavLink to="/ai" className="personal-sidebar__assistant">
                            <Zap size={16} fill="currentColor" />
                            <span>Assistant</span>
                        </NavLink>
                        <NavLink
                            to="/app/personal/settings"
                            className="personal-sidebar__settings"
                            aria-label="Settings"
                            title="Settings"
                        >
                            <Settings size={18} />
                        </NavLink>
                    </div>
                    <NavLink to="/app/segments" className="personal-sidebar__footer-link">
                        <ArrowLeft size={16} />
                        <span>Switch workspace</span>
                    </NavLink>
                    <button type="button" className="personal-sidebar__footer-link" onClick={signOut}>
                        <LogOut size={16} />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>

            <main className="personal-main">
                <div className="personal-main__content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
