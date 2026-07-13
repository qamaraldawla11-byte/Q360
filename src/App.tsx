import { useEffect } from 'react';
import { useRoutes, BrowserRouter, useLocation } from 'react-router-dom';
import { appRoutes } from '@/views/routes';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { useAuthStore } from '@/store/auth.store';

const AppRoutes = () => {
  const element = useRoutes(appRoutes);
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
      'audit-logs': 'Audit Logs',
      billing: 'Order History',
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
      offers: 'Offers',
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
      users: 'Users',
    };

    let pageName = 'Business Operating System';
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
