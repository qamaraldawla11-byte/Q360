import { strict as assert } from 'node:assert';
import { getQProviderStatus } from '../services/qProviderConfig.js';

const environmentKeys = ['Q_AI_PROVIDER', 'Q_AI_API_KEY', 'OPENAI_API_KEY', 'Q_AI_EXTERNAL_ENABLED', 'Q_EXTERNAL_ENABLED', 'Q_MONTHLY_BUDGET_USD'];
const previousEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

const setEnvironment = (values: Record<string, string | undefined>) => {
    for (const key of environmentKeys) delete process.env[key];
    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined) process.env[key] = value;
    }
};

const restoreEnvironment = () => {
    for (const key of environmentKeys) {
        const value = previousEnvironment[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
};

try {
    setEnvironment({});
    const rulesOnly = getQProviderStatus(0, {});
    assert.equal(rulesOnly.mode, 'rules_only');
    assert.equal(rulesOnly.externalModelEnabled, false);
    assert.equal(rulesOnly.provider, 'q360-rules-v1');

    setEnvironment({ OPENAI_API_KEY: 'test-key-not-a-real-secret' });
    const active = getQProviderStatus(1.25);
    assert.equal(active.mode, 'model_active');
    assert.equal(active.externalModelEnabled, true);
    assert.equal(active.model, 'gpt-5.4-mini');
    assert.equal(active.budgetRemainingUsd, 3.75);

    setEnvironment({ OPENAI_API_KEY: 'test-key-not-a-real-secret', Q_AI_EXTERNAL_ENABLED: 'false' });
    const disabled = getQProviderStatus(0);
    assert.equal(disabled.mode, 'rules_only');
    assert.equal(disabled.externalModelEnabled, false);

    setEnvironment({ OPENAI_API_KEY: 'test-key-not-a-real-secret', Q_EXTERNAL_ENABLED: 'false' });
    const legacyDisabled = getQProviderStatus(0);
    assert.equal(legacyDisabled.mode, 'rules_only');
    assert.equal(legacyDisabled.externalModelEnabled, false);

    setEnvironment({ OPENAI_API_KEY: 'test-key-not-a-real-secret' });
    const capped = getQProviderStatus(5);
    assert.equal(capped.mode, 'budget_reached');
    assert.equal(capped.externalModelEnabled, false);
    assert.match(capped.message, /budget has been reached/i);

    setEnvironment({ Q_AI_PROVIDER: 'gemini', OPENAI_API_KEY: 'test-key-not-a-real-secret' });
    const unsupported = getQProviderStatus(0);
    assert.equal(unsupported.configured, false);
    assert.match(unsupported.message, /supports OpenAI and Kimi only/i);

    setEnvironment({ Q_AI_PROVIDER: 'kimi', Q_AI_API_KEY: 'test-kimi-key-not-a-real-secret' });
    const kimiActive = getQProviderStatus(0);
    assert.equal(kimiActive.mode, 'model_active');
    assert.equal(kimiActive.provider, 'kimi');
    assert.equal(kimiActive.model, 'moonshot-v1-8k');
    assert.equal(kimiActive.externalModelEnabled, true);

    setEnvironment({ Q_AI_PROVIDER: 'kimi' });
    const kimiWithoutKey = getQProviderStatus(0);
    assert.equal(kimiWithoutKey.configured, false);
    assert.equal(kimiWithoutKey.provider, 'q360-rules-v1');

    console.log('Q provider configuration safety checks passed.');
} finally {
    restoreEnvironment();
}
