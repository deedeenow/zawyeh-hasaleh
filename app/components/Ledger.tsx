'use client';

import { useState } from 'react';
import { formatAmount, formatDate, formatFullDate, monthKey, MINUS } from '@/lib/format';
import { pickBody, pickJardaTitle, pickNote, pickText, type Dictionary } from '@/lib/i18n';
import type { Entry, Jarda } from '@/lib/types';

interface LedgerProps {
  entries: Entry[];
  reviews: Jarda[];
  totalInMinor: number;
  totalOutMinor: number;
  dict: Dictionary;
}

/**
 * The جردة band. Closed it states the month and what moved through it; open it
 * carries the reasoning. It is a real <button> with aria-expanded rather than a
 * clickable div, so it works from the keyboard and announces its state.
 *
 * The band spans BOTH columns and paints over the spine. That is the structural
 * point rather than a decorative one: a transaction belongs to one side of a
 * T-account, and a month's reckoning belongs to the whole page.
 */
function JardaRow({ jarda, dict }: { jarda: Jarda; dict: Dictionary }) {
  const [open, setOpen] = useState(false);
  const body = pickBody(jarda, dict.locale);
  const title = pickJardaTitle(jarda, dict.locale, dict);

  return (
    <li className={open ? 'jarda jarda-open' : 'jarda'}>
      <button
        type="button"
        className="jarda-head"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="jarda-title">{title}</span>
        <span className="jarda-totals">
          <span>
            {dict.columnIn}{' '}
            <span className="figure num">{dict.digits(formatAmount(jarda.totalInMinor))}</span>{' '}
            {dict.currency}
          </span>
          <span>
            {dict.columnOut}{' '}
            <span className="figure num">{dict.digits(formatAmount(jarda.totalOutMinor))}</span>{' '}
            {dict.currency}
          </span>
        </span>
        <span className="jarda-cue">{open ? dict.jardaClose : dict.jardaOpen}</span>
      </button>

      {open ? (
        <div className="jarda-body">
          {body.map((paragraph, index) => (
            // Paragraphs are plain authored text with no stable id of their own, and
            // the list is re-derived rather than reordered, so the index is safe here.
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Interleaves the جردات into the entry list.
 *
 * Each one sits at the HEAD of the month it reckons — directly above that month's
 * newest entry. A real ledger totals at the *end* of a period, but this rail runs
 * newest-first, so "below July's entries" is chronologically June and reads
 * ambiguously. At the head it is unmistakable: the heading, then the month under it.
 *
 * Months with no published جردة simply flow on. An empty divider every month would
 * be worse than none.
 */
function interleave(entries: Entry[], reviews: Jarda[]): Array<
  { type: 'entry'; entry: Entry; latest: boolean } | { type: 'jarda'; jarda: Jarda }
> {
  const byMonth = new Map(reviews.map((jarda) => [jarda.month, jarda]));
  const rows: Array<
    { type: 'entry'; entry: Entry; latest: boolean } | { type: 'jarda'; jarda: Jarda }
  > = [];

  let currentMonth: string | null = null;
  entries.forEach((entry, index) => {
    const month = monthKey(entry.date);
    if (month !== null && month !== currentMonth) {
      currentMonth = month;
      const jarda = byMonth.get(month);
      if (jarda) rows.push({ type: 'jarda', jarda });
    }
    rows.push({ type: 'entry', entry, latest: index === 0 });
  });

  return rows;
}

export default function Ledger({
  entries,
  reviews,
  totalInMinor,
  totalOutMinor,
  dict,
}: LedgerProps) {
  const rows = interleave(entries, reviews);

  return (
    <section className="rail" aria-labelledby="ledger-heading">
      <header className="rail-head">
        <div className="rail-title">
          <h2 className="eyebrow" id="ledger-heading">
            {dict.ledgerTitle}
          </h2>
          <span className="rail-count">{dict.entryCount(entries.length)}</span>
        </div>
        {/* The two heads label the T-account: everything below hangs on one side
            of the spine or the other. In RTL the grid flips, so money in stays on
            the side you read first. */}
        <div className="rail-columns eyebrow">
          <span>
            {dict.columnIn} ·{' '}
            <span className="figure num">{dict.digits(formatAmount(totalInMinor))}</span> {dict.currency}
          </span>
          <span>
            {dict.columnOut} ·{' '}
            <span className="figure num">{dict.digits(formatAmount(totalOutMinor))}</span> {dict.currency}
          </span>
        </div>
      </header>

      <div className="rail-scroll">
        {entries.length === 0 ? (
          <div className="entries-empty">
            <p>{dict.emptyTitle}</p>
            <p className="muted">{dict.emptyBody}</p>
          </div>
        ) : (
          <ul className="entries">
            {rows.map((row) =>
              row.type === 'jarda' ? (
                <JardaRow key={`jarda-${row.jarda.id}`} jarda={row.jarda} dict={dict} />
              ) : (
                <li
                  key={row.entry.id}
                  className={[
                    'entry',
                    row.entry.kind === 'in' ? 'entry-in' : 'entry-out',
                    row.latest ? 'entry-latest' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="entry-cell">
                    <span className="entry-date figure num">
                      <time
                        dateTime={row.entry.date}
                        title={formatFullDate(row.entry.date, dict.locale)}
                      >
                        {dict.digits(formatDate(row.entry.date))}
                      </time>
                    </span>
                    <span className="entry-amount">
                      <span className="sr-only">
                        {row.entry.kind === 'in' ? dict.srMoneyIn : dict.srMoneyOut}
                      </span>
                      <span className="figure num">
                        <span aria-hidden="true">{row.entry.kind === 'in' ? '+' : MINUS}</span>
                        {dict.digits(formatAmount(row.entry.amountMinor))}
                      </span>
                    </span>
                    <span className="entry-label">{pickText(row.entry, dict.locale)}</span>
                    {pickNote(row.entry, dict.locale) ? (
                      <span className="entry-note">{pickNote(row.entry, dict.locale)}</span>
                    ) : null}
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
