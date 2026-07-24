import { formatAmount, formatDate, formatFullDate, MINUS } from '@/lib/format';
import type { Entry } from '@/lib/types';

interface LedgerProps {
  entries: Entry[];
  currency: string;
  totalInCents: number;
  totalOutCents: number;
}

export default function Ledger({ entries, currency, totalInCents, totalOutCents }: LedgerProps) {
  return (
    <section className="rail" aria-labelledby="ledger-heading">
      <header className="rail-head">
        <div className="rail-title">
          <h2 className="eyebrow" id="ledger-heading">
            The Ledger
          </h2>
          <span className="masthead-meta figure">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        {/* The two heads label the T-account: everything below hangs on one
            side of the spine or the other. */}
        <div className="rail-columns eyebrow">
          <span>
            In · {currency}
            {formatAmount(totalInCents)}
          </span>
          <span>
            Out · {currency}
            {formatAmount(totalOutCents)}
          </span>
        </div>
      </header>

      <div className="rail-scroll">
        {entries.length === 0 ? (
          <div className="entries-empty">
            <p>Nothing has moved through the hasaleh yet.</p>
            <p className="muted">The first entry will show up here.</p>
          </div>
        ) : (
          <ul className="entries">
            {entries.map((entry, index) => (
              <li
                key={entry.id}
                className={[
                  'entry',
                  entry.kind === 'in' ? 'entry-in' : 'entry-out',
                  index === 0 ? 'entry-latest' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="entry-cell">
                  <span className="entry-date figure">
                    <time dateTime={entry.date} title={formatFullDate(entry.date)}>
                      {formatDate(entry.date)}
                    </time>
                  </span>
                  <span className="entry-amount figure">
                    <span className="sr-only">
                      {entry.kind === 'in' ? 'Money in, ' : 'Money out, '}
                    </span>
                    <span aria-hidden="true">{entry.kind === 'in' ? '+' : MINUS}</span>
                    {currency}
                    {formatAmount(entry.amountCents)}
                  </span>
                  <span className="entry-label">{entry.label}</span>
                  {entry.note ? <span className="entry-note">{entry.note}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
