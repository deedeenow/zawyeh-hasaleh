/**
 * One-time import of data/seed-entries.json into Sanity.
 *
 *   NEXT_PUBLIC_SANITY_PROJECT_ID=xxx SANITY_WRITE_TOKEN=yyy node scripts/seed-sanity.mjs
 *
 * Add --dry-run to see what it would create without writing anything.
 * Add --replace to delete every existing ledgerEntry first.
 *
 * The write token is only needed here. The website itself reads with no token.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(HERE, '..', 'data', 'seed-entries.json');

const dryRun = process.argv.includes('--dry-run');
const replace = process.argv.includes('--replace');

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId) {
  console.error('NEXT_PUBLIC_SANITY_PROJECT_ID is not set.');
  process.exit(1);
}
if (!token && !dryRun) {
  console.error(
    'SANITY_WRITE_TOKEN is not set. Create an Editor token in sanity.io/manage → API → Tokens.',
  );
  process.exit(1);
}

const file = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const entries = Array.isArray(file.entries) ? file.entries : [];

// The app stores integer minor units; the Studio field is major units.
const documents = entries.map((entry) => ({
  _type: 'ledgerEntry',
  kind: entry.kind,
  amount: entry.amountCents / 100,
  label: entry.label,
  date: entry.date,
  ...(entry.note ? { note: entry.note } : {}),
}));

console.log(`${documents.length} entries in ${path.basename(SEED)}:`);
for (const doc of documents) {
  const sign = doc.kind === 'in' ? '+' : '−';
  console.log(`  ${doc.date.slice(0, 10)}  ${sign}${doc.amount}  ${doc.label}`);
}

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
  process.exit(0);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-07-01',
  token,
  useCdn: false,
});

if (replace) {
  const deleted = await client.delete({ query: '*[_type == "ledgerEntry"]' });
  console.log(`\n--replace: deleted ${deleted.results?.length ?? 0} existing entries.`);
}

// One transaction, so a failure part-way leaves nothing half-imported.
const tx = documents.reduce((acc, doc) => acc.create(doc), client.transaction());
const result = await tx.commit();

console.log(`\ncreated ${result.results.length} entries in ${projectId}/${dataset}.`);
console.log('Check them in the Studio, then delete data/seed-entries.json if you like.');
