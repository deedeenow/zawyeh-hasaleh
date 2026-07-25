/**
 * Shared shapes. Kept apart from lib/ledger.ts so client components can import
 * the types without pulling node:fs into the browser bundle.
 */

export type EntryKind = 'in' | 'out';

export interface Entry {
  id: string;
  /** ISO-8601 instant the money actually moved. */
  date: string;
  kind: EntryKind;
  /** Always positive. Minor units (fils) so no floating-point money. */
  amountMinor: number;
  /**
   * Entry text is authored per language in the Studio. `label` is the English one
   * and `labelAr` the Arabic; the UI picks by locale and falls back to whichever
   * exists, so a half-translated entry still renders rather than going blank.
   */
  label: string;
  labelAr?: string;
  note?: string;
  noteAr?: string;
}

export interface LedgerFile {
  currency: string;
  entries: Entry[];
}

export interface LedgerView {
  /** ISO 4217 code, e.g. "JOD". Locale-neutral — the UI picks a display form. */
  currency: string;
  /** Integer minor units per major unit: 1000 fils to the dinar, 100 to a cent
   *  currency. Published so any consumer can format the figures correctly. */
  minorPerMajor: number;
  /** Decimal places to show for a fractional amount. */
  decimals: number;
  /** Newest first — the order the ledger column renders in. */
  entries: Entry[];
  balanceMinor: number;
  totalInMinor: number;
  totalOutMinor: number;
  /** Highest the balance has ever been, chronologically. Drives the size mapping. */
  peakMinor: number;
  /** 0–1, balance against the all-time peak. */
  fill: number;
  latest: Entry | null;
}
