import axios, { AxiosError } from 'axios';

type HttpModule = typeof import('./http');

export type RestaurantBusinessType = 'dine_in' | 'takeaway' | 'both';

export interface BusinessProfile {
    id: string;
    publicCode: string;
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
    publicMenuEnabled: boolean;
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

let httpPromise: Promise<HttpModule['http']> | undefined;
const getHttp = () => httpPromise ?? (httpPromise = import('./http').then(m => m.http));

const friendlyError = (error: unknown, fallback: string) => {
    if (axios.isAxiosError<{ error?: string }>(error)) return error.response?.data?.error || fallback;
    return error instanceof Error ? error.message : fallback;
};

const isUnsupportedWorkspaceError = (error: unknown): error is AxiosError<{ error?: string }> =>
    axios.isAxiosError<{ error?: string }>(error) &&
    error.response?.status === 400 &&
    error.response.data?.error === 'Unsupported workspace';

export const businessApi = {
    getProfile: () => getHttp().then(h => h.get<BusinessProfile>('/business/profile')),
    updateProfile: async (profile: UpdateBusinessProfile) => {
        try { return await (await getHttp()).patch<BusinessProfile>('/business/profile', profile); }
        catch (error) { throw new Error(friendlyError(error, 'Unable to save business profile')); }
    },
    uploadLogo: async (logo: File) => {
        const form = new FormData();
        form.append('logo', logo);
        try {
            return await (await getHttp()).post<BusinessProfile>('/business/logo', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        } catch (error) { throw new Error(friendlyError(error, 'Unable to upload logo')); }
    },
    setPublicMenuEnabled: (enabled: boolean) => getHttp().then(h => h.patch<BusinessProfile>('/business/public-menu', { enabled })),
    getModules: () => getHttp().then(h => h.get<{ workspaceKey: string; modules: BusinessModule[] }>('/business/modules?workspace=restaurant')),
    getSharedModules: async (client?: Pick<HttpModule['http'], 'get'>) => {
        const h = client ?? (await getHttp());
        try {
            return await h.get<{ workspaceKey: string; modules: BusinessModule[] }>('/business/modules?workspace=shared');
        } catch (error) {
            if (isUnsupportedWorkspaceError(error)) {
                return { workspaceKey: 'shared', modules: [] };
            }
            throw error;
        }
    },
    setModuleEnabled: (moduleKey: string, enabled: boolean, workspaceKey = 'restaurant') => getHttp().then(h => h.patch<BusinessModule>(`/business/modules/${moduleKey}`, {
        workspaceKey, enabled,
    })),
};
