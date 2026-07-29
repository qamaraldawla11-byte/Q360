import axios, { AxiosError } from 'axios';

export interface SharedModuleFallbackResult {
    workspaceKey: 'shared';
    modules: [];
}

export const SHARED_MODULE_FALLBACK: SharedModuleFallbackResult = { workspaceKey: 'shared', modules: [] };

export const isUnsupportedWorkspaceResponse = (error: unknown): error is AxiosError<{ error: 'Unsupported workspace' }> => {
    if (!axios.isAxiosError(error)) return false;
    if (error.response?.status !== 400) return false;
    const data = error.response.data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    const keys = Object.keys(data);
    if (keys.length !== 1) return false;
    if (!Object.prototype.hasOwnProperty.call(data, 'error')) return false;
    return (data as Record<string, unknown>).error === 'Unsupported workspace';
};

export const withSharedModuleFallback = async <T>(fetch: () => Promise<T>): Promise<T | SharedModuleFallbackResult> => {
    try {
        return await fetch();
    } catch (error) {
        if (isUnsupportedWorkspaceResponse(error)) {
            return SHARED_MODULE_FALLBACK;
        }
        throw error;
    }
};
