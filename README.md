# حصالة · Hasaleh

The Zawyeh money box. One page: the Hasaleh itself — 3D-scanned, rendered through
a 1-bit dither, turning in the middle — the current balance under it, and a full
T-account ledger of everything that went in or came out.

Entries live in **Sanity**. This app only ever reads them, which is what lets it
run on serverless hosting and what will let the larger Zawyeh site read the same
data later.

## Setting up

Needs Node 18.18+ (built and verified on 24.18).

```bash
npm install
```

### 1. Create the Sanity project and Studio

Run this **outside** this folder — the Studio is its own project, and later it can
be folded into the larger Zawyeh site instead:

```bash
npm create sanity@latest -- --project-plan free --create-project "Zawyeh" --dataset production
```

Keep the **dataset public**. This app reads without a token, which only works on a
public dataset — and the ledger is public information by design. A private dataset
would mean shipping a read token to the server for no benefit.

### 2. Add the ledger schema to the Studio

Copy [sanity/schemaTypes/ledgerEntry.ts](sanity/schemaTypes/ledgerEntry.ts) into
your Studio's schema folder and register it:

```ts
// sanity.config.ts in the Studio project
import { ledgerEntry } from './schemaTypes/ledgerEntry';

export default defineConfig({
  // ...
  schema: { types: [ledgerEntry] },
});
```

That file is deliberately not part of this app's build (`sanity` is excluded in
`tsconfig.json`) — it belongs to whichever project runs the Studio.

Then publish the Studio:

```bash
npx sanity deploy
```

### 3. Point this app at the project

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SANITY_PROJECT_ID` (from `sanity.io/manage`), and optionally
`NEXT_PUBLIC_STUDIO_URL` so the masthead links to the Studio. None of these are
secrets.

```bash
npm run dev
```

Until the project id is set the site renders a clean empty state and
`/api/ledger` returns a 503 saying so — it does not crash.

### 4. Import the sample entries (optional)

`data/seed-entries.json` holds seven sample entries. To push them into Sanity:

```bash
npm run seed -- --dry-run
```

```bash
SANITY_WRITE_TOKEN=your-editor-token npm run seed
```

The write token is needed **only** here — create one at `sanity.io/manage` → API →
Tokens with Editor access. Pass `--replace` to clear existing entries first. Then
delete `data/seed-entries.json`; nothing reads it at runtime.

## Recording money

Everything happens in Sanity Studio: pick a direction, type an amount in normal
units (`340`, `12.50` — never cents), say what it was for. The website picks up
published entries within 20 seconds without a reload.

The Studio gives you what the old custom admin page could not: real accounts with
roles, and revision history on every figure, so "who changed this and when" is
answerable. One entry is one document, so two people recording at once can never
overwrite each other.

## Deploying

Use **Vercel** — this is a Next 15 App Router app and Vercel is the reference
platform for it. Netlify works but runs Next through an adapter that trails on new
App Router behaviour.

This folder is its own git repository, so Vercel needs no Root Directory setting.

1. Create an empty repo on GitHub, then push:
   `git remote add origin <url> && git push -u origin main`
2. Vercel → Add New → Project → import it. Framework detection picks up Next.js
   on its own; leave every build setting alone.
3. Add environment variables (tick Production, Preview and Development):
   `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`,
   `NEXT_PUBLIC_SANITY_API_VERSION`, `NEXT_PUBLIC_CURRENCY`, and optionally
   `NEXT_PUBLIC_STUDIO_URL`. Do **not** add `SANITY_WRITE_TOKEN` — the site never
   writes.
4. Deploy.

Because `NEXT_PUBLIC_*` variables are inlined at build time, changing one needs a
redeploy to take effect — not just a save.

When this later becomes part of the larger Zawyeh site, move the folder into that
repo and set Vercel's Root Directory then.

No Sanity CORS configuration is needed. Reads happen server-side, and the browser
only ever talks to this app's own `/api/ledger`.

Nothing is written to disk at runtime, so there is no volume to provision and no
read-only-filesystem problem.

## The model

The object on the page is your scan — `hasaleh media/hasaleh scan.obj` — not a
stand-in. That file is 22 MB of ASCII OBJ with 265k triangles, far more than a 3px
dither can resolve, so it is preprocessed into a small binary:

```bash
npm run model
```

That reads the OBJ, welds it down to ~33k triangles by vertex clustering,
straightens the 2.31° lean in the scan's axis of revolution, centres it, scales it
to 2.1 units tall, recomputes smooth normals, and writes `public/hasaleh.mesh` —
781 KB, about 516 KB gzipped, 3.6% of the source.

Re-run it after a rescan. The OBJ stays the source of truth. To trade file size
against detail, change `CLUSTER_RESOLUTION` in `scripts/prepare-model.mjs` —
triangle count scales with its square.

Two things worth knowing:

- **The scan is a body of revolution**, so spinning it about its own axis of
  symmetry would be nearly invisible — the silhouette never changes.
  `MoneyBox.tsx` tips it forward (`FORWARD_TILT`) inside a nested group so the top
  face and the apex nub come into view and orbit visibly as it turns. Set
  `FORWARD_TILT = 0` for dead upright, and accept a near-static turn.
- **Scan winding is inconsistent** in places, so the shader flips each normal back
  toward the camera rather than trusting face orientation. Hence `DoubleSide`.

## How the design works

- **Two colours.** `#000` and `#fff`, no accent. Emphasis is inversion, never hue.
- **One raster.** `--px: 3px` in `app/globals.css` sets the block size for every
  apparent grey — rules, the ledger spine, the scrollbar — and `DITHER_PIXEL` in
  `app/components/MoneyBox.tsx` matches it, so the WebGL dither and the CSS
  patterns land on the same grid. Change both together or neither.
- **Type.** Copperplate for display and labels, Menlo for everything else and all
  figures. Both ship with macOS, so there are no font downloads; on Windows and
  Linux the stacks in `--display` / `--mono` fall back. Swap in a self-hosted face
  via `next/font/local` when you want it identical everywhere.
- **The ledger is a T-account.** Money in hangs left of the dithered spine, money
  out hangs right. The newest entry is the only inverted row.
- **Size.** The box scales `0.92`–`1.08` from balance against its all-time peak —
  deliberately subtle — plus a damped ±`0.10` spring pulse when a new transaction
  lands. Constants are at the top of `MoneyBox.tsx`.
- **Load.** The dither threshold ramps from 1, so the image develops in over
  ~1.15s. That is the only entrance animation; `prefers-reduced-motion` skips it
  along with the rotation and the bob.

## Structure

```
app/
  page.tsx                 reads the ledger, renders the bank
  layout.tsx               metadata, loads globals.css
  globals.css              all design tokens and layout
  components/
    Bank.tsx               client shell, polls for new entries
    MoneyBox.tsx           loads the scan + Bayer dither post-pass
    Ledger.tsx             the T-account rail
  api/
    ledger/route.ts        GET, public and CORS-open
lib/
  sanity.ts                read-only client, no token
  ledger.ts                GROQ query + the balance derivation
  types.ts                 shapes shared with client components
  format.ts                money and date formatting
sanity/
  schemaTypes/
    ledgerEntry.ts         copy into your Studio project
scripts/
  prepare-model.mjs        OBJ -> decimated, uprighted binary mesh
  seed-sanity.mjs          one-time import of the sample entries
data/
  seed-entries.json        sample data for the import; unused at runtime
public/
  hasaleh.mesh             generated by npm run model
```

## Notes for when this joins the larger site

- **`GET /api/ledger`** returns the fully derived ledger — balance, totals,
  all-time peak, `fill`, and every entry newest-first — with
  `access-control-allow-origin: *`. The larger site can consume it directly, or
  skip it and run the same GROQ query itself.
- **`view()` in `lib/ledger.ts` is pure** and storage-independent. It survived the
  move off the filesystem unchanged and would survive a move to Postgres. If the
  ledger ever becomes real accounting — reconciliation, tax exports — that is the
  one function you keep and the only one you need to re-point.
- **Money is integer minor units** (`amountCents`) everywhere inside the app. The
  Studio field is major units for the editor's sake and is converted once, at the
  boundary in `coerceEntry`. Keep that split.
- **Two ancestor folders still contain spaces**, so the full path is
  `zawyeh space/main website/hasaleh-website`. That is what goes in Vercel's Root
  Directory field. It works, but every shell command against it needs quoting.
  Renaming those two as well would remove the last of it.
- The whole page is `.shell` inside `app/page.tsx`, so it lifts into a route of the
  bigger app as-is; the only global CSS is on `:root` and `body`.
