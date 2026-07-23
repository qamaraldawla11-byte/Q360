/**
 * Restaurant module policy — canonical, dependency-free definition.
 *
 * This module is the single source of truth for Restaurant module
 * identifiers, defaults, and availability. It is PURE: no database client,
 * no Hono, no env requirements, no runtime infrastructure. It must stay
 * importable in any context (contract validation, verification scripts,
 * future frontend-mirrored registries) without DATABASE_URL.
 *
 * Consumers:
 *   - services/businessModules.ts  — adds DB-backed enablement state on top
 *   - services/qOrchestration.ts   — contract allowlist derivation
 *
 * Do not duplicate this list anywhere else.
 */

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
    { moduleKey: 'pos', label: 'Sales', description: 'Create takeaway, dine-in, and delivery orders.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'kds', label: 'Kitchen', description: 'Protected kitchen ticket lifecycle.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'menu', label: 'Menu', description: 'Products and prices used by POS.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'tables', label: 'Tables', description: 'Dine-in table assignment and status.', category: 'Operations', defaultEnabled: true, configurable: true, availability: 'ready' },
    { moduleKey: 'payments', label: 'Orders', description: 'Order history, service, and payment completion.', category: 'Core', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'daily-report', label: 'Reports', description: 'Restaurant daily performance records.', category: 'Management', defaultEnabled: true, configurable: false, availability: 'ready' },
    { moduleKey: 'inventory', label: 'Stock', description: 'Stock, suppliers, purchase orders, and receiving.', category: 'Operations', defaultEnabled: true, configurable: true, availability: 'ready' },
    { moduleKey: 'staff', label: 'Team', description: 'Team records, shifts, roles, access, and invitations.', category: 'Management', defaultEnabled: true, configurable: true, availability: 'ready' },
    { moduleKey: 'finance', label: 'Finance', description: 'Revenue, expenses, bills, salaries, profit and loss.', category: 'Management', defaultEnabled: true, configurable: true, availability: 'ready' },
    { moduleKey: 'customers', label: 'Customers', description: 'Customer contacts, delivery addresses, and order history.', category: 'Management', defaultEnabled: true, configurable: true, availability: 'ready' },
];

export const getModulePolicy = (workspaceKey: string, moduleKey: string) =>
    workspaceKey === 'restaurant' ? restaurantModulePolicies.find(policy => policy.moduleKey === moduleKey) : undefined;
