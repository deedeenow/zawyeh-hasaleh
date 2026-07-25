import { CURRENCY } from './currency';

/** True minus sign (U+2212), not a hyphen — it aligns with the tabular figures. */
export const MINUS = '−';

/**
 * Minor units in, display string out. Trailing zeros are dropped when the amount
 * is whole, so a round 750 reads as "750" rather than "750.000".
 */
export function formatAmount(minor: number): string {
  const { minorPerMajor, decimals } = CURRENCY;
  const whole = Math.trunc(Math.abs(minor) / minorPerMajor);
  const fraction = Math.abs(minor) % minorPerMajor;
  const grouped = whole.toLocaleString('en-US');
  return fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(decimals, '0')}`;
}

export function formatSigned(minor: number, kind: 'in' | 'out'): string {
  return `${kind === 'in' ? '+' : MINUS}${formatAmount(minor)}`;
}

export function formatBalance(minor: number): string {
  return minor < 0 ? `${MINUS}${formatAmount(minor)}` : formatAmount(minor);
}

/** Compact day.month for the ledger rail — the year only appears when it isn't this one. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '——.——';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (date.getFullYear() === new Date().getFullYear()) return `${day}.${month}`;
  return `${day}.${month}.${String(date.getFullYear()).slice(2)}`;
}

export function formatFullDate(iso: string, locale: 'ar' | 'en' = 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return locale === 'ar' ? 'تاريخ غير معروف' : 'unknown date';
  // `-u-nu-latn` keeps Western digits in Arabic too. Mixing digit systems between
  // the dates and the tabular figures in the ledger would read as a mistake.
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  return date.toLocaleDateString(tag, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Parses a typed amount into minor units. Accepts "1200", "1,200.500", "1200.5".
 * Returns null for anything it cannot read, so the caller can say what went wrong.
 */
export function parseAmountToMinor(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  // Decimal places allowed follow the currency: three for the dinar's fils.
  const pattern = new RegExp(`^\\d*(\\.\\d{0,${CURRENCY.decimals}})?$`);
  if (cleaned === '' || !pattern.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * CURRENCY.minorPerMajor);
}
