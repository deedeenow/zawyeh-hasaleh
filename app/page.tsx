import Bank from './components/Bank';
import { getLedger } from '@/lib/ledger';

// The ledger lives on disk and changes whenever an entry is recorded, so this
// page is never cached.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const ledger = await getLedger();
  return <Bank initial={ledger} />;
}
