import type { Entry, EntryKind, LedgerView } from './types';
import { getSanityClient } from './sanity';
import { CURRENCY } from './currency';

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
  // point, and truncating it would quietly lose a minor unit.
  const amountMinor = Math.round(amount * CURRENCY.minorPerMajor);
  if (amountMinor <= 0) return null;

  const parsed = new Date(raw.date ?? '');
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    id: raw.id,
    date: parsed.toISOString(),
    kind: raw.kind,
    amountMinor,
    label: raw.label.trim().slice(0, MAX_LABEL_LENGTH),
    note:
      typeof raw.note === 'string' && raw.note.trim() !== ''
        ? raw.note.trim().slice(0, MAX_NOTE_LENGTH)
        : undefined,
  };
}

export const EMPTY_LEDGER: LedgerView = {
  currency: CURRENCY.code,
  minorPerMajor: CURRENCY.minorPerMajor,
  decimals: CURRENCY.decimals,
  entries: [],
  balanceMinor: 0,
  totalInMinor: 0,
  totalOutMinor: 0,
  peakMinor: 0,
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

  let balanceMinor = 0;
  let totalInMinor = 0;
  let totalOutMinor = 0;
  let peakMinor = 0;

  for (const entry of chronological) {
    if (entry.kind === 'in') {
      balanceMinor += entry.amountMinor;
      totalInMinor += entry.amountMinor;
    } else {
      balanceMinor -= entry.amountMinor;
      totalOutMinor += entry.amountMinor;
    }
    if (balanceMinor > peakMinor) peakMinor = balanceMinor;
  }

  const newestFirst = [...chronological].reverse();
  const fill = peakMinor > 0 ? Math.min(1, Math.max(0, balanceMinor / peakMinor)) : 0;

  return {
    currency: CURRENCY.code,
    minorPerMajor: CURRENCY.minorPerMajor,
    decimals: CURRENCY.decimals,
    entries: newestFirst,
    balanceMinor,
    totalInMinor,
    totalOutMinor,
    peakMinor,
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
