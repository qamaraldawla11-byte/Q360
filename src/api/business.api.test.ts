import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import axios from 'axios';
import { businessApi, type BusinessModule } from './business.api.ts';

type SharedModuleResponse = { workspaceKey: string; modules: BusinessModule[] };

const fakeModule: BusinessModule = {
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

const mockClient = (response: () => Promise<SharedModuleResponse>) => ({
    get: async <T>() => response() as Promise<T>,
});

describe('getSharedModules compatibility fallback', () => {
    it('returns an empty shared result for the exact pre-R5 400 Unsupported workspace response', async () => {
        const error = makeAxiosError(400, { error: 'Unsupported workspace' });
        const result = await businessApi.getSharedModules(mockClient(() => Promise.reject(error)));
        assert.deepStrictEqual(result, { workspaceKey: 'shared', modules: [] });
    });

    it('propagates unrelated 400 responses', async () => {
        const error = makeAxiosError(400, { error: 'Bad request' });
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => axios.isAxiosError(err) && err.response?.status === 400 && err.response.data?.error === 'Bad request',
        );
    });

    it('propagates 401 authentication failures', async () => {
        const error = makeAxiosError(401, { error: 'Unauthorized' }, 'ERR_UNAUTHORIZED');
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => axios.isAxiosError(err) && err.response?.status === 401,
        );
    });

    it('propagates 403 authorization failures', async () => {
        const error = makeAxiosError(403, { error: 'Forbidden' }, 'ERR_FORBIDDEN');
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => axios.isAxiosError(err) && err.response?.status === 403,
        );
    });

    it('propagates 500 server failures', async () => {
        const error = makeAxiosError(500, { error: 'Internal server error' }, 'ERR_BAD_RESPONSE');
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => axios.isAxiosError(err) && err.response?.status === 500,
        );
    });

    it('propagates network errors', async () => {
        const error = new axios.AxiosError('Network Error', 'ERR_NETWORK');
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => axios.isAxiosError(err) && err.code === 'ERR_NETWORK',
        );
    });

    it('propagates malformed responses', async () => {
        const error = new TypeError('Unexpected token < in JSON at position 0');
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => err instanceof TypeError,
        );
    });

    it('returns successful shared-module responses unchanged', async () => {
        const success: SharedModuleResponse = { workspaceKey: 'shared', modules: [fakeModule] };
        const result = await businessApi.getSharedModules(mockClient(() => Promise.resolve(success)));
        assert.deepStrictEqual(result, success);
    });
});

describe('isUnsupportedWorkspaceError shape', () => {
    it('does not fallback when the 400 body has the wrong error text', async () => {
        const error = makeAxiosError(400, { error: 'Unsupported workspace ' });
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => axios.isAxiosError(err) && err.response?.data?.error === 'Unsupported workspace ',
        );
    });

    it('does not fallback when the 400 body has the wrong shape', async () => {
        const error = makeAxiosError(400, { message: 'Unsupported workspace' });
        await assert.rejects(
            () => businessApi.getSharedModules(mockClient(() => Promise.reject(error))),
            (err) => axios.isAxiosError(err) && err.response?.data?.message === 'Unsupported workspace',
        );
    });
});
