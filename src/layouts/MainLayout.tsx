import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useConfigStore } from '@/store/config.store';

export const MainLayout = () => {
    const { sidebarCollapsed } = useConfigStore();

    return (
        <div style={{ minHeight: '100vh', display: 'flex' }}>
            <Sidebar />
            <main
                style={{
                    flex: 1,
                    marginLeft: sidebarCollapsed ? '64px' : '260px',
                    transition: 'margin-left 0.3s ease',
                    padding: '32px',
                    position: 'relative',
                }}
            >
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
