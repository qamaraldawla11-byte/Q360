import type { CSSProperties, ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

// Q360-QB-M4-S2: Founder-only route guard.
//
// Renders children only when the signed-in user is the tenant owner
// (user.role === 'owner'). Admin, manager, staff, waiter/cashier/kitchen and
// legacy 'user' roles are never admitted: the page — and therefore its API
// fetch — is blocked for them. The backend remains the authoritative
// enforcement point (authMiddleware -> requireRole(['owner'])).
export const FounderRoute = ({ children }: { children: ReactNode }) => {
    const { isAuthenticated, user } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated) {
        const from = `${location.pathname}${location.search}`;
        return <Navigate to="/login" replace state={{ from }} />;
    }

    if (user?.role === 'owner') return <>{children}</>;

    const workspaceTarget = user?.primaryWorkspace
        || user?.lastActiveWorkspace
        || (user?.segment ? `/app/${user.segment}` : '/app');

    return (
        <section style={styles.page}>
            <div style={styles.card}>
                <span style={styles.icon}><LockKeyhole size={28} /></span>
                <div>
                    <h2 style={styles.title}>Founder access required</h2>
                    <p style={styles.copy}>The Founder Daily Brief is available to the business owner only.</p>
                </div>
                <Link to={workspaceTarget} style={styles.link}>Go to my workspace</Link>
            </div>
        </section>
    );
};

const styles: Record<string, CSSProperties> = {
    page: {
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
    },
    card: {
        maxWidth: '420px',
        display: 'grid',
        gap: '12px',
        justifyItems: 'start',
        padding: '24px',
        border: '1px solid var(--surface-400)',
        borderRadius: '16px',
        background: 'var(--surface-100)',
    },
    icon: {
        color: 'var(--fg-secondary)',
    },
    title: {
        margin: 0,
        fontSize: '18px',
        color: 'var(--fg-primary)',
    },
    copy: {
        margin: '6px 0 0',
        color: 'var(--fg-secondary)',
        fontSize: '14px',
        lineHeight: 1.5,
    },
    link: {
        color: 'var(--accent-primary)',
        fontSize: '14px',
        fontWeight: 600,
    },
};
