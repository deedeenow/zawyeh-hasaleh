/** True minus sign (U+2212), not a hyphen — it aligns with the tabular figures. */
export const MINUS = '−';

export function formatAmount(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const fraction = Math.abs(cents) % 100;
  const grouped = whole.toLocaleString('en-US');
  return fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, '0')}`;
}

export function formatSigned(cents: number, kind: 'in' | 'out'): string {
  return `${kind === 'in' ? '+' : MINUS}${formatAmount(cents)}`;
}

export function formatBalance(cents: number): string {
  return cents < 0 ? `${MINUS}${formatAmount(cents)}` : formatAmount(cents);
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

export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown date';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Parses a typed amount into minor units. Accepts "1200", "1,200.50", "1200.5".
 * Returns null for anything it cannot read, so the caller can say what went wrong.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (cleaned === '' || !/^\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
