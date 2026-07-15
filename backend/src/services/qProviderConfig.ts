type Environment = Record<string, string | undefined>;

export type QProviderStatus = {
    mode: 'rules_only' | 'model_active' | 'budget_reached';
    provider: 'openai' | 'q360-rules-v1';
    model: string;
    configured: boolean;
    externalModelEnabled: boolean;
    externalModelRequested: boolean;
    monthlyBudgetUsd: number;
    estimatedSpendUsd: number;
    budgetRemainingUsd: number;
    message: string;
};

const DEFAULT_MODEL = 'gpt-5.4-mini';
const DEFAULT_MONTHLY_BUDGET_USD = 5;
// Reserve a small amount so the final request cannot take a business over its cap.
const MIN_MODEL_CALL_BUDGET_USD = 0.02;

const positiveNumber = (value: string | undefined, fallback: number) => {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * Produces only safe-to-display provider state. API keys are deliberately not
 * returned from this module, logged, or exposed to the browser.
 */
export const getQProviderStatus = (
    estimatedSpendUsd: number,
    environment: Environment = process.env,
): QProviderStatus => {
    const requestedProvider = environment.Q_AI_PROVIDER?.trim().toLowerCase();
    const providerAllowed = !requestedProvider || requestedProvider === 'openai';
    const model = environment.Q_OPENAI_MODEL?.trim() || environment.Q_AI_MODEL?.trim() || DEFAULT_MODEL;
    // OPENAI_API_KEY is the production name. Q_AI_API_KEY remains supported so
    // an existing staging setup can be migrated without interruption.
    const hasApiKey = Boolean(environment.OPENAI_API_KEY?.trim() || environment.Q_AI_API_KEY?.trim());
    const configured = providerAllowed && hasApiKey;
    const monthlyBudgetUsd = positiveNumber(environment.Q_MONTHLY_BUDGET_USD, DEFAULT_MONTHLY_BUDGET_USD);
    const explicitlyDisabled = environment.Q_AI_EXTERNAL_ENABLED?.trim().toLowerCase() === 'false';
    const requestedEnablement = configured && !explicitlyDisabled;
    const budgetAvailable = Math.max(0, monthlyBudgetUsd - estimatedSpendUsd) >= MIN_MODEL_CALL_BUDGET_USD;
    const externalModelEnabled = requestedEnablement && budgetAvailable;

    let mode: QProviderStatus['mode'] = 'rules_only';
    let message = 'Rules-only Q is active. Add an OpenAI key to enable optional AI answers.';

    if (requestedProvider && !providerAllowed) {
        message = 'This Q release supports OpenAI only. Rules-only Q remains active.';
    } else if (configured && explicitlyDisabled) {
        message = 'OpenAI is configured but paused. Rules-only Q remains active.';
    } else if (configured && !budgetAvailable) {
        mode = 'budget_reached';
        message = 'The monthly Q AI budget has been reached. Q automatically continues in rules-only mode.';
    } else if (externalModelEnabled) {
        mode = 'model_active';
        message = `Q uses ${model} within this business's monthly budget and falls back to rules-only answers if needed.`;
    }

    return {
        mode,
        provider: configured ? 'openai' : 'q360-rules-v1',
        model: configured ? model : 'structured-pulse-v1',
        configured,
        externalModelEnabled,
        externalModelRequested: requestedEnablement,
        monthlyBudgetUsd,
        estimatedSpendUsd,
        budgetRemainingUsd: Math.max(0, monthlyBudgetUsd - estimatedSpendUsd),
        message,
    };
};
