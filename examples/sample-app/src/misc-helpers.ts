/**
 * formatCurrency — format a number as a localized currency string.
 *
 * @param amount   numeric amount
 * @param currency ISO 4217 currency code (default "USD")
 * @param locale   BCP 47 locale (default "en-US")
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

/**
 * isEmail — validate that a string looks like an email address.
 *
 * @param value candidate string
 * @returns true when `value` is a plausible email
 */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * groupBy — group items of an array by a derived string key.
 *
 * @param items   array to group
 * @param keyFn   maps an item to its group key
 * @returns a record of key -> items
 */
export function groupBy<T>(
  items: readonly T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (out[key] ??= []).push(item);
  }
  return out;
}

/**
 * slugify — DELIBERATELY UNUSED utility to exercise dead-code detection.
 *
 * @param text input text
 * @returns a url-safe slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
