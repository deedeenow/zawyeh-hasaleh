import Bank from '../components/Bank';
import { getLedger } from '@/lib/ledger';


export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Hasaleh · حصالة — Zawyeh',
  description: 'What is in the Zawyeh money box, and where every amount came from or went to.',
};

/** English is the alternate language. */
export default async function EnglishPage() {
  const ledger = await getLedger();
  return <Bank initial={ledger} locale="en" />;
}
