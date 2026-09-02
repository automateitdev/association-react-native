/**
 * Money, as this app is allowed to handle it.
 *
 * ========================= THE RULE =========================
 * This app NEVER calculates money. Not a sum, not a difference, not a
 * percentage, not a total. Every figure displayed comes from the API.
 * ============================================================
 *
 * That is not caution for its own sake. The system this replaces has a family
 * of defects with exactly one shape: a fine added to an instalment somewhere it
 * should not have been, then stored, then reported as savings. Once two numbers
 * are added together the split cannot be recovered, and nobody notices for
 * years.
 *
 * The server therefore returns instalment and fine as separate fields AND any
 * total it wants shown - `total_due`, `grand_total`, `total_paid`. If a screen
 * needs a number that does not exist in the response, the fix is a server
 * change, not an addition here.
 *
 * Money arrives as a STRING with two decimals ("1000.00"), never a JSON number.
 * A JSON number is an IEEE-754 float, and floats do not reconcile.
 */

/** A money value exactly as the API sends it. Never parsed into a number. */
export type Money = string;

/**
 * Format for display. Presentation only - it never changes the value.
 *
 * Bengali digits are used when the association's locale is `bn`, because that
 * is what members read on their own statements.
 */
export function formatMoney(
  amount: Money,
  options: { locale?: string; currency?: string; withSymbol?: boolean } = {},
): string {
  const { locale = 'en', currency = 'BDT', withSymbol = true } = options;

  // Split on the decimal point rather than parsing: the string is authoritative
  // and Number() would round it.
  const [whole = '0', fraction = '00'] = amount.split('.');
  const negative = whole.startsWith('-');
  const digits = negative ? whole.slice(1) : whole;

  const grouped = groupBangladeshi(digits);
  const localised = locale.startsWith('bn')
    ? toBengaliDigits(`${grouped}.${fraction}`)
    : `${grouped}.${fraction}`;

  const sign = negative ? '-' : '';
  const symbol = withSymbol ? (currency === 'BDT' ? '৳' : `${currency} `) : '';

  return `${sign}${symbol}${localised}`;
}

/**
 * Bangladeshi grouping: the last three digits, then pairs.
 * 1234567 -> 12,34,567 (not 1,234,567).
 */
function groupBangladeshi(digits: string): string {
  if (digits.length <= 3) return digits;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);

  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string): string {
  return input.replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);
}

/**
 * Is this amount greater than zero?
 *
 * A comparison, not arithmetic - needed to decide whether to SHOW a fine row at
 * all. Done on the string so no float is ever involved.
 */
export function isPositive(amount: Money): boolean {
  return /[1-9]/.test(amount.replace('-', ''));
}
