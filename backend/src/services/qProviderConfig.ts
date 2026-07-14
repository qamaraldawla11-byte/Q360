export type QExternalProvider = 'openai' | 'gemini';

type Environment = Record<string, string | undefined>;

export type QProviderStatus = {
    mode: 'rules_only' | 'provider_ready';
    provider: string;
    model: string;
    configured: boolean;
    externalModelEnabled: boolean;
    externalModelRequested: boolean;
    monthlyBudgetUsd: number;
    estimatedSpendUsd: number;
    budgetRemainingUsd: number | null;
    message: string;
};

const supportedProviders = new Set<QExternalProvider>(['openai', 'gemini']);

const positiveNumber = (value: string | undefined) => {
    const parsed = Number(value ?? '0');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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
    const provider = requestedProvider && supportedProviders.has(requestedProvider as QExternalProvider)
        ? requestedProvider as QExternalProvider
        : null;
    const model = environment.Q_AI_MODEL?.trim() || null;
    const hasApiKey = Boolean(environment.Q_AI_API_KEY?.trim());
    const configured = Boolean(provider && model && hasApiKey);
    const monthlyBudgetUsd = positiveNumber(environment.Q_MONTHLY_BUDGET_USD);
    const requestedEnablement = environment.Q_AI_EXTERNAL_ENABLED?.trim().toLowerCase() === 'true';
    const budgetAvailable = monthlyBudgetUsd === 0 || estimatedSpendUsd < monthlyBudgetUsd;
    // The provider adapter is not part of this checkpoint. Keeping this false
    // prevents a configuration change from ever causing an unreviewed model call.
    const externalModelEnabled = false;
    const externalModelRequested = configured && requestedEnablement && budgetAvailable;

    let message = 'Rules-only Q is active. Add provider credentials only when you choose to enable external AI.';
    if (requestedProvider && !provider) {
        message = 'Q supports only the approved OpenAI or Gemini provider values. Rules-only Q remains active.';
    } else if (configured && !requestedEnablement) {
        message = 'A provider is configured, but external AI is disabled until Q_AI_EXTERNAL_ENABLED is set to true.';
    } else if (configured && requestedEnablement && !budgetAvailable) {
        message = 'The Q monthly AI budget has been reached. Rules-only Q remains active.';
    } else if (externalModelRequested) {
        message = 'A provider is configured and approved for the monthly budget. External calls remain off until the model adapter is released.';
    }

    return {
        mode: configured ? 'provider_ready' : 'rules_only',
        provider: provider ?? 'q360-rules-v1',
        model: model ?? 'structured-pulse-v1',
        configured,
        externalModelEnabled,
        externalModelRequested,
        monthlyBudgetUsd,
        estimatedSpendUsd,
        budgetRemainingUsd: monthlyBudgetUsd ? Math.max(0, monthlyBudgetUsd - estimatedSpendUsd) : null,
        message,
    };
};
