export type QProvider = 'openai' | 'kimi' | 'q360-rules-v1';

export type QProviderCallResult = {
    text: string;
    provider: QProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsdMicros: number;
};

export type QProviderCallOptions = {
    provider: QProvider;
    baseUrl?: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens: number;
};

const REQUEST_TIMEOUT_MS = 12_000;

const asNonNegativeNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

// OpenAI gpt-5.4-mini standard prices in USD per 1M tokens.
const OPENAI_INPUT_USD_PER_1M = 0.75;
const OPENAI_OUTPUT_USD_PER_1M = 4.5;

// Kimi/Moonshot defaults can be overridden via env if the owner negotiates
// different rates. These conservative defaults match the Moonshot v1 8k
// tier and keep the budget guard provider-neutral.
const KIMI_INPUT_USD_PER_1M = 0.5;
const KIMI_OUTPUT_USD_PER_1M = 2.0;

export const estimateQProviderCostUsdMicros = (
    provider: QProvider,
    inputTokens: number,
    outputTokens: number,
) => {
    const input = asNonNegativeNumber(inputTokens);
    const output = asNonNegativeNumber(outputTokens);
    if (provider === 'openai') {
        return Math.round(input * OPENAI_INPUT_USD_PER_1M + output * OPENAI_OUTPUT_USD_PER_1M);
    }
    const inputRate = Number(process.env.Q_AI_COST_INPUT_PER_1M_USD) || KIMI_INPUT_USD_PER_1M;
    const outputRate = Number(process.env.Q_AI_COST_OUTPUT_PER_1M_USD) || KIMI_OUTPUT_USD_PER_1M;
    return Math.round(input * inputRate + output * outputRate);
};

const clip = (value: string, limit: number) => value.replace(/\s+/g, ' ').trim().slice(0, limit);

const extractOpenAIResponseText = (payload: Record<string, unknown>) => {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const output = Array.isArray(payload.output) ? payload.output : [];
    const parts: string[] = [];
    for (const item of output) {
        if (!item || typeof item !== 'object') continue;
        const content = Array.isArray((item as { content?: unknown }).content)
            ? (item as { content: unknown[] }).content
            : [];
        for (const entry of content) {
            if (!entry || typeof entry !== 'object') continue;
            const text = (entry as { text?: unknown }).text;
            if (typeof text === 'string') parts.push(text);
        }
    }
    return parts.join('\n').trim();
};

const extractKimiResponseText = (payload: Record<string, unknown>) => {
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const first = choices[0];
    if (!first || typeof first !== 'object') return '';
    const message = (first as { message?: unknown }).message;
    if (!message || typeof message !== 'object') return '';
    const content = (message as { content?: unknown }).content;
    return typeof content === 'string' ? content.trim() : '';
};

type ProviderFailureCategory =
    | 'authentication_error'
    | 'invalid_request'
    | 'rate_limited'
    | 'provider_server_error'
    | 'provider_http_error'
    | 'timeout'
    | 'network_error'
    | 'provider_exception'
    | 'missing_content';

const categoryForHttpStatus = (status: number): ProviderFailureCategory => {
    if (status === 401 || status === 403) return 'authentication_error';
    if (status === 400 || status === 404 || status === 422) return 'invalid_request';
    if (status === 429) return 'rate_limited';
    if (status >= 500 && status < 600) return 'provider_server_error';
    return 'provider_http_error';
};

const categoryForException = (error: unknown): ProviderFailureCategory => {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        return 'timeout';
    }
    if (error instanceof TypeError) return 'network_error';
    return 'provider_exception';
};

type ProviderFailureLog = {
    event: 'Q_PROVIDER_REQUEST_FAILED' | 'Q_PROVIDER_INVALID_RESPONSE';
    provider: QProvider;
    model: string;
    httpStatus?: number;
    category: ProviderFailureCategory;
    durationMs: number;
};

const logProviderFailure = (details: ProviderFailureLog) => {
    console.error(JSON.stringify(details));
};

/**
 * Shared, server-only provider caller. No API key is ever returned to the
 * frontend; the normalized result is provider-agnostic and safe to log or
 * persist in q_usage_events.
 */
export const callQProvider = async (options: QProviderCallOptions): Promise<QProviderCallResult | null> => {
    const { provider, apiKey, model, systemPrompt, userPrompt, maxOutputTokens } = options;
    if (provider === 'q360-rules-v1') return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const requestStartedAt = Date.now();

    try {
        if (provider === 'kimi') {
            const baseUrl = options.baseUrl?.trim() || 'https://api.moonshot.ai/v1';
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: clip(systemPrompt, 8_000) },
                        { role: 'user', content: clip(userPrompt, 12_000) },
                    ],
                    max_tokens: maxOutputTokens,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                logProviderFailure({
                    event: 'Q_PROVIDER_REQUEST_FAILED',
                    provider,
                    model,
                    httpStatus: response.status,
                    category: categoryForHttpStatus(response.status),
                    durationMs: Date.now() - requestStartedAt,
                });
                return null;
            }
            const payload = (await response.json()) as Record<string, unknown>;
            const text = clip(extractKimiResponseText(payload), 2_000);
            if (!text) {
                logProviderFailure({
                    event: 'Q_PROVIDER_INVALID_RESPONSE',
                    provider,
                    model,
                    category: 'missing_content',
                    durationMs: Date.now() - requestStartedAt,
                });
            }
            const usage = payload.usage && typeof payload.usage === 'object' ? (payload.usage as Record<string, unknown>) : {};
            const inputTokens = asNonNegativeNumber(usage.prompt_tokens);
            const outputTokens = asNonNegativeNumber(usage.completion_tokens);
            return {
                text,
                provider,
                model,
                inputTokens,
                outputTokens,
                estimatedCostUsdMicros: estimateQProviderCostUsdMicros(provider, inputTokens, outputTokens),
            };
        }

        // Default to OpenAI Responses API to preserve existing behaviour.
        const baseUrl = options.baseUrl?.trim() || 'https://api.openai.com/v1';
        const response = await fetch(`${baseUrl}/responses`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                instructions: clip(systemPrompt, 8_000),
                input: clip(userPrompt, 12_000),
                max_output_tokens: maxOutputTokens,
                store: false,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            logProviderFailure({
                event: 'Q_PROVIDER_REQUEST_FAILED',
                provider,
                model,
                httpStatus: response.status,
                category: categoryForHttpStatus(response.status),
                durationMs: Date.now() - requestStartedAt,
            });
            return null;
        }
        const payload = (await response.json()) as Record<string, unknown>;
        const text = clip(extractOpenAIResponseText(payload), 2_000);
        if (!text) {
            logProviderFailure({
                event: 'Q_PROVIDER_INVALID_RESPONSE',
                provider,
                model,
                category: 'missing_content',
                durationMs: Date.now() - requestStartedAt,
            });
        }
        const usage = payload.usage && typeof payload.usage === 'object' ? (payload.usage as Record<string, unknown>) : {};
        const inputTokens = asNonNegativeNumber(usage.input_tokens);
        const outputTokens = asNonNegativeNumber(usage.output_tokens);
        return {
            text,
            provider,
            model,
            inputTokens,
            outputTokens,
            estimatedCostUsdMicros: estimateQProviderCostUsdMicros(provider, inputTokens, outputTokens),
        };
    } catch (error) {
        logProviderFailure({
            event: 'Q_PROVIDER_REQUEST_FAILED',
            provider,
            model,
            category: categoryForException(error),
            durationMs: Date.now() - requestStartedAt,
        });
        return null;
    } finally {
        clearTimeout(timeout);
    }
};
