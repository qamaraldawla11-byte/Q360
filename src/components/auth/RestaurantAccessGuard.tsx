import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { hasRestaurantModuleAccess, isRestaurantManager } from '@/utils/restaurantAccess';

interface RestaurantAccessGuardProps {
    children: ReactNode;
    accessKey?: string;
    management?: boolean;
}

export const RestaurantAccessGuard = ({ children, accessKey, management = false }: RestaurantAccessGuardProps) => {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const allowed = management
        ? isRestaurantManager(user)
        : Boolean(accessKey && hasRestaurantModuleAccess(user, accessKey));

    if (allowed) return <>{children}</>;

    return (
        <section style={styles.page}>
            <div style={styles.card}>
                <span style={styles.icon}><LockKeyhole size={28} /></span>
                <div>
                    <h2 style={styles.title}>You don’t have access to this area</h2>
                    <p style={styles.copy}>Ask the business owner or manager to update your assigned access.</p>
                </div>
                <button type="button" style={styles.button} onClick={() => navigate('/app/restaurant/profile')}>
                    View my profile
                </button>
            </div>
        </section>
    );
};

const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: 'calc(100vh - 56px)', padding: 32, display: 'grid', placeItems: 'center', background: 'var(--surface-100)' },
    card: { width: 'min(100%, 560px)', padding: 32, display: 'grid', gap: 20, border: '1px solid var(--surface-400)', borderRadius: 20, background: 'var(--surface-200)', color: 'var(--fg-primary)', boxShadow: '0 18px 50px rgba(0,0,0,.14)' },
    icon: { width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 16, background: '#fff3e8', color: '#f97316' },
    title: { margin: '0 0 8px', fontSize: 24 },
    copy: { margin: 0, color: 'var(--fg-secondary)', lineHeight: 1.6 },
    button: { minHeight: 46, padding: '0 18px', border: 0, borderRadius: 12, background: '#f97316', color: '#fff', cursor: 'pointer', font: 'inherit', fontWeight: 750 },
};
