import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { DEFAULT_LOCALE, DIRECTION } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'حصالة · Hasaleh — زاوية',
  description: 'ما في حصالة زاوية، ومن أين جاء كل مبلغ وإلى أين ذهب.',
};

/**
 * The one place a palette value has to be restated. Next resolves viewport metadata
 * on the server, before any stylesheet exists, so it cannot read --ground the way
 * MoneyBox.tsx and scripts/make-favicon.mjs both do.
 *
 * KEEP IN SYNC WITH --ground IN app/globals.css. If the paper changes and this does
 * not, mobile browsers tint their chrome the old colour and the seam shows at the
 * top of the page.
 */
export const viewport: Viewport = {
  themeColor: '#f3ece1',
  colorScheme: 'light',
};

/**
 * The document defaults to Arabic because Arabic is the primary language. The
 * English route overrides dir/lang on its own wrapper, which avoids needing two
 * layouts or a flash of the wrong direction.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} dir={DIRECTION[DEFAULT_LOCALE]}>
      <body>{children}</body>
    </html>
  );
}
