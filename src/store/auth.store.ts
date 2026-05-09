import { create } from 'zustand';
import { authApi } from '@/api/auth.api';
import type { User } from '@/types/user';

interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    isLoading: boolean;
    previewMode: boolean;
    isInitialized: boolean;
    login: (email: string) => Promise<void>;
    initSession: () => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    previewMode: false,
    isInitialized: false,

    initSession: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            set({ isInitialized: true, isAuthenticated: false });
            return;
        }

        try {
            const user = await authApi.getSession();
            set({
                isInitialized: true,
                isAuthenticated: true,
                user,
            });
        } catch (error) {
            // Token is invalid or expired
            console.error('Session restoration failed', error);
            localStorage.removeItem('auth_token');
            set({ isInitialized: true, isAuthenticated: false, user: null });
        }
    },

    login: async (email: string) => {
        set({ isLoading: true });

        try {
            const response = await authApi.login(email);
            localStorage.setItem('auth_token', response.token);

            set({
                isLoading: false,
                isAuthenticated: true,
                user: response.user,
            });

            // Redirect Logic handled in components, but store is ready.
        } catch (error) {
            console.error('Login failed', error);
            set({ isLoading: false });
            throw error;
        }
    },

    updateUser: (updates) => {
        set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null
        }));
    },

    logout: () => {
        localStorage.removeItem('auth_token');
        authApi.logout().catch(console.error);
        set({ isAuthenticated: false, user: null });
    },
}));
