import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

export const SegmentView = () => {
    const navigate = useNavigate();
    const { updateUser } = useAuthStore();

    useEffect(() => {
        updateUser({
            userType: 'sme',
            segment: null,
            lastActiveWorkspace: undefined,
        });

        navigate('/onboarding/type', { replace: true });
    }, [navigate, updateUser]);

    return (
        <div role="status" style={{ color: 'var(--q-color-text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
            Preparing business onboarding…
        </div>
    );
};
