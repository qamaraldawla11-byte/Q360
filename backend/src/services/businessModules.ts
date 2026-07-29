import { and, eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businessModules } from '../db/schema.js';
import {
    decideSharedModuleEnabled,
    getModulePolicy,
    SHARED_WORKSPACE_KEY,
} from './restaurantModulePolicies.js';

// Canonical policy definitions live in the dependency-free module
// restaurantModulePolicies.ts. They are re-exported here so existing
// consumers of this service keep a single import site and there is exactly
// one policy definition.
export {
    decideSharedModuleEnabled,
    getModulePolicy,
    restaurantModulePolicies,
    SHARED_MANAGED_MODULE_KEYS,
    SHARED_WORKSPACE_KEY,
    sharedModulePolicies,
} from './restaurantModulePolicies.js';
export type { BusinessModulePolicy, LegacyModuleFallback, ModuleEnablementRow } from './restaurantModulePolicies.js';
import type { LegacyModuleFallback } from './restaurantModulePolicies.js';

/**
 * Raw saved enablement row, queried separately from policy defaults so that
 * row EXISTENCE (not merely the enabled value) can drive the shared-module
 * fallback rules.
 */
export const getBusinessModuleRow = async (businessId: string, workspaceKey: string, moduleKey: string) =>
    first(db.select().from(businessModules).where(and(
        eq(businessModules.businessId, businessId),
        eq(businessModules.workspaceKey, workspaceKey),
        eq(businessModules.moduleKey, moduleKey),
    )));

export const isBusinessModuleEnabled = async (businessId: string, workspaceKey: string, moduleKey: string) => {
    const policy = getModulePolicy(workspaceKey, moduleKey);
    if (!policy) return false;

    // Canonical shared scope: server-controlled resolution. The shared row is
    // authoritative when it exists; only when it is absent does the temporary
    // non-destructive legacy 'restaurant/customers' fallback apply (customers
    // only — quotes has no legacy workspace fallback).
    if (workspaceKey === SHARED_WORKSPACE_KEY) {
        const sharedRow = await getBusinessModuleRow(businessId, SHARED_WORKSPACE_KEY, moduleKey);
        let legacy: LegacyModuleFallback | undefined;
        if (moduleKey === 'customers') {
            const legacyPolicy = getModulePolicy('restaurant', 'customers');
            if (!legacyPolicy) return false; // fail closed: legacy fallback policy must exist
            legacy = {
                policy: legacyPolicy,
                row: await getBusinessModuleRow(businessId, 'restaurant', 'customers'),
            };
        }
        return decideSharedModuleEnabled(policy, sharedRow, legacy);
    }

    if (!policy.configurable) return policy.defaultEnabled;
    const saved = await getBusinessModuleRow(businessId, workspaceKey, moduleKey);
    return saved?.enabled ?? policy.defaultEnabled;
};
