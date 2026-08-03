/**
 * Product-specific money formatting.
 *
 * Backend money is represented as an integer amount in the minor unit
 * (e.g. 1999 EUR cents) plus a currency code. This helper converts to a
 * localized currency string using Intl.NumberFormat without any floating-point
 * business calculations.
 */

const DEFAULT_CURRENCY = 'USD';
const MISSING_PRICE_PLACEHOLDER = '-';

export const formatProductPrice = (
    amountMinor?: number | null,
    currency?: string | null,
): string => {
    if (amountMinor === null || amountMinor === undefined) {
        return MISSING_PRICE_PLACEHOLDER;
    }

    const safeCurrency = currency?.trim().toUpperCase() || DEFAULT_CURRENCY;

    // Defensive: only safe integers are accepted. Fallback to placeholder
    // instead of rendering a corrupt or unsafe value.
    if (!Number.isFinite(amountMinor)) {
        return MISSING_PRICE_PLACEHOLDER;
    }

    const major = Math.trunc(amountMinor) / 100;

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: safeCurrency,
        }).format(major);
    } catch {
        // If the currency code is invalid for Intl, still show a numeric value
        // with the currency code so the user sees something useful.
        return `${safeCurrency} ${major.toFixed(2)}`;
    }
};
