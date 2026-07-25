'use client';

import { useEffect, useState } from 'react';
import MoneyBox from './MoneyBox';
import Ledger from './Ledger';
import About from './About';
import { formatAmount, formatBalance, formatDate } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import type { LedgerView } from '@/lib/types';

const POLL_INTERVAL_MS = 20_000;

/**
 * Only serialisable props may cross the server/client boundary, so the page hands
 * over a locale string and the dictionary — which carries functions for Arabic
 * pluralisation — is built here, on the client side of that line.
 */
export default function Bank({ initial, locale }: { initial: LedgerView; locale: Locale }) {
  const dict = getDictionary(locale);
  const [ledger, setLedger] = useState(initial);
  const [aboutOpen, setAboutOpen] = useState(false);

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
    <div className="shell" dir={dict.dir} lang={dict.locale}>
      <header className="masthead">
        <div className="masthead-mark">
          <span className="wordmark arabic" lang="ar" dir="rtl">
            {dict.wordmark}
          </span>
          <span className={dict.locale === 'ar' ? 'brand arabic' : 'brand'}>{dict.brand}</span>
        </div>

        <nav className="masthead-nav">
          <button className="link-quiet" type="button" onClick={() => setAboutOpen(true)}>
            {dict.about}
          </button>
          {/* The alternate language is always named in its own language. */}
          <a
            className={dict.locale === 'ar' ? 'link-quiet' : 'link-quiet arabic'}
            href={dict.altHref}
            lang={dict.locale === 'ar' ? 'en' : 'ar'}
          >
            {dict.altLabel}
          </a>
        </nav>
      </header>

      <div className="body">
        <section className="stage" aria-labelledby="balance-heading">
          <MoneyBox
            fill={ledger.fill}
            pulseKey={latest?.id ?? 'empty'}
            pulseDirection={latest?.kind === 'out' ? -1 : 1}
          />

          <div className="readout">
            <h1 className="eyebrow" id="balance-heading">
              {dict.balanceLabel}
            </h1>

            <p className="balance">
              <span className="figure num">{dict.digits(formatBalance(ledger.balanceMinor))}</span>
              <span className="balance-currency">{dict.currency}</span>
            </p>

            {latest ? (
              <p className="readout-last">
                <span className="readout-last-tag">
                  {latest.kind === 'in' ? dict.lastIn : dict.lastOut}
                </span>
                <span className="figure num">{dict.digits(formatAmount(latest.amountMinor))}</span>
                <span>{dict.currency}</span>
                <span>{latest.label}</span>
                <span className="figure num">{dict.digits(formatDate(latest.date))}</span>
              </p>
            ) : (
              <p className="readout-last">
                <span>{dict.emptyReadout}</span>
              </p>
            )}

            <p className="totals">
              <span>
                {dict.totalIn}{' '}
                <span className="figure num">{dict.digits(formatAmount(ledger.totalInMinor))}</span>{' '}
                {dict.currency}
              </span>
              <span>
                {dict.totalOut}{' '}
                <span className="figure num">{dict.digits(formatAmount(ledger.totalOutMinor))}</span>{' '}
                {dict.currency}
              </span>
            </p>
          </div>
        </section>

        <Ledger
          entries={ledger.entries}
          totalInMinor={ledger.totalInMinor}
          totalOutMinor={ledger.totalOutMinor}
          dict={dict}
        />
      </div>

      <About dict={dict} open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
