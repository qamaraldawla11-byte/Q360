import { strict as assert } from 'node:assert';
import { answerPublicConcierge } from '../services/qPublicConcierge.js';

const originalFetch = globalThis.fetch;
const environmentKeys = [
  'OPENAI_API_KEY',
  'Q_AI_API_KEY',
  'Q_AI_KEY',
  'Q_PUBLIC_AI_ENABLED',
  'Q_PUBLIC_OPENAI_MODEL',
  'Q_PUBLIC_AI_REQUESTS_PER_HOUR',
];
const previousEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));

try {
  process.env.OPENAI_API_KEY = 'verification-only-key';
  process.env.Q_PUBLIC_AI_ENABLED = 'true';
  process.env.Q_PUBLIC_OPENAI_MODEL = 'gpt-5.4-mini';
  process.env.Q_PUBLIC_AI_REQUESTS_PER_HOUR = '25';

  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        reply: 'Noor Cafe is a good start. Which country will it operate in?',
        updates: { businessType: 'cafe', businessName: 'Noor Cafe' },
        suggestedReplies: ['Egypt', 'Saudi Arabia'],
        recommendedModules: ['Dashboard', 'Sales', 'Menu', 'Q Assistant'],
        readyForSignIn: false,
      }),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const aiResult = await answerPublicConcierge({
    message: 'I run a cafe called Noor Cafe',
    visitorKey: 'public-q-ai-verifier',
  });

  assert.equal(aiResult.mode, 'ai');
  assert.equal(aiResult.updates.businessName, 'Noor Cafe');
  assert.equal(requestBody?.model, 'gpt-5.4-mini');
  assert.equal(requestBody?.store, false);
  assert.match(String(requestBody?.instructions), /do not access accounts/i);

  globalThis.fetch = (async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      reply: 'I am doing well, thank you. When you are ready, what kind of business do you run?',
      updates: { businessName: 'How are you' },
      suggestedReplies: ['Restaurant'],
      recommendedModules: ['Dashboard'],
      readyForSignIn: false,
    }),
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

  const casualAiResult = await answerPublicConcierge({
    message: 'How are you?',
    visitorKey: 'public-q-chat-verifier',
  });

  assert.equal(casualAiResult.mode, 'ai');
  assert.deepEqual(casualAiResult.updates, {});
  assert.match(casualAiResult.reply, /doing well/i);

  process.env.Q_PUBLIC_AI_ENABLED = 'false';
  const casualGuidedResult = await answerPublicConcierge({
    message: 'How are you?',
    visitorKey: 'public-q-guided-chat-verifier',
  });
  assert.equal(casualGuidedResult.mode, 'guided');
  assert.deepEqual(casualGuidedResult.updates, {});
  assert.match(casualGuidedResult.reply, /doing well/i);
  process.env.Q_PUBLIC_AI_ENABLED = 'true';

  globalThis.fetch = (async () => {
    throw new Error('verification network unavailable');
  }) as typeof fetch;

  const fallbackResult = await answerPublicConcierge({
    message: 'I run a restaurant with 4 tables',
    visitorKey: 'public-q-fallback-verifier',
  });

  assert.equal(fallbackResult.mode, 'guided');
  assert.equal(fallbackResult.updates.businessType, 'restaurant');
  assert.equal(fallbackResult.updates.tables, 4);

  console.log('Public Q Concierge verification passed: protected AI request and guided fallback both work.');
} finally {
  globalThis.fetch = originalFetch;
  for (const key of environmentKeys) {
    const previousValue = previousEnvironment.get(key);
    if (previousValue === undefined) delete process.env[key];
    else process.env[key] = previousValue;
  }
}
