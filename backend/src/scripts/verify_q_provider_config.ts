import { strict as assert } from 'node:assert';
import { getQProviderStatus } from '../services/qProviderConfig.js';

const rulesOnly = getQProviderStatus(0, {});
assert.equal(rulesOnly.mode, 'rules_only');
assert.equal(rulesOnly.externalModelEnabled, false);

const configuredButDisabled = getQProviderStatus(0, {
    Q_AI_PROVIDER: 'openai',
    Q_AI_MODEL: 'example-model',
    Q_AI_API_KEY: 'test-key-not-a-real-secret',
    Q_MONTHLY_BUDGET_USD: '10',
});
assert.equal(configuredButDisabled.mode, 'provider_ready');
assert.equal(configuredButDisabled.externalModelEnabled, false);

const enabled = getQProviderStatus(2.5, {
    Q_AI_PROVIDER: 'gemini',
    Q_AI_MODEL: 'example-model',
    Q_AI_API_KEY: 'test-key-not-a-real-secret',
    Q_AI_EXTERNAL_ENABLED: 'true',
    Q_MONTHLY_BUDGET_USD: '10',
});
assert.equal(enabled.externalModelEnabled, false);
assert.equal(enabled.externalModelRequested, true);
assert.equal(enabled.budgetRemainingUsd, 7.5);

const capped = getQProviderStatus(10, {
    Q_AI_PROVIDER: 'openai',
    Q_AI_MODEL: 'example-model',
    Q_AI_API_KEY: 'test-key-not-a-real-secret',
    Q_AI_EXTERNAL_ENABLED: 'true',
    Q_MONTHLY_BUDGET_USD: '10',
});
assert.equal(capped.externalModelEnabled, false);
assert.match(capped.message, /budget has been reached/i);

const unsupported = getQProviderStatus(0, {
    Q_AI_PROVIDER: 'unknown-provider',
    Q_AI_MODEL: 'example-model',
    Q_AI_API_KEY: 'test-key-not-a-real-secret',
});
assert.equal(unsupported.configured, false);
assert.match(unsupported.message, /supports only/i);

console.log('Q provider configuration safety checks passed.');
