/**
 * Q Guest Brief Service — A2.2 Slice 1 (internal service core, NO routes).
 *
 * Database-backed lifecycle for guest→authenticated handoff briefs:
 *
 *   active → claimed → confirmed → consumed
 *   terminal alternatives: expired, dismissed, revoked
 *
 * Invariants enforced here:
 *   - The raw token is never stored or returned; only its HMAC-derived hash
 *     (A2.1 primitives). Malformed tokens fail closed BEFORE any DB operation.
 *   - Claim is atomic: row lock + conditional UPDATE (state in WHERE), never
 *     read-modify-write. Same-user retries are idempotent (no side effects,
 *     no expiry extension, no token rotation). Different users get a
 *     deterministic 'conflict'.
 *   - After claim, retrieval is by authenticated user identity only.
 *   - Consume is an INTERNAL operation (R4): the future approved-field
 *     application workflow calls it only after fields are applied.
 *   - Lazy expiry only (R6): active 60 min, claimed 7 days, confirmed 24 h.
 *     Reads/retries never extend these windows.
 *   - visitorKeyHash is write-only telemetry context. It is never read for
 *     any decision in this service (R3).
 *   - This module never reads environment variables; the token secret and
 *     clock are injected. Audit events are emitted payload-free through the
 *     optional onEvent hook (the shared audit_logs table requires tenant
 *     context a pre-tenant brief does not have; route-layer wiring maps
 *     these events).
 */

import { randomUUID } from 'crypto';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { qGuestBriefs } from '../db/schema.js';
import type { QGuestBriefState } from '../db/schema.js';
import {
    hashBriefToken,
    isBriefTokenShape,
    toBriefTokenRecord,
    validateGuestBriefPayload,
} from './qGuestBrief.js';
import type { QGuestBriefPayload, QBriefTokenSecret } from './qGuestBrief.js';

// ---------------------------------------------------------------------------
// Retention policy (approved). Never silently extended on reads or retries.
// ---------------------------------------------------------------------------

export const Q_GUEST_BRIEF_ACTIVE_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes
export const Q_GUEST_BRIEF_CLAIMED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const Q_GUEST_BRIEF_CONFIRMED_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export const TERMINAL_BRIEF_STATES: readonly QGuestBriefState[] = ['consumed', 'expired', 'dismissed', 'revoked'];
export const UNRESOLVED_BRIEF_STATES: readonly QGuestBriefState[] = ['claimed', 'confirmed'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QGuestBriefEvent = {
    type:
        | 'created'
        | 'claimed'
        | 'claim_conflict'
        | 'confirmed'
        | 'consumed'
        | 'dismissed'
        | 'expired'
        | 'revoked'
        | 'replay_attempt';
    briefId: string;
    userId?: string;
    reason?: string;
};

export type QGuestBriefServiceDeps = {
    /** Injected HMAC secret (A2.1 rules: ≥ 32 bytes). Never read from env here. */
    tokenSecret: QBriefTokenSecret;
    /** Injectable clock for deterministic lifecycle behavior. */
    now?: () => Date;
    /** Optional payload-free audit/telemetry hook. */
    onEvent?: (event: QGuestBriefEvent) => void;
};

/** The only brief representation callers ever see. Never contains tokenHash or visitorKeyHash. */
export type QGuestBriefView = {
    id: string;
    state: QGuestBriefState;
    payload: QGuestBriefPayload;
    claimedByUserId: string | null;
    claimedAt: Date | null;
    confirmedAt: Date | null;
    confirmedFields: string[] | null;
    activeExpiresAt: Date;
    createdAt: Date;
};

export type QGuestBriefFailureCode =
    | 'invalid_token'
    | 'invalid_payload'
    | 'brief_not_found'
    | 'expired'
    | 'conflict'
    | 'unresolved_exists'
    | 'payload_invalid'
    | 'invalid_state'
    | 'invalid_fields';

export type QGuestBriefResult<T> =
    | ({ ok: true } & T)
    | { ok: false; code: QGuestBriefFailureCode; message: string };

type BriefRow = typeof qGuestBriefs.$inferSelect;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const now = (deps: QGuestBriefServiceDeps): Date => deps.now?.() ?? new Date();

const emit = (deps: QGuestBriefServiceDeps, event: QGuestBriefEvent) => {
    deps.onEvent?.(event);
};

const fail = <T>(code: QGuestBriefFailureCode, message: string): QGuestBriefResult<T> => ({ ok: false, code, message });

const toView = (row: BriefRow): QGuestBriefView | null => {
    const parsed = validateGuestBriefPayload(row.payload);
    if (!parsed.ok) return null;
    return {
        id: row.id,
        state: row.state,
        payload: parsed.value,
        claimedByUserId: row.claimedByUserId,
        claimedAt: row.claimedAt,
        confirmedAt: row.confirmedAt,
        confirmedFields: row.confirmedFields,
        activeExpiresAt: row.activeExpiresAt,
        createdAt: row.createdAt,
    };
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Lazy expiry (R6): transitions a claimed/confirmed row to expired when its
 * retention window has passed. Conditional update; emits the event. Returns
 * true when the row was expired by this call.
 */
const applyLazyExpiry = async (
    tx: Tx,
    row: BriefRow,
    at: Date,
    deps: QGuestBriefServiceDeps,
): Promise<boolean> => {
    const deadline =
        row.state === 'claimed' && row.claimedAt ? row.claimedAt.getTime() + Q_GUEST_BRIEF_CLAIMED_RETENTION_MS
        : row.state === 'confirmed' && row.confirmedAt ? row.confirmedAt.getTime() + Q_GUEST_BRIEF_CONFIRMED_WINDOW_MS
        : null;
    if (deadline === null || at.getTime() <= deadline) return false;
    await tx.update(qGuestBriefs)
        .set({ state: 'expired', terminalAt: at, stateUpdatedAt: at })
        .where(and(eq(qGuestBriefs.id, row.id), eq(qGuestBriefs.state, row.state)));
    emit(deps, { type: 'expired', briefId: row.id, userId: row.claimedByUserId ?? undefined, reason: `${row.state}_retention_elapsed` });
    return true;
};

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export const createGuestBrief = async (
    input: { rawToken: string; payload: unknown; visitorKeyHash?: string | null },
    deps: QGuestBriefServiceDeps,
): Promise<QGuestBriefResult<{ briefId: string; tokenHash: string; activeExpiresAt: Date }>> => {
    // Fail closed BEFORE any database operation.
    if (!isBriefTokenShape(input.rawToken)) {
        return fail('invalid_token', 'Malformed brief token.');
    }
    const parsed = validateGuestBriefPayload(input.payload);
    if (!parsed.ok) {
        return fail('invalid_payload', `Payload failed contract validation: ${parsed.errors.map(e => e.field).join(', ')}`);
    }

    const at = now(deps);
    const activeExpiresAt = new Date(at.getTime() + Q_GUEST_BRIEF_ACTIVE_EXPIRY_MS);
    const { tokenHash } = toBriefTokenRecord(input.rawToken, deps.tokenSecret);
    const briefId = `gbr_${randomUUID()}`;

    await db.insert(qGuestBriefs).values({
        id: briefId,
        tokenHash,
        state: 'active',
        payload: parsed.value,
        visitorKeyHash: input.visitorKeyHash ?? null, // write-only telemetry; never read for decisions (R3)
        activeExpiresAt,
        stateUpdatedAt: at,
    });

    emit(deps, { type: 'created', briefId });
    return { ok: true, briefId, tokenHash, activeExpiresAt };
};

// ---------------------------------------------------------------------------
// claim (atomic; same-user idempotent; different-user conflict)
// ---------------------------------------------------------------------------

export const claimGuestBrief = async (
    input: { rawToken: string; userId: string },
    deps: QGuestBriefServiceDeps,
): Promise<QGuestBriefResult<{ outcome: 'claimed' | 'already_claimed'; brief: QGuestBriefView }>> => {
    // Fail closed BEFORE any database operation.
    if (!isBriefTokenShape(input.rawToken)) {
        return fail('invalid_token', 'Malformed brief token.');
    }
    const tokenHash = hashBriefToken(input.rawToken, deps.tokenSecret);
    const at = now(deps);

    return db.transaction(async (tx) => {
        const rows = await tx.select().from(qGuestBriefs).where(eq(qGuestBriefs.tokenHash, tokenHash)).for('update');
        const row = rows[0];
        if (!row) return fail('brief_not_found', 'No brief exists for this token.');

        // Same-user idempotent replay on a non-terminal brief: return the
        // current brief WITHOUT side effects, expiry extension, or token work.
        if (UNRESOLVED_BRIEF_STATES.includes(row.state) && row.claimedByUserId === input.userId) {
            const expired = await applyLazyExpiry(tx, row, at, deps);
            if (expired) return fail('expired', 'This brief has expired.');
            const brief = toView(row);
            if (!brief) return fail('payload_invalid', 'Stored payload no longer satisfies the contract.');
            return { ok: true as const, outcome: 'already_claimed' as const, brief };
        }

        // Any other non-active state (claimed by someone else, or terminal):
        // deterministic conflict. Terminal briefs can never be reclaimed.
        if (row.state !== 'active') {
            emit(deps, { type: 'claim_conflict', briefId: row.id, userId: input.userId, reason: `state_${row.state}` });
            return fail('conflict', 'This brief is no longer claimable.');
        }

        // Active but past the 60-minute window → expire (persisted), then fail.
        if (at.getTime() > row.activeExpiresAt.getTime()) {
            await tx.update(qGuestBriefs)
                .set({ state: 'expired', terminalAt: at, stateUpdatedAt: at })
                .where(and(eq(qGuestBriefs.id, row.id), eq(qGuestBriefs.state, 'active')));
            emit(deps, { type: 'expired', briefId: row.id, reason: 'active_expiry_elapsed' });
            return fail('expired', 'This brief has expired.');
        }

        // One unresolved brief per user: a second claim conflicts deterministically.
        const unresolved = await tx.select({ id: qGuestBriefs.id }).from(qGuestBriefs)
            .where(and(eq(qGuestBriefs.claimedByUserId, input.userId), inArray(qGuestBriefs.state, [...UNRESOLVED_BRIEF_STATES])));
        if (unresolved.length > 0) {
            emit(deps, { type: 'claim_conflict', briefId: row.id, userId: input.userId, reason: 'unresolved_exists' });
            return fail('unresolved_exists', 'You already have an unresolved Q brief. Confirm or dismiss it first.');
        }

        // Registry-drift defense: re-validate the stored payload before binding.
        const brief = toView(row);
        if (!brief) {
            await tx.update(qGuestBriefs)
                .set({ state: 'revoked', terminalAt: at, stateUpdatedAt: at })
                .where(and(eq(qGuestBriefs.id, row.id), eq(qGuestBriefs.state, 'active')));
            emit(deps, { type: 'revoked', briefId: row.id, reason: 'payload_invalid' });
            return fail('payload_invalid', 'Stored payload no longer satisfies the contract.');
        }

        // Atomic conditional claim: the state guard in WHERE is the CAS.
        const updated = await tx.update(qGuestBriefs)
            .set({ state: 'claimed', claimedByUserId: input.userId, claimedAt: at, stateUpdatedAt: at })
            .where(and(eq(qGuestBriefs.id, row.id), eq(qGuestBriefs.state, 'active')))
            .returning();
        if (updated.length === 0) {
            emit(deps, { type: 'claim_conflict', briefId: row.id, userId: input.userId, reason: 'lost_race' });
            return fail('conflict', 'This brief was claimed concurrently.');
        }

        emit(deps, { type: 'claimed', briefId: row.id, userId: input.userId });
        const claimedBrief = toView(updated[0]);
        if (!claimedBrief) return fail('payload_invalid', 'Stored payload no longer satisfies the contract.');
        return { ok: true as const, outcome: 'claimed' as const, brief: claimedBrief };
    });
};

// ---------------------------------------------------------------------------
// retrieval (authenticated identity only — never by token)
// ---------------------------------------------------------------------------

export const getCurrentGuestBriefForUser = async (
    userId: string,
    deps: QGuestBriefServiceDeps,
): Promise<QGuestBriefView | null> => {
    return db.transaction(async (tx) => {
        const rows = await tx.select().from(qGuestBriefs)
            .where(and(eq(qGuestBriefs.claimedByUserId, userId), inArray(qGuestBriefs.state, [...UNRESOLVED_BRIEF_STATES])))
            .for('update');
        const row = rows[0];
        if (!row) return null;
        const expired = await applyLazyExpiry(tx, row, now(deps), deps);
        if (expired) return null;
        return toView(row);
    });
};

// ---------------------------------------------------------------------------
// confirm (conditional transition; acceptedFields ⊆ payload.prefill keys)
// ---------------------------------------------------------------------------

export const confirmGuestBrief = async (
    input: { userId: string; acceptedFields: string[] },
    deps: QGuestBriefServiceDeps,
): Promise<QGuestBriefResult<{ outcome: 'confirmed' | 'already_confirmed'; brief: QGuestBriefView }>> => {
    const at = now(deps);
    return db.transaction(async (tx) => {
        const rows = await tx.select().from(qGuestBriefs)
            .where(and(eq(qGuestBriefs.claimedByUserId, input.userId), inArray(qGuestBriefs.state, [...UNRESOLVED_BRIEF_STATES])))
            .for('update');
        const row = rows[0];
        if (!row) {
            return fail('invalid_state', 'No claimed brief awaits confirmation.');
        }

        // D2: repeated confirmation with the same effective fields is an
        // idempotent success — no timestamp changes, no repeated events.
        // A materially different confirmation is a deterministic conflict.
        if (row.state === 'confirmed') {
            const stored = row.confirmedFields ?? [];
            const sameFields = stored.length === input.acceptedFields.length
                && stored.every(field => input.acceptedFields.includes(field));
            if (sameFields) {
                const brief = toView(row);
                if (!brief) return fail('payload_invalid', 'Stored payload no longer satisfies the contract.');
                return { ok: true as const, outcome: 'already_confirmed' as const, brief };
            }
            return fail('conflict', 'This brief was already confirmed with different fields.');
        }

        const expired = await applyLazyExpiry(tx, row, at, deps);
        if (expired) return fail('expired', 'This brief has expired.');

        const brief = toView(row);
        if (!brief) return fail('payload_invalid', 'Stored payload no longer satisfies the contract.');

        const allowed = Object.keys(brief.payload.prefill);
        const rejected = input.acceptedFields.filter(field => !allowed.includes(field));
        if (rejected.length > 0) {
            return fail('invalid_fields', `Fields not present in the approved prefill candidates: ${rejected.join(', ')}`);
        }

        const updated = await tx.update(qGuestBriefs)
            .set({ state: 'confirmed', confirmedAt: at, confirmedFields: input.acceptedFields, stateUpdatedAt: at })
            .where(and(eq(qGuestBriefs.id, row.id), eq(qGuestBriefs.state, 'claimed')))
            .returning();
        if (updated.length === 0) return fail('conflict', 'Brief state changed concurrently.');

        emit(deps, { type: 'confirmed', briefId: row.id, userId: input.userId });
        const confirmedBrief = toView(updated[0]);
        if (!confirmedBrief) return fail('payload_invalid', 'Stored payload no longer satisfies the contract.');
        return { ok: true as const, outcome: 'confirmed' as const, brief: confirmedBrief };
    });
};

// ---------------------------------------------------------------------------
// consume (INTERNAL operation — R4: called by the approved-field application
// workflow only AFTER fields are successfully applied. Not a public endpoint.)
// ---------------------------------------------------------------------------

export const consumeGuestBrief = async (
    input: { userId: string },
    deps: QGuestBriefServiceDeps,
): Promise<QGuestBriefResult<{ outcome: 'consumed' | 'already_consumed'; briefId: string }>> => {
    const at = now(deps);
    return db.transaction(async (tx) => {
        // Consume always targets the CURRENT confirmed brief first.
        const confirmedRows = await tx.select().from(qGuestBriefs)
            .where(and(eq(qGuestBriefs.claimedByUserId, input.userId), eq(qGuestBriefs.state, 'confirmed')))
            .for('update');
        const row = confirmedRows[0];

        if (!row) {
            // Idempotent repeated consume: only when there is no unresolved
            // brief at all and a consumed brief exists for this user — i.e.
            // a retry of the same completed operation, never a cross-brief hit.
            const unresolved = await tx.select({ id: qGuestBriefs.id }).from(qGuestBriefs)
                .where(and(eq(qGuestBriefs.claimedByUserId, input.userId), inArray(qGuestBriefs.state, [...UNRESOLVED_BRIEF_STATES])));
            if (unresolved.length > 0) {
                // Covers consume-before-confirm: a merely-claimed brief is not consumable.
                return fail('invalid_state', 'No confirmed brief awaits consumption.');
            }
            const consumedRows = await tx.select({ id: qGuestBriefs.id }).from(qGuestBriefs)
                .where(and(eq(qGuestBriefs.claimedByUserId, input.userId), eq(qGuestBriefs.state, 'consumed')));
            if (consumedRows.length > 0) {
                return { ok: true as const, outcome: 'already_consumed' as const, briefId: consumedRows[0].id };
            }
            return fail('invalid_state', 'No confirmed brief awaits consumption.');
        }

        const expired = await applyLazyExpiry(tx, row, at, deps);
        if (expired) return fail('expired', 'The confirmed application window has elapsed.');

        const updated = await tx.update(qGuestBriefs)
            .set({ state: 'consumed', terminalAt: at, stateUpdatedAt: at })
            .where(and(eq(qGuestBriefs.id, row.id), eq(qGuestBriefs.state, 'confirmed')))
            .returning();
        if (updated.length === 0) return fail('conflict', 'Brief state changed concurrently.');

        emit(deps, { type: 'consumed', briefId: row.id, userId: input.userId });
        return { ok: true as const, outcome: 'consumed' as const, briefId: row.id };
    });
};

// ---------------------------------------------------------------------------
// dismiss / revoke
// ---------------------------------------------------------------------------

export const dismissGuestBrief = async (
    input: { userId: string },
    deps: QGuestBriefServiceDeps,
): Promise<QGuestBriefResult<{ briefId: string }>> => {
    const at = now(deps);
    return db.transaction(async (tx) => {
        const rows = await tx.select().from(qGuestBriefs)
            .where(and(eq(qGuestBriefs.claimedByUserId, input.userId), inArray(qGuestBriefs.state, [...UNRESOLVED_BRIEF_STATES])))
            .for('update');
        const row = rows[0];
        if (!row) return fail('invalid_state', 'No unresolved brief to dismiss.');

        const updated = await tx.update(qGuestBriefs)
            .set({ state: 'dismissed', terminalAt: at, stateUpdatedAt: at })
            .where(and(eq(qGuestBriefs.id, row.id), inArray(qGuestBriefs.state, [...UNRESOLVED_BRIEF_STATES])))
            .returning();
        if (updated.length === 0) return fail('conflict', 'Brief state changed concurrently.');

        emit(deps, { type: 'dismissed', briefId: row.id, userId: input.userId });
        return { ok: true as const, briefId: row.id };
    });
};

/** System primitive: security action or payload-integrity revocation. */
export const revokeGuestBrief = async (
    input: { briefId: string; reason: string },
    deps: QGuestBriefServiceDeps,
): Promise<QGuestBriefResult<{ briefId: string }>> => {
    const at = now(deps);
    const updated = await db.update(qGuestBriefs)
        .set({ state: 'revoked', terminalAt: at, stateUpdatedAt: at })
        .where(and(eq(qGuestBriefs.id, input.briefId), inArray(qGuestBriefs.state, ['active', ...UNRESOLVED_BRIEF_STATES])))
        .returning();
    if (updated.length === 0) return fail('invalid_state', 'Brief is already terminal or does not exist.');
    emit(deps, { type: 'revoked', briefId: input.briefId, userId: updated[0].claimedByUserId ?? undefined, reason: input.reason });
    return { ok: true as const, briefId: input.briefId };
};

// ---------------------------------------------------------------------------
// lazy expiry sweep (callable helper — R6: no scheduler in Slice 1)
// ---------------------------------------------------------------------------

/**
 * Applies due expiry transitions in bulk. Callable from verification or a
 * future scheduled job; Slice 1 schedules nothing.
 *
 * Future physical cleanup (documented, NOT implemented): rows with
 * terminalAt older than 30 days are deleted, or anonymized by clearing
 * payload and visitorKeyHash while keeping id/state/timestamps for metrics.
 */
export const expireDueGuestBriefs = async (
    deps: QGuestBriefServiceDeps,
): Promise<{ activeExpired: number; claimedExpired: number; confirmedExpired: number }> => {
    const at = now(deps);
    const activeExpired = await db.update(qGuestBriefs)
        .set({ state: 'expired', terminalAt: at, stateUpdatedAt: at })
        .where(and(eq(qGuestBriefs.state, 'active'), lt(qGuestBriefs.activeExpiresAt, at)))
        .returning({ id: qGuestBriefs.id });
    const claimedExpired = await db.update(qGuestBriefs)
        .set({ state: 'expired', terminalAt: at, stateUpdatedAt: at })
        .where(and(eq(qGuestBriefs.state, 'claimed'), lt(qGuestBriefs.claimedAt, new Date(at.getTime() - Q_GUEST_BRIEF_CLAIMED_RETENTION_MS))))
        .returning({ id: qGuestBriefs.id });
    const confirmedExpired = await db.update(qGuestBriefs)
        .set({ state: 'expired', terminalAt: at, stateUpdatedAt: at })
        .where(and(eq(qGuestBriefs.state, 'confirmed'), lt(qGuestBriefs.confirmedAt, new Date(at.getTime() - Q_GUEST_BRIEF_CONFIRMED_WINDOW_MS))))
        .returning({ id: qGuestBriefs.id });
    for (const row of [...activeExpired, ...claimedExpired, ...confirmedExpired]) {
        emit(deps, { type: 'expired', briefId: row.id, reason: 'sweep' });
    }
    return {
        activeExpired: activeExpired.length,
        claimedExpired: claimedExpired.length,
        confirmedExpired: confirmedExpired.length,
    };
};
