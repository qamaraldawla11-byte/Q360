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
        <div role="status" style={{ color: 'var(--fg-secondary)', fontSize: '14px', textAlign: 'center' }}>
            Preparing business onboarding...
        </div>
    );
};
