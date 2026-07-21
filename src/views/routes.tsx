/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, type RouteObject, useLocation } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { AppShell } from '@/layouts/AppShell';
import { useAuthStore } from '@/store/auth.store';
import { RestaurantAccessGuard } from '@/components/auth/RestaurantAccessGuard';
import { hasRestaurantModuleAccess, isRestaurantManager } from '@/utils/restaurantAccess';
import { PLATFORM_APP_URL } from '@/utils/host';

// NOTE: The Platform Operations experience (admin.q360.app) has its own route
// table in src/views/platformRoutes.tsx, selected by host in src/App.tsx.
// This file serves ONLY tenant/public origins.
// Architecture authority: docs/adr/ADR_PLATFORM_OPERATIONS_EXPERIENCE.md

// Lazy Load Modules
const LandingView = lazy(() => import('@/modules/public/LandingView').then(m => ({ default: m.LandingView })));
const LandingViewV2 = lazy(() => import('@/modules/public/LandingViewV2').then(m => ({ default: m.LandingViewV2 })));
const PricingView = lazy(() => import('@/modules/public/PricingView').then(m => ({ default: m.PricingView })));
const DocsView = lazy(() => import('@/modules/public/DocsView').then(m => ({ default: m.DocsView })));
const SupportView = lazy(() => import('@/modules/public/SupportView').then(m => ({ default: m.SupportView })));
const AiView = lazy(() => import('@/modules/public/AiView').then(m => ({ default: m.AiView })));
const PublicMenuView = lazy(() => import('@/modules/public/PublicMenuView').then(m => ({ default: m.PublicMenuView })));
const PublicBusinessView = lazy(() => import('@/modules/public/PublicBusinessView').then(m => ({ default: m.PublicBusinessView })));

// Onboarding
const OnboardingLayout = lazy(() => import('@/modules/onboarding/layout/OnboardingLayout').then(m => ({ default: m.OnboardingLayout })));
const IdentityView = lazy(() => import('@/modules/onboarding/IdentityView').then(m => ({ default: m.IdentityView })));
const SegmentView = lazy(() => import('@/modules/onboarding/SegmentView').then(m => ({ default: m.SegmentView })));
const SubSegmentView = lazy(() => import('@/modules/onboarding/SubSegmentView').then(m => ({ default: m.SubSegmentView })));
const BusinessTypeView = lazy(() => import('@/modules/onboarding/BusinessTypeView').then(m => ({ default: m.BusinessTypeView })));

const LoginView = lazy(() => import('@/modules/auth/LoginView').then(m => ({ default: m.LoginView })));
const SegmentsView = lazy(() => import('@/modules/core/SegmentsView').then(m => ({ default: m.SegmentsView })));
const MarketplaceView = lazy(() => import('@/modules/marketplace/MarketplaceView').then(m => ({ default: m.MarketplaceView })));
const LogisticsView = lazy(() => import('@/modules/logistics/LogisticsView').then(m => ({ default: m.LogisticsView })));
const MerchantsView = lazy(() => import('@/modules/merchants/MerchantsView').then(m => ({ default: m.MerchantsView })));
const SettingsView = lazy(() => import('@/modules/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const NotFoundView = lazy(() => import('@/modules/core/NotFoundView').then(m => ({ default: m.NotFoundView })));
const PersonalDashboard = lazy(() => import('@/components/personal/PersonalDashboard').then(m => ({ default: m.PersonalDashboard })));
const InvoiceListView = lazy(() => import('@/components/personal/PersonalStubViews').then(m => ({ default: m.InvoiceListView })));
const ClientListView = lazy(() => import('@/components/personal/PersonalStubViews').then(m => ({ default: m.ClientListView })));
const ExpenseView = lazy(() => import('@/components/personal/PersonalStubViews').then(m => ({ default: m.ExpenseView })));
const TaskView = lazy(() => import('@/components/personal/PersonalStubViews').then(m => ({ default: m.TaskView })));
const PersonalSettingsView = lazy(() => import('@/components/personal/PersonalStubViews').then(m => ({ default: m.PersonalSettingsView })));

// Restaurant Vertical
const RestaurantDashboard = lazy(() => import('@/modules/commerce/restaurant/views/DashboardView').then(m => ({ default: m.DashboardView })));
const RestaurantMenu = lazy(() => import('@/modules/commerce/restaurant/views/MenuView').then(m => ({ default: m.MenuView })));
const RestaurantPos = lazy(() => import('@/modules/commerce/restaurant/views/PosView').then(m => ({ default: m.PosView })));
const RestaurantKitchen = lazy(() => import('@/modules/commerce/restaurant/views/KitchenView').then(m => ({ default: m.KitchenView })));
const RestaurantFloor = lazy(() => import('@/modules/commerce/restaurant/views/FloorView').then(m => ({ default: m.FloorView })));
const RestaurantOrderHistory = lazy(() => import('@/modules/commerce/restaurant/views/OrderHistoryView').then(m => ({ default: m.OrderHistoryView })));
const RestaurantStaff = lazy(() => import('@/modules/commerce/restaurant/views/StaffView').then(m => ({ default: m.StaffView })));
const RestaurantInventory = lazy(() => import('@/modules/commerce/restaurant/views/InventoryView').then(m => ({ default: m.InventoryView })));
const RestaurantReports = lazy(() => import('@/modules/commerce/restaurant/views/ReportsView').then(m => ({ default: m.ReportsView })));
const RestaurantFinance = lazy(() => import('@/modules/commerce/restaurant/views/FinanceView').then(m => ({ default: m.FinanceView })));
const RestaurantCustomers = lazy(() => import('@/modules/commerce/restaurant/views/CustomersView').then(m => ({ default: m.CustomersView })));
const RestaurantModules = lazy(() => import('@/modules/commerce/restaurant/views/ModulesOverviewView').then(m => ({ default: m.ModulesOverviewView })));
const RestaurantSettings = lazy(() => import('@/modules/commerce/restaurant/views/SettingsView').then(m => ({ default: m.SettingsView })));
const RestaurantAssistant = lazy(() => import('@/modules/commerce/restaurant/views/AssistantView').then(m => ({ default: m.AssistantView })));
const RestaurantProfile = lazy(() => import('@/modules/commerce/restaurant/views/ProfileView').then(m => ({ default: m.ProfileView })));

const RESTAURANT_STAFF_LANDING = [
    ['pos', '/app/restaurant/pos'],
    ['kds', '/app/restaurant/kitchen'],
    ['menu', '/app/restaurant/menu'],
    ['tables', '/app/restaurant/floor'],
    ['inventory', '/app/restaurant/inventory'],
    ['payments', '/app/restaurant/billing'],
    ['daily-report', '/app/restaurant/reports'],
] as const;

const RestaurantHomeRoute = () => {
    const user = useAuthStore(state => state.user);
    if (hasRestaurantModuleAccess(user, 'dashboard')) return <RestaurantDashboard />;
    const landing = RESTAURANT_STAFF_LANDING.find(([accessKey]) => hasRestaurantModuleAccess(user, accessKey));
    return <Navigate to={landing?.[1] || '/app/restaurant/profile'} replace />;
};

// Pharmacy Vertical
const PharmacyDashboard = lazy(() => import('@/modules/commerce/pharmacy/views/DashboardView').then(m => ({ default: m.DashboardView })));
const PharmacyCatalog = lazy(() => import('@/modules/commerce/pharmacy/views/CatalogView').then(m => ({ default: m.CatalogView })));
const PharmacyInventory = lazy(() => import('@/modules/commerce/pharmacy/views/InventoryView').then(m => ({ default: m.InventoryView })));
const PharmacySuppliers = lazy(() => import('@/modules/commerce/pharmacy/views/SuppliersView').then(m => ({ default: m.SuppliersView })));
const PharmacyPos = lazy(() => import('@/modules/commerce/pharmacy/views/PosView').then(m => ({ default: m.PosView })));
const PharmacyRx = lazy(() => import('@/modules/commerce/pharmacy/views/PrescriptionView').then(m => ({ default: m.PrescriptionView })));
const PharmacyReports = lazy(() => import('@/modules/commerce/pharmacy/views/ReportsView').then(m => ({ default: m.ReportsView })));
const PharmacyStaff = lazy(() => import('@/modules/commerce/pharmacy/views/StaffView').then(m => ({ default: m.StaffView })));

// Retail Vertical
const RetailDashboard = lazy(() => import('@/modules/commerce/retail/views/DashboardView').then(m => ({ default: m.DashboardView })));
const RetailPos = lazy(() => import('@/modules/commerce/retail/views/PosView').then(m => ({ default: m.PosView })));
const RetailCatalog = lazy(() => import('@/modules/commerce/retail/views/CatalogView').then(m => ({ default: m.CatalogView })));
const RetailInventory = lazy(() => import('@/modules/commerce/retail/views/InventoryView').then(m => ({ default: m.InventoryView })));
const RetailCustomers = lazy(() => import('@/modules/commerce/retail/views/CustomersView').then(m => ({ default: m.CustomersView })));
const RetailQuotes = lazy(() => import('@/modules/commerce/retail/views/QuotesView').then(m => ({ default: m.QuotesView })));
const RetailReports = lazy(() => import('@/modules/commerce/retail/views/ReportsView').then(m => ({ default: m.ReportsView })));
const RetailSettings = lazy(() => import('@/modules/commerce/retail/views/SettingsView').then(m => ({ default: m.SettingsView })));

// Supermarket Vertical
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
const SchoolDashboard = lazy(() => import('@/modules/education/school/views/DashboardView').then(m => ({ default: m.DashboardView })));

// Loading Component
const PageLoader = () => (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fg-secondary)' }}>
        Loading module...
    </div>
);

// Cross-origin handoff (ADR §8): admin surfaces exist ONLY on the Platform
// origin. Legacy /admin/* and /app/admin paths on tenant origins forward to
// the Platform origin, preserving the intended destination.
const PLATFORM_PATH_MAP: Record<string, string> = {
    '/admin': '/',
    '/admin/users': '/people',
    '/admin/businesses': '/tenants',
    '/admin/audit-logs': '/audit',
    '/admin/q-usage': '/ai-operations',
    '/admin/settings': '/settings',
    '/app/admin': '/',
};

const PlatformOriginRedirect = () => {
    const location = useLocation();
    useEffect(() => {
        const target = PLATFORM_PATH_MAP[location.pathname] ?? '/';
        window.location.replace(`${PLATFORM_APP_URL}${target}`);
    }, [location.pathname]);
    return <PageLoader />;
};

// Auth Guard Wrapper — Architecture Spec Compliant
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, user } = useAuthStore();
    const location = useLocation();

    // Rule 1: Not authenticated → Login
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    // Rule 2: Persisted onboarding state controls access for every user.
    if (user?.onboardingCompleted && location.pathname.startsWith('/onboarding')) {
        return <Navigate to={user.lastActiveWorkspace || user.primaryWorkspace || (user.segment ? `/app/${user.segment}` : '/app')} replace />;
    }
    if (!user?.onboardingCompleted && !location.pathname.startsWith('/onboarding')) {
        return <Navigate to="/onboarding/identity" replace />;
    }

    if (
        user?.segment === 'restaurant'
        && !isRestaurantManager(user)
        && location.pathname.startsWith('/app')
        && !location.pathname.startsWith('/app/restaurant')
    ) {
        return <Navigate to="/app/restaurant" replace />;
    }

    // Rule 3: At /app root → Redirect to primary workspace or segments
    if (location.pathname === '/app' || location.pathname === '/app/') {
        if (user?.userType === 'personal') {
            return <Navigate to="/app/personal" replace />;
        }
        if (user?.primaryWorkspace) {
            return <Navigate to={user.primaryWorkspace} replace />;
        }
        if (user?.segment) {
            return <Navigate to={`/app/${user.segment}`} replace />;
        }
        // Fallback: No workspace set (edge case)
        return <Navigate to="/app/segments" replace />;
    }

    return <>{children}</>;
};

export const appRoutes: RouteObject[] = [
    { path: '/', element: <Suspense fallback={<PageLoader />}><LandingView /></Suspense> },
    { path: '/design-2', element: <Suspense fallback={<PageLoader />}><LandingViewV2 /></Suspense> },
    { path: '/pricing', element: <Suspense fallback={<PageLoader />}><PricingView /></Suspense> },
    { path: '/docs', element: <Suspense fallback={<PageLoader />}><DocsView /></Suspense> },
    { path: '/support', element: <Suspense fallback={<PageLoader />}><SupportView /></Suspense> },
    { path: '/ai', element: <Suspense fallback={<PageLoader />}><AiView /></Suspense> },
    { path: '/menu/:publicCode', element: <Suspense fallback={<PageLoader />}><PublicMenuView /></Suspense> },
    { path: '/connect/:publicCode', element: <Suspense fallback={<PageLoader />}><PublicBusinessView /></Suspense> },

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
        element: <ProtectedRoute><AppShell /></ProtectedRoute>,
        children: [
            {
                path: 'personal',
                children: [
                    { index: true, element: <PersonalDashboard /> },
                    { path: 'invoices', element: <InvoiceListView /> },
                    { path: 'clients', element: <ClientListView /> },
                    { path: 'expenses', element: <ExpenseView /> },
                    { path: 'tasks', element: <TaskView /> },
                    { path: 'settings', element: <PersonalSettingsView /> },
                ],
            },
            {
                path: 'restaurant',
                children: [
                    { index: true, element: <RestaurantHomeRoute /> },
                    { path: 'menu', element: <RestaurantAccessGuard accessKey="menu"><RestaurantMenu /></RestaurantAccessGuard> },
                    { path: 'pos', element: <RestaurantAccessGuard accessKey="pos"><RestaurantPos /></RestaurantAccessGuard> },
                    { path: 'kitchen', element: <RestaurantAccessGuard accessKey="kds"><RestaurantKitchen /></RestaurantAccessGuard> },
                    { path: 'floor', element: <RestaurantAccessGuard accessKey="tables"><RestaurantFloor /></RestaurantAccessGuard> },
                    { path: 'billing', element: <RestaurantAccessGuard accessKey="payments"><RestaurantOrderHistory /></RestaurantAccessGuard> },
                    { path: 'assistant', element: <RestaurantAccessGuard management><RestaurantAssistant /></RestaurantAccessGuard> },
                    { path: 'staff', element: <RestaurantAccessGuard management><RestaurantStaff /></RestaurantAccessGuard> },
                    { path: 'inventory', element: <RestaurantAccessGuard accessKey="inventory"><RestaurantInventory /></RestaurantAccessGuard> },
                    { path: 'reports', element: <RestaurantAccessGuard accessKey="daily-report"><RestaurantReports /></RestaurantAccessGuard> },
                    { path: 'finance', element: <RestaurantAccessGuard management><RestaurantFinance /></RestaurantAccessGuard> },
                    { path: 'customers', element: <RestaurantAccessGuard management><RestaurantCustomers /></RestaurantAccessGuard> },
                    { path: 'modules', element: <RestaurantAccessGuard management><RestaurantModules /></RestaurantAccessGuard> },
                    { path: 'settings', element: <RestaurantAccessGuard management><RestaurantSettings /></RestaurantAccessGuard> },
                    { path: 'profile', element: <RestaurantProfile /> },
                ]
            },
            {
                path: 'pharmacy',
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
                children: [
                    { index: true, element: <RetailDashboard /> },
                    { path: 'pos', element: <RetailPos /> },
                    { path: 'catalog', element: <RetailCatalog /> },
                    { path: 'inventory', element: <RetailInventory /> },
                    { path: 'customers', element: <RetailCustomers /> },
                    { path: 'quotes', element: <RetailQuotes /> },
                    { path: 'procurement', element: <RetailProcurement /> },
                    { path: 'reports', element: <RetailReports /> },
                    { path: 'settings', element: <RetailSettings /> },
                ]
            },
            {
                path: 'supermarket',
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
                        path: 'personal_freelancer',
                        element: <Navigate to="/app/personal" replace />,
                    },
                    {
                        path: 'personal_consultant',
                        element: <Navigate to="/app/personal" replace />,
                    },
                    {
                        path: 'personal_creative',
                        element: <Navigate to="/app/personal" replace />,
                    },
                    {
                        // Consolidated (ADR §8): the old in-workspace admin
                        // dashboard now lives only on the Platform origin.
                        path: 'admin',
                        element: <PlatformOriginRedirect />,
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
    // Consolidated (ADR §8): the /admin/* tree moved to the Platform origin's
    // own route table. On tenant origins it forwards cross-origin.
    { path: '/admin', element: <PlatformOriginRedirect /> },
    { path: '/admin/*', element: <PlatformOriginRedirect /> },
    {
        path: '*',
        element: (
            <Suspense fallback={<PageLoader />}>
                <NotFoundView />
            </Suspense>
        ),
    },
];
