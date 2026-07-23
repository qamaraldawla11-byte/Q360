/**
 * Shared country alias normalization and currency derivation used by the
 * Public Q live plan and guest-brief handoff.
 *
 * Unknown countries keep a deterministic USD fallback for currency. Recognized
 * aliases and canonical names are never silently mapped to USD.
 */

const COUNTRY_CURRENCY_MAP: Record<string, { canonical: string; currency: string }> = {
  // Saudi Arabia and aliases
  'saudiarabia': { canonical: 'Saudi Arabia', currency: 'SAR' },
  'saudi arabia': { canonical: 'Saudi Arabia', currency: 'SAR' },
  'ksa': { canonical: 'Saudi Arabia', currency: 'SAR' },
  'saudi': { canonical: 'Saudi Arabia', currency: 'SAR' },
  'sa': { canonical: 'Saudi Arabia', currency: 'SAR' },
  // United Arab Emirates and aliases
  'unitedarabemirates': { canonical: 'United Arab Emirates', currency: 'AED' },
  'united arab emirates': { canonical: 'United Arab Emirates', currency: 'AED' },
  'uae': { canonical: 'United Arab Emirates', currency: 'AED' },
  'u.a.e.': { canonical: 'United Arab Emirates', currency: 'AED' },
  'ae': { canonical: 'United Arab Emirates', currency: 'AED' },
  // Egypt
  'egypt': { canonical: 'Egypt', currency: 'EGP' },
  'eg': { canonical: 'Egypt', currency: 'EGP' },
  // Sudan
  'sudan': { canonical: 'Sudan', currency: 'SDG' },
  'sd': { canonical: 'Sudan', currency: 'SDG' },
  // Spain
  'spain': { canonical: 'Spain', currency: 'EUR' },
  'es': { canonical: 'Spain', currency: 'EUR' },
  // Other EUR countries previously supported
  'france': { canonical: 'France', currency: 'EUR' },
  'germany': { canonical: 'Germany', currency: 'EUR' },
  // United Kingdom and aliases
  'unitedkingdom': { canonical: 'United Kingdom', currency: 'GBP' },
  'united kingdom': { canonical: 'United Kingdom', currency: 'GBP' },
  'uk': { canonical: 'United Kingdom', currency: 'GBP' },
  'greatbritain': { canonical: 'United Kingdom', currency: 'GBP' },
  'great britain': { canonical: 'United Kingdom', currency: 'GBP' },
  'gb': { canonical: 'United Kingdom', currency: 'GBP' },
  // United States and aliases
  'unitedstates': { canonical: 'United States', currency: 'USD' },
  'united states': { canonical: 'United States', currency: 'USD' },
  'usa': { canonical: 'United States', currency: 'USD' },
  'us': { canonical: 'United States', currency: 'USD' },
  'america': { canonical: 'United States', currency: 'USD' },
};

const countryKey = (input: string): string =>
  input.trim().toLowerCase().replace(/[-_\s.]/g, '');

export const normalizeCountry = (input: string): string | undefined => {
  const normalized = COUNTRY_CURRENCY_MAP[countryKey(input)]?.canonical;
  return normalized ? normalized.trim() : undefined;
};

export const currencyForCountry = (input: string): string => {
  const entry = COUNTRY_CURRENCY_MAP[countryKey(input)];
  // Unknown countries keep the safe USD fallback; recognized countries are never
  // silently converted to USD.
  return entry?.currency ?? 'USD';
};
