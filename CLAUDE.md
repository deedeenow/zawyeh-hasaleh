# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

حصالة / Hasaleh — a public transparency ledger for the Zawyeh cultural space. One page:
the real Hasaleh (a 3D-scanned money box) turning in the middle, rendered through a
1-bit Bayer dither, the current balance beneath it, and a T-account ledger of every
amount in or out. Read-only; entries are authored in Sanity Studio.

`README.md` is the design and deployment document and is worth reading. This file
covers what is easy to break.

## Commands

```bash
npm run dev          # localhost:3000 — / is Arabic, /en is English
npm run build        # production build
npx tsc --noEmit     # THE correctness gate — see below
```

**There is no linter and no test runner.** `npx tsc --noEmit` plus a real browser
check is the whole verification story, so run both. TypeScript will not catch the
runtime traps listed under Gotchas.

Asset pipeline (run from the repo root, all idempotent):

```bash
npm run model        # OBJ -> public/hasaleh.mesh, then regenerates the favicon
npm run favicon      # mesh -> app/icon.svg (silhouette outline)
npm run obj          # mesh -> "hasaleh media/hasaleh-processed.obj" for Blender etc.
npm run seed         # one-off import of data/seed-entries.json; needs SANITY_WRITE_TOKEN
```

The source scan lives **outside this repo** at `../hasaleh media/hasaleh scan.obj`
(22 MB). `public/hasaleh.mesh` is generated and committed so deploys don't need it.

## Data flow

Sanity → GROQ → `coerceEntry` → `view()` → page and `/api/ledger`. One direction only;
this app never writes to Sanity.

- `lib/sanity.ts` — read-only client, **no token**. Works because the dataset is
  public. `isConfigured` is false when the project id is missing, and the site then
  renders a clean empty state rather than crashing.
- `lib/ledger.ts` — the GROQ query, `coerceEntry` (validation + unit conversion), and
  `view()`.
- **`view()` is pure and storage-independent.** It survived a move off the filesystem
  unchanged and would survive a move to Postgres. If storage changes, it is the one
  function to keep and the only one to re-point.
- `coerceEntry` drops malformed documents rather than throwing — a half-filled Studio
  document must not take the public page down.
- `/api/ledger` is CORS-open on purpose: the larger Zawyeh site is expected to consume it.

## Money

Currency is the Jordanian dinar, which divides into **1000 fils, not 100**. All of it
lives in `lib/currency.ts` — code, `minorPerMajor`, `decimals`.

- Sanity stores `amount` in **major units** (an editor types `12.5` meaning 12½ dinars).
  Conversion to integer minor units happens once, in `coerceEntry`. This is why moving
  from cents to fils needed no data migration.
- Internally everything is integer minor units, named `*Minor` (never `*Cents`).
- Always `Math.round`, never truncate: `8.29 * 100` is `828.9999999999999`.
- The API publishes `currency`, `minorPerMajor` and `decimals` so consumers can format
  without guessing.

## Languages

Arabic is primary at `/`, English alternate at `/en`. RTL is the **base** layout in
`globals.css`; LTR is the override. Retrofitting RTL is the expensive direction.

- `grid-column: 1` is whichever side you read first, so the T-account mirrors for free.
- Arabic-Indic digits on the Arabic page, via `dict.digits()`. Menlo has no such glyphs,
  so Arabic figures fall to an Arabic face and the ledger columns no longer align to the
  pixel. That is a known, accepted cost.
- Entry text is bilingual: `label`/`labelAr`, `note`/`noteAr`. `pickText`/`pickNote` fall
  back to the other language so a half-translated entry still renders.
- The Arabic display faces in `--display-ar` / `--body-ar` are a **placeholder** pending
  a chosen font. See `app/fonts/README.md`.

## The 1-bit design system

Two colours and nothing else. `--ground` is the paper, `--mark` is everything drawn on it.

**`--ground` and `--mark` in `app/globals.css` are the single source of truth.**
`app/components/MoneyBox.tsx` reads them at runtime; `scripts/make-favicon.mjs` parses them out of the
stylesheet at generation time. Never restate a colour anywhere else — it was hardcoded in
three places once and silently kept the old value through a palette change, and the
favicon stopped matching the site.

**Never use `opacity` to make a tint.** A translucent mark anti-aliases to a real
midtone, which the design does not allow. Use a sparser dither instead
(`--rule-h-faint`, or a 25% `conic-gradient`). Same reason the About scrim is a 50%
checkerboard of ground rather than a translucent black.

**`--px: 3px` and `DITHER_PIXEL` in `app/components/MoneyBox.tsx` must match.** They are the same
raster — CSS checkerboards and the WebGL dither land on one grid, and that is what makes
the page read as a single image. Change both or neither.

## The 3D object

`app/components/MoneyBox.tsx` renders the scan to a low-res render target, then a full-screen pass
applies an 8×8 ordered Bayer dither.

- The **render target always clears to black**, whatever the palette. The scene is
  rendered as *luminance* and compared against the dither threshold, so a light clear
  reads as "everything on". Colour is applied only in the screen pass.
- `readColor` deliberately returns raw sRGB components and **not** a `THREE.Color`:
  three converts into its linear working space, and the dither pass writes to the canvas
  with no sRGB encode, which renders the mark far too dark.
- The dither uses `lum > threshold`, not `step()`. One Bayer cell is exactly `0.0`, and
  `step()` would light it on pure black — scattering a dot lattice over the background.
- Shading is a hand-written lambert rather than three's lights, so the luminance ramp is
  identical across three versions and lighting-unit conventions.
- Slot height, object aspect and the silhouette are **measured from the mesh**, not
  hardcoded, so a rescan stays correct.
- Fine detail is **raster-bound, not mesh-bound**. The coin slot is ~1.4% of the object's
  height and spans about two dither blocks. Decimation is not the culprit — the shipped
  mesh carries the same rotational asymmetry as the raw scan. The lever is `--px`.

## Sanity schema — mind the divergence

The live schema is **MCP-managed**: deployed through the Sanity connector, not from a
local Studio project. `sanity/schemaTypes/ledgerEntry.ts` is a **mirror** for version
history. Editing it changes nothing on its own, and it is excluded from `tsconfig.json`.

The MCP schema format takes declarative values only, so the deployed version drops
`preview.prepare` and function-valued `initialValue`.

After any schema change, redeploy the Studio too or it keeps serving the old one.

When the larger Zawyeh site gains a real Studio, adopt this type into it and switch to
`npx sanity@latest schema deploy` from then on. Mixing the two is what makes deployed and
source schemas drift.

## Gotchas that cost real time

- **Stop the dev server before `rm -rf .next`.** Deleting it underneath a running server
  leaves it serving 500s with `ENOENT: routes-manifest.json`, and it looks like a code
  bug. Fast Refresh can also leave the DOM wedged after many edits — hard-reload or use a
  fresh tab before concluding anything is broken.
- **Anchor `:lang(ar)` selectors to `.shell`.** The document element is `lang="ar"`, so a
  bare `:lang(ar) .eyebrow` also matches on the English route. That once applied an Arabic
  font to Latin text and, because font fallback is per-glyph, ate the word spaces.
- **Wrap every numeral run in `.num`** (`direction: ltr; unicode-bidi: isolate`). Without
  it, RTL bidi moves a leading minus to the far side and `−515` renders as `515−`.
- **Only serialisable props cross the server/client boundary.** Pages hand `Bank` a locale
  *string*; the dictionary is built client-side because it carries functions (Arabic
  pluralisation, digit conversion).
- **Anything `resize()` closes over must be declared above it.** `resize()` runs during
  effect setup, so a later `let` leaves it in the temporal dead zone and the component
  throws on mount. TypeScript does not catch this across the closure, and the build passes
  while the client dies.
- **In a headless/hidden document `requestAnimationFrame` never fires**, so the render loop
  does not advance and screenshots show a stale frame. `app/components/MoneyBox.tsx` exposes a dev-only
  `window.__moneyBox` with `step(frames)`, `state()`, `dropCoin()` and `dropAmbient()` for
  exactly this. Use it rather than concluding the 3D is broken.

## Deploying

Vercel. This folder is its own git repository, so no Root Directory setting is needed.
`.env` is **committed on purpose** — every value is a `NEXT_PUBLIC_*` that already ships
in the client bundle, and committing it means a deploy needs no dashboard configuration.
Secrets (only `SANITY_WRITE_TOKEN`, only for `npm run seed`) go in `.env.local`, which
stays git-ignored.

No Sanity CORS configuration is needed: reads happen server-side, and the browser only
ever talks to this app's own `/api/ledger`.
