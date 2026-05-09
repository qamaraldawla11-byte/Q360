import { useEffect } from 'react';
import { useRoutes, BrowserRouter } from 'react-router-dom';
import { appRoutes } from '@/views/routes';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { useAuthStore } from '@/store/auth.store';

const AppRoutes = () => {
  const element = useRoutes(appRoutes);
  return element;
};

function AppContent() {
  const { isInitialized, initSession } = useAuthStore();

  useEffect(() => {
    initSession();
  }, [initSession]);

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
