import Bank from './components/Bank';
import { getLedger } from '@/lib/ledger';


// The ledger lives in Sanity and changes whenever an entry is published, so this
// page is never cached.
export const dynamic = 'force-dynamic';

/** Arabic is the primary language, so it sits at the root. */
export default async function Page() {
  const ledger = await getLedger();
  return <Bank initial={ledger} locale="ar" />;
}
