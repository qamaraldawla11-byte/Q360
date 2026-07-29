import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import axios from 'axios';
import {
    isUnsupportedWorkspaceResponse,
    SHARED_MODULE_FALLBACK,
    withSharedModuleFallback,
} from './sharedModuleFallback.ts';

type SharedModuleResponse = { workspaceKey: string; modules: unknown[] };

const fakeModule = {
    moduleKey: 'customers',
    workspaceKey: 'shared',
    label: 'Customers',
    description: 'Shared customers',
    category: 'Core',
    enabled: true,
    configurable: true,
    availability: 'ready',
};

const makeAxiosError = (status: number, data: unknown, code = 'ERR_BAD_REQUEST') =>
    new axios.AxiosError('Request failed', code, undefined, undefined, {
        status,
        data,
        statusText: '',
        headers: {},
        config: {} as any,
    } as any);

describe('isUnsupportedWorkspaceResponse predicate', () => {
    it('matches the exact pre-R5 400 Unsupported workspace response', () => {
        const error = makeAxiosError(400, { error: 'Unsupported workspace' });
        assert.equal(isUnsupportedWorkspaceResponse(error), true);
    });

    it('rejects unrelated 400 responses', () => {
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, { error: 'Bad request' })), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, { error: 'Unsupported workspace ' })), false);
    });

    it('rejects 401, 403, 404, 409, and 500', () => {
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(401, { error: 'Unsupported workspace' })), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(403, { error: 'Unsupported workspace' })), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(404, { error: 'Unsupported workspace' })), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(409, { error: 'Unsupported workspace' })), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(500, { error: 'Unsupported workspace' })), false);
    });

    it('rejects network errors', () => {
        const error = new axios.AxiosError('Network Error', 'ERR_NETWORK');
        assert.equal(isUnsupportedWorkspaceResponse(error), false);
    });

    it('rejects timeout errors', () => {
        const error = new axios.AxiosError('Timeout', 'ETIMEDOUT');
        assert.equal(isUnsupportedWorkspaceResponse(error), false);
    });

    it('rejects malformed response bodies', () => {
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, { message: 'Unsupported workspace' })), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, ['Unsupported workspace'])), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, 'Unsupported workspace')), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, null)), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, undefined)), false);
    });

    it('rejects bodies with extra properties', () => {
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, { error: 'Unsupported workspace', extra: 'x' })), false);
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, { extra: 'x', error: 'Unsupported workspace' })), false);
    });

    it('rejects objects that inherit error without owning it', () => {
        const data = Object.create({ error: 'Unsupported workspace' });
        assert.equal(isUnsupportedWorkspaceResponse(makeAxiosError(400, data)), false);
    });
});

describe('withSharedModuleFallback wrapper', () => {
    it('returns an empty shared result for the exact pre-R5 400 Unsupported workspace response', async () => {
        const error = makeAxiosError(400, { error: 'Unsupported workspace' });
        const result = await withSharedModuleFallback(() => Promise.reject(error));
        assert.deepStrictEqual(result, SHARED_MODULE_FALLBACK);
    });

    it('propagates unrelated 400 responses', async () => {
        const error = makeAxiosError(400, { error: 'Bad request' });
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.response?.status === 400 && err.response.data?.error === 'Bad request',
        );
    });

    it('propagates 401 authentication failures', async () => {
        const error = makeAxiosError(401, { error: 'Unauthorized' }, 'ERR_UNAUTHORIZED');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.response?.status === 401,
        );
    });

    it('propagates 403 authorization failures', async () => {
        const error = makeAxiosError(403, { error: 'Forbidden' }, 'ERR_FORBIDDEN');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.response?.status === 403,
        );
    });

    it('propagates 404 not found', async () => {
        const error = makeAxiosError(404, { error: 'Not found' }, 'ERR_NOT_FOUND');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.response?.status === 404,
        );
    });

    it('propagates 409 conflicts', async () => {
        const error = makeAxiosError(409, { error: 'Conflict' }, 'ERR_CONFLICT');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.response?.status === 409,
        );
    });

    it('propagates 500 server failures', async () => {
        const error = makeAxiosError(500, { error: 'Internal server error' }, 'ERR_BAD_RESPONSE');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.response?.status === 500,
        );
    });

    it('propagates network errors', async () => {
        const error = new axios.AxiosError('Network Error', 'ERR_NETWORK');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.code === 'ERR_NETWORK',
        );
    });

    it('propagates timeout errors', async () => {
        const error = new axios.AxiosError('Timeout', 'ETIMEDOUT');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => axios.isAxiosError(err) && err.code === 'ETIMEDOUT',
        );
    });

    it('propagates malformed response objects', async () => {
        const error = new TypeError('Unexpected token < in JSON at position 0');
        await assert.rejects(
            () => withSharedModuleFallback(() => Promise.reject(error)),
            (err) => err instanceof TypeError,
        );
    });

    it('returns successful shared-module responses unchanged', async () => {
        const success: SharedModuleResponse = { workspaceKey: 'shared', modules: [fakeModule] };
        const result = await withSharedModuleFallback(() => Promise.resolve(success));
        assert.deepStrictEqual(result, success);
    });
});
