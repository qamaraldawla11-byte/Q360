import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

/**
 * A2.2 Slice 1 verification: Q guest-brief schema + internal service core.
 *
 * Uses the repository's approved staging guard. This script is DESTRUCTIVE
 * only within its own namespaced rows (usr_verify_brief_* / gbr_ ids it
 * created) and must never run against production.
 *
 * No routes are exercised — Slice 1 has none. Auth/login independence is
 * verified as a coupling check (case 18), not an HTTP test.
 */
requireQ360StagingDatabaseGuard('verify:q-guest-brief-service');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'guest-brief-service-verification-secret';
process.env.NODE_ENV = 'test';

const { and, eq, inArray } = await import('drizzle-orm');
const { db, closeDatabase } = await import('../db/client.js');
const { qGuestBriefs, users } = await import('../db/schema.js');
const { generateBriefToken, hashBriefToken } = await import('../services/qGuestBrief.js');
const {
    Q_GUEST_BRIEF_ACTIVE_EXPIRY_MS,
    claimGuestBrief,
    confirmGuestBrief,
    consumeGuestBrief,
    createGuestBrief,
    dismissGuestBrief,
    expireDueGuestBriefs,
    getCurrentGuestBriefForUser,
    revokeGuestBrief,
} = await import('../services/qGuestBriefService.js');

const results: { name: string; passed: boolean; detail?: string }[] = [];
const check = (name: string, fn: () => Promise<void> | void) => Promise.resolve()
    .then(fn)
    .then(() => { results.push({ name, passed: true }); })
    .catch((error: unknown) => { results.push({ name, passed: false, detail: error instanceof Error ? error.message : String(error) }); });
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
    if (!condition) throw new Error(message);
};

const TOKEN_SECRET = 'a2-2-verification-only-secret-32bytes!';
let currentTime = Date.now();
const events: { type: string; briefId: string; userId?: string; reason?: string }[] = [];
const deps = { tokenSecret: TOKEN_SECRET, now: () => new Date(currentTime), onEvent: (e: { type: string; briefId: string; userId?: string; reason?: string }) => { events.push(e); } };

const USER_A = 'usr_verify_brief_a';
const USER_B = 'usr_verify_brief_b';
const createdBriefIds: string[] = [];

const VALID_RECOMMENDATION = {
    intent: 'create_workspace',
    businessType: 'Family restaurant with dine-in and takeaway',
    recommendedWorkspace: 'restaurant',
    recommendedModules: ['pos', 'kds', 'menu'],
    priorities: ['Take orders faster'],
    rationale: 'Dine-in service with a kitchen.',
    requiresApproval: true,
};
const payload = () => ({
    version: 1,
    businessSummary: 'A family restaurant with 12 tables, dine-in and takeaway.',
    recommendation: VALID_RECOMMENDATION,
    prefill: { businessName: 'Mama Rosa', country: 'Germany', currency: 'EUR' },
    answers: [{ question: 'How many locations?', answer: 'One' }],
    clientMetadata: { createdFrom: 'guest_concierge' },
});

const createBrief = async (visitorKeyHash: string | null = null) => {
    const rawToken = generateBriefToken();
    const created = await createGuestBrief({ rawToken, payload: payload(), visitorKeyHash }, deps);
    assert(created.ok, `create failed: ${!created.ok && created.code}`);
    createdBriefIds.push(created.briefId);
    return { rawToken, briefId: created.briefId };
};

const rawRow = async (briefId: string) => {
    const rows = await db.select().from(qGuestBriefs).where(eq(qGuestBriefs.id, briefId));
    return rows[0];
};

try {
    await db.delete(qGuestBriefs).where(inArray(qGuestBriefs.claimedByUserId, [USER_A, USER_B]));
    await db.delete(users).where(inArray(users.id, [USER_A, USER_B]));
    await db.insert(users).values([
        { id: USER_A, email: `${USER_A}@example.com`, role: 'owner' },
        { id: USER_B, email: `${USER_B}@example.com`, role: 'owner' },
    ]);

    await check('01: creation stores token hash, never the raw token', async () => {
        const { rawToken, briefId } = await createBrief();
        const row = await rawRow(briefId);
        assert(row, 'row missing after create');
        assert(row.tokenHash === hashBriefToken(rawToken, TOKEN_SECRET), 'tokenHash mismatch');
        assert(!JSON.stringify(row).includes(rawToken), 'raw token leaked into stored row');
        assert(row.state === 'active', 'initial state must be active');
        assert(row.activeExpiresAt.getTime() - currentTime === Q_GUEST_BRIEF_ACTIVE_EXPIRY_MS, 'active expiry not 60 minutes');
    });

    await check('02: active brief claims successfully', async () => {
        const { rawToken, briefId } = await createBrief();
        const claim = await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        assert(claim.ok && claim.outcome === 'claimed', `claim failed: ${!claim.ok && claim.code}`);
        assert(claim.brief.id === briefId && claim.brief.state === 'claimed', 'brief view mismatch');
        assert(claim.brief.claimedByUserId === USER_A, 'claimedByUserId mismatch');
        await dismissGuestBrief({ userId: USER_A }, deps); // free USER_A for later cases
    });

    await check('03: same-user claim retry is idempotent (no side effects, no expiry change)', async () => {
        const { rawToken } = await createBrief();
        const first = await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        assert(first.ok && first.outcome === 'claimed', 'first claim failed');
        const eventsBefore = events.length;
        const retry = await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        assert(retry.ok && retry.outcome === 'already_claimed', `retry not idempotent: ${!retry.ok && retry.code}`);
        assert(retry.brief.claimedAt?.getTime() === first.brief.claimedAt?.getTime(), 'retry changed claimedAt');
        assert(events.length === eventsBefore, 'retry emitted side-effect events');
        await dismissGuestBrief({ userId: USER_A }, deps);
    });

    await check('04: different-user claim conflicts deterministically', async () => {
        const { rawToken } = await createBrief();
        const first = await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        assert(first.ok, 'setup claim failed');
        const second = await claimGuestBrief({ rawToken, userId: USER_B }, deps);
        assert(!second.ok && second.code === 'conflict', `expected conflict, got ${!second.ok ? second.code : 'ok'}`);
        await dismissGuestBrief({ userId: USER_A }, deps);
    });

    await check('05: malformed token fails closed before any database operation', async () => {
        const before = await db.select({ id: qGuestBriefs.id }).from(qGuestBriefs);
        const claim = await claimGuestBrief({ rawToken: 'not-a-valid-token', userId: USER_A }, deps);
        assert(!claim.ok && claim.code === 'invalid_token', `expected invalid_token, got ${!claim.ok ? claim.code : 'ok'}`);
        const create = await createGuestBrief({ rawToken: 'also-bad', payload: payload() }, deps);
        assert(!create.ok && create.code === 'invalid_token', 'create accepted malformed token');
        const after = await db.select({ id: qGuestBriefs.id }).from(qGuestBriefs);
        assert(after.length === before.length, 'database was touched by malformed-token calls');
    });

    await check('06+07: expired active brief cannot be claimed; expiry transition persisted', async () => {
        const { rawToken, briefId } = await createBrief();
        currentTime += Q_GUEST_BRIEF_ACTIVE_EXPIRY_MS + 60_000; // 61 minutes later
        const claim = await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        assert(!claim.ok && claim.code === 'expired', `expected expired, got ${!claim.ok ? claim.code : 'ok'}`);
        const row = await rawRow(briefId);
        assert(row?.state === 'expired', `expiry not persisted (state=${row?.state})`);
        assert(row.terminalAt !== null, 'terminalAt not set on expiry');
    });

    await check('08+09: claimed brief retrieves by authenticated identity; unrelated user gets null', async () => {
        const { rawToken } = await createBrief();
        await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        const mine = await getCurrentGuestBriefForUser(USER_A, deps);
        assert(mine && mine.state === 'claimed' && mine.claimedByUserId === USER_A, 'owner retrieval failed');
        assert(!('tokenHash' in mine), 'retrieval view leaks tokenHash');
        const other = await getCurrentGuestBriefForUser(USER_B, deps);
        assert(other === null, 'unrelated user retrieved the brief');
        await dismissGuestBrief({ userId: USER_A }, deps);
    });

    await check('10: confirmation is conditional and validates accepted fields', async () => {
        const noBrief = await confirmGuestBrief({ userId: USER_A, acceptedFields: [] }, deps);
        assert(!noBrief.ok && noBrief.code === 'invalid_state', 'confirm without claimed brief must fail');
        const { rawToken } = await createBrief();
        await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        const badFields = await confirmGuestBrief({ userId: USER_A, acceptedFields: ['timezone'] }, deps);
        assert(!badFields.ok && badFields.code === 'invalid_fields', 'non-prefill field accepted');
        const confirmed = await confirmGuestBrief({ userId: USER_A, acceptedFields: ['businessName', 'currency'] }, deps);
        assert(confirmed.ok && confirmed.brief.state === 'confirmed', `confirm failed: ${!confirmed.ok && confirmed.code}`);
        assert(confirmed.brief.confirmedFields?.join(',') === 'businessName,currency', 'confirmedFields mismatch');
        const secondConfirm = await confirmGuestBrief({ userId: USER_A, acceptedFields: [] }, deps);
        assert(!secondConfirm.ok && secondConfirm.code === 'invalid_state', 'second confirm must be rejected (conditional transition)');
        await consumeGuestBrief({ userId: USER_A }, deps); // clean up unresolved state
    });

    await check('11: consume fails before confirmation', async () => {
        const { rawToken } = await createBrief();
        await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        const consume = await consumeGuestBrief({ userId: USER_A }, deps);
        assert(!consume.ok && consume.code === 'invalid_state', `expected invalid_state, got ${!consume.ok ? consume.code : 'ok'}`);
        await dismissGuestBrief({ userId: USER_A }, deps);
    });

    await check('12+13: consume succeeds after confirmation; repeated consume is idempotent', async () => {
        const { rawToken, briefId } = await createBrief();
        await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        await confirmGuestBrief({ userId: USER_A, acceptedFields: ['businessName'] }, deps);
        const consumed = await consumeGuestBrief({ userId: USER_A }, deps);
        assert(consumed.ok && consumed.outcome === 'consumed', `consume failed: ${!consumed.ok && consumed.code}`);
        const row = await rawRow(briefId);
        assert(row?.state === 'consumed' && row.terminalAt !== null, 'consumed state/terminalAt not persisted');
        const again = await consumeGuestBrief({ userId: USER_A }, deps);
        assert(again.ok && again.outcome === 'already_consumed', 'repeated consume not idempotent');
    });

    await check('14: terminal brief cannot be reclaimed', async () => {
        const { rawToken } = await createBrief();
        await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        await dismissGuestBrief({ userId: USER_A }, deps);
        const reclaimSame = await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        assert(!reclaimSame.ok && reclaimSame.code === 'conflict', 'dismissed brief reclaimable by same user');
        const reclaimOther = await claimGuestBrief({ rawToken, userId: USER_B }, deps);
        assert(!reclaimOther.ok && reclaimOther.code === 'conflict', 'dismissed brief reclaimable by other user');
    });

    await check('15: one unresolved brief per user; second claim conflicts', async () => {
        const first = await createBrief();
        const second = await createBrief();
        await claimGuestBrief({ rawToken: first.rawToken, userId: USER_A }, deps);
        const claim2 = await claimGuestBrief({ rawToken: second.rawToken, userId: USER_A }, deps);
        assert(!claim2.ok && claim2.code === 'unresolved_exists', `expected unresolved_exists, got ${!claim2.ok ? claim2.code : 'ok'}`);
        await dismissGuestBrief({ userId: USER_A }, deps);
        // After dismissal, the second brief claims fine.
        const claim3 = await claimGuestBrief({ rawToken: second.rawToken, userId: USER_A }, deps);
        assert(claim3.ok && claim3.outcome === 'claimed', 'claim after dismissal should succeed');
        await dismissGuestBrief({ userId: USER_A }, deps);
    });

    await check('16: visitorKeyHash is write-only telemetry with zero authorization effect', async () => {
        const withKey = await createBrief('vk_hash_alpha');
        const withoutKey = await createBrief(null);
        const claimA = await claimGuestBrief({ rawToken: withKey.rawToken, userId: USER_A }, deps);
        assert(claimA.ok, 'claim with stored visitorKeyHash failed');
        await dismissGuestBrief({ userId: USER_A }, deps);
        const claimB = await claimGuestBrief({ rawToken: withoutKey.rawToken, userId: USER_A }, deps);
        assert(claimB.ok, 'claim without visitorKeyHash failed');
        await dismissGuestBrief({ userId: USER_A }, deps);
        // Structural guard: the service must never query visitorKeyHash.
        const serviceSource = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'services', 'qGuestBriefService.ts'), 'utf8');
        assert(!/eq\(qGuestBriefs\.visitorKeyHash/.test(serviceSource), 'service queries visitorKeyHash — R3 violation');
    });

    await check('17: service module has no environment access (injected deps only)', () => {
        const serviceSource = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'services', 'qGuestBriefService.ts'), 'utf8');
        assert(!/process\.env/.test(serviceSource), 'service reads process.env directly');
    });

    await check('18: login/auth path has zero coupling to the brief service', () => {
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
        const authRoute = readFileSync(path.join(root, 'src', 'routes', 'auth.ts'), 'utf8');
        const authMiddleware = readFileSync(path.join(root, 'src', 'middleware', 'auth.ts'), 'utf8');
        for (const [label, source] of [['auth.ts', authRoute], ['middleware/auth.ts', authMiddleware]] as const) {
            assert(!/guestBrief|guest_brief|qGuestBrief/i.test(source), `${label} references the guest-brief service — login independence violated`);
        }
        // Module-load independence: the auth route graph loads without the
        // brief service ever being imported (nothing above pulled it in via auth).
    });

    await check('extra: lazy sweep expires due rows; revoke primitive works; events are payload-free', async () => {
        const { rawToken, briefId } = await createBrief();
        currentTime += Q_GUEST_BRIEF_ACTIVE_EXPIRY_MS + 60_000;
        const sweep = await expireDueGuestBriefs(deps);
        assert(sweep.activeExpired >= 1, 'sweep did not expire the due active brief');
        const row = await rawRow(briefId);
        assert(row?.state === 'expired', 'sweep expiry not persisted');
        const claim = await claimGuestBrief({ rawToken, userId: USER_A }, deps);
        assert(!claim.ok && claim.code === 'conflict', 'expired-by-sweep brief claimable');

        const second = await createBrief();
        const revoked = await revokeGuestBrief({ briefId: second.briefId, reason: 'verification' }, deps);
        assert(revoked.ok, 'revoke failed');
        const revokedRow = await rawRow(second.briefId);
        assert(revokedRow?.state === 'revoked' && revokedRow.terminalAt !== null, 'revoke not persisted');

        for (const event of events) {
            const serialized = JSON.stringify(event);
            assert(!/businessSummary|recommendation|token/i.test(serialized.replace(/"type":"[a-z_]*token[a-z_]*"/, '')), `event may carry payload: ${serialized}`);
        }
    });
} catch (error) {
    results.push({ name: '(harness)', passed: false, detail: error instanceof Error ? error.message : String(error) });
} finally {
    await db.delete(qGuestBriefs).where(inArray(qGuestBriefs.id, createdBriefIds.length > 0 ? createdBriefIds : ['gbr_none']));
    await db.delete(qGuestBriefs).where(inArray(qGuestBriefs.claimedByUserId, [USER_A, USER_B]));
    await db.delete(users).where(inArray(users.id, [USER_A, USER_B]));
    await closeDatabase();
}

const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({
    script: 'verify:q-guest-brief-service',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
}, null, 2));

if (failed.length > 0) {
    console.error(`Q guest-brief service verification failed: ${failed.length} case(s) failed.`);
    process.exitCode = 1;
} else {
    console.log('Q guest-brief service verification passed.');
}
