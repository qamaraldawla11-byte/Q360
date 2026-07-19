/* eslint-disable react-refresh/only-export-components */
// Platform Operations route table — mounted ONLY on the Platform origin
// (admin.q360.app). Selected by host in src/App.tsx.
// Architecture authority: docs/adr/ADR_PLATFORM_OPERATIONS_EXPERIENCE.md
import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

const AdminLayout = lazy(() => import('@/layouts/AdminLayout').then(m => ({ default: m.AdminLayout })));
const PlatformLoginView = lazy(() => import('@/modules/platform/PlatformLoginView').then(m => ({ default: m.PlatformLoginView })));
const NoPlatformAccessView = lazy(() => import('@/modules/platform/NoPlatformAccessView').then(m => ({ default: m.NoPlatformAccessView })));
const OverviewPage = lazy(() => import('@/modules/admin/DashboardView').then(m => ({ default: m.DashboardView })));
const UsersPage = lazy(() => import('@/views/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const BusinessesPage = lazy(() => import('@/views/admin/BusinessesPage').then(m => ({ default: m.BusinessesPage })));
const AuditLogsPage = lazy(() => import('@/views/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const SettingsPage = lazy(() => import('@/views/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));
const QUsagePage = lazy(() => import('@/views/admin/QUsagePage').then(m => ({ default: m.QUsagePage })));
const NotFoundView = lazy(() => import('@/modules/core/NotFoundView').then(m => ({ default: m.NotFoundView })));

const PageLoader = () => (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-secondary)' }}>
        Loading...
    </div>
);

// Platform experience rules (ADR §5):
// - signed out  → Platform sign-in, with the deep link preserved in state
// - non-admin   → explicit No Platform Access screen (never the workspace)
// - admin       → the Platform shell
const PlatformRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, user } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated) {
        const from = `${location.pathname}${location.search}`;
        return <Navigate to="/login" replace state={{ from }} />;
    }
    if (user?.role !== 'admin') {
        return <Navigate to="/no-access" replace />;
    }
    return <>{children}</>;
};

const S = (node: React.ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

export const platformRoutes: RouteObject[] = [
    { path: '/login', element: S(<PlatformLoginView />) },
    { path: '/no-access', element: S(<NoPlatformAccessView />) },
    {
        path: '/',
        element: <PlatformRoute>{S(<AdminLayout />)}</PlatformRoute>,
        children: [
            { index: true, element: S(<OverviewPage />) },
            { path: 'tenants', element: S(<BusinessesPage />) },
            { path: 'people', element: S(<UsersPage />) },
            { path: 'ai-operations', element: S(<QUsagePage />) },
            { path: 'audit', element: S(<AuditLogsPage />) },
            { path: 'settings', element: S(<SettingsPage />) },
        ],
    },
    // Legacy /admin/* bookmarks keep working on the Platform origin.
    { path: '/admin', element: <Navigate to="/" replace /> },
    { path: '/admin/users', element: <Navigate to="/people" replace /> },
    { path: '/admin/businesses', element: <Navigate to="/tenants" replace /> },
    { path: '/admin/audit-logs', element: <Navigate to="/audit" replace /> },
    { path: '/admin/q-usage', element: <Navigate to="/ai-operations" replace /> },
    { path: '/admin/settings', element: <Navigate to="/settings" replace /> },
    { path: '*', element: S(<NotFoundView />) },
];
