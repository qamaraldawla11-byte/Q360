import { strict as assert } from 'node:assert';
import { callQProvider } from '../services/qProviderClient.js';

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

const logs: unknown[] = [];

const captureLog = (...args: unknown[]) => {
    logs.push(args);
};

const clearLogs = () => {
    logs.length = 0;
};

const lastLog = (): Record<string, unknown> | undefined => {
    if (logs.length === 0) return undefined;
    const entry = logs[logs.length - 1];
    if (Array.isArray(entry) && entry.length === 1 && typeof entry[0] === 'string') {
        try {
            return JSON.parse(entry[0]) as Record<string, unknown>;
        } catch {
            return undefined;
        }
    }
    return undefined;
};

const assertNoSecrets = (log: Record<string, unknown>) => {
    const serialized = JSON.stringify(log);
    assert.equal(serialized.includes('test-api-key'), false, 'log must not contain API key');
    assert.equal(serialized.includes('Authorization'), false, 'log must not contain Authorization header');
    assert.equal(serialized.includes('system prompt'), false, 'log must not contain prompt content');
    assert.equal(serialized.includes('user prompt'), false, 'log must not contain prompt content');
    assert.equal(serialized.includes('raw response body'), false, 'log must not contain raw response body');
    assert.equal(log.body, undefined, 'log must not expose request body');
};

const makeCall = () => callQProvider({
    provider: 'kimi',
    apiKey: 'test-api-key',
    model: 'moonshot-v1-8k',
    systemPrompt: 'system prompt content',
    userPrompt: 'user prompt content',
    maxOutputTokens: 450,
});

try {
    console.error = captureLog;

    // 401 -> authentication_error
    clearLogs();
    globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });
    const unauthorized = await makeCall();
    assert.equal(unauthorized, null);
    const unauthorizedLog = lastLog();
    assert.equal(unauthorizedLog?.event, 'Q_PROVIDER_REQUEST_FAILED');
    assert.equal(unauthorizedLog?.provider, 'kimi');
    assert.equal(unauthorizedLog?.model, 'moonshot-v1-8k');
    assert.equal(unauthorizedLog?.httpStatus, 401);
    assert.equal(unauthorizedLog?.category, 'authentication_error');
    assert.equal(typeof unauthorizedLog?.durationMs, 'number');
    assertNoSecrets(unauthorizedLog as Record<string, unknown>);

    // 429 -> rate_limited
    clearLogs();
    globalThis.fetch = async () => new Response('Too Many Requests', { status: 429 });
    const rateLimited = await makeCall();
    assert.equal(rateLimited, null);
    const rateLimitedLog = lastLog();
    assert.equal(rateLimitedLog?.category, 'rate_limited');
    assertNoSecrets(rateLimitedLog as Record<string, unknown>);

    // 500 -> provider_server_error
    clearLogs();
    globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });
    const serverError = await makeCall();
    assert.equal(serverError, null);
    const serverErrorLog = lastLog();
    assert.equal(serverErrorLog?.category, 'provider_server_error');
    assertNoSecrets(serverErrorLog as Record<string, unknown>);

    // 418 -> provider_http_error (other non-2xx)
    clearLogs();
    globalThis.fetch = async () => new Response('I am a teapot', { status: 418 });
    const teapot = await makeCall();
    assert.equal(teapot, null);
    const teapotLog = lastLog();
    assert.equal(teapotLog?.category, 'provider_http_error');
    assertNoSecrets(teapotLog as Record<string, unknown>);

    // Thrown fetch error -> network_error
    clearLogs();
    globalThis.fetch = async () => {
        throw new TypeError('fetch failed');
    };
    const networkFailure = await makeCall();
    assert.equal(networkFailure, null);
    const networkLog = lastLog();
    assert.equal(networkLog?.event, 'Q_PROVIDER_REQUEST_FAILED');
    assert.equal(networkLog?.category, 'network_error');
    assertNoSecrets(networkLog as Record<string, unknown>);

    // Timeout (AbortError) -> timeout
    clearLogs();
    globalThis.fetch = async (_input, init) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
            if (signal) {
                const abort = () => {
                    const error = new DOMException('The operation was aborted.', 'AbortError');
                    reject(error);
                };
                if (signal.aborted) {
                    abort();
                    return;
                }
                signal.addEventListener('abort', abort, { once: true });
            }
        });
    };
    const timeoutFailure = await makeCall();
    assert.equal(timeoutFailure, null);
    const timeoutLog = lastLog();
    assert.equal(timeoutLog?.category, 'timeout');
    assertNoSecrets(timeoutLog as Record<string, unknown>);

    // 200 with empty content -> missing_content log but still returns result
    clearLogs();
    globalThis.fetch = async () => new Response(JSON.stringify({
        choices: [{ message: { content: '' } }],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    const emptySuccess = await makeCall();
    assert.notEqual(emptySuccess, null);
    assert.equal(emptySuccess?.text, '');
    const emptyLog = lastLog();
    assert.equal(emptyLog?.event, 'Q_PROVIDER_INVALID_RESPONSE');
    assert.equal(emptyLog?.category, 'missing_content');
    assertNoSecrets(emptyLog as Record<string, unknown>);

    // 200 with valid content -> no failure log
    clearLogs();
    globalThis.fetch = async () => new Response(JSON.stringify({
        choices: [{ message: { content: 'Kimi reply text' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    const validSuccess = await makeCall();
    assert.notEqual(validSuccess, null);
    assert.equal(validSuccess?.text, 'Kimi reply text');
    assert.equal(logs.length, 0, 'no failure log should be emitted for valid response');

    console.log(JSON.stringify({ status: 'PASS', checks: 8 }));
} catch (error) {
    console.error('Q provider diagnostics verification failed:', error);
    process.exitCode = 1;
} finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
}
