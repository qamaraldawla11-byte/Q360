/**
 * Q Agent & Workspace Orchestration — A1 contract layer.
 *
 * This module is the smallest trusted contract layer between Q (an untrusted,
 * possibly LLM-assisted proposer) and the Q360 application (the trusted layer
 * that owns identity, authorization, execution, and navigation).
 *
 * SECURITY BOUNDARY
 * -----------------
 * Untrusted/model layer may ONLY propose:
 *   - business type (free-text description)
 *   - workspace recommendation (validated against APPROVED_WORKSPACES)
 *   - module recommendation (validated against the canonical module registry)
 *   - priorities and rationale (free text, display only)
 *
 * Trusted layer exclusively owns:
 *   - tenant identity and businessId (JWT-derived, never accepted from input)
 *   - role and permission decisions
 *   - module availability policy
 *   - approval state (explicit owner action, never inferred from prose)
 *   - execution of workspace creation / module activation
 *   - the destination route (produced only by resolveDestination)
 *   - navigation
 *
 * No model-generated string may be passed directly into router navigation,
 * database writes, module activation, or authorization checks. Every
 * untrusted object must pass through validateRecommendation /
 * validateApproval before any trusted consumer reads it.
 *
 * A1 SCOPE: types and pure validators only. Nothing in this module creates
 * workspaces, activates modules, writes to the database, calls an LLM, or
 * navigates. orchestrateWorkspace() is an explicit stub that always returns
 * a typed failure; it exists to pin the discriminated result contract.
 */

import { getModulePolicy, restaurantModulePolicies } from './restaurantModulePolicies.js';

// ---------------------------------------------------------------------------
// Approved identifiers (trusted layer truth)
// ---------------------------------------------------------------------------

/**
 * Workspaces Q may recommend. Inclusion rule: the workspace is registered,
 * not preview/disabled/locked, and has a real route in src/views/routes.tsx.
 * Source cross-checks (enforced by scripts/verify_q_orchestration_contract.ts):
 *   - src/core/modules/moduleRegistry.ts (q360WorkspaceRegistry status)
 *   - backend/src/routes/user.ts (workspacePaths)
 *   - src/views/routes.tsx (route definitions)
 *
 * pharmacy / supermarket / school are 'preview' in the frontend registry and
 * are therefore NOT recommendable destinations. services is 'disabled'.
 */
export const APPROVED_WORKSPACES = ['restaurant', 'retail', 'personal'] as const;
export type ApprovedWorkspaceId = typeof APPROVED_WORKSPACES[number];

/**
 * Audited destination allowlist. These are the ONLY route strings the
 * orchestration layer may ever emit. Every entry must correspond to a real
 * route definition; the verification script asserts this against
 * src/views/routes.tsx. Do not add planned or preview workspaces here.
 */
export const DESTINATION_ALLOWLIST = {
    onboarding: '/onboarding/identity',
    restaurant: '/app/restaurant',
    retail: '/app/retail',
    personal: '/app/personal',
} as const;
export type ApprovedDestination = typeof DESTINATION_ALLOWLIST[keyof typeof DESTINATION_ALLOWLIST];

/**
 * Approved module identifiers, derived from the canonical backend module
 * registry (businessModules.ts). Only modules with availability 'ready' are
 * recommendable; 'preview' policies are excluded. Today the only workspace
 * with a backend module registry is restaurant, so approved modules are only
 * valid in combination with the restaurant workspace.
 */
export const APPROVED_MODULES = restaurantModulePolicies
    .filter(policy => policy.availability === 'ready')
    .map(policy => policy.moduleKey);
export type ApprovedModuleId = string;

/** The only workspace that currently has a backend module registry. */
export const MODULE_REGISTRY_WORKSPACE: ApprovedWorkspaceId = 'restaurant';

// ---------------------------------------------------------------------------
// Recommendation contract (model-proposed → validated)
// ---------------------------------------------------------------------------

export const Q_RECOMMENDATION_INTENTS = ['create_workspace', 'recommend_workspace', 'explore'] as const;
export type QRecommendationIntent = typeof Q_RECOMMENDATION_INTENTS[number];

/**
 * A recommendation AFTER validation. This is the only shape trusted code may
 * consume. Note what is deliberately absent: businessId, tenant identity,
 * role, destination, JWT claims, executable commands, arbitrary metadata.
 */
export type QRecommendation = {
    intent: QRecommendationIntent;
    /** Free-text business description from the owner/model. Display only. */
    businessType: string;
    recommendedWorkspace: ApprovedWorkspaceId;
    recommendedModules: ApprovedModuleId[];
    priorities: string[];
    rationale: string;
    /** Always true. Q can never self-approve; only an explicit owner action can. */
    requiresApproval: true;
};

export type QContractRejection = {
    code:
        | 'malformed'
        | 'forbidden_field'
        | 'unknown_intent'
        | 'unknown_workspace'
        | 'unavailable_workspace'
        | 'unknown_module'
        | 'module_workspace_mismatch'
        | 'approval_not_explicit'
        | 'invalid_approval_state'
        | 'invalid_corrections';
    field: string;
    message: string;
};

export type QValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; errors: QContractRejection[] };

/**
 * Fields that must NEVER arrive from untrusted/model input. Presence of any
 * of these is an automatic rejection — the model does not get to influence
 * identity, authorization, execution, or navigation.
 */
const FORBIDDEN_UNTRUSTED_FIELDS = [
    'businessId',
    'tenantId',
    'tenant',
    'userId',
    'ownerId',
    'role',
    'permissions',
    'jwt',
    'token',
    'destination',
    'route',
    'path',
    'url',
    'success',
    'executed',
    'enabledModules',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
    typeof value === 'string' ? value : null;

const asStringArray = (value: unknown): string[] | null =>
    Array.isArray(value) && value.every(item => typeof item === 'string') ? value as string[] : null;

const isApprovedWorkspace = (value: unknown): value is ApprovedWorkspaceId =>
    typeof value === 'string' && (APPROVED_WORKSPACES as readonly string[]).includes(value);

const isReadyModule = (workspace: ApprovedWorkspaceId, moduleKey: string): boolean =>
    getModulePolicy(workspace, moduleKey)?.availability === 'ready';

/**
 * Validate an untrusted recommendation object (e.g. assembled from a model's
 * proposal). Returns a fully typed QRecommendation or typed rejections.
 * Pure and deterministic; never throws on bad input.
 */
export const validateRecommendation = (input: unknown): QValidationResult<QRecommendation> => {
    const errors: QContractRejection[] = [];
    if (!isRecord(input)) {
        return { ok: false, errors: [{ code: 'malformed', field: '(root)', message: 'Recommendation must be an object.' }] };
    }

    for (const field of FORBIDDEN_UNTRUSTED_FIELDS) {
        if (field in input) {
            errors.push({
                code: 'forbidden_field',
                field,
                message: `Field '${field}' is owned by the trusted layer and must not come from untrusted input.`,
            });
        }
    }

    const intent = asString(input.intent);
    if (!intent || !(Q_RECOMMENDATION_INTENTS as readonly string[]).includes(intent)) {
        errors.push({ code: 'unknown_intent', field: 'intent', message: 'Unknown or missing recommendation intent.' });
    }

    const businessType = asString(input.businessType) ?? '';
    const rationale = asString(input.rationale) ?? '';
    const priorities = asStringArray(input.priorities) ?? [];

    const workspace = input.recommendedWorkspace;
    if (!isApprovedWorkspace(workspace)) {
        // Distinguish "not a workspace at all" from "known but not available".
        const knownButUnavailable = typeof workspace === 'string'
            && ['pharmacy', 'supermarket', 'school', 'services', 'shared', 'autoparts', 'clinic', 'other'].includes(workspace);
        errors.push({
            code: knownButUnavailable ? 'unavailable_workspace' : 'unknown_workspace',
            field: 'recommendedWorkspace',
            message: knownButUnavailable
                ? `Workspace '${workspace}' is registered but not available for Q orchestration.`
                : 'Unknown workspace identifier.',
        });
    }

    const rawModules = input.recommendedModules;
    let modules: string[] = [];
    if (rawModules === undefined || rawModules === null) {
        modules = [];
    } else if (!asStringArray(rawModules)) {
        errors.push({ code: 'malformed', field: 'recommendedModules', message: 'recommendedModules must be an array of strings.' });
    } else {
        modules = asStringArray(rawModules)!;
    }

    if (isApprovedWorkspace(workspace)) {
        if (modules.length > 0 && workspace !== MODULE_REGISTRY_WORKSPACE) {
            errors.push({
                code: 'module_workspace_mismatch',
                field: 'recommendedModules',
                message: `Workspace '${workspace}' has no module registry; recommendedModules must be empty.`,
            });
        }
        for (const moduleKey of modules) {
            if (!isReadyModule(workspace, moduleKey)) {
                const existsSomewhere = restaurantModulePolicies.some(policy => policy.moduleKey === moduleKey);
                errors.push({
                    code: existsSomewhere ? 'module_workspace_mismatch' : 'unknown_module',
                    field: 'recommendedModules',
                    message: existsSomewhere
                        ? `Module '${moduleKey}' is not available for workspace '${workspace}'.`
                        : `Unknown module identifier '${moduleKey}'.`,
                });
            }
        }
    }

    if (input.requiresApproval !== true) {
        errors.push({
            code: 'approval_not_explicit',
            field: 'requiresApproval',
            message: 'requiresApproval must be exactly true; Q can never mark a recommendation as pre-approved.',
        });
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
        ok: true,
        value: {
            intent: intent as QRecommendationIntent,
            businessType,
            recommendedWorkspace: workspace as ApprovedWorkspaceId,
            recommendedModules: [...new Set(modules)],
            priorities,
            rationale,
            requiresApproval: true,
        },
    };
};

// ---------------------------------------------------------------------------
// Owner approval contract (explicit, never implicit)
// ---------------------------------------------------------------------------

export const Q_APPROVAL_STATES = ['pending', 'approved', 'corrected', 'rejected'] as const;
export type QApprovalState = typeof Q_APPROVAL_STATES[number];

/**
 * An explicit owner decision over a validated recommendation. Suitable for
 * rendering a confirmation card and, later, for submission to a trusted
 * orchestration endpoint. Approval is NEVER inferred from chat wording: the
 * state field must be set by a deliberate UI action.
 *
 * TIMESTAMP TRUST MODEL
 * This object is client-supplied evidence of a UI action, nothing more.
 * - `clientEventAt` is optional, untrusted client metadata (clock may be
 *   wrong or forged). It is NEVER treated as proof of approval.
 * - There is deliberately NO `approvedAt` field here. A trusted approval
 *   timestamp can only be minted server-side by the future orchestration
 *   layer (see QTrustedApproval). Validation rejects any input that tries
 *   to supply `approvedAt`.
 */
export type QOwnerApproval = {
    recommendation: QRecommendation;
    state: QApprovalState;
    /** Owner corrections, validated against the same allowlists. */
    corrections: {
        workspace?: ApprovedWorkspaceId;
        modules?: ApprovedModuleId[];
        note?: string;
    };
    /** Final validated choices after corrections. Owned by the trusted layer. */
    approvedWorkspace: ApprovedWorkspaceId;
    approvedModules: ApprovedModuleId[];
    /** Optional untrusted client-side event time. Metadata only; never authoritative. */
    clientEventAt?: string;
};

/**
 * The trusted approval record. `approvedAt` and `approvedBy` may ONLY be
 * created by the future server-side orchestration layer from authenticated
 * context — never from client or model input. A1 creates no instances of
 * this type; it exists to pin the trust boundary.
 */
export type QTrustedApproval = {
    approval: QOwnerApproval;
    /** Server-minted ISO timestamp. Trusted layer only. */
    approvedAt: string;
    /** Authenticated user id from the server session. Trusted layer only. */
    approvedBy: string;
};

/**
 * Validate an untrusted approval object. The final workspace/module choices
 * are recomputed from (recommendation + corrections) and must match the
 * supplied approved* fields, so a caller cannot smuggle in unapproved
 * choices. Pure and deterministic.
 */
export const validateApproval = (input: unknown): QValidationResult<QOwnerApproval> => {
    const errors: QContractRejection[] = [];
    if (!isRecord(input)) {
        return { ok: false, errors: [{ code: 'malformed', field: '(root)', message: 'Approval must be an object.' }] };
    }

    const recResult = validateRecommendation(input.recommendation);
    if (!recResult.ok) {
        errors.push(...recResult.errors.map(error => ({ ...error, field: `recommendation.${error.field}` })));
    }

    const state = asString(input.state);
    if (!state || !(Q_APPROVAL_STATES as readonly string[]).includes(state)) {
        errors.push({ code: 'invalid_approval_state', field: 'state', message: 'Approval state must be pending, approved, corrected, or rejected.' });
    }

    const corrections = isRecord(input.corrections) ? input.corrections : {};
    let correctedWorkspace: ApprovedWorkspaceId | undefined;
    let correctedModules: string[] | undefined;
    let correctionNote: string | undefined;

    if ('workspace' in corrections) {
        if (isApprovedWorkspace(corrections.workspace)) {
            correctedWorkspace = corrections.workspace;
        } else {
            errors.push({ code: 'invalid_corrections', field: 'corrections.workspace', message: 'Corrected workspace is not an approved workspace.' });
        }
    }
    if ('modules' in corrections) {
        const parsed = asStringArray(corrections.modules);
        if (parsed) {
            correctedModules = parsed;
        } else {
            errors.push({ code: 'invalid_corrections', field: 'corrections.modules', message: 'Corrected modules must be an array of strings.' });
        }
    }
    if ('note' in corrections) {
        const note = asString(corrections.note);
        if (note !== null) correctionNote = note;
    }

    if (errors.length > 0 || !recResult.ok) return { ok: false, errors };

    const recommendation = recResult.value;
    const finalWorkspace = correctedWorkspace ?? recommendation.recommendedWorkspace;
    const finalModules = [...new Set(correctedModules ?? recommendation.recommendedModules)];

    if (finalModules.length > 0 && finalWorkspace !== MODULE_REGISTRY_WORKSPACE) {
        errors.push({
            code: 'module_workspace_mismatch',
            field: 'approvedModules',
            message: `Final workspace '${finalWorkspace}' has no module registry; approvedModules must be empty.`,
        });
    }
    for (const moduleKey of finalModules) {
        if (!isReadyModule(finalWorkspace, moduleKey)) {
            errors.push({ code: 'unknown_module', field: 'approvedModules', message: `Module '${moduleKey}' is not available for workspace '${finalWorkspace}'.` });
        }
    }

    // The caller-supplied final choices must equal the recomputed ones; this
    // prevents approval objects that quietly alter the validated outcome.
    const suppliedWorkspace = input.approvedWorkspace;
    const suppliedModules = asStringArray(input.approvedModules);
    if (suppliedWorkspace !== finalWorkspace) {
        errors.push({ code: 'invalid_corrections', field: 'approvedWorkspace', message: 'approvedWorkspace does not match recommendation + corrections.' });
    }
    if (!suppliedModules || suppliedModules.length !== finalModules.length || !suppliedModules.every(m => finalModules.includes(m))) {
        errors.push({ code: 'invalid_corrections', field: 'approvedModules', message: 'approvedModules does not match recommendation + corrections.' });
    }

    // A client/model must never supply a trusted approval timestamp.
    // approvedAt can only be minted server-side (see QTrustedApproval).
    if ('approvedAt' in input) {
        errors.push({
            code: 'forbidden_field',
            field: 'approvedAt',
            message: "Field 'approvedAt' is minted only by the trusted server-side orchestration layer and must not come from client input.",
        });
    }

    // clientEventAt is optional untrusted metadata: accepted only as a
    // string, carried through verbatim, and never treated as proof.
    const clientEventAt = asString(input.clientEventAt) ?? undefined;

    if (errors.length > 0) return { ok: false, errors };

    return {
        ok: true,
        value: {
            recommendation,
            state: state as QApprovalState,
            corrections: {
                ...(correctedWorkspace ? { workspace: correctedWorkspace } : {}),
                ...(correctedModules ? { modules: correctedModules } : {}),
                ...(correctionNote ? { note: correctionNote } : {}),
            },
            approvedWorkspace: finalWorkspace,
            approvedModules: finalModules,
            ...(clientEventAt ? { clientEventAt } : {}),
        },
    };
};

// ---------------------------------------------------------------------------
// Destination resolution (trusted, deterministic)
// ---------------------------------------------------------------------------

export type QDestinationResult =
    | { ok: true; destination: ApprovedDestination }
    | { ok: false; errors: QContractRejection[] };

/**
 * Resolve the single approved destination for a validated workspace. Accepts
 * ONLY a validated ApprovedWorkspaceId — never a route string. Deterministic
 * table lookup against DESTINATION_ALLOWLIST; there is no path in this
 * function that can emit a string supplied by a caller.
 */
export const resolveDestination = (workspace: ApprovedWorkspaceId): QDestinationResult => {
    const destination = DESTINATION_ALLOWLIST[workspace];
    if (!destination) {
        return {
            ok: false,
            errors: [{
                code: 'unknown_workspace',
                field: 'workspace',
                message: `No approved destination exists for workspace '${workspace}'.`,
            }],
        };
    }
    return { ok: true, destination };
};

/** The approved destination for continuing onboarding. */
export const ONBOARDING_DESTINATION: ApprovedDestination = DESTINATION_ALLOWLIST.onboarding;

// ---------------------------------------------------------------------------
// Trusted orchestration result contract (type only — no execution in A1)
// ---------------------------------------------------------------------------

export const Q_ORCHESTRATION_FAILURE_CODES = [
    'not_implemented',
    'not_approved',
    'validation_failed',
    'unauthorized',
    'workspace_unavailable',
    'module_unavailable',
    'destination_unresolvable',
] as const;
export type QOrchestrationFailureCode = typeof Q_ORCHESTRATION_FAILURE_CODES[number];

/**
 * The future trusted orchestration result. Discriminated on `success`.
 *
 * - businessId exists ONLY here, in the trusted result, and can only ever be
 *   produced by server-side orchestration (JWT/DB-derived). It is structurally
 *   absent from QRecommendation and rejected from all untrusted input.
 * - destination can only be an ApprovedDestination from resolveDestination.
 * - Failure results are machine-readable via `code`.
 */
export type QOrchestrationResult =
    | {
        success: true;
        businessId: string;
        workspace: ApprovedWorkspaceId;
        enabledModules: ApprovedModuleId[];
        destination: ApprovedDestination;
    }
    | {
        success: false;
        code: QOrchestrationFailureCode;
        message: string;
    };

/**
 * A1 stub: no implementation may generate a successful orchestration result
 * yet. This pins the discriminated contract for consumers and tests.
 */
export const orchestrateWorkspace = (_approval: QOwnerApproval): QOrchestrationResult => ({
    success: false,
    code: 'not_implemented',
    message: 'Workspace orchestration is not implemented in A1. This contract layer only validates and types proposals.',
});
