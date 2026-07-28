/**
 * Module policy — canonical, dependency-free definition.
 *
 * This module is the single source of truth for module identifiers, defaults,
 * and availability across workspace scopes. It is PURE: no database client,
 * no Hono, no env requirements, no runtime infrastructure. It must stay
 * importable in any context (contract validation, verification scripts,
 * future frontend-mirrored registries) without DATABASE_URL.
 *
 * Scopes (CORE-M1 hybrid module-entitlement architecture):
 *   - 'shared'      — tenant-wide shared modules (customers, quotes).
 *                     Canonical scope; server-controlled resolution only.
 *   - 'restaurant'  — workspace-scoped operational modules (POS, KDS, tables,
 *                     menu, payments, ...). Legacy 'restaurant/customers'
 *                     policy is retained ONLY for the temporary non-destructive
 *                     fallback when the canonical 'shared/customers' row is
 *                     absent. New customer/quote state is written under
 *                     'shared' exclusively.
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

export const SHARED_WORKSPACE_KEY = 'shared';

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

/**
 * Canonical tenant-wide shared modules. CORE-M1 keeps
 * shared/quotes.defaultEnabled = true unchanged for this milestone.
 */
export const sharedModulePolicies: readonly BusinessModulePolicy[] = [
    { moduleKey: 'customers', label: 'Customers', description: 'Shared customer/client records for Commerce and future Services.', category: 'Management', defaultEnabled: true, configurable: true, availability: 'ready' },
    { moduleKey: 'quotes', label: 'Quotes', description: 'Shared estimates and quote documents for Commerce and future Services.', category: 'Management', defaultEnabled: true, configurable: true, availability: 'ready' },
];

/**
 * Modules that are managed exclusively under the canonical shared scope.
 * Attempts to write them under Restaurant or any other workspace scope must
 * be rejected by the module-settings route (fail closed).
 */
export const SHARED_MANAGED_MODULE_KEYS: ReadonlySet<string> = new Set(
    sharedModulePolicies.map(policy => policy.moduleKey),
);

/**
 * Server-controlled scope resolution. Shared policies resolve ONLY under the
 * canonical 'shared' scope — never under Restaurant or other
 * workspace-specific scopes. Unknown workspace/module combinations resolve to
 * undefined so callers fail closed.
 */
export const getModulePolicy = (workspaceKey: string, moduleKey: string) => {
    if (workspaceKey === 'restaurant') {
        return restaurantModulePolicies.find(policy => policy.moduleKey === moduleKey);
    }
    if (workspaceKey === SHARED_WORKSPACE_KEY) {
        return sharedModulePolicies.find(policy => policy.moduleKey === moduleKey);
    }
    return undefined;
};

export type ModuleEnablementRow = { enabled: boolean } | null | undefined;

export type LegacyModuleFallback = {
    policy: BusinessModulePolicy;
    row: ModuleEnablementRow;
};

/**
 * Pure shared-module enablement decision (CORE-M1):
 *   - canonical shared row exists  → its state is authoritative (an explicit
 *     disabled state stays disabled; NO legacy fallback occurs);
 *   - canonical shared row absent  → temporary non-destructive legacy
 *     fallback when one is provided (customers only); otherwise the policy
 *     default applies (quotes: defaultEnabled = true).
 */
export const decideSharedModuleEnabled = (
    policy: BusinessModulePolicy,
    sharedRow: ModuleEnablementRow,
    legacy?: LegacyModuleFallback,
): boolean => {
    if (sharedRow) return sharedRow.enabled;
    if (legacy) return legacy.row?.enabled ?? legacy.policy.defaultEnabled;
    return policy.defaultEnabled;
};
