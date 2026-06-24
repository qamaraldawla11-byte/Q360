import { Outlet, useLocation } from 'react-router-dom';
import { PersonalLayout } from './PersonalLayout';
import { SmeLayout } from './SmeLayout';

const SME_WORKSPACE_PATHS = [
    '/app/restaurant',
    '/app/pharmacy',
    '/app/supermarket',
    '/app/retail',
    '/app/school',
];

export const AppShell = () => {
    const { pathname } = useLocation();

    if (pathname === '/app/personal' || pathname.startsWith('/app/personal/')) {
        return <PersonalLayout />;
    }

    if (SME_WORKSPACE_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
        return <SmeLayout />;
    }

    return <Outlet />;
};
