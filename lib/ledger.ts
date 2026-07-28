import type { Entry, EntryKind, Jarda, LedgerView } from './types';
import { getSanityClient } from './sanity';
import { CURRENCY } from './currency';
import { monthKey } from './format';

export type { Entry, EntryKind, Jarda, LedgerView };

export const MAX_LABEL_LENGTH = 120;
export const MAX_NOTE_LENGTH = 400;
export const MAX_JARDA_TITLE_LENGTH = 120;
export const MAX_JARDA_BODY_LENGTH = 4000;

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
    labelAr,
    note,
    noteAr
  }
`;

/**
 * Every published جردة, newest month first. `_updatedAt` comes along so that if two
 * documents somehow claim the same month — Sanity cannot enforce uniqueness across
 * documents — the most recently edited one wins deterministically rather than
 * whichever the query happened to return first.
 */
const JARDA_QUERY = /* groq */ `
  *[_type == "jarda" && defined(month)] | order(month desc, _updatedAt desc) {
    "id": _id,
    month,
    title,
    titleAr,
    body,
    bodyAr,
    _updatedAt
  }
`;

/** The shape GROQ returns. Everything is optional — a document can be half-filled. */
interface RawEntry {
  id?: string;
  date?: string;
  kind?: string;
  amount?: number;
  label?: string;
  labelAr?: string;
  note?: string;
  noteAr?: string;
}

function isKind(value: unknown): value is EntryKind {
  return value === 'in' || value === 'out';
}

/** Trims and caps a piece of optional entry text, or drops it. */
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed.slice(0, max);
}

/**
 * Drops anything malformed rather than throwing. A half-finished document in the
 * Studio should not take the public page down.
 */
function coerceEntry(raw: RawEntry): Entry | null {
  if (!raw.id || !isKind(raw.kind)) return null;
  // At least one language must have a label, or there is nothing to show.
  const label = text(raw.label, MAX_LABEL_LENGTH);
  const labelAr = text(raw.labelAr, MAX_LABEL_LENGTH);
  if (!label && !labelAr) return null;

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
    label: label ?? labelAr ?? '',
    labelAr,
    note: text(raw.note, MAX_NOTE_LENGTH),
    noteAr: text(raw.noteAr, MAX_NOTE_LENGTH),
  };
}

interface RawJarda {
  id?: string;
  month?: string;
  title?: string;
  titleAr?: string;
  body?: string;
  bodyAr?: string;
  _updatedAt?: string;
}

/** "2026-07", and a real month number. Anything else is not a month. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Normalises whatever the Studio's month picker stored into "YYYY-MM".
 *
 * Sanity's `date` type with `dateFormat: 'YYYY-MM'` has stored both the bare month
 * and a full "YYYY-MM-01" across versions, so this accepts either rather than
 * betting on one and silently dropping every جردة if the other turns up.
 */
function toMonth(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 7);
  return MONTH_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Splits authored prose into paragraphs on blank lines. Plain text rather than
 * Portable Text on purpose: it matches how entry notes are already authored and
 * needs no renderer. Portable Text is the upgrade if جردات ever want links or
 * emphasis; paragraphs alone do not justify it.
 */
function paragraphs(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .slice(0, MAX_JARDA_BODY_LENGTH)
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/**
 * Drops anything malformed rather than throwing, exactly as `coerceEntry` does. A
 * half-written جردة in the Studio must not take the public page down.
 */
function coerceJarda(raw: RawJarda): Jarda | null {
  const month = toMonth(raw.month);
  if (!raw.id || !month) return null;

  const body = paragraphs(raw.body);
  const bodyAr = paragraphs(raw.bodyAr);
  // A جردة with nothing written in either language is an empty divider, which is
  // worse than no divider at all.
  if (body.length === 0 && bodyAr.length === 0) return null;

  return {
    id: raw.id,
    month,
    title: text(raw.title, MAX_JARDA_TITLE_LENGTH),
    titleAr: text(raw.titleAr, MAX_JARDA_TITLE_LENGTH),
    body,
    bodyAr,
    // Placeholders; `view()` fills these from the entries themselves.
    totalInMinor: 0,
    totalOutMinor: 0,
    entryCount: 0,
  };
}

export const EMPTY_LEDGER: LedgerView = {
  currency: CURRENCY.code,
  minorPerMajor: CURRENCY.minorPerMajor,
  decimals: CURRENCY.decimals,
  entries: [],
  reviews: [],
  balanceMinor: 0,
  totalInMinor: 0,
  totalOutMinor: 0,
  peakMinor: 0,
  fill: 0,
  latest: null,
};

/**
 * Derives everything the page shows from a flat list of entries, plus the جردات.
 * Deliberately pure and storage-independent — this survived the move off the
 * filesystem unchanged, and would survive a move to Postgres too.
 *
 * `jardas` defaults to empty so every existing caller keeps working unchanged.
 */
export function view(entries: Entry[], jardas: Jarda[] = []): LedgerView {
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

  // Each month's own in/out, keyed the same way a جردة is filed. Computed here so a
  // جردة can never state a total that disagrees with the entries printed under it.
  const byMonth = new Map<string, { inMinor: number; outMinor: number; count: number }>();
  for (const entry of chronological) {
    const key = monthKey(entry.date);
    if (!key) continue;
    const month = byMonth.get(key) ?? { inMinor: 0, outMinor: 0, count: 0 };
    if (entry.kind === 'in') month.inMinor += entry.amountMinor;
    else month.outMinor += entry.amountMinor;
    month.count += 1;
    byMonth.set(key, month);
  }

  // Newest month first, at most one per month — a second document claiming a month
  // that is already taken is dropped rather than rendered as a duplicate divider.
  const seen = new Set<string>();
  const reviews = [...jardas]
    .sort((a, b) => b.month.localeCompare(a.month))
    .filter((jarda) => {
      if (seen.has(jarda.month)) return false;
      seen.add(jarda.month);
      return true;
    })
    .map((jarda) => {
      const totals = byMonth.get(jarda.month);
      return {
        ...jarda,
        totalInMinor: totals?.inMinor ?? 0,
        totalOutMinor: totals?.outMinor ?? 0,
        entryCount: totals?.count ?? 0,
      };
    });

  return {
    currency: CURRENCY.code,
    minorPerMajor: CURRENCY.minorPerMajor,
    decimals: CURRENCY.decimals,
    entries: newestFirst,
    reviews,
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

  // The page polls every 20s and Sanity's CDN absorbs the load, so never let Next's
  // data cache hold a stale balance. Both queries go out together — the جردات are
  // never worth a second round trip's latency.
  const [raw, rawJardas] = await Promise.all([
    client.fetch<RawEntry[]>(ENTRIES_QUERY, {}, { cache: 'no-store' }),
    client
      .fetch<RawJarda[]>(JARDA_QUERY, {}, { cache: 'no-store' })
      // A جردة that fails to load must not take the ledger down with it. The whole
      // point of the page is the figures; the commentary is additional.
      .catch(() => [] as RawJarda[]),
  ]);

  const entries = (raw ?? []).map(coerceEntry).filter((entry): entry is Entry => entry !== null);
  const jardas = (rawJardas ?? [])
    .map(coerceJarda)
    .filter((jarda): jarda is Jarda => jarda !== null);
  return view(entries, jardas);
}
