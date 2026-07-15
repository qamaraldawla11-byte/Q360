
import { http } from './http';

// Types
export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: string;
    status?: string;
    isLocked?: boolean;
    primaryWorkspace?: string;
    onboardingCompleted?: boolean;
}

export interface AdminBusiness {
    id: string;
    name: string;
    type: string;
    status: string;
    suspensionReason?: string;
}

export interface AdminLog {
    id: string;
    action: string;
    entity: string;
    details: string;
    timestamp: string;
    userId: string;
    businessId: string;
    entityId?: string;
}

export interface AdminSetting {
    key: string;
    value: string;
    description?: string;
}

export interface DashboardStats {
    totalUsers: number;
    totalBusinesses: number;
    activeBusinesses: number;
    recentActions: AdminLog[];
    systemHealth: {
        database: string;
        server: string;
        lastCheck: string;
    };
}

export interface AuditLogFilters {
    userId?: string;
    businessId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
}

export interface QProviderStatus {
    mode: 'rules_only' | 'model_active' | 'budget_reached';
    provider: 'openai' | 'q360-rules-v1';
    model: string;
    configured: boolean;
    externalModelEnabled: boolean;
    monthlyBudgetUsd: number;
    budgetRemainingUsd: number;
    message: string;
}

export interface QUsageResponse {
    period: { days: number; from: string; to: string };
    provider: QProviderStatus;
    summary: {
        requests: number;
        completedRequests: number;
        modelRequests: number;
        fallbackRequests: number;
        failedRequests: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCostUsd: number;
        activeBusinesses: number;
        activeUsers: number;
        fallbackRate: number;
    };
    businesses: Array<{
        id: string;
        name: string;
        status: string;
        requests: number;
        modelRequests: number;
        fallbackRequests: number;
        totalTokens: number;
        periodCostUsd: number;
        monthCostUsd: number;
        monthlyBudgetUsd: number;
        budgetRemainingUsd: number;
        providerMode: QProviderStatus['mode'];
    }>;
    users: Array<{
        id: string;
        name: string;
        email: string;
        businessId?: string | null;
        requests: number;
        modelRequests: number;
        totalTokens: number;
        estimatedCostUsd: number;
    }>;
    fallbackReasons: Array<{ reason: string; count: number }>;
}

export const adminApi = {
    // Dashboard
    getStats: () => http.get<DashboardStats>('/admin/stats'),
    getQUsage: (days = 30) => http.get<QUsageResponse>(`/admin/q-usage?days=${days}`),

    // Users
    getUsers: () => http.get<AdminUser[]>('/admin/users'),
    createUser: (data: Partial<AdminUser>) => http.post<AdminUser>('/admin/users', data),
    updateUser: (id: string, data: Partial<AdminUser>) => http.patch(`/admin/users/${id}`, data),
    activateUser: (id: string) => http.post(`/admin/users/${id}/activate`, {}),
    deactivateUser: (id: string) => http.post(`/admin/users/${id}/deactivate`, {}),
    lockUser: (id: string) => http.post(`/admin/users/${id}/lock`, {}),
    unlockUser: (id: string) => http.post(`/admin/users/${id}/unlock`, {}),

    // Businesses
    getBusinesses: () => http.get<AdminBusiness[]>('/admin/businesses'),
    createBusiness: (data: { name: string; type: string }) => http.post<AdminBusiness>('/admin/businesses', data),
    suspendBusiness: (id: string, reason: string) => http.post(`/admin/businesses/${id}/suspend`, { reason }),
    activateBusiness: (id: string) => http.post(`/admin/businesses/${id}/activate`, {}),

    // Audit Logs
    getAuditLogs: (filters?: AuditLogFilters) => {
        const params = new URLSearchParams();
        if (filters?.userId) params.append('userId', filters.userId);
        if (filters?.businessId) params.append('businessId', filters.businessId);
        if (filters?.action) params.append('action', filters.action);
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
        const queryString = params.toString();
        return http.get<AdminLog[]>(`/admin/audit-logs${queryString ? `?${queryString}` : ''}`);
    },

    // Settings
    getSettings: () => http.get<AdminSetting[]>('/admin/settings'),
    saveSetting: (data: AdminSetting) => http.post('/admin/settings', data),
};
