import type { ReactNode } from 'react';

interface ModuleShellProps {
    children: ReactNode;
    fullHeight?: boolean;
    padding?: string;
}

export const ModuleShell = ({ children, fullHeight = false, padding = '32px' }: ModuleShellProps) => {
    return (
        <div style={{
            height: fullHeight ? 'calc(100vh - 64px)' : 'auto', // Adjust for header/nav
            padding: padding,
            background: 'var(--surface-100)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {children}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
