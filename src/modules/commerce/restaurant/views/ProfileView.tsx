import { ShieldCheck, UserRound } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/store/auth.store';

const ACCESS_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    pos: 'POS / Cashier',
    kds: 'Kitchen',
    menu: 'Menu',
    tables: 'Floor / Tables',
    inventory: 'Inventory & Purchasing',
    payments: 'Order History',
    'daily-report': 'Reports',
};

export const ProfileView = () => {
    const user = useAuthStore(state => state.user);
    const access = user?.moduleAccess ?? [];

    return (
        <ModuleShell>
            <PageHeader title="My Profile" subtitle="Your account details and assigned Restaurant access." />
            <div style={styles.grid}>
                <section style={styles.card}>
                    <span style={styles.icon}><UserRound size={26} /></span>
                    <div>
                        <span style={styles.eyebrow}>Account</span>
                        <h2 style={styles.name}>{user?.name || 'Staff member'}</h2>
                        <p style={styles.email}>{user?.email}</p>
                    </div>
                    <dl style={styles.details}>
                        <div><dt style={styles.term}>Role</dt><dd style={styles.value}>{user?.role || 'staff'}</dd></div>
                        <div><dt style={styles.term}>Workspace</dt><dd style={styles.value}>{user?.businessName || 'Restaurant'}</dd></div>
                    </dl>
                </section>

                <section style={styles.card}>
                    <span style={styles.icon}><ShieldCheck size={26} /></span>
                    <div>
                        <span style={styles.eyebrow}>Assigned access</span>
                        <h2 style={styles.heading}>Your available tools</h2>
                    </div>
                    <div style={styles.accessList}>
                        {access.length ? access.map(key => (
                            <span key={key} style={styles.badge}>{ACCESS_LABELS[key] || key}</span>
                        )) : <p style={styles.email}>No modules have been assigned yet.</p>}
                    </div>
                    <p style={styles.note}>Business settings, staff access, and modules are managed by the owner or manager.</p>
                </section>
            </div>
        </ModuleShell>
    );
};

const styles: Record<string, React.CSSProperties> = {
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 },
    card: { padding: 26, display: 'flex', flexDirection: 'column', gap: 18, border: '1px solid var(--surface-400)', borderRadius: 18, background: 'var(--surface-200)', color: 'var(--fg-primary)' },
    icon: { width: 50, height: 50, display: 'grid', placeItems: 'center', borderRadius: 14, background: '#fff3e8', color: '#f97316' },
    eyebrow: { color: '#f97316', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' },
    name: { margin: '6px 0 2px', fontSize: 25 },
    heading: { margin: '6px 0 0', fontSize: 22 },
    email: { margin: 0, color: 'var(--fg-secondary)' },
    details: { margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 },
    term: { color: 'var(--fg-secondary)', fontSize: 12 },
    value: { margin: '4px 0 0', fontWeight: 750, textTransform: 'capitalize' },
    accessList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
    badge: { padding: '8px 11px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 12, fontWeight: 750 },
    note: { margin: 0, padding: 14, borderRadius: 12, background: 'var(--surface-300)', color: 'var(--fg-secondary)', lineHeight: 1.55 },
};
