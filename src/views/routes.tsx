import { lazy, Suspense } from 'react';
import { Navigate, Outlet, type RouteObject, useLocation } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { useAuthStore } from '@/store/auth.store';

// Admin Pages (Lazy Load)
const AdminLayout = lazy(() => import('@/layouts/AdminLayout').then(m => ({ default: m.AdminLayout })));
const UsersPage = lazy(() => import('@/views/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const BusinessesPage = lazy(() => import('@/views/admin/BusinessesPage').then(m => ({ default: m.BusinessesPage })));
const AuditLogsPage = lazy(() => import('@/views/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const SettingsPage = lazy(() => import('@/views/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));



// Lazy Load Modules
const LandingView = lazy(() => import('@/modules/public/LandingView').then(m => ({ default: m.LandingView })));
const PricingView = lazy(() => import('@/modules/public/PricingView').then(m => ({ default: m.PricingView })));
const DocsView = lazy(() => import('@/modules/public/DocsView').then(m => ({ default: m.DocsView })));
const SupportView = lazy(() => import('@/modules/public/SupportView').then(m => ({ default: m.SupportView })));
const AiView = lazy(() => import('@/modules/public/AiView').then(m => ({ default: m.AiView })));

// Onboarding
const OnboardingLayout = lazy(() => import('@/modules/onboarding/layout/OnboardingLayout').then(m => ({ default: m.OnboardingLayout })));
const IdentityView = lazy(() => import('@/modules/onboarding/IdentityView').then(m => ({ default: m.IdentityView })));
const SegmentView = lazy(() => import('@/modules/onboarding/SegmentView').then(m => ({ default: m.SegmentView })));
const SubSegmentView = lazy(() => import('@/modules/onboarding/SubSegmentView').then(m => ({ default: m.SubSegmentView })));
const BusinessTypeView = lazy(() => import('@/modules/onboarding/BusinessTypeView').then(m => ({ default: m.BusinessTypeView })));

const LoginView = lazy(() => import('@/modules/auth/LoginView').then(m => ({ default: m.LoginView })));
const SegmentsView = lazy(() => import('@/modules/core/SegmentsView').then(m => ({ default: m.SegmentsView })));
const DashboardView = lazy(() => import('@/modules/admin/DashboardView').then(m => ({ default: m.DashboardView })));
const MarketplaceView = lazy(() => import('@/modules/marketplace/MarketplaceView').then(m => ({ default: m.MarketplaceView })));
const LogisticsView = lazy(() => import('@/modules/logistics/LogisticsView').then(m => ({ default: m.LogisticsView })));
const MerchantsView = lazy(() => import('@/modules/merchants/MerchantsView').then(m => ({ default: m.MerchantsView })));
const SettingsView = lazy(() => import('@/modules/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const NotFoundView = lazy(() => import('@/modules/core/NotFoundView').then(m => ({ default: m.NotFoundView })));

// Restaurant Vertical
const RestaurantLayout = lazy(() => import('@/modules/commerce/restaurant/layout/RestaurantLayout').then(m => ({ default: m.RestaurantLayout })));
const RestaurantDashboard = lazy(() => import('@/modules/commerce/restaurant/views/DashboardView').then(m => ({ default: m.DashboardView })));
const RestaurantMenu = lazy(() => import('@/modules/commerce/restaurant/views/MenuView').then(m => ({ default: m.MenuView })));
const RestaurantPos = lazy(() => import('@/modules/commerce/restaurant/views/PosView').then(m => ({ default: m.PosView })));
const RestaurantKitchen = lazy(() => import('@/modules/commerce/restaurant/views/KitchenView').then(m => ({ default: m.KitchenView })));
const RestaurantFloor = lazy(() => import('@/modules/commerce/restaurant/views/FloorView').then(m => ({ default: m.FloorView })));
const RestaurantBilling = lazy(() => import('@/modules/commerce/restaurant/views/BillingView').then(m => ({ default: m.BillingView })));
const RestaurantStaff = lazy(() => import('@/modules/commerce/restaurant/views/StaffView').then(m => ({ default: m.StaffView })));
const RestaurantInventory = lazy(() => import('@/modules/commerce/restaurant/views/InventoryView').then(m => ({ default: m.InventoryView })));
const RestaurantReports = lazy(() => import('@/modules/commerce/restaurant/views/ReportsView').then(m => ({ default: m.ReportsView })));
const RestaurantSettings = lazy(() => import('@/modules/commerce/restaurant/views/SettingsView').then(m => ({ default: m.SettingsView })));

// Pharmacy Vertical
const PharmacyLayout = lazy(() => import('@/modules/commerce/pharmacy/layout/PharmacyLayout').then(m => ({ default: m.PharmacyLayout })));
const PharmacyDashboard = lazy(() => import('@/modules/commerce/pharmacy/views/DashboardView').then(m => ({ default: m.DashboardView })));
const PharmacyCatalog = lazy(() => import('@/modules/commerce/pharmacy/views/CatalogView').then(m => ({ default: m.CatalogView })));
const PharmacyInventory = lazy(() => import('@/modules/commerce/pharmacy/views/InventoryView').then(m => ({ default: m.InventoryView })));
const PharmacySuppliers = lazy(() => import('@/modules/commerce/pharmacy/views/SuppliersView').then(m => ({ default: m.SuppliersView })));
const PharmacyPos = lazy(() => import('@/modules/commerce/pharmacy/views/PosView').then(m => ({ default: m.PosView })));
const PharmacyRx = lazy(() => import('@/modules/commerce/pharmacy/views/PrescriptionView').then(m => ({ default: m.PrescriptionView })));
const PharmacyReports = lazy(() => import('@/modules/commerce/pharmacy/views/ReportsView').then(m => ({ default: m.ReportsView })));
const PharmacyStaff = lazy(() => import('@/modules/commerce/pharmacy/views/StaffView').then(m => ({ default: m.StaffView })));

// Retail Vertical
const RetailLayout = lazy(() => import('@/modules/commerce/retail/layout/RetailLayout').then(m => ({ default: m.RetailLayout })));
const RetailDashboard = lazy(() => import('@/modules/commerce/retail/views/DashboardView').then(m => ({ default: m.DashboardView })));

// Supermarket Vertical
const SupermarketLayout = lazy(() => import('@/modules/commerce/supermarket/layout/SupermarketLayout').then(m => ({ default: m.SupermarketLayout })));
const SupermarketDashboard = lazy(() => import('@/modules/commerce/supermarket/views/DashboardView').then(m => ({ default: m.DashboardView })));
const SupermarketPos = lazy(() => import('@/modules/commerce/supermarket/views/PosView').then(m => ({ default: m.PosView })));
const SupermarketCatalog = lazy(() => import('@/modules/commerce/supermarket/views/CatalogView').then(m => ({ default: m.CatalogView })));
const SupermarketInventory = lazy(() => import('@/modules/commerce/supermarket/views/InventoryView').then(m => ({ default: m.InventoryView })));
const SupermarketSuppliers = lazy(() => import('@/modules/commerce/supermarket/views/SuppliersView').then(m => ({ default: m.SuppliersView })));
const SupermarketOffers = lazy(() => import('@/modules/commerce/supermarket/views/OffersView').then(m => ({ default: m.OffersView })));
const SupermarketStaff = lazy(() => import('@/modules/commerce/supermarket/views/StaffView').then(m => ({ default: m.StaffView })));
const SupermarketReports = lazy(() => import('@/modules/commerce/supermarket/views/ReportsView').then(m => ({ default: m.ReportsView })));
const SupermarketSettings = lazy(() => import('@/modules/commerce/supermarket/views/SettingsView').then(m => ({ default: m.SettingsView })));
const SupermarketProcurement = lazy(() => import('@/modules/commerce/supermarket/views/ProcurementView').then(m => ({ default: m.SupermarketProcurementView })));

const PharmacyProcurement = lazy(() => import('@/modules/commerce/pharmacy/views/ProcurementView').then(m => ({ default: m.PharmacyProcurementView })));
const RetailProcurement = lazy(() => import('@/modules/commerce/retail/views/ProcurementView').then(m => ({ default: m.RetailProcurementView })));

// School Vertical
const SchoolLayout = lazy(() => import('@/modules/education/school/layout/SchoolLayout').then(m => ({ default: m.SchoolLayout })));
const SchoolDashboard = lazy(() => import('@/modules/education/school/views/DashboardView').then(m => ({ default: m.DashboardView })));

// Loading Component
const PageLoader = () => (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-secondary)' }}>
        Loading module...
    </div>
);

// Auth Guard Wrapper — Architecture Spec Compliant
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, user } = useAuthStore();
    const location = useLocation();

    // Rule 1: Not authenticated → Login
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    // Rule 2: Not onboarded → Onboarding (unless already there)
    // Exception: Admins/Owners bypass onboarding
    const isBypassRole = user?.role === 'admin' || user?.role === 'owner';
    if (!user?.onboardingCompleted && !location.pathname.startsWith('/onboarding') && !isBypassRole) {
        return <Navigate to="/onboarding/identity" replace />;
    }

    // Rule 3: At /app root → Redirect to primary workspace or segments
    if (location.pathname === '/app' || location.pathname === '/app/') {
        if (user?.primaryWorkspace) {
            return <Navigate to={user.primaryWorkspace} replace />;
        }
        // Fallback: No workspace set (edge case)
        return <Navigate to="/app/segments" replace />;
    }

    return <>{children}</>;
};

export const appRoutes: RouteObject[] = [
    { path: '/', element: <Suspense fallback={<PageLoader />}><LandingView /></Suspense> },
    { path: '/pricing', element: <Suspense fallback={<PageLoader />}><PricingView /></Suspense> },
    { path: '/docs', element: <Suspense fallback={<PageLoader />}><DocsView /></Suspense> },
    { path: '/support', element: <Suspense fallback={<PageLoader />}><SupportView /></Suspense> },
    { path: '/ai', element: <Suspense fallback={<PageLoader />}><AiView /></Suspense> },

    {
        path: '/login',
        element: (
            <Suspense fallback={<PageLoader />}>
                <LoginView />
            </Suspense>
        ),
    },
    {
        path: '/onboarding',
        element: <ProtectedRoute><Suspense fallback={<PageLoader />}><OnboardingLayout /></Suspense></ProtectedRoute>,
        children: [
            { index: true, element: <Navigate to="/onboarding/identity" replace /> },
            { path: 'identity', element: <IdentityView /> },
            { path: 'segment', element: <SegmentView /> },
            { path: 'type', element: <SubSegmentView /> },
            { path: 'workspace', element: <BusinessTypeView /> },
        ]
    },
    {
        path: '/app',
        element: <ProtectedRoute><Outlet /></ProtectedRoute>,
        children: [
            {
                path: 'restaurant',
                element: <RestaurantLayout />,
                children: [
                    { index: true, element: <RestaurantDashboard /> },
                    { path: 'menu', element: <RestaurantMenu /> },
                    { path: 'pos', element: <RestaurantPos /> },
                    { path: 'kitchen', element: <RestaurantKitchen /> },
                    { path: 'floor', element: <RestaurantFloor /> },
                    { path: 'billing', element: <RestaurantBilling /> },
                    { path: 'staff', element: <RestaurantStaff /> },
                    { path: 'inventory', element: <RestaurantInventory /> },
                    { path: 'reports', element: <RestaurantReports /> },
                    { path: 'settings', element: <RestaurantSettings /> },
                ]
            },
            {
                path: 'pharmacy',
                element: <PharmacyLayout />,
                children: [
                    { index: true, element: <PharmacyDashboard /> },
                    { path: 'catalog', element: <PharmacyCatalog /> },
                    { path: 'inventory', element: <PharmacyInventory /> },
                    { path: 'suppliers', element: <PharmacySuppliers /> },
                    { path: 'pos', element: <PharmacyPos /> },
                    { path: 'rx', element: <PharmacyRx /> },
                    { path: 'reports', element: <PharmacyReports /> },
                    { path: 'staff', element: <PharmacyStaff /> },
                    { path: 'procurement', element: <PharmacyProcurement /> },
                ]
            },
            {
                path: 'retail',
                element: <RetailLayout />,
                children: [
                    { index: true, element: <RetailDashboard /> },
                    { path: 'procurement', element: <RetailProcurement /> },
                ]
            },
            {
                path: 'supermarket',
                element: <SupermarketLayout />,
                children: [
                    { index: true, element: <SupermarketDashboard /> },
                    { path: 'pos', element: <SupermarketPos /> },
                    { path: 'catalog', element: <SupermarketCatalog /> },
                    { path: 'inventory', element: <SupermarketInventory /> },
                    { path: 'suppliers', element: <SupermarketSuppliers /> },
                    { path: 'offers', element: <SupermarketOffers /> },
                    { path: 'staff', element: <SupermarketStaff /> },
                    { path: 'reports', element: <SupermarketReports /> },
                    { path: 'settings', element: <SupermarketSettings /> },
                    { path: 'procurement', element: <SupermarketProcurement /> },
                ]
            },
            {
                path: 'school',
                element: <SchoolLayout />,
                children: [
                    { index: true, element: <SchoolDashboard /> },
                ]
            },
            {
                element: <MainLayout />,
                children: [
                    {
                        path: 'segments',
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <SegmentsView />
                            </Suspense>
                        ),
                    },
                    {
                        path: 'admin',
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <DashboardView />
                            </Suspense>
                        ),
                    },
                    {
                        path: 'marketplace',
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <MarketplaceView />
                            </Suspense>
                        ),
                    },
                    {
                        path: 'logistics',
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <LogisticsView />
                            </Suspense>
                        ),
                    },
                    {
                        path: 'merchants',
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <MerchantsView />
                            </Suspense>
                        ),
                    },
                    {
                        path: 'settings',
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <SettingsView />
                            </Suspense>
                        ),
                    },
                ],
            },
        ],
    },
    {
        path: '/admin',
        element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
        children: [
            { index: true, element: <Navigate to="/admin/users" replace /> },
            { path: 'users', element: <UsersPage /> },
            { path: 'businesses', element: <BusinessesPage /> },
            { path: 'audit-logs', element: <AuditLogsPage /> },
            { path: 'settings', element: <SettingsPage /> },
        ]
    },
    {
        path: '*',
        element: (
            <Suspense fallback={<PageLoader />}>
                <NotFoundView />
            </Suspense>
        ),
    },
];
