/**
 * A2.1 verification: Q guest-brief contract and token primitives.
 *
 * Pure contract verification — no database, no network, no LLM. The module
 * under test (qGuestBrief.ts) is infrastructure-free, so this script proves
 * importability with DATABASE_URL and JWT_SECRET explicitly unset.
 */
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.JWT_SECRET;
if (process.env.DATABASE_URL !== undefined || process.env.JWT_SECRET !== undefined) {
    throw new Error('Environment sanitization failed: DATABASE_URL/JWT_SECRET must be unset for this verification.');
}

const {
    BRIEF_TOKEN_BYTES,
    Q_GUEST_BRIEF_LIMITS,
    Q_GUEST_BRIEF_PAYLOAD_VERSION,
    BRIEF_SECRET_MIN_BYTES,
    briefTokenHashesEqual,
    generateBriefToken,
    hashBriefToken,
    isBriefTokenShape,
    toBriefTokenRecord,
    validateGuestBriefPayload,
} = await import('../services/qGuestBrief.js');

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

const VALID_RECOMMENDATION = {
    intent: 'create_workspace',
    businessType: 'Family restaurant with dine-in and takeaway',
    recommendedWorkspace: 'restaurant',
    recommendedModules: ['pos', 'kds', 'menu'],
    priorities: ['Take orders faster'],
    rationale: 'Dine-in service with a kitchen.',
    requiresApproval: true,
};

const minimalPayload = () => ({
    version: Q_GUEST_BRIEF_PAYLOAD_VERSION,
    businessSummary: 'A family restaurant with 12 tables, dine-in and takeaway.',
    recommendation: VALID_RECOMMENDATION,
});

const completePayload = () => ({
    ...minimalPayload(),
    prefill: { businessName: 'Mama Rosa', country: 'Germany', currency: 'EUR' },
    answers: [
        { question: 'How many locations?', answer: 'One' },
        { question: 'Biggest priority?', answer: 'Faster order taking' },
    ],
    clientMetadata: { createdFrom: 'guest_concierge', clientEventAt: '2026-07-19T01:00:00.000Z' },
});

// ---------------------------------------------------------------------------
// Import purity
// ---------------------------------------------------------------------------

check('import: contract module loads with DATABASE_URL and JWT_SECRET unset', () => {
    assert(process.env.DATABASE_URL === undefined, 'DATABASE_URL is set — import-purity proof invalid');
    assert(process.env.JWT_SECRET === undefined, 'JWT_SECRET is set — import-purity proof invalid');
    assert(typeof validateGuestBriefPayload === 'function', 'validateGuestBriefPayload not importable');
    assert(typeof generateBriefToken === 'function', 'generateBriefToken not importable');
});

// ---------------------------------------------------------------------------
// Payload validation — positive
// ---------------------------------------------------------------------------

check('positive: valid minimal payload validates', () => {
    const result = validateGuestBriefPayload(minimalPayload());
    assert(result.ok, `minimal payload rejected: ${JSON.stringify(!result.ok && result.errors)}`);
    assert(result.value.version === Q_GUEST_BRIEF_PAYLOAD_VERSION, 'version not preserved');
    assert(Array.isArray(result.value.answers) && result.value.answers.length === 0, 'answers should default to []');
    assert(result.value.clientMetadata.createdFrom === 'guest_concierge', 'clientMetadata default mismatch');
});

check('positive: valid complete payload validates', () => {
    const result = validateGuestBriefPayload(completePayload());
    assert(result.ok, `complete payload rejected: ${JSON.stringify(!result.ok && result.errors)}`);
    assert(result.value.prefill.businessName === 'Mama Rosa', 'prefill businessName lost');
    assert(result.value.answers.length === 2, 'answers lost');
    assert(result.value.clientMetadata.clientEventAt === '2026-07-19T01:00:00.000Z', 'clientEventAt lost');
});

check('positive: normalization trims text and omits blank optional fields', () => {
    const result = validateGuestBriefPayload({
        ...minimalPayload(),
        businessSummary: '   A family restaurant.   ',
        prefill: { businessName: '  Mama Rosa  ', country: '   ' },
    });
    assert(result.ok, `normalization payload rejected: ${JSON.stringify(!result.ok && result.errors)}`);
    assert(result.value.businessSummary === 'A family restaurant.', 'summary not trimmed');
    assert(result.value.prefill.businessName === 'Mama Rosa', 'businessName not trimmed');
    assert(!('country' in result.value.prefill), 'blank optional field should be omitted');
});

// ---------------------------------------------------------------------------
// Payload validation — negative
// ---------------------------------------------------------------------------

check('negative: version missing or wrong rejected', () => {
    const missing = validateGuestBriefPayload({ ...minimalPayload(), version: undefined });
    assert(!missing.ok && hasError(missing.errors, 'unsupported_version'), 'missing version not rejected');
    const wrong = validateGuestBriefPayload({ ...minimalPayload(), version: 2 });
    assert(!wrong.ok && hasError(wrong.errors, 'unsupported_version'), 'version 2 not rejected');
    const asString = validateGuestBriefPayload({ ...minimalPayload(), version: '1' });
    assert(!asString.ok && hasError(asString.errors, 'unsupported_version'), "string version '1' not rejected");
});

check('negative: unknown fields rejected at every level', () => {
    const top = validateGuestBriefPayload({ ...minimalPayload(), transcript: 'raw chat log' });
    assert(!top.ok && hasError(top.errors, 'unknown_field'), 'unknown top-level field not rejected');
    const prefill = validateGuestBriefPayload({ ...minimalPayload(), prefill: { timezone: 'CET' } });
    assert(!prefill.ok && hasError(prefill.errors, 'unknown_field'), 'unknown prefill field not rejected');
    const answer = validateGuestBriefPayload({ ...minimalPayload(), answers: [{ question: 'q', answer: 'a', extra: 1 }] });
    assert(!answer.ok && hasError(answer.errors, 'unknown_field'), 'unknown answer field not rejected');
});

check('negative: oversized values and total payload rejected', () => {
    const longSummary = validateGuestBriefPayload({ ...minimalPayload(), businessSummary: 'x'.repeat(Q_GUEST_BRIEF_LIMITS.businessSummaryMax + 1) });
    assert(!longSummary.ok && hasError(longSummary.errors, 'value_too_long'), 'oversized summary not rejected');
    const longName = validateGuestBriefPayload({ ...minimalPayload(), prefill: { businessName: 'n'.repeat(Q_GUEST_BRIEF_LIMITS.businessNameMax + 1) } });
    assert(!longName.ok && hasError(longName.errors, 'value_too_long'), 'oversized business name not rejected');
    const longAnswer = validateGuestBriefPayload({ ...minimalPayload(), answers: [{ question: 'q', answer: 'a'.repeat(Q_GUEST_BRIEF_LIMITS.answerValueMax + 1) }] });
    assert(!longAnswer.ok && hasError(longAnswer.errors, 'value_too_long'), 'oversized answer not rejected');
});

check('negative: excessive answers rejected', () => {
    const answers = Array.from({ length: Q_GUEST_BRIEF_LIMITS.answersMax + 1 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` }));
    const result = validateGuestBriefPayload({ ...minimalPayload(), answers });
    assert(!result.ok && hasError(result.errors, 'too_many_answers'), 'excessive answers not rejected');
});

check('negative: tenant/business identity fields rejected', () => {
    for (const field of ['businessId', 'tenantId', 'userId', 'boundUserId']) {
        const result = validateGuestBriefPayload({ ...minimalPayload(), [field]: 'biz_main' });
        assert(!result.ok && hasError(result.errors, 'forbidden_field'), `${field} not rejected`);
    }
});

check('negative: trusted approval fields rejected', () => {
    for (const field of ['approvedAt', 'approvedBy']) {
        const result = validateGuestBriefPayload({ ...minimalPayload(), [field]: '2026-07-19T00:00:00Z' });
        assert(!result.ok && hasError(result.errors, 'forbidden_field'), `${field} not rejected`);
    }
});

check('negative: arbitrary route/destination rejected', () => {
    for (const field of ['destination', 'route', 'url']) {
        const result = validateGuestBriefPayload({ ...minimalPayload(), [field]: '/admin/users' });
        assert(!result.ok && hasError(result.errors, 'forbidden_field'), `${field} not rejected`);
    }
});

check('negative: unknown module in nested recommendation rejected', () => {
    const result = validateGuestBriefPayload({
        ...minimalPayload(),
        recommendation: { ...VALID_RECOMMENDATION, recommendedModules: ['pos', 'warp-drive'] },
    });
    assert(!result.ok && hasError(result.errors, 'unknown_module'), 'unknown module not rejected via A1 contract');
});

check('negative: unsafe characters and unsafe empty values rejected', () => {
    const control = validateGuestBriefPayload({ ...minimalPayload(), businessSummary: 'bad\u0007summary' });
    assert(!control.ok && hasError(control.errors, 'unsafe_characters'), 'control characters not rejected');
    const emptySummary = validateGuestBriefPayload({ ...minimalPayload(), businessSummary: '   ' });
    assert(!emptySummary.ok && hasError(emptySummary.errors, 'empty_value'), 'blank summary not rejected');
    const emptyAnswer = validateGuestBriefPayload({ ...minimalPayload(), answers: [{ question: 'q', answer: '  ' }] });
    assert(!emptyAnswer.ok && hasError(emptyAnswer.errors, 'empty_value'), 'blank answer not rejected');
});

// ---------------------------------------------------------------------------
// Token primitives
// ---------------------------------------------------------------------------

const TEST_SECRET = 'a2-1-verification-only-secret-32by';

check('token: entropy and transport shape', () => {
    const token = generateBriefToken();
    // base64url of 32 bytes → 43 chars, URL-safe alphabet only.
    assert(/^[A-Za-z0-9_-]{43}$/.test(token), `token shape unexpected: '${token}'`);
    assert(BRIEF_TOKEN_BYTES === 32, 'token entropy must be 256 bits');
});

check('token: uniqueness over a 1000-token sample', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateBriefToken()));
    assert(tokens.size === 1000, `collision in sample: ${1000 - tokens.size} duplicate(s)`);
});

check('token: deterministic hashing; different token or secret → different hash', () => {
    const token = generateBriefToken();
    const hashA = hashBriefToken(token, TEST_SECRET);
    const hashB = hashBriefToken(token, TEST_SECRET);
    assert(hashA === hashB, 'same token + secret must hash deterministically');
    assert(hashBriefToken(generateBriefToken(), TEST_SECRET) !== hashA, 'different token produced same hash');
    assert(hashBriefToken(token, `${TEST_SECRET}-other`) !== hashA, 'different secret produced same hash');
});

check('token: constant-time comparison accepts equal and rejects unequal', () => {
    const hashA = hashBriefToken(generateBriefToken(), TEST_SECRET);
    const hashACopy = `${hashA}`;
    const hashB = hashBriefToken(generateBriefToken(), TEST_SECRET);
    assert(briefTokenHashesEqual(hashA, hashACopy) === true, 'equal hashes not accepted');
    assert(briefTokenHashesEqual(hashA, hashB) === false, 'unequal hashes accepted');
    assert(briefTokenHashesEqual(hashA, hashA.slice(0, -2)) === false, 'length mismatch accepted');
});

check('token: serialized stored representation never contains the raw token', () => {
    const token = generateBriefToken();
    const record = toBriefTokenRecord(token, TEST_SECRET);
    const serialized = JSON.stringify(record);
    assert(!serialized.includes(token), 'raw token leaked into stored representation');
    assert(!('token' in record), 'stored record carries a raw token field');
    assert(typeof record.tokenHash === 'string' && record.tokenHash.length > 0, 'tokenHash missing');
});

// ---------------------------------------------------------------------------
// Currency hardening
// ---------------------------------------------------------------------------

check('currency: trims and normalizes to three uppercase ASCII letters', () => {
    const eur = validateGuestBriefPayload({ ...minimalPayload(), prefill: { currency: ' eur ' } });
    assert(eur.ok && eur.value.prefill.currency === 'EUR', `' eur ' did not normalize to 'EUR': ${JSON.stringify(!eur.ok && eur.errors)}`);
    const usd = validateGuestBriefPayload({ ...minimalPayload(), prefill: { currency: 'usd' } });
    assert(usd.ok && usd.value.prefill.currency === 'USD', 'lowercase valid currency rejected');
    const blank = validateGuestBriefPayload({ ...minimalPayload(), prefill: { currency: '   ' } });
    assert(blank.ok && !('currency' in blank.value.prefill), 'blank currency should be omitted, not rejected');
});

check('currency: malformed non-blank values rejected', () => {
    for (const bad of ['EU', 'EURO', '12A', '€€€', 'EU\u0007', 'e1u', 'US D']) {
        const result = validateGuestBriefPayload({ ...minimalPayload(), prefill: { currency: bad } });
        assert(!result.ok && hasError(result.errors, 'malformed'), `currency ${JSON.stringify(bad)} was not rejected`);
    }
});

// ---------------------------------------------------------------------------
// Token input & secret hardening
// ---------------------------------------------------------------------------

const expectThrow = (fn: () => unknown, label: string) => {
    let threw = false;
    try {
        fn();
    } catch {
        threw = true;
    }
    assert(threw, `${label} did not throw`);
};

check('token: malformed token input fails closed', () => {
    const valid = generateBriefToken();
    assert(isBriefTokenShape(valid), 'generated token fails its own shape check');
    const malformed: unknown[] = [
        'short',                                     // wrong length
        valid.slice(1),                              // 42 chars
        `${valid}x`,                                 // 44 chars
        `${valid.slice(0, 42)}=`,                    // '=' padding
        `${valid.slice(0, 20)} ${valid.slice(21)}`,  // embedded whitespace
        ` ${valid}`,                                 // leading whitespace
        `${valid.slice(0, 10)}+${valid.slice(11)}`,  // non-base64url alphabet
        42, null, undefined, {},
    ];
    for (const bad of malformed) {
        assert(!isBriefTokenShape(bad), `shape check accepted ${JSON.stringify(bad)}`);
    }
    expectThrow(() => hashBriefToken('short', TEST_SECRET), 'hashBriefToken(short token)');
    expectThrow(() => hashBriefToken(`${valid.slice(0, 42)}=`, TEST_SECRET), 'hashBriefToken(padded token)');
    expectThrow(() => hashBriefToken(` ${valid}`, TEST_SECRET), 'hashBriefToken(whitespace token)');
    expectThrow(() => toBriefTokenRecord('not-a-token', TEST_SECRET), 'toBriefTokenRecord(malformed token)');
});

check('token: missing, empty, or too-short secret fails closed', () => {
    const token = generateBriefToken();
    expectThrow(() => hashBriefToken(token, undefined as never), 'missing secret');
    expectThrow(() => hashBriefToken(token, ''), 'empty secret');
    expectThrow(() => hashBriefToken(token, 'x'.repeat(BRIEF_SECRET_MIN_BYTES - 1)), 'short string secret');
    expectThrow(() => hashBriefToken(token, new Uint8Array(BRIEF_SECRET_MIN_BYTES - 1)), 'short binary secret');
    expectThrow(() => toBriefTokenRecord(token, 'tiny'), 'toBriefTokenRecord(short secret)');
    // Boundary: exactly 32 bytes works; string (UTF-8) and binary forms agree.
    const stringSecret = 's'.repeat(BRIEF_SECRET_MIN_BYTES);
    const binarySecret = new Uint8Array(BRIEF_SECRET_MIN_BYTES).fill(0x73); // 0x73 === 's'
    const viaString = hashBriefToken(token, stringSecret);
    assert(viaString === hashBriefToken(token, Buffer.from(stringSecret, 'utf8')), 'string and Buffer secrets must agree on identical bytes');
    assert(briefTokenHashesEqual(viaString, hashBriefToken(token, binarySecret)), 'Uint8Array secret produced a different hash');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({
    script: 'verify:q-guest-brief-contract',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
}, null, 2));

if (failed.length > 0) {
    console.error(`Q guest-brief contract verification failed: ${failed.length} case(s) failed.`);
    process.exitCode = 1;
} else {
    console.log('Q guest-brief contract verification passed.');
}
