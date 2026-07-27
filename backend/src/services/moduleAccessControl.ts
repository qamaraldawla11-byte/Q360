/**
 * Module access control — pure, dependency-free authorization logic.
 *
 * Compatibility contract (ADR-020 / M4 intent / M5.8):
 *   - Management roles (owner, admin, manager) bypass moduleAccess entirely.
 *   - moduleAccess === null | undefined  → legacy unrestricted access (allow).
 *   - moduleAccess === []                 → explicit deny-all.
 *   - moduleAccess === ['kds', ...]       → allow only listed module keys.
 *
 * This module is PURE: no database client, no Hono, no env requirements.
 * It must stay importable in any test context without DATABASE_URL.
 */

export const MODULE_MANAGEMENT_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'manager']);

export type ModuleAccessDecision = {
    allowed: boolean;
    reason: 'management_bypass' | 'legacy_unrestricted' | 'explicit_deny_all' | 'explicit_allow' | 'explicit_deny';
};

export const decideModuleAccess = (
    role: string | null | undefined,
    moduleAccess: string[] | null | undefined,
    moduleKey: string,
): ModuleAccessDecision => {
    if (typeof role === 'string' && MODULE_MANAGEMENT_ROLES.has(role)) {
        return { allowed: true, reason: 'management_bypass' };
    }
    if (moduleAccess === null || moduleAccess === undefined) {
        return { allowed: true, reason: 'legacy_unrestricted' };
    }
    if (!Array.isArray(moduleAccess) || moduleAccess.length === 0) {
        return { allowed: false, reason: 'explicit_deny_all' };
    }
    return moduleAccess.includes(moduleKey)
        ? { allowed: true, reason: 'explicit_allow' }
        : { allowed: false, reason: 'explicit_deny' };
};

export const moduleAccessAllows = (
    role: string | null | undefined,
    moduleAccess: string[] | null | undefined,
    moduleKey: string,
): boolean => decideModuleAccess(role, moduleAccess, moduleKey).allowed;
