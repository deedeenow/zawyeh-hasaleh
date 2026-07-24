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
  /** Always positive. Minor units (cents/fils) so no floating-point money. */
  amountCents: number;
  label: string;
  note?: string;
}

export interface LedgerFile {
  currency: string;
  entries: Entry[];
}

export interface LedgerView {
  currency: string;
  /** Newest first — the order the ledger column renders in. */
  entries: Entry[];
  balanceCents: number;
  totalInCents: number;
  totalOutCents: number;
  /** Highest the balance has ever been, chronologically. Drives the size mapping. */
  peakCents: number;
  /** 0–1, balance against the all-time peak. */
  fill: number;
  latest: Entry | null;
}
