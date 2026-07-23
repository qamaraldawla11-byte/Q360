import { and, eq } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businessModules } from '../db/schema.js';
import { getModulePolicy } from './restaurantModulePolicies.js';

// Canonical policy definitions live in the dependency-free module
// restaurantModulePolicies.ts. They are re-exported here so existing
// consumers of this service keep a single import site and there is exactly
// one policy definition.
export { getModulePolicy, restaurantModulePolicies } from './restaurantModulePolicies.js';
export type { BusinessModulePolicy } from './restaurantModulePolicies.js';

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
