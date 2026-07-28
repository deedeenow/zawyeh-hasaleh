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

/**
 * جردة — the monthly stocktake. One per month, authored in the Studio, saying why
 * the money went where it went. It is not a transaction: no amount, no direction,
 * and at most one for any given month.
 */
export interface Jarda {
  id: string;
  /** "YYYY-MM" in Amman time. The month this reckons — see monthKey in lib/format. */
  month: string;
  /** Optional; the UI falls back to the month's own name. */
  title?: string;
  titleAr?: string;
  /**
   * Paragraphs, already split on blank lines. Bilingual like entry text, and the UI
   * falls back to the other language so a half-translated جردة still reads.
   */
  body: string[];
  bodyAr: string[];
  /**
   * DERIVED in `view()` from the entries of that month — never authored. An editor
   * who could type a total could contradict the ledger printed directly beneath it,
   * which on a transparency page is the one bug that must not ship.
   */
  totalInMinor: number;
  totalOutMinor: number;
  entryCount: number;
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
  /**
   * The monthly جردات, newest month first. Deliberately a SEPARATE array rather than
   * a merged timeline: `/api/ledger` is CORS-open and the larger Zawyeh site is
   * expected to consume it, so `entries` has to keep its shape. Consumers that do not
   * know about جردات simply ignore this field.
   */
  reviews: Jarda[];
  balanceMinor: number;
  totalInMinor: number;
  totalOutMinor: number;
  /** Highest the balance has ever been, chronologically. Drives the size mapping. */
  peakMinor: number;
  /** 0–1, balance against the all-time peak. */
  fill: number;
  latest: Entry | null;
}
