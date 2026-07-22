import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Hono } from 'hono';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';
import type { QGuestBriefView } from '../services/qGuestBriefService.js';

/**
 * Q guest-brief routes + approved provisioning verification (A2.2 Slice 2).
 *
 * Uses the repository's approved staging guard. This script is DESTRUCTIVE
 * only within its own namespaced rows (usr_verify_qbrief_* / biz_verify_qbrief_*
 * and the briefs it creates) and must never run against production.
 *
 * Exercises the HTTP lifecycle end-to-end against a fresh Hono app mounted
 * exactly like src/index.ts: public create → authenticated claim → current →
 * confirm (provisioning) → dismiss, plus fail-closed gating, rate limiting,
 * replay idempotency, and login/auth independence.
 */
requireQ360StagingDatabaseGuard('verify:q-guest-brief-routes');
requireDatabaseUrl();
process.env.JWT_SECRET ||= 'guest-brief-routes-verification-secret';
process.env.Q_GUEST_BRIEF_ENABLED = 'true';
process.env.Q_GUEST_BRIEF_TOKEN_SECRET = 'verify-qbrief-routes-token-secret-48bytes-012345';
process.env.NODE_ENV = 'test';

const { eq, inArray } = await import('drizzle-orm');
const { db, closeDatabase, first } = await import('../db/client.js');
const {
    auditLogs,
    businesses,
    businessModules,
    qAssistantConversations,
    qAssistantMessages,
    qBusinessMemories,
    qGuestBriefs,
    restaurantTables,
    users,
} = await import('../db/schema.js');
const { default: publicRoutes } = await import('../routes/public.js');
const { qGuestBriefRoutes, getQGuestBriefDeps } = await import('../routes/qGuestBriefs.js');
const { generateBriefToken, hashBriefToken } = await import('../services/qGuestBrief.js');
const { createGuestBrief } = await import('../services/qGuestBriefService.js');
const { provisionRestaurantWorkspaceFromBrief } = await import('../services/qGuestBriefProvisioning.js');

// Mounted exactly like src/index.ts: public routes always, authenticated
// guest-brief routes only when the fail-closed deps check passes.
const app = new Hono();
app.route('/api/public', publicRoutes);
if (getQGuestBriefDeps()) app.route('/api/q/guest-briefs', qGuestBriefRoutes);

const SECRET = process.env.Q_GUEST_BRIEF_TOKEN_SECRET;
const USER_A = 'usr_verify_qbrief_a';
const USER_B = 'usr_verify_qbrief_b';
const USER_C = 'usr_verify_qbrief_c';
const USER_D = 'usr_verify_qbrief_d';
const USER_E = 'usr_verify_qbrief_e';
const USER_F = 'usr_verify_qbrief_f';
const BIZ_A = 'biz_verify_qbrief_a';
const BIZ_B = 'biz_verify_qbrief_b';
const BIZ_C = 'biz_verify_qbrief_c';
const BIZ_D = 'biz_verify_qbrief_d';
const BIZ_E = 'biz_verify_qbrief_e';
const BIZ_F = 'biz_verify_qbrief_f';
const userIds = [USER_A, USER_B, USER_C, USER_D, USER_E, USER_F];
const businessIds = [BIZ_A, BIZ_B, BIZ_C, BIZ_D, BIZ_E, BIZ_F];
const httpTokenHashes: string[] = [];
const serviceBriefIds: string[] = [];

const results: { name: string; passed: boolean; detail?: string }[] = [];
const check = (name: string, fn: () => Promise<void> | void) => Promise.resolve()
    .then(fn)
    .then(() => { results.push({ name, passed: true }); })
    .catch((error: unknown) => { results.push({ name, passed: false, detail: error instanceof Error ? error.message : String(error) }); });
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
    if (!condition) throw new Error(message);
};

const token = (userId: string, businessId: string) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({ sub: userId, email: `${userId}@example.com`, role: 'owner', businessId, iat: now, exp: now + 3600 });
    const signature = createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
};
const request = (authToken: string, path: string, init?: RequestInit) => app.request(path, {
    ...init, headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json', ...init?.headers },
});
const createBriefHttp = (visitorKey: string, body: Record<string, unknown>) => app.request('/api/public/q-concierge/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': visitorKey },
    body: JSON.stringify(body),
});

const validCreateBody = (overrides: Record<string, unknown> = {}) => ({
    businessType: 'restaurant',
    businessName: 'Verify Bistro',
    country: 'Germany',
    currency: 'eur',
    services: ['dine-in', 'takeaway'],
    tables: 3,
    priorities: ['service_speed', 'guest_experience'],
    ...overrides,
});

const servicePayload = () => ({
    version: 1,
    businessSummary: 'A verification restaurant with 2 tables and dine-in service.',
    recommendation: {
        intent: 'create_workspace',
        businessType: 'restaurant',
        recommendedWorkspace: 'restaurant',
        recommendedModules: ['pos', 'kds', 'menu'],
        priorities: ['service_speed'],
        rationale: 'Verification brief.',
        requiresApproval: true,
    },
    prefill: { businessName: 'Verify Service Diner', country: 'Germany', currency: 'EUR' },
    answers: [
        { question: 'business_type', answer: 'restaurant' },
        { question: 'table_count', answer: '2' },
        { question: 'service_modes', answer: 'dine-in' },
    ],
    clientMetadata: { createdFrom: 'guest_concierge' },
});

const cleanup = async () => {
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds));
    await db.delete(qAssistantMessages).where(inArray(qAssistantMessages.businessId, businessIds));
    await db.delete(qAssistantConversations).where(inArray(qAssistantConversations.businessId, businessIds));
    await db.delete(qBusinessMemories).where(inArray(qBusinessMemories.businessId, businessIds));
    await db.delete(restaurantTables).where(inArray(restaurantTables.businessId, businessIds));
    await db.delete(businessModules).where(inArray(businessModules.businessId, businessIds));
    if (httpTokenHashes.length > 0) await db.delete(qGuestBriefs).where(inArray(qGuestBriefs.tokenHash, httpTokenHashes));
    await db.delete(qGuestBriefs).where(inArray(qGuestBriefs.claimedByUserId, userIds));
    if (serviceBriefIds.length > 0) await db.delete(qGuestBriefs).where(inArray(qGuestBriefs.id, serviceBriefIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(businesses).where(inArray(businesses.id, businessIds));
};

let briefTokenA = '';
let briefIdA = '';

try {
    await cleanup(); // clear leftovers from any earlier aborted run
    await db.insert(businesses).values([
        { id: BIZ_A, name: 'Qbrief A', type: 'restaurant' },
        { id: BIZ_B, name: 'Qbrief B', type: 'restaurant' },
        { id: BIZ_C, name: 'Qbrief C', type: 'restaurant' },
        { id: BIZ_D, name: 'Qbrief D', type: 'restaurant' },
        { id: BIZ_E, name: 'Qbrief E', type: 'restaurant' },
        { id: BIZ_F, name: 'Qbrief F', type: 'restaurant' },
    ]);
    await db.insert(users).values([
        { id: USER_A, email: `${USER_A}@example.com`, role: 'owner', businessId: BIZ_A },
        { id: USER_B, email: `${USER_B}@example.com`, role: 'owner', businessId: BIZ_B },
        { id: USER_C, email: `${USER_C}@example.com`, role: 'owner', businessId: BIZ_C, userType: 'sme', segment: 'restaurant', businessName: 'Qbrief C', country: 'Germany', currency: 'EUR', onboardingCompleted: true, primaryWorkspace: '/app/restaurant' },
        { id: USER_D, email: `${USER_D}@example.com`, role: 'owner', businessId: BIZ_D },
        { id: USER_E, email: `${USER_E}@example.com`, role: 'owner', businessId: BIZ_E },
        { id: USER_F, email: `${USER_F}@example.com`, role: 'owner', businessId: BIZ_F },
    ]);
    const tokenA = token(USER_A, BIZ_A);
    const tokenB = token(USER_B, BIZ_B);
    const tokenC = token(USER_C, BIZ_C);
    const tokenD = token(USER_D, BIZ_D);
    const tokenE = token(USER_E, BIZ_E);
    const tokenF = token(USER_F, BIZ_F);

    await check('01: gating is fail-closed (flag off / missing secret / short secret → null)', () => {
        const savedEnabled = process.env.Q_GUEST_BRIEF_ENABLED;
        const savedSecret = process.env.Q_GUEST_BRIEF_TOKEN_SECRET;
        try {
            delete process.env.Q_GUEST_BRIEF_ENABLED;
            assert(getQGuestBriefDeps() === null, 'deps non-null with flag off');
            process.env.Q_GUEST_BRIEF_ENABLED = 'true';
            delete process.env.Q_GUEST_BRIEF_TOKEN_SECRET;
            assert(getQGuestBriefDeps() === null, 'deps non-null with missing secret');
            process.env.Q_GUEST_BRIEF_TOKEN_SECRET = 'short';
            assert(getQGuestBriefDeps() === null, 'deps non-null with short secret');
        } finally {
            process.env.Q_GUEST_BRIEF_ENABLED = savedEnabled;
            process.env.Q_GUEST_BRIEF_TOKEN_SECRET = savedSecret;
        }
        assert(getQGuestBriefDeps() !== null, 'deps null with valid flag + secret');
    });

    await check('02: create happy path (201, 43-char token, no tokenHash, exact contract payload)', async () => {
        const response = await createBriefHttp('verify-visitor-02', validCreateBody());
        assert(response.status === 201, `create returned ${response.status}`);
        const body = await response.json() as Record<string, unknown>;
        assert(typeof body.briefToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(body.briefToken), 'briefToken shape mismatch');
        assert(!('tokenHash' in body), 'response leaks tokenHash');
        assert(typeof body.activeExpiresAt === 'string', 'activeExpiresAt missing');
        briefTokenA = body.briefToken;
        httpTokenHashes.push(hashBriefToken(briefTokenA, SECRET));
        const row = await first(db.select().from(qGuestBriefs).where(eq(qGuestBriefs.tokenHash, hashBriefToken(briefTokenA, SECRET))));
        assert(row, 'brief row missing after create');
        briefIdA = row.id;
        const keys = Object.keys(row.payload as Record<string, unknown>).sort();
        assert(JSON.stringify(keys) === JSON.stringify(['answers', 'businessSummary', 'clientMetadata', 'prefill', 'recommendation', 'version']), `unexpected payload keys: ${keys.join(',')}`);
    });

    await check('03: create for a non-restaurant business type → 422 not_implemented', async () => {
        const response = await createBriefHttp('verify-visitor-03', validCreateBody({ businessType: 'retail' }));
        assert(response.status === 422, `expected 422, got ${response.status}`);
        const body = await response.json() as { error?: string; message?: string };
        assert(body.error === 'not_implemented', `expected not_implemented, got ${body.error}`);
        assert(body.message === 'Only the Restaurant workspace is supported for Q-guided setup right now.', 'not_implemented message mismatch');
    });

    await check('04: create with trusted-layer fields → 422 invalid_payload, zero side effects', async () => {
        const briefsBefore = (await db.select({ id: qGuestBriefs.id }).from(qGuestBriefs)).length;
        for (const field of ['businessId', 'role', 'destination']) {
            const response = await createBriefHttp(`verify-visitor-04-${field}`, validCreateBody({ [field]: 'smuggle' }));
            assert(response.status === 422, `${field}: expected 422, got ${response.status}`);
            assert((await response.json() as { error?: string }).error === 'invalid_payload', `${field}: expected invalid_payload`);
        }
        const briefsAfter = (await db.select({ id: qGuestBriefs.id }).from(qGuestBriefs)).length;
        assert(briefsAfter === briefsBefore, 'a brief row was created from a forbidden-field request');
        const business = await first(db.select().from(businesses).where(eq(businesses.id, BIZ_A)));
        assert(business?.name === 'Qbrief A' && !business.country, 'businesses mutated by rejected create');
        const user = await first(db.select().from(users).where(eq(users.id, USER_A)));
        assert(user?.onboardingCompleted === false && !user.segment, 'users mutated by rejected create');
    });

    await check('05: claim requires a JWT (401); malformed token → 400 invalid_token pre-DB', async () => {
        const unauthenticated = await app.request('/api/q/guest-briefs/claim', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefToken: briefTokenA }),
        });
        assert(unauthenticated.status === 401, `expected 401, got ${unauthenticated.status}`);
        const briefsBefore = (await db.select({ id: qGuestBriefs.id }).from(qGuestBriefs)).length;
        const malformed = await request(tokenA, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: 'not-a-valid-token' }) });
        assert(malformed.status === 400, `expected 400, got ${malformed.status}`);
        assert((await malformed.json() as { error?: string }).error === 'invalid_token', 'expected invalid_token');
        const briefsAfter = (await db.select({ id: qGuestBriefs.id }).from(qGuestBriefs)).length;
        assert(briefsAfter === briefsBefore, 'malformed claim touched the database');
    });

    await check('06: claim lifecycle (claimed / already_claimed / cross-user conflict / unknown token)', async () => {
        const claim = await request(tokenA, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: briefTokenA }) });
        assert(claim.status === 200, `claim returned ${claim.status}`);
        const claimBody = await claim.json() as { outcome?: string; brief?: { id: string; state: string } };
        assert(claimBody.outcome === 'claimed', `expected claimed, got ${claimBody.outcome}`);
        assert(claimBody.brief?.id === briefIdA && claimBody.brief.state === 'claimed', 'brief view mismatch');
        assert(!('tokenHash' in (claimBody.brief as unknown as Record<string, unknown>)), 'brief view leaks tokenHash');

        const retry = await request(tokenA, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: briefTokenA }) });
        assert(retry.status === 200 && (await retry.json() as { outcome?: string }).outcome === 'already_claimed', 'same-user retry not idempotent');

        const other = await request(tokenB, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: briefTokenA }) });
        assert(other.status === 409 && (await other.json() as { error?: string }).error === 'brief_conflict', 'cross-user claim should conflict');

        const unknown = await request(tokenB, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: generateBriefToken() }) });
        assert(unknown.status === 404 && (await unknown.json() as { error?: string }).error === 'brief_not_found', 'unknown token should be brief_not_found');
    });

    await check('07: claiming an expired brief → 410 expired (transition persisted)', async () => {
        const rawToken = generateBriefToken();
        const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const created = await createGuestBrief({ rawToken, payload: servicePayload(), visitorKeyHash: null }, { tokenSecret: SECRET, now: () => past });
        assert(created.ok, 'setup create failed');
        serviceBriefIds.push(created.briefId);
        const claim = await request(tokenA, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: rawToken }) });
        assert(claim.status === 410, `expected 410, got ${claim.status}`);
        assert((await claim.json() as { error?: string }).error === 'expired', 'expected expired');
        const row = await first(db.select().from(qGuestBriefs).where(eq(qGuestBriefs.id, created.briefId)));
        assert(row?.state === 'expired', `expiry not persisted (state=${row?.state})`);
    });

    await check('08: GET current is scoped to the authenticated user', async () => {
        const mine = await request(tokenA, '/api/q/guest-briefs/current');
        assert(mine.status === 200, `expected 200, got ${mine.status}`);
        assert((await mine.json() as { brief?: { id: string } | null }).brief?.id === briefIdA, 'user A should see the claimed brief');
        const other = await request(tokenB, '/api/q/guest-briefs/current');
        assert(other.status === 200 && (await other.json() as { brief?: unknown }).brief === null, 'user B must see null');
    });

    await check('09: confirm provisions the restaurant workspace end-to-end', async () => {
        const confirm = await request(tokenA, '/api/q/guest-briefs/current/confirm', {
            method: 'POST', body: JSON.stringify({ acceptedFields: ['businessName', 'country', 'currency'] }),
        });
        assert(confirm.status === 200, `confirm returned ${confirm.status}`);
        const body = await confirm.json() as Record<string, unknown>;
        assert(body.success === true && body.outcome === 'confirmed', `unexpected confirm body ${JSON.stringify(body)}`);
        assert(body.workspace === 'restaurant' && body.destination === '/app/restaurant', 'workspace/destination mismatch');
        assert(body.tablesEnsured === 3 && body.tablesCreated === 3, `table counts ${body.tablesEnsured}/${body.tablesCreated}`);
        assert(!('businessId' in body), 'response must not contain businessId');

        const user = await first(db.select().from(users).where(eq(users.id, USER_A)));
        assert(user?.segment === 'restaurant' && user.onboardingCompleted === true, 'user onboarding state not updated');
        assert(user.primaryWorkspace === '/app/restaurant' && user.userType === 'sme', 'user workspace/userType mismatch');
        assert(user.businessName === 'Verify Bistro' && user.country === 'Germany' && user.currency === 'EUR', 'user profile fields mismatch');
        assert(user.role === 'owner', 'user should own the workspace');

        const business = await first(db.select().from(businesses).where(eq(businesses.id, BIZ_A)));
        assert(business?.name === 'Verify Bistro' && business.country === 'Germany' && business.currency === 'EUR', 'business locale mismatch');
        assert(business.restaurantType === 'both' && business.type === 'restaurant' && business.ownerUserId === USER_A, 'business type/ownership mismatch');

        const tables = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, BIZ_A));
        assert(tables.length === 3, `expected exactly 3 tables, got ${tables.length}`);
        for (const label of ['Table 1', 'Table 2', 'Table 3']) {
            const row = tables.find(table => table.label === label);
            assert(row && row.capacity === 4 && row.status === 'available', `table ${label} mismatch`);
        }

        const memories = await db.select().from(qBusinessMemories).where(eq(qBusinessMemories.businessId, BIZ_A));
        assert(memories.length === 1, `expected one memory row, got ${memories.length}`);
        assert(memories[0].ownerSummary?.includes('Verify Bistro'), 'memory summary missing the business name');

        const conversation = await first(db.select().from(qAssistantConversations).where(eq(qAssistantConversations.id, `qconv_onboarding_${BIZ_A}`)));
        assert(conversation, 'welcome conversation missing');
        const messages = await db.select().from(qAssistantMessages).where(eq(qAssistantMessages.conversationId, conversation.id));
        assert(messages.length === 1 && messages[0].role === 'assistant', 'welcome message mismatch');

        const audits = await db.select().from(auditLogs).where(eq(auditLogs.businessId, BIZ_A));
        const confirmedAudit = audits.find(entry => entry.action === 'Q_GUEST_BRIEF_CONFIRMED');
        const provisionedAudit = audits.find(entry => entry.action === 'Q_WORKSPACE_PROVISIONED');
        assert(confirmedAudit && provisionedAudit, 'audit rows missing');
        assert(!JSON.stringify(confirmedAudit.details).includes(briefTokenA), 'token leaked into Q_GUEST_BRIEF_CONFIRMED details');
        assert(!JSON.stringify(provisionedAudit.details).includes(briefTokenA), 'token leaked into Q_WORKSPACE_PROVISIONED details');
    });

    await check('10: confirm replay with the same fields → 200 already_confirmed, zero duplication', async () => {
        const replay = await request(tokenA, '/api/q/guest-briefs/current/confirm', {
            method: 'POST', body: JSON.stringify({ acceptedFields: ['businessName', 'country', 'currency'] }),
        });
        assert(replay.status === 200, `replay returned ${replay.status}`);
        const body = await replay.json() as Record<string, unknown>;
        assert(body.success === true && body.outcome === 'already_confirmed', `expected already_confirmed, got ${JSON.stringify(body)}`);
        assert(body.tablesCreated === 0 && body.tablesEnsured === 3, 'replay must not create tables');
        const tables = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, BIZ_A));
        assert(tables.length === 3, 'replay duplicated tables');
        const memories = await db.select().from(qBusinessMemories).where(eq(qBusinessMemories.businessId, BIZ_A));
        assert(memories.length === 1, 'replay duplicated the memory row');
        const named = await db.select().from(businesses).where(eq(businesses.name, 'Verify Bistro'));
        assert(named.length === 1, 'replay created a new business');
    });

    await check('11: confirm with different fields after confirmation → 409 brief_conflict', async () => {
        const conflict = await request(tokenA, '/api/q/guest-briefs/current/confirm', {
            method: 'POST', body: JSON.stringify({ acceptedFields: ['businessName'] }),
        });
        assert(conflict.status === 409, `expected 409, got ${conflict.status}`);
        assert((await conflict.json() as { error?: string }).error === 'brief_conflict', 'expected brief_conflict');
    });

    await check('12: user who completed onboarding elsewhere → 409 workspace_exists, brief untouched', async () => {
        const create = await createBriefHttp('verify-visitor-12', validCreateBody({ businessName: 'C Diner' }));
        assert(create.status === 201, `create returned ${create.status}`);
        const { briefToken } = await create.json() as { briefToken: string };
        httpTokenHashes.push(hashBriefToken(briefToken, SECRET));
        const claim = await request(tokenC, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken }) });
        assert(claim.status === 200, `claim returned ${claim.status}`);
        const briefId = (await claim.json() as { brief: { id: string } }).brief.id;
        const confirm = await request(tokenC, '/api/q/guest-briefs/current/confirm', {
            method: 'POST', body: JSON.stringify({ acceptedFields: ['businessName', 'country', 'currency'] }),
        });
        assert(confirm.status === 409, `expected 409, got ${confirm.status}`);
        assert((await confirm.json() as { error?: string }).error === 'workspace_exists', 'expected workspace_exists');
        const row = await first(db.select().from(qGuestBriefs).where(eq(qGuestBriefs.id, briefId)));
        assert(row?.state === 'claimed', `brief must stay claimable-state, got ${row?.state}`);
        const cTables = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, BIZ_C));
        assert(cTables.length === 0, 'workspace_exists path mutated tables');
    });

    await check('13: dismiss is idempotent and mutates no workspace state', async () => {
        const create = await createBriefHttp('verify-visitor-13', validCreateBody({ businessName: 'B Diner' }));
        assert(create.status === 201, `create returned ${create.status}`);
        const { briefToken } = await create.json() as { briefToken: string };
        httpTokenHashes.push(hashBriefToken(briefToken, SECRET));
        const claim = await request(tokenB, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken }) });
        assert(claim.status === 200, `claim returned ${claim.status}`);
        const dismiss = await request(tokenB, '/api/q/guest-briefs/current/dismiss', { method: 'POST', body: JSON.stringify({}) });
        assert(dismiss.status === 200 && (await dismiss.json() as { outcome?: string }).outcome === 'dismissed', 'dismiss failed');
        const again = await request(tokenB, '/api/q/guest-briefs/current/dismiss', { method: 'POST', body: JSON.stringify({}) });
        assert(again.status === 200 && (await again.json() as { outcome?: string }).outcome === 'no_active_brief', 'second dismiss should be no_active_brief');
        const user = await first(db.select().from(users).where(eq(users.id, USER_B)));
        assert(user?.onboardingCompleted === false && !user.segment, 'dismiss mutated user onboarding');
        const bTables = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, BIZ_B));
        assert(bTables.length === 0, 'dismiss mutated tables');
    });

    await check('14: provisioning fails closed for non-restaurant recommendations', async () => {
        const foreignBrief: QGuestBriefView = {
            id: 'gbr_verify_foreign',
            state: 'confirmed',
            payload: {
                version: 1,
                businessSummary: 'A retail shop.',
                recommendation: {
                    intent: 'create_workspace',
                    businessType: 'retail',
                    recommendedWorkspace: 'retail',
                    recommendedModules: [],
                    priorities: [],
                    rationale: 'n/a',
                    requiresApproval: true,
                },
                prefill: { businessName: 'Retail Co', country: 'Germany', currency: 'EUR' },
                answers: [{ question: 'business_type', answer: 'retail' }],
                clientMetadata: { createdFrom: 'guest_concierge' },
            },
            claimedByUserId: USER_B,
            claimedAt: new Date(),
            confirmedAt: new Date(),
            confirmedFields: ['businessName'],
            activeExpiresAt: new Date(),
            createdAt: new Date(),
        };
        const result = await provisionRestaurantWorkspaceFromBrief({ userId: USER_B, brief: foreignBrief });
        assert(!result.ok && result.code === 'not_implemented', `expected not_implemented, got ${result.ok ? 'ok' : result.code}`);
        // HTTP confirms can only emit the restaurant destination — asserted in
        // cases 09/10 (destination === '/app/restaurant' on every 200 body).
    });

    await check('15: the 6th brief create within the hour → 429 rate_limited', async () => {
        const visitor = 'verify-visitor-15';
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            const response = await createBriefHttp(visitor, validCreateBody());
            assert(response.status === 201, `attempt ${attempt} returned ${response.status}`);
            const body = await response.json() as { briefToken: string };
            httpTokenHashes.push(hashBriefToken(body.briefToken, SECRET));
        }
        const limited = await createBriefHttp(visitor, validCreateBody());
        assert(limited.status === 429, `6th create returned ${limited.status}`);
        const body = await limited.json() as { error?: string; retryAfterSeconds?: number };
        assert(body.error === 'rate_limited' && typeof body.retryAfterSeconds === 'number' && body.retryAfterSeconds >= 1, 'rate_limited body mismatch');
    });

    await check('17: concurrent confirmations for the same brief serialize and create exactly one workspace', async () => {
        const create = await createBriefHttp('verify-visitor-17', validCreateBody({ businessName: 'D Diner', tables: 4 }));
        assert(create.status === 201, `create returned ${create.status}`);
        const { briefToken } = await create.json() as { briefToken: string };
        httpTokenHashes.push(hashBriefToken(briefToken, SECRET));
        const claim = await request(tokenD, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken }) });
        assert(claim.status === 200, `claim returned ${claim.status}`);

        const body = JSON.stringify({ acceptedFields: ['businessName', 'country', 'currency'] });
        const [responseA, responseB] = await Promise.all([
            request(tokenD, '/api/q/guest-briefs/current/confirm', { method: 'POST', body }),
            request(tokenD, '/api/q/guest-briefs/current/confirm', { method: 'POST', body }),
        ]);
        assert(responseA.status === 200, `concurrent confirm A returned ${responseA.status}`);
        assert(responseB.status === 200, `concurrent confirm B returned ${responseB.status}`);
        const outcomeA = (await responseA.json() as { outcome?: string }).outcome;
        const outcomeB = (await responseB.json() as { outcome?: string }).outcome;
        assert(
            (outcomeA === 'confirmed' && outcomeB === 'already_confirmed')
            || (outcomeA === 'already_confirmed' && outcomeB === 'confirmed'),
            `expected one confirmed and one already_confirmed, got ${outcomeA}/${outcomeB}`,
        );

        const tables = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, BIZ_D));
        assert(tables.length === 4, `expected exactly 4 tables, got ${tables.length}`);
        const memories = await db.select().from(qBusinessMemories).where(eq(qBusinessMemories.businessId, BIZ_D));
        assert(memories.length === 1, `expected exactly one memory row, got ${memories.length}`);
        const conversation = await first(db.select().from(qAssistantConversations).where(eq(qAssistantConversations.id, `qconv_onboarding_${BIZ_D}`)));
        assert(conversation, 'expected exactly one welcome conversation');
        const messages = await db.select().from(qAssistantMessages).where(eq(qAssistantMessages.conversationId, `qconv_onboarding_${BIZ_D}`));
        assert(messages.length === 1, `expected exactly one welcome message, got ${messages.length}`);

        const user = await first(db.select().from(users).where(eq(users.id, USER_D)));
        assert(user?.onboardingCompleted === true && user.segment === 'restaurant', 'user was not onboarded');
    });

    await check('18: second claim while another unresolved brief exists → 409 unresolved_exists', async () => {
        const createA = await createBriefHttp('verify-visitor-18a', validCreateBody({ businessName: 'E Diner A' }));
        assert(createA.status === 201, `create A returned ${createA.status}`);
        const { briefToken: tokenA18 } = await createA.json() as { briefToken: string };
        httpTokenHashes.push(hashBriefToken(tokenA18, SECRET));
        const claimA = await request(tokenE, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: tokenA18 }) });
        assert(claimA.status === 200, `claim A returned ${claimA.status}`);

        const createB = await createBriefHttp('verify-visitor-18b', validCreateBody({ businessName: 'E Diner B' }));
        assert(createB.status === 201, `create B returned ${createB.status}`);
        const { briefToken: tokenB18 } = await createB.json() as { briefToken: string };
        httpTokenHashes.push(hashBriefToken(tokenB18, SECRET));
        const claimB = await request(tokenE, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken: tokenB18 }) });
        assert(claimB.status === 409, `second claim returned ${claimB.status}`);
        const body = await claimB.json() as { error?: string };
        assert(body.error === 'brief_unresolved_exists', `expected brief_unresolved_exists, got ${body.error}`);

        const rowA = await first(db.select().from(qGuestBriefs).where(eq(qGuestBriefs.tokenHash, hashBriefToken(tokenA18, SECRET))));
        assert(rowA?.state === 'claimed' && rowA.claimedByUserId === USER_E, 'first brief should remain claimed by user E');
        const rowB = await first(db.select().from(qGuestBriefs).where(eq(qGuestBriefs.tokenHash, hashBriefToken(tokenB18, SECRET))));
        assert(rowB?.state === 'active', 'second brief should stay active');
    });

    await check('19: confirm of a lazily expired claimed brief → 410 expired', async () => {
        const create = await createBriefHttp('verify-visitor-19', validCreateBody({ businessName: 'F Diner' }));
        assert(create.status === 201, `create returned ${create.status}`);
        const { briefToken } = await create.json() as { briefToken: string };
        httpTokenHashes.push(hashBriefToken(briefToken, SECRET));
        const claim = await request(tokenF, '/api/q/guest-briefs/claim', { method: 'POST', body: JSON.stringify({ briefToken }) });
        assert(claim.status === 200, `claim returned ${claim.status}`);
        const briefId = (await claim.json() as { brief: { id: string } }).brief.id;

        const expiredClaimedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        await db.update(qGuestBriefs)
            .set({ claimedAt: expiredClaimedAt, stateUpdatedAt: expiredClaimedAt })
            .where(eq(qGuestBriefs.id, briefId));

        const confirm = await request(tokenF, '/api/q/guest-briefs/current/confirm', {
            method: 'POST', body: JSON.stringify({ acceptedFields: ['businessName', 'country', 'currency'] }),
        });
        assert(confirm.status === 410, `expected 410, got ${confirm.status}`);
        assert((await confirm.json() as { error?: string }).error === 'expired', 'expected expired');
        const row = await first(db.select().from(qGuestBriefs).where(eq(qGuestBriefs.id, briefId)));
        assert(row?.state === 'expired', `lazy expiry not persisted (state=${row?.state})`);
        const fTables = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, BIZ_F));
        assert(fTables.length === 0, 'expired confirm mutated tables');
    });

    await check('20: confirm after dismissal → 409 invalid_state, no workspace mutation', async () => {
        // USER_B dismissed their brief in case 13; the brief row is terminal.
        const confirm = await request(tokenB, '/api/q/guest-briefs/current/confirm', {
            method: 'POST', body: JSON.stringify({ acceptedFields: ['businessName', 'country', 'currency'] }),
        });
        assert(confirm.status === 409, `expected 409, got ${confirm.status}`);
        const body = await confirm.json() as { error?: string };
        assert(body.error === 'invalid_state', `expected invalid_state, got ${body.error}`);
        const bTables = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, BIZ_B));
        assert(bTables.length === 0, 'dismissed confirm mutated tables');
    });

    await check('16: login/auth path stays independent of the guest-brief feature', () => {
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
        const authRoute = readFileSync(path.join(root, 'src', 'routes', 'auth.ts'), 'utf8');
        const authMiddleware = readFileSync(path.join(root, 'src', 'middleware', 'auth.ts'), 'utf8');
        for (const [label, source] of [['auth.ts', authRoute], ['middleware/auth.ts', authMiddleware]] as const) {
            assert(!/guestBrief|guest_brief|qGuestBrief/i.test(source), `${label} references the guest-brief feature — login independence violated`);
        }
    });
} catch (error) {
    results.push({ name: '(harness)', passed: false, detail: error instanceof Error ? error.message : String(error) });
} finally {
    await cleanup();
    await closeDatabase();
}

const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({
    script: 'verify:q-guest-brief-routes',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
}, null, 2));

if (failed.length > 0) {
    console.error(`Q guest-brief routes verification failed: ${failed.length} case(s) failed.`);
    process.exitCode = 1;
} else {
    console.log('Q guest-brief routes verification passed.');
}
