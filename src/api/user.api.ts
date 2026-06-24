import { http } from './http';
import type { User, UserSegment, UserType } from '@/types/user';
import axios from 'axios';

export interface UpdateProfileInput {
    userType: UserType;
    segment: UserSegment;
    businessName: string;
    country: string;
    currency: string;
}

const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ error?: string }>(error)) {
        return error.response?.data?.error || (error.response ? 'Unable to save your profile' : 'Cannot connect to server');
    }
    return error instanceof Error ? error.message : 'Unable to save your profile';
};

export const userApi = {
    getProfile: (): Promise<User> => http.get<User>('/user/profile'),
    updateProfile: async (profile: UpdateProfileInput): Promise<User> => {
        try {
            return await http.put<User>('/user/profile', profile);
        } catch (error) {
            throw new Error(getErrorMessage(error));
        }
    },
};
