import { create } from 'zustand';
import axios from 'axios';
import { authApi } from '@/api/auth.api';
import type { OtpRequestResponse } from '@/api/auth.api';
import { userApi } from '@/api/user.api';
import type { User } from '@/types/user';

interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    isLoading: boolean;
    previewMode: boolean;
    isInitialized: boolean;
    requestOtp: (email: string) => Promise<OtpRequestResponse>;
    verifyOtp: (email: string, code: string) => Promise<void>;
    initSession: () => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
    expireSession: () => void;
    logout: () => void;
}

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

const cacheUser = (user: User) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

const cachedUser = (): User | null => {
    try {
        const value = localStorage.getItem(AUTH_USER_KEY);
        return value ? JSON.parse(value) as User : null;
    } catch {
        localStorage.removeItem(AUTH_USER_KEY);
        return null;
    }
};

const clearLocalSession = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
};

const isInvalidSession = (error: unknown) =>
    axios.isAxiosError(error) && error.response?.status === 401;

const isRetryableSessionError = (error: unknown) =>
    axios.isAxiosError(error) && (!error.response || error.response.status >= 500);

const restoreProfile = async () => {
    const delays = [0, 350, 900];
    let lastError: unknown;
    for (const delay of delays) {
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        try {
            return await userApi.getProfile();
        } catch (error) {
            lastError = error;
            if (!isRetryableSessionError(error)) throw error;
        }
    }
    throw lastError;
};

export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    previewMode: false,
    isInitialized: false,

    initSession: async () => {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
            set({ isInitialized: true, isAuthenticated: false });
            return;
        }

        try {
            const user = await restoreProfile();
            localStorage.setItem('onboarding_complete', String(user.onboardingCompleted));
            cacheUser(user);
            set({
                isInitialized: true,
                isAuthenticated: true,
                user,
            });
        } catch (error) {
            console.error('Session restoration failed', error);
            if (isInvalidSession(error)) {
                clearLocalSession();
                set({ isInitialized: true, isAuthenticated: false, user: null });
                return;
            }

            const user = cachedUser();
            set({
                isInitialized: true,
                isAuthenticated: Boolean(user),
                user,
            });
        }
    },

    requestOtp: async (email: string) => {
        set({ isLoading: true });
        try {
            const response = await authApi.requestOtp(email);
            set({ isLoading: false });
            return response;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    verifyOtp: async (email: string, code: string) => {
        set({ isLoading: true });

        try {
            const response = await authApi.verifyOtp(email, code);
            localStorage.setItem(AUTH_TOKEN_KEY, response.token);
            cacheUser(response.user);
            let user = response.user;
            try {
                user = await restoreProfile();
            } catch (error) {
                if (isInvalidSession(error)) throw error;
                console.warn('Using verified login profile while the server reconnects', error);
            }
            localStorage.setItem('onboarding_complete', String(user.onboardingCompleted));
            cacheUser(user);

            set({
                isLoading: false,
                isAuthenticated: true,
                user,
            });

            // Redirect Logic handled in components, but store is ready.
        } catch (error) {
            console.error('Login failed', error);
            clearLocalSession();
            set({ isLoading: false });
            throw error;
        }
    },

    updateUser: (updates) => {
        set((state) => {
            const user = state.user ? { ...state.user, ...updates } : null;
            if (user) cacheUser(user);
            return { user };
        });
    },

    expireSession: () => {
        clearLocalSession();
        set({ isAuthenticated: false, user: null, isInitialized: true });
    },

    logout: () => {
        const hadToken = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
        clearLocalSession();
        if (hadToken) authApi.logout().catch(console.error);
        set({ isAuthenticated: false, user: null });
    },
}));
