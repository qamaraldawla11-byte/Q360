import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Bot, ChevronDown, LogOut, Menu, Settings, UserRound, X } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { pharmacyManifest } from '@/modules/commerce/pharmacy/manifest';
import { restaurantManifest } from '@/modules/commerce/restaurant/manifest';
import { retailManifest } from '@/modules/commerce/retail/manifest';
import { supermarketManifest } from '@/modules/commerce/supermarket/manifest';
import { schoolManifest } from '@/modules/education/school/manifest';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import type { VerticalManifest, VerticalModule } from '@/types/vertical';
import { LogoFull } from '@/components/ui/Logo';
import { businessApi, type BusinessProfile } from '@/api/business.api';
import { useBusinessModulesStore } from '@/store/businessModules.store';
import { hasRestaurantModuleAccess, isRestaurantManager, RESTAURANT_MODULE_ACCESS } from '@/utils/restaurantAccess';

const SME_MANIFESTS: VerticalManifest[] = [
    restaurantManifest,
    pharmacyManifest,
    supermarketManifest,
    retailManifest,
    schoolManifest,
];

const MANAGEMENT_MODULES = new Set(['staff', 'reports', 'finance', 'customers', 'modules', 'settings']);

function getSections(modules: VerticalModule[]) {
    return [
        { label: 'Operations', modules: modules.filter(module => !MANAGEMENT_MODULES.has(module.id)) },
        { label: 'Management', modules: modules.filter(module => MANAGEMENT_MODULES.has(module.id)) },
    ].filter(section => section.modules.length);
}

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('');
}

export const SmeLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore(state => state.user);
    const logout = useAuthStore(state => state.logout);
    const isDark = useConfigStore(state => state.theme === 'dark');
    const [now, setNow] = useState(() => new Date());
    const [menuOpen, setMenuOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const businessModules = useBusinessModulesStore(state => state.modules);
    const loadBusinessModules = useBusinessModulesStore(state => state.load);
    const menuRef = useRef<HTMLDivElement>(null);
    const canManageRestaurant = isRestaurantManager(user);

    const manifest = SME_MANIFESTS.find(candidate =>
        location.pathname === candidate.basePath
        || location.pathname.startsWith(`${candidate.basePath}/`),
    );
    const visibleManifestModules = useMemo(() => {
        const modules = manifest?.modules ?? [];
        if (manifest?.id !== 'restaurant') return modules;
        const enabled = new Map(businessModules.map(module => [module.moduleKey, module.enabled]));
        return modules.filter(module => {
            if (['modules', 'settings'].includes(module.id)) return canManageRestaurant;
            if (['staff', 'finance', 'customers'].includes(module.id) && !canManageRestaurant) return false;
            const accessKey = RESTAURANT_MODULE_ACCESS[module.id];
            if (accessKey && !hasRestaurantModuleAccess(user, accessKey)) return false;
            if (module.id === 'floor') return enabled.get('tables') ?? true;
            if (module.id === 'inventory') return enabled.get('inventory') ?? true;
            if (module.id === 'staff') return enabled.get('staff') ?? true;
            if (module.id === 'finance') return enabled.get('finance') ?? true;
            if (module.id === 'customers') return enabled.get('customers') ?? true;
            return true;
        });
    }, [businessModules, canManageRestaurant, manifest, user]);
    const sections = useMemo(() => getSections(visibleManifestModules), [visibleManifestModules]);

    const currentModule = manifest?.modules
        .filter(module => {
            const path = `${manifest.basePath}${module.path}`;
            return module.path
                ? location.pathname.startsWith(path)
                : location.pathname === manifest.basePath || location.pathname === `${manifest.basePath}/`;
        })
        .sort((a, b) => b.path.length - a.path.length)[0];

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!location.pathname.startsWith('/app/restaurant')) return;
        businessApi.getProfile().then(setBusinessProfile).catch(() => undefined);
        void loadBusinessModules();
        const updateProfile = (event: Event) => setBusinessProfile((event as CustomEvent<BusinessProfile>).detail);
        window.addEventListener('q360:business-profile', updateProfile);
        return () => window.removeEventListener('q360:business-profile', updateProfile);
    }, [loadBusinessModules, location.pathname]);

    useEffect(() => {
        const closeMenu = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', closeMenu);
        return () => document.removeEventListener('mousedown', closeMenu);
    }, []);

    if (!manifest || !user) {
        return (
            <div style={styles.unsupported}>
                This layout is available to registered SME workspaces.
            </div>
        );
    }

    const accentWash = `${manifest.color}1f`;
    const displayName = user?.name?.trim()
        ? user.name.trim().split(' ')[0]
        : user?.email?.split('@')[0] ?? 'there';
    const initials = getInitials(displayName) || 'OS';
    const workspaceName = businessProfile?.name?.trim() || user.businessName?.trim() || manifest.name;

    const signOut = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="sme-shell" style={{ ...styles.shell, background: isDark ? '#090b10' : '#f4f6f8', color: isDark ? '#f8fafc' : '#111827' }}>
            {sidebarOpen && (
                <button
                    type="button"
                    className="sme-sidebar-backdrop"
                    aria-label="Close navigation"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <aside className={`sme-sidebar${sidebarOpen ? ' sme-sidebar--open' : ''}`} style={{ ...styles.sidebar, background: isDark ? '#0d1016' : '#fff', borderColor: isDark ? '#202631' : '#e5e7eb' }}>
                <div style={{ ...styles.workspaceHeader, borderColor: isDark ? '#202631' : '#e5e7eb' }}>
                    <div style={styles.mobileSidebarHeader}>
                        <span style={styles.brandPlate}>{businessProfile?.logoUrl
                            ? <img src={`${businessProfile.logoUrl}?v=${encodeURIComponent(businessProfile.updatedAt || '')}`} alt={`${workspaceName} logo`} style={styles.businessLogo} />
                            : <LogoFull height={24} />}</span>
                        <button type="button" className="sme-sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <div style={styles.workspaceCopy}>
                        <strong style={styles.workspaceName}>{workspaceName}</strong>
                    </div>
                </div>

                <nav style={styles.nav} aria-label={`${manifest.shortName} navigation`}>
                    {sections.map(section => (
                        <div key={section.label} style={styles.navSection}>
                            <div style={styles.sectionLabel}>{section.label}</div>
                            {section.modules.map(module => {
                                const path = `${manifest.basePath}${module.path}`;
                                const active = module.path
                                    ? location.pathname.startsWith(path)
                                    : location.pathname === manifest.basePath || location.pathname === `${manifest.basePath}/`;

                                return (
                                    <button
                                        key={module.id}
                                        type="button"
                                        aria-current={active ? 'page' : undefined}
                                        onClick={() => {
                                            navigate(path);
                                            setSidebarOpen(false);
                                        }}
                                        style={{
                                            ...styles.navItem,
                                            background: active ? accentWash : 'transparent',
                                            color: active ? manifest.color : isDark ? '#a7b0bf' : '#596273',
                                            borderColor: active ? `${manifest.color}55` : 'transparent',
                                        }}
                                    >
                                        <module.icon size={17} />
                                        {module.label}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div style={{ ...styles.sidebarFooter, borderColor: isDark ? '#202631' : '#e5e7eb' }}>
                    {(manifest.id !== 'restaurant' || canManageRestaurant) && (
                        <button type="button" onClick={() => navigate(manifest.id === 'restaurant' ? '/app/restaurant/assistant' : '/ai')} style={styles.agentLink}>
                            <Bot size={16} /> Q Assistant <span style={{ color: '#7dd3fc' }}>Preview</span>
                        </button>
                    )}
                    <div style={styles.userSummary}>
                        <div style={{ ...styles.avatar, background: accentWash, color: manifest.color }}>
                            {user.avatar ? <img src={user.avatar} alt="" style={styles.avatarImage} /> : initials}
                        </div>
                        <div style={styles.userCopy}>
                            <strong style={styles.userName}>{displayName}</strong>
                            <button type="button" onClick={() => navigate(manifest.id === 'restaurant' && !canManageRestaurant ? '/app/restaurant/profile' : '/app/segments')} style={styles.switchLink}>
                                {manifest.id === 'restaurant' && !canManageRestaurant ? 'My profile' : 'Switch workspace'}
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <div className="sme-main-column" style={styles.mainColumn}>
                <header className="sme-top-bar" style={{ ...styles.topBar, background: isDark ? 'rgba(9,11,16,.92)' : 'rgba(255,255,255,.92)', borderColor: isDark ? '#202631' : '#e5e7eb' }}>
                    <div style={styles.titleGroup}>
                        <button type="button" className="sme-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
                            <Menu size={20} />
                        </button>
                        <h1 style={styles.pageTitle}>{currentModule?.label ?? manifest.shortName}</h1>
                    </div>
                    <div style={styles.topActions}>
                        <time dateTime={now.toISOString()} style={styles.clock}>
                            {new Intl.DateTimeFormat(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            }).format(now)}
                        </time>
                        <button type="button" aria-label="Notifications" style={styles.iconButton}>
                            <Bell size={18} />
                            <span style={styles.notificationDot} />
                        </button>
                        <div ref={menuRef} style={styles.menuContainer}>
                            <button type="button" aria-label="Open user menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)} style={styles.userMenuButton}>
                                <span style={{ ...styles.topAvatar, background: accentWash, color: manifest.color }}>{initials}</span>
                                <ChevronDown size={15} />
                            </button>
                            {menuOpen && (
                                <div style={{ ...styles.menu, background: isDark ? '#141821' : '#fff', borderColor: isDark ? '#2a313e' : '#e5e7eb' }}>
                                    {manifest.id === 'restaurant' ? (
                                        canManageRestaurant
                                            ? <button type="button" onClick={() => navigate('/app/restaurant/settings')} style={styles.menuItem}><Settings size={16} /> Business settings</button>
                                            : <button type="button" onClick={() => navigate('/app/restaurant/profile')} style={styles.menuItem}><UserRound size={16} /> My profile</button>
                                    ) : <button type="button" onClick={() => navigate('/app/settings')} style={styles.menuItem}><Settings size={16} /> Settings</button>}
                                    {(manifest.id !== 'restaurant' || canManageRestaurant) && (
                                        <button type="button" onClick={() => navigate('/app/segments')} style={styles.menuItem}><UserRound size={16} /> Workspaces</button>
                                    )}
                                    <button type="button" onClick={signOut} style={styles.menuItem}><LogOut size={16} /> Sign out</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <main className="sme-content" style={styles.content}><Outlet /></main>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    shell: { minHeight: '100vh', fontFamily: 'var(--font-sans)' },
    sidebar: { position: 'fixed', inset: '0 auto 0 0', zIndex: 300, width: 220, height: '100vh', display: 'flex', flexDirection: 'column', borderRight: '1px solid' },
    workspaceHeader: { minHeight: 90, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid' },
    mobileSidebarHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    brandPlate: { display: 'inline-flex', padding: '5px 8px', borderRadius: 8, background: '#fff' },
    businessLogo: { width: 104, height: 32, objectFit: 'contain' },
    workspaceCopy: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
    workspaceName: { fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    workspaceType: { color: '#7f8998', fontSize: 11 },
    nav: { flex: 1, overflowY: 'auto', padding: '6px 10px 16px' },
    navSection: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 16 },
    sectionLabel: { padding: '7px 9px', color: '#687385', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' },
    navItem: { width: '100%', minHeight: 38, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid', borderRadius: 8, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 550, textAlign: 'left' },
    sidebarFooter: { padding: 10, borderTop: '1px solid', display: 'flex', flexDirection: 'column', gap: 10 },
    agentLink: { minHeight: 36, padding: '8px 9px', display: 'flex', alignItems: 'center', gap: 9, border: 0, borderRadius: 8, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: 13 },
    userSummary: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 7px 4px' },
    avatar: { width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden', fontSize: 12, fontWeight: 800 },
    avatarImage: { width: '100%', height: '100%', objectFit: 'cover' },
    userCopy: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
    userName: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    switchLink: { padding: 0, border: 0, background: 'transparent', color: '#7f8998', cursor: 'pointer', font: 'inherit', fontSize: 11, textAlign: 'left' },
    mainColumn: { minHeight: '100vh', marginLeft: 220, display: 'flex', flexDirection: 'column' },
    topBar: { position: 'sticky', top: 0, zIndex: 100, height: 56, padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', backdropFilter: 'blur(14px)' },
    titleGroup: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
    pageTitle: { margin: 0, fontSize: 16, lineHeight: 1, fontWeight: 700 },
    topActions: { display: 'flex', alignItems: 'center', gap: 10 },
    clock: { color: '#8c96a5', fontSize: 12, fontVariantNumeric: 'tabular-nums' },
    iconButton: { position: 'relative', width: 34, height: 34, display: 'grid', placeItems: 'center', border: 0, borderRadius: 9, background: 'transparent', color: 'inherit', cursor: 'pointer' },
    notificationDot: { position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: '50%', background: '#ef4444' },
    menuContainer: { position: 'relative' },
    userMenuButton: { height: 34, padding: '0 6px 0 2px', display: 'flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 18, background: 'transparent', color: 'inherit', cursor: 'pointer' },
    topAvatar: { width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: '50%', fontSize: 10, fontWeight: 800 },
    menu: { position: 'absolute', top: 42, right: 0, width: 160, padding: 6, border: '1px solid', borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,.28)' },
    menuItem: { width: '100%', padding: '9px 10px', display: 'flex', alignItems: 'center', gap: 9, border: 0, borderRadius: 7, background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: 12, textAlign: 'left' },
    content: { flex: 1, minWidth: 0, overflow: 'auto' },
    unsupported: { minHeight: '100vh', padding: 32, display: 'grid', placeItems: 'center', background: '#090b10', color: '#a7b0bf', fontFamily: 'var(--font-sans)', textAlign: 'center' },
};
