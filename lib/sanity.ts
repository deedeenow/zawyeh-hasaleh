import { createClient, type SanityClient } from '@sanity/client';

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
/**
 * Sanity pins behaviour to a date. Bumping it opts into newer API behaviour, so
 * it is deliberately explicit rather than "latest".
 */
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-07-01';

/** False until the project id is set, so a fresh clone still builds and renders. */
export const isConfigured = projectId !== '';

let warned = false;

/**
 * Read-only client. No token: this app never writes to Sanity — entries are
 * created and edited in Sanity Studio, which is where the accounts, roles and
 * revision history live.
 */
export function getSanityClient(): SanityClient | null {
  if (!isConfigured) {
    if (!warned && process.env.NODE_ENV !== 'production') {
      warned = true;
      console.warn(
        '[hasaleh] NEXT_PUBLIC_SANITY_PROJECT_ID is not set — the ledger will render empty. See README.',
      );
    }
    return null;
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    // Served from Sanity's CDN, which is invalidated on publish, so entries
    // appear almost immediately without every visitor hitting the origin API.
    useCdn: true,
    // Never surface unpublished drafts on the public page.
    perspective: 'published',
  });
}
