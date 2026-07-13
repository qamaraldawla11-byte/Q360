import type { User, UserRole } from '@/types/user';

const BUSINESS_MANAGEMENT_ROLES = new Set<UserRole>(['user', 'owner', 'admin', 'manager']);

export const RESTAURANT_MODULE_ACCESS: Record<string, string> = {
    dashboard: 'dashboard',
    pos: 'pos',
    kitchen: 'kds',
    menu: 'menu',
    floor: 'tables',
    inventory: 'inventory',
    billing: 'payments',
    reports: 'daily-report',
};

export const isRestaurantManager = (user: Pick<User, 'role'> | null | undefined) =>
    Boolean(user && BUSINESS_MANAGEMENT_ROLES.has(user.role));

export const hasRestaurantModuleAccess = (
    user: Pick<User, 'role' | 'moduleAccess'> | null | undefined,
    accessKey: string,
) => {
    if (!user) return false;
    if (isRestaurantManager(user)) return true;
    return Array.isArray(user.moduleAccess) && user.moduleAccess.includes(accessKey);
};
