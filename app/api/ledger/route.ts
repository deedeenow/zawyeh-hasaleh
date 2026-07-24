import { getLedger } from '@/lib/ledger';
import { isConfigured } from '@/lib/sanity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The public ledger, derived and ready to render. Writes are not handled here —
 * entries are created in Sanity Studio, which owns the accounts, roles and
 * revision history.
 *
 * This is also the endpoint the larger Zawyeh site can consume, so it stays
 * CORS-open and cache-free.
 */
export async function GET(): Promise<Response> {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  };

  if (!isConfigured) {
    return new Response(
      JSON.stringify({ error: 'The ledger is not connected to Sanity yet. See the README.' }),
      { status: 503, headers },
    );
  }

  try {
    return new Response(JSON.stringify(await getLedger()), { headers });
  } catch (error) {
    console.error('[hasaleh] ledger query failed', error);
    return new Response(JSON.stringify({ error: 'The ledger could not be read.' }), {
      status: 502,
      headers,
    });
  }
}
