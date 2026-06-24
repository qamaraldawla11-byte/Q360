import { http } from './http';
import type { User } from '@/types/user';
import axios from 'axios';

interface LoginResponse {
    token: string;
    user: User;
}

export interface OtpRequestResponse {
    success: true;
    expiresIn: number;
    developmentMode: boolean;
}

const rethrowConnectionError = (error: unknown): never => {
    if (axios.isAxiosError<{ error?: string }>(error)) {
        if (!error.response) {
            throw new Error('Cannot connect to server');
        }
        throw new Error(error.response.data?.error || 'Authentication failed');
    }
    throw error;
};

export const authApi = {
    requestOtp: async (email: string): Promise<OtpRequestResponse> => {
        try {
            return await http.post<OtpRequestResponse>('/auth/login', { email });
        } catch (error) {
            return rethrowConnectionError(error);
        }
    },

    verifyOtp: async (email: string, code: string): Promise<LoginResponse> => {
        try {
            return await http.post<LoginResponse>('/auth/verify', { email, code });
        } catch (error) {
            return rethrowConnectionError(error);
        }
    },

    logout: async (): Promise<void> => {
        return http.post<void>('/auth/logout');
    },

    getSession: async (): Promise<User> => {
        try {
            return await http.get<User>('/auth/session');
        } catch (error) {
            return rethrowConnectionError(error);
        }
    }
};
