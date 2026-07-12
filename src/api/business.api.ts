import axios from 'axios';
import { http } from './http';

export type RestaurantBusinessType = 'dine_in' | 'takeaway' | 'both';

export interface BusinessProfile {
    id: string;
    name: string;
    type: string | null;
    country: string | null;
    city: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
    timezone: string;
    taxIdentifier: string | null;
    restaurantType: RestaurantBusinessType;
    logoUrl: string | null;
    updatedAt: string | null;
}

export type UpdateBusinessProfile = Pick<BusinessProfile,
    'name' | 'country' | 'city' | 'address' | 'phone' | 'email' | 'currency' | 'timezone' | 'taxIdentifier' | 'restaurantType'>;

const friendlyError = (error: unknown, fallback: string) => {
    if (axios.isAxiosError<{ error?: string }>(error)) return error.response?.data?.error || fallback;
    return error instanceof Error ? error.message : fallback;
};

export const businessApi = {
    getProfile: () => http.get<BusinessProfile>('/business/profile'),
    updateProfile: async (profile: UpdateBusinessProfile) => {
        try { return await http.patch<BusinessProfile>('/business/profile', profile); }
        catch (error) { throw new Error(friendlyError(error, 'Unable to save business profile')); }
    },
    uploadLogo: async (logo: File) => {
        const form = new FormData();
        form.append('logo', logo);
        try {
            return await http.post<BusinessProfile>('/business/logo', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        } catch (error) { throw new Error(friendlyError(error, 'Unable to upload logo')); }
    },
};
