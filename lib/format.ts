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

/**
 * The ledger keeps Amman time, not the reader's and not the server's.
 *
 * This is a Jordanian organisation's book: a figure recorded on the 31st was
 * recorded on the 31st, and it should say so to someone reading in Berlin. Left on
 * local time, the same entry rendered as 31.07 on a laptop in Amman and 01.08 on
 * one in London — and once the monthly جردة started grouping entries by month, that
 * became visible as an entry filed under a month whose date it does not show.
 *
 * Pinning it also removes a server/client split: `view()` derives each جردة's
 * totals on the server, which runs UTC, while the dates beside them are formatted
 * in the browser. Both now agree because both are Amman.
 */
export const LEDGER_TIME_ZONE = 'Asia/Amman';

/** The Amman calendar parts of an instant. */
function ammanParts(iso: string): { year: number; month: number; day: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // en-CA gives ISO-ordered numeric parts, which is the cheapest way to read a
  // wall-clock date in a named zone without pulling in a date library.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: LEDGER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .split('-')
    .map(Number);
  return { year, month, day };
}

/**
 * "YYYY-MM" in Amman time — the key a جردة is filed under, and the key entries are
 * grouped by. Pure and deterministic on both server and client.
 */
export function monthKey(iso: string): string | null {
  const parts = ammanParts(iso);
  if (!parts) return null;
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

/** Compact day.month for the ledger rail — the year only appears when it isn't this one. */
export function formatDate(iso: string): string {
  const parts = ammanParts(iso);
  if (!parts) return '——.——';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  const thisYear = ammanParts(new Date().toISOString())?.year;
  if (parts.year === thisYear) return `${day}.${month}`;
  return `${day}.${month}.${String(parts.year).slice(2)}`;
}

export function formatFullDate(iso: string, locale: 'ar' | 'en' = 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return locale === 'ar' ? 'تاريخ غير معروف' : 'unknown date';
  // `-u-nu-latn` keeps Western digits in Arabic too. Mixing digit systems between
  // the dates and the tabular figures in the ledger would read as a mistake.
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  return date.toLocaleDateString(tag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: LEDGER_TIME_ZONE,
  });
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
