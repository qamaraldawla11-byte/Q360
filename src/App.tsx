import { useEffect } from 'react';
import { useRoutes, BrowserRouter, useLocation } from 'react-router-dom';
import { appRoutes } from '@/views/routes';
import { platformRoutes } from '@/views/platformRoutes';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { useAuthStore } from '@/store/auth.store';
import { isPlatformHost } from '@/utils/host';

// Host-selected shell (ADR: docs/adr/ADR_PLATFORM_OPERATIONS_EXPERIENCE.md):
// the Platform origin mounts the Platform Operations route table; every other
// origin mounts the tenant/public route table. One build, two experiences.
const onPlatformHost = isPlatformHost();

const AppRoutes = () => {
  const element = useRoutes(onPlatformHost ? platformRoutes : appRoutes);
  return element;
};

function AppContent() {
  const { isInitialized, initSession } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const labels: Record<string, string> = {
      ai: 'AI',
      'ai-operations': 'AI Operations',
      audit: 'Audit & Security',
      'audit-logs': 'Audit Logs',
      billing: 'Orders',
      businesses: 'Businesses',
      catalog: 'Catalog',
      clients: 'Clients',
      customers: 'Customers',
      docs: 'Documentation',
      expenses: 'Expenses',
      floor: 'Floor',
      inventory: 'Inventory',
      invoices: 'Invoices',
      kitchen: 'Kitchen',
      login: 'Sign In',
      logistics: 'Logistics',
      marketplace: 'Marketplace',
      menu: 'Menu',
      merchants: 'Merchants',
      'no-access': 'No Platform Access',
      offers: 'Offers',
      people: 'People',
      personal: 'Personal',
      pharmacy: 'Pharmacy',
      pos: 'POS',
      pricing: 'Pricing',
      procurement: 'Procurement',
      reports: 'Reports',
      restaurant: 'Restaurant',
      retail: 'Retail',
      rx: 'Prescriptions',
      school: 'School',
      segments: 'Workspaces',
      settings: 'Settings',
      staff: 'Staff',
      supermarket: 'Supermarket',
      support: 'Support',
      tasks: 'Tasks',
      tenants: 'Tenants',
      users: 'Users',
    };

    let pageName = 'Business Operating System';
    if (onPlatformHost) {
      pageName = segments[0] ? (labels[segments[0]] ?? 'Platform') : 'Overview';
      document.title = `Q360 Platform — ${pageName}`;
      return;
    }
    if (segments[0] === 'onboarding') {
      pageName = 'Set Up Your Workspace';
    } else if (segments[0] === 'app' && segments[1]) {
      const workspace = labels[segments[1]] ?? segments[1];
      const page = segments[2] ? (labels[segments[2]] ?? segments[2]) : (segments[1] === 'personal' ? 'Home' : 'Dashboard');
      pageName = `${workspace} ${page}`;
    } else if (segments[0] === 'admin') {
      pageName = labels[segments[1]] ?? 'Admin';
    } else if (segments[0]) {
      pageName = labels[segments[0]] ?? 'Page';
    }

    document.title = `Q360 — ${pageName}`;
  }, [location.pathname]);

  if (!isInitialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        color: '#fff',
        fontSize: '1.2rem'
      }}>
        Loading...
      </div>
    );
  }

  return <AppRoutes />;
}

function App() {
  return (
    <GlobalErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </GlobalErrorBoundary>
  );
}

export default App;
