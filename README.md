# حصالة · Hasaleh

The Zawyeh money box. One page: the Hasaleh itself — 3D-scanned, rendered through
a 1-bit dither, turning in the middle — the current balance under it, and a full
T-account ledger of everything that went in or came out.

Entries live in **Sanity**. This app only ever reads them, which is what lets it
run on serverless hosting and what will let the larger Zawyeh site read the same
data later.

## What is already wired

The Sanity side is live. Nothing below needs doing again — it is recorded here so
you know how it is put together.

| | |
| --- | --- |
| Project | `Zawyeh` — `3a03n44v` (org `oLuoFh4dA`) |
| Dataset | `production`, **public** ACL |
| Schema | `ledgerEntry`, MCP-managed on workspace `default` |
| Studio | https://zawyeh-hasaleh.sanity.studio/ |
| Sample entries | created, then **unpublished** — they sit as drafts |

The dataset is public on purpose: the site reads with no token, which only works on
a public dataset, and the ledger is public information anyway.

To run it locally:

```bash
npm install
```

```bash
npm run dev
```

`.env` is committed with the project id, dataset, API version, currency and Studio
URL. Every one of those is a `NEXT_PUBLIC_*` value that already ships inside the
client bundle, so none of it is secret — and committing it means a deploy needs no
dashboard configuration. Override anything locally with `.env.local`, which stays
git-ignored. If the project id is ever missing, the site renders a clean empty
state and `/api/ledger` returns a 503 saying so, rather than crashing.

### The schema is MCP-managed — mind the divergence

The deployed schema was created through the Sanity connector, not from a local
Studio project. [sanity/schemaTypes/ledgerEntry.ts](sanity/schemaTypes/ledgerEntry.ts)
is a **mirror** of it for reference and version history, not the source of truth.
Editing that file changes nothing on its own.

Two consequences:

- The MCP schema format takes declarative values only, so the deployed version
  drops the custom `preview.prepare` (entries list as label + ISO date rather than
  label + signed amount) and the `initialValue` date default. The two-decimal
  validator did survive.
- When the larger Zawyeh site gets a proper Studio in its own repo, adopt this type
  into it and deploy with `npx sanity@latest schema deploy` from then on. Mixing
  the two is what makes deployed and source schemas drift apart.

### Sample entries

Seven samples were used to verify the whole chain, then unpublished so no invented
figures sit on a public ledger. They are drafts in the Studio — publish any of them
to bring them back, or delete them and start recording real ones.

`data/seed-entries.json` plus `npm run seed` (needs `SANITY_WRITE_TOKEN`) remains
available if you ever want to bulk-import from a file again.

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

This folder is its own git repository, ready to push.

The quickest route, no GitHub needed:

```bash
npx vercel --prod
```

It logs you in once in the browser, then asks which scope — pick the **Zawyeh**
team. Because `.env` is committed, **no environment variables need setting in the
dashboard**; the build reads them from the file.

If you would rather deploy from git, create an empty GitHub repo, then:

```bash
git remote add origin <url> && git push -u origin main
```

and import it in Vercel. Framework detection handles the rest — leave every build
setting alone, and no Root Directory is needed since this folder is the repo root.

Note that any `NEXT_PUBLIC_*` value you later override in the Vercel dashboard is
inlined at build time, so changing one needs a redeploy, not just a save.

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
585 KB, about 500 KB gzipped, 2.7% of the source. Indices are 16-bit whenever the
vertex count fits in 65535, which it does here; that is exactly lossless.

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
- **Naming is consistent across the three places it appears**: the folder, the
  GitHub repo, and the Studio host are all `zawyeh-hasaleh`. Keep them in step.
- **Two ancestor folders still contain spaces**, so the full local path is
  `zawyeh space/main website/zawyeh-hasaleh`. Irrelevant to deployment now that the
  repo root is this folder, but shell commands against the path still need quoting.
  Renaming those two would remove the last of it.
- The whole page is `.shell` inside `app/page.tsx`, so it lifts into a route of the
  bigger app as-is; the only global CSS is on `:root` and `body`.

## Licence

MIT — see [LICENSE](LICENSE). Copyright holder is written as "Zawyeh"; change it
if a different legal entity should hold it.

Note this covers **everything in the repository**, including `public/hasaleh.mesh`,
the processed 3D scan of the Hasaleh. If you would rather the scan not be reusable,
keep the code MIT and move the mesh out to a separately-licensed asset.
