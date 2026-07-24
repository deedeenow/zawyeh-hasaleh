import type { Entry, EntryKind, LedgerView } from './types';
import { getSanityClient } from './sanity';

export type { Entry, EntryKind, LedgerView };

export const MAX_LABEL_LENGTH = 120;
export const MAX_NOTE_LENGTH = 400;

/**
 * Every published entry, newest first. Editors type `amount` in major units
 * (340, 12.50) because that is what they mean; it is converted to integer minor
 * units at this boundary and stays an integer everywhere inside the app.
 */
const ENTRIES_QUERY = /* groq */ `
  *[_type == "ledgerEntry" && defined(date) && defined(amount)] | order(date desc) {
    "id": _id,
    date,
    kind,
    amount,
    label,
    note
  }
`;

/** The shape GROQ returns. Everything is optional — a document can be half-filled. */
interface RawEntry {
  id?: string;
  date?: string;
  kind?: string;
  amount?: number;
  label?: string;
  note?: string;
}

function isKind(value: unknown): value is EntryKind {
  return value === 'in' || value === 'out';
}

/**
 * Drops anything malformed rather than throwing. A half-finished document in the
 * Studio should not take the public page down.
 */
function coerceEntry(raw: RawEntry): Entry | null {
  if (!raw.id || !isKind(raw.kind)) return null;
  if (typeof raw.label !== 'string' || raw.label.trim() === '') return null;

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Round, never truncate: 8.29 * 100 is 828.9999999999999 in binary floating
  // point, and truncating it would quietly lose a cent.
  const amountCents = Math.round(amount * 100);
  if (amountCents <= 0) return null;

  const parsed = new Date(raw.date ?? '');
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    id: raw.id,
    date: parsed.toISOString(),
    kind: raw.kind,
    amountCents,
    label: raw.label.trim().slice(0, MAX_LABEL_LENGTH),
    note:
      typeof raw.note === 'string' && raw.note.trim() !== ''
        ? raw.note.trim().slice(0, MAX_NOTE_LENGTH)
        : undefined,
  };
}

export const EMPTY_LEDGER: LedgerView = {
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? '$',
  entries: [],
  balanceCents: 0,
  totalInCents: 0,
  totalOutCents: 0,
  peakCents: 0,
  fill: 0,
  latest: null,
};

/**
 * Derives everything the page shows from a flat list of entries. Deliberately
 * pure and storage-independent — this survived the move off the filesystem
 * unchanged, and would survive a move to Postgres too.
 */
export function view(entries: Entry[]): LedgerView {
  const chronological = [...entries].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id),
  );

  let balanceCents = 0;
  let totalInCents = 0;
  let totalOutCents = 0;
  let peakCents = 0;

  for (const entry of chronological) {
    if (entry.kind === 'in') {
      balanceCents += entry.amountCents;
      totalInCents += entry.amountCents;
    } else {
      balanceCents -= entry.amountCents;
      totalOutCents += entry.amountCents;
    }
    if (balanceCents > peakCents) peakCents = balanceCents;
  }

  const newestFirst = [...chronological].reverse();
  const fill = peakCents > 0 ? Math.min(1, Math.max(0, balanceCents / peakCents)) : 0;

  return {
    currency: EMPTY_LEDGER.currency,
    entries: newestFirst,
    balanceCents,
    totalInCents,
    totalOutCents,
    peakCents,
    fill,
    latest: newestFirst[0] ?? null,
  };
}

export async function getLedger(): Promise<LedgerView> {
  const client = getSanityClient();
  if (!client) return EMPTY_LEDGER;

  const raw = await client.fetch<RawEntry[]>(
    ENTRIES_QUERY,
    {},
    // The page polls every 20s and Sanity's CDN absorbs the load, so never let
    // Next's data cache hold a stale balance.
    { cache: 'no-store' },
  );

  const entries = (raw ?? []).map(coerceEntry).filter((entry): entry is Entry => entry !== null);
  return view(entries);
}
