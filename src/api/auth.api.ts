import { http } from './http';
import type { User } from '@/types/user';

interface LoginResponse {
    token: string;
    user: User;
}

// Environment-controlled simulation mode
// Set VITE_SIMULATION_MODE=true in .env to enable mock responses
const SIMULATION_MODE = import.meta.env.VITE_SIMULATION_MODE === 'true';

const mockUser: User = {
    id: 'usr_mock_001',
    name: 'System Admin',
    email: 'admin@one-os.io',
    role: 'admin',
    avatar: 'SA',

    // ARCHITECTURE FLAGS
    onboardingCompleted: false,  // Force onboarding flow for new users
    primaryWorkspace: null,
    workspaces: []
};

export const authApi = {
    login: async (email: string): Promise<LoginResponse> => {
        if (SIMULATION_MODE) {
            await new Promise(resolve => setTimeout(resolve, 800));
            return {
                token: 'mock_jwt_token_xy7z',
                user: { ...mockUser, email }
            };
        }
        return http.post<LoginResponse>('/auth/login', { email });
    },

    logout: async (): Promise<void> => {
        if (SIMULATION_MODE) {
            await new Promise(resolve => setTimeout(resolve, 300));
            return;
        }
        return http.post<void>('/auth/logout');
    },

    getSession: async (): Promise<User> => {
        if (SIMULATION_MODE) {
            return mockUser;
        }
        return http.get<User>('/auth/session');
    }
};
