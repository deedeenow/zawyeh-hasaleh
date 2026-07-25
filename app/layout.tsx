import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { DEFAULT_LOCALE, DIRECTION } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'حصالة · Hasaleh — زاوية',
  description: 'ما في حصالة زاوية، ومن أين جاء كل مبلغ وإلى أين ذهب.',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
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
