import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * A1 verification: Q orchestration contract layer.
 *
 * Pure contract/validator verification — no database queries, no network,
 * no LLM. The contract module's import graph is dependency-free (it imports
 * the canonical policy data from restaurantModulePolicies.ts, which has no
 * DB/Hono/env dependencies), so this script PROVES importability with
 * DATABASE_URL and JWT_SECRET explicitly unset.
 */
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.JWT_SECRET;
if (process.env.DATABASE_URL !== undefined || process.env.JWT_SECRET !== undefined) {
    throw new Error('Environment sanitization failed: DATABASE_URL/JWT_SECRET must be unset for this verification.');
}

const {
    APPROVED_WORKSPACES,
    APPROVED_MODULES,
    DESTINATION_ALLOWLIST,
    MODULE_REGISTRY_WORKSPACE,
    ONBOARDING_DESTINATION,
    orchestrateWorkspace,
    resolveDestination,
    validateApproval,
    validateRecommendation,
} = await import('../services/qOrchestration.js');
const { restaurantModulePolicies } = await import('../services/restaurantModulePolicies.js');

const results: { name: string; passed: boolean; detail?: string }[] = [];
const check = (name: string, fn: () => void) => {
    try {
        fn();
        results.push({ name, passed: true });
    } catch (error) {
        results.push({ name, passed: false, detail: error instanceof Error ? error.message : String(error) });
    }
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
    if (!condition) throw new Error(message);
};
const hasError = (errors: { code: string }[], code: string) => errors.some(error => error.code === code);

const VALID_RECOMMENDATION_INPUT = {
    intent: 'create_workspace',
    businessType: 'Family restaurant with dine-in and takeaway',
    recommendedWorkspace: 'restaurant',
    recommendedModules: ['pos', 'kds', 'menu', 'tables'],
    priorities: ['Take orders faster', 'See daily sales'],
    rationale: 'Dine-in service with a kitchen.',
    requiresApproval: true,
};

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

check('positive: every approved workspace resolves to its real destination', () => {
    const expected: Record<string, string> = {
        restaurant: '/app/restaurant',
        retail: '/app/retail',
        personal: '/app/personal',
    };
    for (const workspace of APPROVED_WORKSPACES) {
        const resolved = resolveDestination(workspace);
        assert(resolved.ok, `resolveDestination('${workspace}') failed`);
        assert(resolved.destination === expected[workspace], `workspace '${workspace}' resolved to '${resolved.destination}', expected '${expected[workspace]}'`);
    }
    assert(ONBOARDING_DESTINATION === '/onboarding/identity', 'onboarding destination mismatch');
});

check('positive: a valid recommendation parses successfully', () => {
    const result = validateRecommendation(VALID_RECOMMENDATION_INPUT);
    assert(result.ok, `valid recommendation rejected: ${JSON.stringify(!result.ok && result.errors)}`);
    assert(result.value.requiresApproval === true, 'requiresApproval must be true');
    assert(result.value.recommendedWorkspace === 'restaurant', 'workspace mismatch');
    assert(!('businessId' in result.value), 'validated recommendation must not carry businessId');
    assert(!('destination' in result.value), 'validated recommendation must not carry destination');
});

check('positive: approved module combinations validate (restaurant registry)', () => {
    const allReady = restaurantModulePolicies.filter(p => p.availability === 'ready').map(p => p.moduleKey);
    const result = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, recommendedModules: allReady });
    assert(result.ok, `all ready modules rejected: ${JSON.stringify(!result.ok && result.errors)}`);
    const empty = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, recommendedModules: [] });
    assert(empty.ok, 'empty module list should be valid');
});

check('positive: contract module imports with DATABASE_URL and JWT_SECRET unset', () => {
    // Reaching this line at all is the proof: the dynamic imports at the top
    // of this script executed with both variables deleted from the env.
    assert(process.env.DATABASE_URL === undefined, 'DATABASE_URL is set — import-purity proof invalid');
    assert(process.env.JWT_SECRET === undefined, 'JWT_SECRET is set — import-purity proof invalid');
    assert(typeof validateRecommendation === 'function', 'validateRecommendation not importable');
    assert(typeof resolveDestination === 'function', 'resolveDestination not importable');
    assert(Array.isArray(restaurantModulePolicies) && restaurantModulePolicies.length === 11, 'canonical policy list not importable');
});

check('positive: a valid explicit approval validates and recomputes final choices', () => {
    const approval = validateApproval({
        recommendation: VALID_RECOMMENDATION_INPUT,
        state: 'approved',
        corrections: {},
        approvedWorkspace: 'restaurant',
        approvedModules: ['pos', 'kds', 'menu', 'tables'],
    });
    assert(approval.ok, `valid approval rejected: ${JSON.stringify(!approval.ok && approval.errors)}`);
    assert(approval.value.approvedWorkspace === 'restaurant', 'approved workspace mismatch');
});

check('positive: owner correction re-targets the final validated workspace', () => {
    const approval = validateApproval({
        recommendation: VALID_RECOMMENDATION_INPUT,
        state: 'corrected',
        corrections: { workspace: 'retail', modules: [], note: 'We are a shop, not a restaurant.' },
        approvedWorkspace: 'retail',
        approvedModules: [],
    });
    assert(approval.ok, `valid correction rejected: ${JSON.stringify(!approval.ok && approval.errors)}`);
    assert(approval.value.approvedWorkspace === 'retail', 'correction did not re-target workspace');
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

check('negative: arbitrary destination route string rejected', () => {
    const result = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, destination: 'javascript:alert(1)' });
    assert(!result.ok && hasError(result.errors, 'forbidden_field'), 'destination field was not rejected');
    const route = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, route: '/admin/users' });
    assert(!route.ok && hasError(route.errors, 'forbidden_field'), 'route field was not rejected');
});

check('negative: unknown workspace rejected', () => {
    const result = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, recommendedWorkspace: 'cafe-space' });
    assert(!result.ok && hasError(result.errors, 'unknown_workspace'), 'unknown workspace was not rejected as unknown_workspace');
});

check('negative: planned/unavailable workspace rejected', () => {
    for (const workspace of ['pharmacy', 'supermarket', 'school', 'services']) {
        const result = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, recommendedWorkspace: workspace });
        assert(!result.ok && hasError(result.errors, 'unavailable_workspace'), `workspace '${workspace}' was not rejected as unavailable_workspace`);
    }
});

check('negative: unknown module rejected', () => {
    const result = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, recommendedModules: ['pos', 'warp-drive'] });
    assert(!result.ok && hasError(result.errors, 'unknown_module'), 'unknown module was not rejected');
});

check('negative: mismatched module/workspace combination rejected', () => {
    const retailWithModules = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, recommendedWorkspace: 'retail', recommendedModules: ['pos'] });
    assert(!retailWithModules.ok && hasError(retailWithModules.errors, 'module_workspace_mismatch'), 'retail+modules was not rejected');
    const personalWithModules = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, recommendedWorkspace: 'personal', recommendedModules: ['kds'] });
    assert(!personalWithModules.ok && hasError(personalWithModules.errors, 'module_workspace_mismatch'), 'personal+modules was not rejected');
});

check('negative: model-supplied businessId rejected (and other trusted fields)', () => {
    const result = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, businessId: 'biz_main' });
    assert(!result.ok && hasError(result.errors, 'forbidden_field'), 'businessId was not rejected');
    const role = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, role: 'admin' });
    assert(!role.ok && hasError(role.errors, 'forbidden_field'), 'role was not rejected');
    const success = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, success: true });
    assert(!success.ok && hasError(success.errors, 'forbidden_field'), 'success was not rejected');
});

check('negative: requiresApproval cannot be false or absent', () => {
    const without = { ...VALID_RECOMMENDATION_INPUT } as Record<string, unknown>;
    delete without.requiresApproval;
    const missing = validateRecommendation(without);
    assert(!missing.ok && hasError(missing.errors, 'approval_not_explicit'), 'missing requiresApproval was not rejected');
    const falsy = validateRecommendation({ ...VALID_RECOMMENDATION_INPUT, requiresApproval: false });
    assert(!falsy.ok && hasError(falsy.errors, 'approval_not_explicit'), 'requiresApproval:false was not rejected');
});

check('negative: malformed approval rejected', () => {
    const noState = validateApproval({ recommendation: VALID_RECOMMENDATION_INPUT, approvedWorkspace: 'restaurant', approvedModules: [] });
    assert(!noState.ok && hasError(noState.errors, 'invalid_approval_state'), 'approval without state was not rejected');
    const tampered = validateApproval({
        recommendation: VALID_RECOMMENDATION_INPUT,
        state: 'approved',
        corrections: {},
        approvedWorkspace: 'retail', // does not match recommendation + corrections
        approvedModules: [],
    });
    assert(!tampered.ok && hasError(tampered.errors, 'invalid_corrections'), 'tampered approvedWorkspace was not rejected');
});

check('security: client cannot supply a trusted approval timestamp (approvedAt rejected, clientEventAt never authoritative)', () => {
    // A client-supplied approvedAt must be rejected: that timestamp can only
    // be minted server-side by the future orchestration layer.
    const forged = validateApproval({
        recommendation: VALID_RECOMMENDATION_INPUT,
        state: 'approved',
        corrections: {},
        approvedWorkspace: 'restaurant',
        approvedModules: ['pos', 'kds', 'menu', 'tables'],
        approvedAt: '2026-07-18T12:00:00.000Z',
    });
    assert(!forged.ok && hasError(forged.errors, 'forbidden_field'), 'client-supplied approvedAt was not rejected');

    // clientEventAt is accepted only as untrusted metadata and is never
    // promoted into trusted state.
    const withMetadata = validateApproval({
        recommendation: VALID_RECOMMENDATION_INPUT,
        state: 'approved',
        corrections: {},
        approvedWorkspace: 'restaurant',
        approvedModules: ['pos', 'kds', 'menu', 'tables'],
        clientEventAt: '2026-07-18T12:00:00.000Z',
    });
    assert(withMetadata.ok, `approval with clientEventAt rejected: ${JSON.stringify(!withMetadata.ok && withMetadata.errors)}`);
    assert(withMetadata.value.clientEventAt === '2026-07-18T12:00:00.000Z', 'clientEventAt metadata not carried through');
    assert(!('approvedAt' in withMetadata.value), 'validated approval must never contain approvedAt');
    assert(!('approvedBy' in withMetadata.value), 'validated approval must never contain approvedBy');

    // No timestamp of any kind is required for validity: approval proof is
    // the explicit state field, not the clock.
    const noTimestamp = validateApproval({
        recommendation: VALID_RECOMMENDATION_INPUT,
        state: 'approved',
        corrections: {},
        approvedWorkspace: 'restaurant',
        approvedModules: ['pos', 'kds', 'menu', 'tables'],
    });
    assert(noTimestamp.ok, 'approval without any timestamp must be valid (proof is the explicit state, not a clock value)');
});

check('negative: malformed recommendation objects rejected', () => {
    for (const bad of [null, undefined, 'restaurant', 42, [], { intent: 'create_workspace' }]) {
        const result = validateRecommendation(bad);
        assert(!result.ok, `malformed input ${JSON.stringify(bad)} was accepted`);
    }
});

check('negative: orchestration result failure stays discriminated (no success path in A1)', () => {
    const approval = validateApproval({
        recommendation: VALID_RECOMMENDATION_INPUT,
        state: 'approved',
        corrections: {},
        approvedWorkspace: 'restaurant',
        approvedModules: ['pos', 'kds', 'menu', 'tables'],
    });
    assert(approval.ok, 'setup approval invalid');
    const result = orchestrateWorkspace(approval.value);
    assert(result.success === false, 'A1 orchestration must never succeed');
    assert(result.code === 'not_implemented', `unexpected failure code '${result.code}'`);
    // Discrimination: success branch fields must be absent on failure.
    assert(!('businessId' in result), 'failure result must not carry businessId');
    assert(!('destination' in result), 'failure result must not carry destination');
});

// ---------------------------------------------------------------------------
// Registry consistency
// ---------------------------------------------------------------------------

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const routesSource = readFileSync(path.join(repoRoot, 'src', 'views', 'routes.tsx'), 'utf8');
const registrySource = readFileSync(path.join(repoRoot, 'src', 'core', 'modules', 'moduleRegistry.ts'), 'utf8');
const userRoutesSource = readFileSync(path.join(repoRoot, 'backend', 'src', 'routes', 'user.ts'), 'utf8');

check('registry: every allowlisted destination corresponds to a real registered route', () => {
    // Route literals appear both as absolute parents ('/onboarding', '/app')
    // and as nested child segments ('identity', 'restaurant'). Collect both
    // the raw literal and its leading-slash-stripped form.
    const routePaths = new Set(
        [...routesSource.matchAll(/path:\s*'([^']+)'/g)].flatMap(match => [match[1], match[1].replace(/^\//, '')]),
    );
    assert(routePaths.size > 10, 'route extraction found suspiciously few paths — routes.tsx format may have changed');
    for (const [key, destination] of Object.entries(DESTINATION_ALLOWLIST)) {
        const segments = destination.split('/').filter(Boolean);
        for (const segment of segments) {
            assert(routePaths.has(segment), `destination '${key}' (${destination}): segment '${segment}' is not a registered route path`);
        }
    }
});

check('registry: no duplicate destination entries', () => {
    const destinations = Object.values(DESTINATION_ALLOWLIST);
    assert(new Set(destinations).size === destinations.length, 'duplicate destination found in allowlist');
});

check('registry: no unsupported module appears in the contract allowlist', () => {
    const readyPolicies = restaurantModulePolicies.filter(p => p.availability === 'ready').map(p => p.moduleKey);
    assert(APPROVED_MODULES.length === readyPolicies.length, 'APPROVED_MODULES length differs from ready registry policies');
    for (const moduleKey of APPROVED_MODULES) {
        assert(readyPolicies.includes(moduleKey), `allowlisted module '${moduleKey}' is not a ready registry policy`);
    }
    assert(MODULE_REGISTRY_WORKSPACE === 'restaurant', 'module registry workspace drifted from restaurant');
});

check('registry: approved workspaces are enabled in the frontend workspace registry', () => {
    // Bound the match window so a workspace entry cannot bleed into later
    // entries (the module registry further down also contains 'enabled').
    const statusOf = (workspace: string): string | null => {
        const entry = new RegExp(`workspaceKey:\\s*'${workspace}'[\\s\\S]{0,400}?status:\\s*'(\\w+)'`);
        return entry.exec(registrySource)?.[1] ?? null;
    };
    for (const workspace of ['restaurant', 'retail']) {
        assert(statusOf(workspace) === 'enabled', `frontend registry does not mark '${workspace}' as enabled (found '${statusOf(workspace)}')`);
    }
    for (const workspace of ['pharmacy', 'supermarket', 'school', 'services']) {
        assert(statusOf(workspace) !== 'enabled', `frontend registry unexpectedly enables '${workspace}' — review the allowlist`);
    }
});

check('registry: destinations match backend workspacePaths mappings', () => {
    assert(/restaurant:\s*'\/app\/restaurant'/.test(userRoutesSource), 'workspacePaths restaurant mapping drifted');
    assert(/retail:\s*'\/app\/retail'/.test(userRoutesSource), 'workspacePaths retail mapping drifted');
    assert(/personal_freelancer:\s*'\/app\/personal'/.test(userRoutesSource), 'workspacePaths personal mapping drifted');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({
    script: 'verify:q-orchestration-contract',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
}, null, 2));

if (failed.length > 0) {
    console.error(`Q orchestration contract verification failed: ${failed.length} case(s) failed.`);
    process.exitCode = 1;
} else {
    console.log('Q orchestration contract verification passed.');
}
