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

export interface BusinessModule {
    moduleKey: string;
    workspaceKey: string;
    label: string;
    description: string;
    category: 'Core' | 'Operations' | 'Management';
    enabled: boolean;
    configurable: boolean;
    availability: 'ready' | 'preview';
}

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
    getModules: () => http.get<{ workspaceKey: string; modules: BusinessModule[] }>('/business/modules?workspace=restaurant'),
    setModuleEnabled: (moduleKey: string, enabled: boolean) => http.patch<BusinessModule>(`/business/modules/${moduleKey}`, {
        workspaceKey: 'restaurant', enabled,
    }),
};
