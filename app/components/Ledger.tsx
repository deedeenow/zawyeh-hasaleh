import { formatAmount, formatDate, formatFullDate, MINUS } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import type { Entry } from '@/lib/types';

interface LedgerProps {
  entries: Entry[];
  totalInMinor: number;
  totalOutMinor: number;
  dict: Dictionary;
}

export default function Ledger({ entries, totalInMinor, totalOutMinor, dict }: LedgerProps) {
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
                  <span className="entry-date figure num">
                    <time dateTime={entry.date} title={formatFullDate(entry.date, dict.locale)}>
                      {dict.digits(formatDate(entry.date))}
                    </time>
                  </span>
                  <span className="entry-amount">
                    <span className="sr-only">
                      {entry.kind === 'in' ? dict.srMoneyIn : dict.srMoneyOut}
                    </span>
                    <span className="figure num">
                      <span aria-hidden="true">{entry.kind === 'in' ? '+' : MINUS}</span>
                      {dict.digits(formatAmount(entry.amountMinor))}
                    </span>
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
