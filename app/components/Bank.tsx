'use client';

import { useEffect, useState } from 'react';
import MoneyBox from './MoneyBox';
import Ledger from './Ledger';
import { formatAmount, formatBalance, formatDate } from '@/lib/format';
import type { LedgerView } from '@/lib/types';

const POLL_INTERVAL_MS = 20_000;

/** Entries are recorded in Sanity Studio, so the link leaves the site entirely. */
const studioUrl = process.env.NEXT_PUBLIC_STUDIO_URL ?? '';

export default function Bank({ initial }: { initial: LedgerView }) {
  const [ledger, setLedger] = useState(initial);

  // The page is public and read-only, so polling is enough to pick up whatever
  // was published in the Studio without anyone reloading.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/ledger', { cache: 'no-store' });
        if (!response.ok) return;
        const next = (await response.json()) as LedgerView;
        if (!cancelled && Array.isArray(next.entries)) setLedger(next);
      } catch {
        // Offline or mid-deploy. Keep showing the last good ledger.
      }
    };

    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', load);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  const { latest } = ledger;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead-mark">
          <span className="eyebrow">Zawyeh</span>
          <span className="arabic" lang="ar" dir="rtl">
            حصالة
          </span>
        </div>
        {studioUrl ? (
          <a
            className="masthead-meta masthead-link"
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
          >
            Record an entry
          </a>
        ) : null}
      </header>

      <div className="body">
        <section className="stage" aria-labelledby="balance-heading">
          <MoneyBox
            fill={ledger.fill}
            pulseKey={latest?.id ?? 'empty'}
            pulseDirection={latest?.kind === 'out' ? -1 : 1}
          />

          <div className="readout">
            <div className="readout-label">
              <h1 className="eyebrow" id="balance-heading">
                In the hasaleh
              </h1>
            </div>

            <p className="balance">
              <span className="balance-currency">{ledger.currency}</span>
              {formatBalance(ledger.balanceCents)}
            </p>

            {latest ? (
              <p className="readout-last">
                <span className="readout-last-tag">
                  {latest.kind === 'in' ? 'Last in' : 'Last out'}
                </span>
                <span className="figure">
                  {ledger.currency}
                  {formatAmount(latest.amountCents)}
                </span>
                <span>{latest.label}</span>
                <span className="figure">{formatDate(latest.date)}</span>
              </p>
            ) : (
              <p className="readout-last">
                <span>Empty. Nothing in, nothing out.</span>
              </p>
            )}

            <p className="totals figure">
              <span>
                In {ledger.currency}
                {formatAmount(ledger.totalInCents)}
              </span>
              <span>
                Out {ledger.currency}
                {formatAmount(ledger.totalOutCents)}
              </span>
            </p>
          </div>
        </section>

        <Ledger
          entries={ledger.entries}
          currency={ledger.currency}
          totalInCents={ledger.totalInCents}
          totalOutCents={ledger.totalOutCents}
        />
      </div>
    </div>
  );
}
