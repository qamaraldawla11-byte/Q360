import { strict as assert } from 'node:assert';
import { getQProviderStatus } from '../services/qProviderConfig.js';

const rulesOnly = getQProviderStatus(0, {});
assert.equal(rulesOnly.mode, 'rules_only');
assert.equal(rulesOnly.externalModelEnabled, false);

const active = getQProviderStatus(1.25, {
    OPENAI_API_KEY: 'test-key-not-a-real-secret',
});
assert.equal(active.mode, 'model_active');
assert.equal(active.externalModelEnabled, true);
assert.equal(active.model, 'gpt-5.4-mini');
assert.equal(active.budgetRemainingUsd, 3.75);

const disabled = getQProviderStatus(0, {
    OPENAI_API_KEY: 'test-key-not-a-real-secret',
    Q_AI_EXTERNAL_ENABLED: 'false',
});
assert.equal(disabled.mode, 'rules_only');
assert.equal(disabled.externalModelEnabled, false);

const capped = getQProviderStatus(5, {
    OPENAI_API_KEY: 'test-key-not-a-real-secret',
});
assert.equal(capped.mode, 'budget_reached');
assert.equal(capped.externalModelEnabled, false);
assert.match(capped.message, /budget has been reached/i);

const unsupported = getQProviderStatus(0, {
    Q_AI_PROVIDER: 'gemini',
    OPENAI_API_KEY: 'test-key-not-a-real-secret',
});
assert.equal(unsupported.configured, false);
assert.match(unsupported.message, /supports OpenAI only/i);

console.log('Q provider configuration safety checks passed.');
