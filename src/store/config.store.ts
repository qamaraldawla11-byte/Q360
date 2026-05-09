import { create } from 'zustand';

interface ConfigState {
    theme: 'dark' | 'light';
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
    theme: 'dark', // Default to dark for "Enterprise" feel
    sidebarCollapsed: false,

    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setTheme: (theme) => set({ theme }),
}));
