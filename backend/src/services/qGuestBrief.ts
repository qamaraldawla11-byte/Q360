/**
 * Q Guest Brief — A2.1 pure contract and token primitives.
 *
 * This module defines the versioned payload that survives the guest→
 * authenticated handoff, plus the cryptographic token primitives used to
 * reference it. It is PURE infrastructure-free code:
 *
 *   - no environment lookup at import time (secrets are function arguments)
 *   - no database import, no route import, no Hono, no React
 *   - no global mutation, no module-level state
 *   - no reversible token storage helper (hashing is one-way)
 *
 * PAYLOAD DISTINCTIONS (do not conflate):
 *   - businessSummary:   concise human-readable summary (display + prefill aid)
 *   - recommendation:    the A1-validated structured recommendation
 *   - prefill:           approved onboarding-prefill candidates only
 *   - clientMetadata:    untrusted client context, never authoritative
 *
 * TRUST MODEL:
 *   - Raw transcript is NOT part of this payload and never survives by default.
 *   - Tenant/business identity fields, trusted approval fields, routes,
 *     destinations, and arbitrary module ids are rejected (defense in depth:
 *     the nested recommendation is validated through the A1 contract too).
 *   - The server stores ONLY a derived token hash. The raw token is returned
 *     to the client exactly once and must never appear in URLs or logs.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { validateRecommendation } from './qOrchestration.js';
import type { QContractRejection, QRecommendation } from './qOrchestration.js';

// ---------------------------------------------------------------------------
// Versioned payload contract
// ---------------------------------------------------------------------------

export const Q_GUEST_BRIEF_PAYLOAD_VERSION = 1;

export const Q_GUEST_BRIEF_LIMITS = {
    businessSummaryMax: 2000,
    businessNameMax: 120,
    countryMax: 100,
    currencyMax: 3,
    answersMax: 12,
    answerQuestionMax: 200,
    answerValueMax: 500,
    clientEventAtMax: 40,
    /** Maximum serialized size of the normalized payload (bytes). */
    payloadBytesMax: 16 * 1024,
} as const;

/** Approved onboarding-prefill candidates. Nothing else may be prefilled. */
export type QGuestBriefPrefill = {
    businessName?: string;
    country?: string;
    currency?: string;
};

/** A concise onboarding answer captured during the conversation. */
export type QGuestBriefAnswer = {
    question: string;
    answer: string;
};

/** Untrusted client context. Metadata only; never authoritative. */
export type QGuestBriefClientMetadata = {
    createdFrom: 'guest_concierge';
    clientEventAt?: string;
};

export type QGuestBriefPayload = {
    version: typeof Q_GUEST_BRIEF_PAYLOAD_VERSION;
    businessSummary: string;
    recommendation: QRecommendation;
    prefill: QGuestBriefPrefill;
    answers: QGuestBriefAnswer[];
    clientMetadata: QGuestBriefClientMetadata;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type QGuestBriefRejectionCode =
    | 'malformed'
    | 'unsupported_version'
    | 'unknown_field'
    | 'forbidden_field'
    | 'empty_value'
    | 'value_too_long'
    | 'too_many_answers'
    | 'payload_too_large'
    | 'unsafe_characters';

export type QGuestBriefRejection = {
    code: QGuestBriefRejectionCode | QContractRejection['code'];
    field: string;
    message: string;
};

export type QGuestBriefValidationResult =
    | { ok: true; value: QGuestBriefPayload }
    | { ok: false; errors: QGuestBriefRejection[] };

/** Exact allowlist of accepted top-level fields. */
const ALLOWED_TOP_LEVEL_FIELDS = ['version', 'businessSummary', 'recommendation', 'prefill', 'answers', 'clientMetadata'] as const;
const ALLOWED_PREFILL_FIELDS = ['businessName', 'country', 'currency'] as const;
const ALLOWED_ANSWER_FIELDS = ['question', 'answer'] as const;
const ALLOWED_METADATA_FIELDS = ['createdFrom', 'clientEventAt'] as const;

/**
 * Fields that must never arrive in a guest brief: tenant/business identity,
 * trusted approval evidence, routes/destinations, execution state.
 */
const FORBIDDEN_BRIEF_FIELDS = [
    'businessId',
    'tenantId',
    'tenant',
    'userId',
    'ownerId',
    'boundUserId',
    'claimedBy',
    'role',
    'permissions',
    'jwt',
    'token',
    'tokenHash',
    'approvedAt',
    'approvedBy',
    'destination',
    'route',
    'path',
    'url',
    'success',
    'executed',
    'enabledModules',
] as const;

/** C0 controls (except \n and \t) plus DEL — rejected anywhere in text. */
const UNSAFE_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const hasUnsafeCharacters = (value: string): boolean => UNSAFE_CHARACTERS.test(value);

const rejectUnknownAndForbidden = (
    record: Record<string, unknown>,
    allowed: readonly string[],
    scope: string,
    errors: QGuestBriefRejection[],
) => {
    for (const key of Object.keys(record)) {
        if ((FORBIDDEN_BRIEF_FIELDS as readonly string[]).includes(key)) {
            errors.push({
                code: 'forbidden_field',
                field: `${scope}${key}`,
                message: `Field '${key}' is owned by the trusted layer and must not appear in a guest brief.`,
            });
        } else if (!allowed.includes(key)) {
            errors.push({ code: 'unknown_field', field: `${scope}${key}`, message: `Unknown field '${key}'.` });
        }
    }
};

const cleanCurrency = (
    value: unknown,
    field: string,
    errors: QGuestBriefRejection[],
): string | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
        errors.push({ code: 'malformed', field, message: 'Expected a string.' });
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined; // optional + blank → omitted
    // Normalize to uppercase and require exactly three ASCII letters
    // (ISO 4217 shape). Malformed non-blank values are rejected, and any
    // control characters fail this pattern as well.
    const normalized = trimmed.toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
        errors.push({ code: 'malformed', field, message: 'Currency must be exactly three ASCII letters (e.g. EUR, USD).' });
        return undefined;
    }
    return normalized;
};

const cleanText = (
    value: unknown,
    field: string,
    max: number,
    required: boolean,
    errors: QGuestBriefRejection[],
): string | undefined => {
    if (value === undefined || value === null) {
        if (required) errors.push({ code: 'empty_value', field, message: 'Required text is missing.' });
        return undefined;
    }
    if (typeof value !== 'string') {
        errors.push({ code: 'malformed', field, message: 'Expected a string.' });
        return undefined;
    }
    const normalized = value.trim();
    if (required && normalized.length === 0) {
        errors.push({ code: 'empty_value', field, message: 'Text must not be empty.' });
        return undefined;
    }
    if (normalized.length === 0) return undefined; // optional + blank → omitted
    if (normalized.length > max) {
        errors.push({ code: 'value_too_long', field, message: `Text exceeds ${max} characters.` });
        return undefined;
    }
    if (hasUnsafeCharacters(normalized)) {
        errors.push({ code: 'unsafe_characters', field, message: 'Text contains control characters.' });
        return undefined;
    }
    return normalized;
};

/**
 * Validate and normalize an untrusted guest-brief payload. Pure and
 * deterministic; never throws on bad input. The nested recommendation is
 * validated through the A1 contract, so unknown modules, routes, and
 * trusted-layer fields are rejected there as well.
 */
export const validateGuestBriefPayload = (input: unknown): QGuestBriefValidationResult => {
    const errors: QGuestBriefRejection[] = [];
    if (!isRecord(input)) {
        return { ok: false, errors: [{ code: 'malformed', field: '(root)', message: 'Guest brief payload must be an object.' }] };
    }

    rejectUnknownAndForbidden(input, ALLOWED_TOP_LEVEL_FIELDS, '', errors);

    if (input.version !== Q_GUEST_BRIEF_PAYLOAD_VERSION) {
        errors.push({
            code: 'unsupported_version',
            field: 'version',
            message: `Unsupported payload version; expected ${Q_GUEST_BRIEF_PAYLOAD_VERSION}.`,
        });
    }

    const businessSummary = cleanText(input.businessSummary, 'businessSummary', Q_GUEST_BRIEF_LIMITS.businessSummaryMax, true, errors);

    // Nested recommendation: full A1 validation (unknown modules, routes,
    // businessId, approval tampering are all rejected there).
    let recommendation: QRecommendation | undefined;
    const recResult = validateRecommendation(input.recommendation);
    if (recResult.ok) {
        recommendation = recResult.value;
    } else {
        errors.push(...recResult.errors.map(error => ({ ...error, field: `recommendation.${error.field}` })));
    }

    const prefill: QGuestBriefPrefill = {};
    if (input.prefill !== undefined) {
        if (!isRecord(input.prefill)) {
            errors.push({ code: 'malformed', field: 'prefill', message: 'prefill must be an object.' });
        } else {
            rejectUnknownAndForbidden(input.prefill, ALLOWED_PREFILL_FIELDS, 'prefill.', errors);
            const businessName = cleanText(input.prefill.businessName, 'prefill.businessName', Q_GUEST_BRIEF_LIMITS.businessNameMax, false, errors);
            const country = cleanText(input.prefill.country, 'prefill.country', Q_GUEST_BRIEF_LIMITS.countryMax, false, errors);
            const currency = cleanCurrency(input.prefill.currency, 'prefill.currency', errors);
            if (businessName) prefill.businessName = businessName;
            if (country) prefill.country = country;
            if (currency) prefill.currency = currency;
        }
    }

    const answers: QGuestBriefAnswer[] = [];
    if (input.answers !== undefined) {
        if (!Array.isArray(input.answers)) {
            errors.push({ code: 'malformed', field: 'answers', message: 'answers must be an array.' });
        } else {
            if (input.answers.length > Q_GUEST_BRIEF_LIMITS.answersMax) {
                errors.push({ code: 'too_many_answers', field: 'answers', message: `At most ${Q_GUEST_BRIEF_LIMITS.answersMax} answers are allowed.` });
            }
            for (const [index, item] of input.answers.slice(0, Q_GUEST_BRIEF_LIMITS.answersMax + 1).entries()) {
                if (!isRecord(item)) {
                    errors.push({ code: 'malformed', field: `answers[${index}]`, message: 'Answer must be an object.' });
                    continue;
                }
                rejectUnknownAndForbidden(item, ALLOWED_ANSWER_FIELDS, `answers[${index}].`, errors);
                const question = cleanText(item.question, `answers[${index}].question`, Q_GUEST_BRIEF_LIMITS.answerQuestionMax, true, errors);
                const answer = cleanText(item.answer, `answers[${index}].answer`, Q_GUEST_BRIEF_LIMITS.answerValueMax, true, errors);
                if (question && answer) answers.push({ question, answer });
            }
        }
    }

    let clientMetadata: QGuestBriefClientMetadata = { createdFrom: 'guest_concierge' };
    if (input.clientMetadata !== undefined) {
        if (!isRecord(input.clientMetadata)) {
            errors.push({ code: 'malformed', field: 'clientMetadata', message: 'clientMetadata must be an object.' });
        } else {
            rejectUnknownAndForbidden(input.clientMetadata, ALLOWED_METADATA_FIELDS, 'clientMetadata.', errors);
            if (input.clientMetadata.createdFrom !== 'guest_concierge') {
                errors.push({ code: 'malformed', field: 'clientMetadata.createdFrom', message: "createdFrom must be 'guest_concierge'." });
            }
            const clientEventAt = cleanText(input.clientMetadata.clientEventAt, 'clientMetadata.clientEventAt', Q_GUEST_BRIEF_LIMITS.clientEventAtMax, false, errors);
            clientMetadata = { createdFrom: 'guest_concierge', ...(clientEventAt ? { clientEventAt } : {}) };
        }
    }

    if (errors.length > 0) return { ok: false, errors };
    if (!businessSummary || !recommendation) {
        // Unreachable given the checks above, but keeps the type honest.
        return { ok: false, errors: [...errors, { code: 'malformed', field: '(root)', message: 'Payload incomplete.' }] };
    }

    const normalized: QGuestBriefPayload = {
        version: Q_GUEST_BRIEF_PAYLOAD_VERSION,
        businessSummary,
        recommendation,
        prefill,
        answers,
        clientMetadata,
    };

    const serializedSize = JSON.stringify(normalized).length;
    if (serializedSize > Q_GUEST_BRIEF_LIMITS.payloadBytesMax) {
        return {
            ok: false,
            errors: [{ code: 'payload_too_large', field: '(root)', message: `Normalized payload exceeds ${Q_GUEST_BRIEF_LIMITS.payloadBytesMax} bytes.` }],
        };
    }

    return { ok: true, value: normalized };
};

// ---------------------------------------------------------------------------
// Token primitives (pure; secret is an argument, never an env lookup)
// ---------------------------------------------------------------------------

/** 256 bits of CSPRNG entropy per token. */
export const BRIEF_TOKEN_BYTES = 32;

/**
 * The exact generated-token contract: base64url encoding of 32 bytes →
 * exactly 43 characters, URL-safe alphabet, no '=' padding, no whitespace.
 */
export const BRIEF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Shape check for opaque brief tokens. All token-consuming helpers fail closed on malformed input. */
export const isBriefTokenShape = (token: unknown): token is string =>
    typeof token === 'string' && BRIEF_TOKEN_PATTERN.test(token);

/** Minimum HMAC secret strength: 32 bytes (256 bits). */
export const BRIEF_SECRET_MIN_BYTES = 32;

/**
 * Injected HMAC secret. Binary form (Buffer/Uint8Array, ≥ 32 bytes) is
 * preferred. A string is interpreted as UTF-8 and must encode to at least
 * 32 BYTES — not merely 32 JavaScript characters.
 */
export type QBriefTokenSecret = string | Buffer | Uint8Array;

const normalizeSecret = (secret: QBriefTokenSecret): Buffer => {
    if (secret === undefined || secret === null) {
        throw new Error('Brief token secret is required.');
    }
    const bytes = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : Buffer.from(secret);
    if (bytes.length < BRIEF_SECRET_MIN_BYTES) {
        throw new Error(`Brief token secret must be at least ${BRIEF_SECRET_MIN_BYTES} bytes (got ${bytes.length}).`);
    }
    return bytes;
};

const requireTokenShape = (token: string): void => {
    if (!isBriefTokenShape(token)) {
        throw new Error('Malformed brief token: expected exactly 43 unpadded base64url characters.');
    }
};

/**
 * Generate a cryptographically secure 256-bit opaque token. The base64url
 * representation is URL-safe BY ACCIDENT OF ENCODING ONLY — the token must
 * be transported in request bodies / browser storage, never placed in a URL.
 */
export const generateBriefToken = (): string => randomBytes(BRIEF_TOKEN_BYTES).toString('base64url');

/**
 * Deterministic server-side token hash. Only this derived value may be
 * persisted. The secret is supplied by the caller (trusted layer); this
 * module never reads configuration or environment.
 *
 * Fails closed: throws on a malformed token or a missing/weak secret.
 */
export const hashBriefToken = (token: string, secret: QBriefTokenSecret): string => {
    requireTokenShape(token);
    return createHmac('sha256', normalizeSecret(secret)).update(token, 'utf8').digest('base64url');
};

/** Constant-time comparison of two derived token hashes. */
export const briefTokenHashesEqual = (a: string, b: string): boolean => {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * The serialized stored representation of a brief reference. It is
 * structurally impossible for this type to carry the raw token.
 */
export type QGuestBriefTokenRecord = {
    tokenHash: string;
};

/**
 * Build the only persistable token artifact: the derived hash. One-way;
 * there is intentionally no reverse helper.
 */
export const toBriefTokenRecord = (token: string, secret: QBriefTokenSecret): QGuestBriefTokenRecord => ({
    tokenHash: hashBriefToken(token, secret),
});
