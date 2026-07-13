import { and, eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businessModules } from '../db/schema.js';

export type BusinessModulePolicy = {
    moduleKey: string;
    label: string;
    description: string;
    category: 'Core' | 'Operations' | 'Management';
    defaultEnabled: boolean;
    configurable: boolean;
    availability: 'ready' | 'preview';
};

export const restaurantModulePolicies: readonly BusinessModulePolicy[] = [
    { moduleKey: 'dashboard', label: 'Dashboard', description: 'Your Restaurant operating overview.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'pos', label: 'POS / Cashier', description: 'Create takeaway and dine-in orders.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'kds', label: 'Kitchen', description: 'Protected kitchen ticket lifecycle.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'menu', label: 'Menu', description: 'Products and prices used by POS.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'tables', label: 'Floor / Tables', description: 'Dine-in table assignment and floor status.', category: 'Operations', defaultEnabled: true, configurable: true, availability: 'ready' },
    { moduleKey: 'payments', label: 'Orders & Payments', description: 'Protected service and payment completion.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'daily-report', label: 'Reports', description: 'Restaurant daily performance records.', category: 'Management', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'inventory', label: 'Inventory & Purchasing', description: 'Saved stock, suppliers, purchase orders, and receiving.', category: 'Operations', defaultEnabled: true, configurable: true, availability: 'ready' },
    { moduleKey: 'staff', label: 'Staff / HR', description: 'Staff records, shifts, roles, module access, and invitations.', category: 'Management', defaultEnabled: true, configurable: true, availability: 'ready' },
];

export const getModulePolicy = (workspaceKey: string, moduleKey: string) =>
    workspaceKey === 'restaurant' ? restaurantModulePolicies.find(policy => policy.moduleKey === moduleKey) : undefined;

export const isBusinessModuleEnabled = async (businessId: string, workspaceKey: string, moduleKey: string) => {
    const policy = getModulePolicy(workspaceKey, moduleKey);
    if (!policy) return false;
    if (!policy.configurable) return policy.defaultEnabled;
    const saved = await first(db.select().from(businessModules).where(and(
        eq(businessModules.businessId, businessId),
        eq(businessModules.workspaceKey, workspaceKey),
        eq(businessModules.moduleKey, moduleKey),
    )));
    return saved?.enabled ?? policy.defaultEnabled;
};
