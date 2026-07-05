const isPerformanceInstrumentationEnabled = import.meta.env.DEV;

export const createPerformanceCorrelationId = (prefix: string) =>
    `${prefix}-${crypto.randomUUID()}`;

export const performanceMark = () => performance.now();

export const performanceDuration = (startedAt: number) =>
    Math.round((performance.now() - startedAt) * 100) / 100;

export const logPerformanceTiming = (event: string, details: Record<string, string | number | boolean | null>) => {
    if (!isPerformanceInstrumentationEnabled) return;
    console.info('[q360-performance]', { event, ...details });
};
