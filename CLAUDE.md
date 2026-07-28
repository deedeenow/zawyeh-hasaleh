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
npm run model        # OBJ -> public/hasaleh.mesh
npm run favicon      # draws the coin in app/icon.svg; reads the palette from globals.css
npm run marks        # logo + sun PNGs -> traced SVGs in public/
npm run obj          # mesh -> "hasaleh media/hasaleh-processed.obj" for Blender etc.
npm run seed         # one-off import of data/seed-entries.json; needs SANITY_WRITE_TOKEN
```

The source art lives **outside this repo**: `../hasaleh media/` holds `hasaleh
scan.obj` (22 MB), `hasaleh logo.png` and `hasaleh favicon.png`, and `../../media/`
holds `zawyeh-sun.png` — which belongs to the parent brand and is shared by every
Zawyeh property, so it is referenced across the sub-brand boundary rather than copied
in. All the outputs (`public/hasaleh.mesh`, `public/wordmark.svg`,
`public/zawyeh-sun.svg`, `app/icon.svg`) are generated and committed, so a deploy never
needs either folder.

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

## الجردة — the monthly stocktake

A second document type, `jarda`: once a month, why the money went where it went. Not
a variant of `ledgerEntry` — no amount, no direction, at most one per month.

- **Its totals are DERIVED, never authored.** `view()` computes each month's in/out
  from the entries themselves. Never add an amount field to this type: an editor who
  could type a total could contradict the ledger printed directly beneath it, and on
  a transparency page that is the one bug that must not ship.
- **It sits at the HEAD of its month's block**, above that month's newest entry. A
  real ledger totals at the *end* of a period, but this rail runs newest-first, so
  "below July's entries" is chronologically June and reads ambiguously.
- **`reviews` is a separate array on `LedgerView`, not a merged timeline.**
  `/api/ledger` is CORS-open and the larger Zawyeh site is expected to consume it, so
  `entries` must keep its shape. `Ledger.tsx` does the interleaving client-side.
- Body is plain text split on blank lines, matching how entry notes are authored.
  Portable Text is the upgrade if جردات ever need links; paragraphs do not justify it.
- Month names are the **Levantine** ones (تموز، آب، أيلول), hardcoded in `lib/i18n.ts`
  rather than taken from `toLocaleDateString('ar-JO')` — ICU's answer for that locale
  has changed between versions, so the month shown would depend on which Node built
  the page.
- The band **spans both columns and paints over the spine**. That is structural: a
  transaction belongs to one side of a T-account, a month's reckoning to the page.
- The hover highlight has **no transition, deliberately**. A fade between paper and
  ink passes through every midtone in between, which the palette does not allow.

## Time — the ledger keeps Amman hours

`LEDGER_TIME_ZONE` in `lib/format.ts` is `Asia/Amman`, and `formatDate`,
`formatFullDate` and `monthKey` all resolve through it.

This is not cosmetic. On local time the same entry rendered as `31.07` in Amman and
`01.08` in London, and once the جردة started grouping by month, an entry could be
filed under a month whose date it did not show. It also removes a server/client
split: `view()` derives each جردة's totals on the server, which runs UTC, while the
dates beside them are formatted in the browser. Both agree now because both are
Amman. **Do not reach for `getMonth()`/`getDate()` here** — use `monthKey`.

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

## The design system — three inks from a ledger book

Modelled on a دفتر الديوان. Cream paper, blue-black ink, and a red column grid that
the press put down before anyone wrote a figure on it.

- `--ground` `#f3ece1` — the paper.
- `--mark` `#1a3a6b` — anything a hand puts on it. All text, all figures, the object.
- `--rule` `#b0453c` — anything that frames rather than states. Every rule, the
  T-account spine, the dialog border.

**The invariant that makes three colours read as two: nothing written is ever red,
and no rule is ever ink.** Emphasis is still inversion, never hue — the newest entry
is an ink block, not a red one. If you find yourself wanting red for emphasis or ink
for a border, the answer is no.

Verticals are solid (`--rule-v`), horizontals are dithered (`--rule-h`,
`--rule-h-faint`), because that is how the book is ruled. The dither is no longer
there to fake a lighter value — the colour does that — it is there to keep the page
one raster.

**The tokens in `app/globals.css` are the single source of truth.**
`app/components/MoneyBox.tsx` reads `--ground` and `--mark` at runtime;
`scripts/make-favicon.mjs` parses `--mark` out of the stylesheet at generation time.
Never restate a colour anywhere else — it was hardcoded in three places once and
silently kept the old value through a palette change, and the favicon stopped
matching the site. Two places unavoidably carry copies, both commented:
`themeColor` in `app/layout.tsx` (Next resolves viewport metadata before any
stylesheet exists) and the `readColor` fallbacks in `MoneyBox.tsx`. Change `--ground`
or `--mark` and grep for the old hex.

**The object stays strictly two colours.** Red never reaches the dither — the shader
takes `--ground` and `--mark` only.

**Never use `opacity` to make a tint.** A translucent mark anti-aliases to a real
midtone, which the design does not allow. Use a sparser dither instead
(`--rule-h-faint`, or a 25% `conic-gradient`). Same reason the About scrim is a 50%
checkerboard of ground rather than a translucent black.

## Generated brand assets

Three, all traced from brush drawings, all committed, none to be hand-edited. The
tracer is shared: `scripts/lib/trace-bitmap.mjs`.

- `public/wordmark.svg` and `public/zawyeh-sun.svg` — `npm run marks`, from
  `hasaleh logo.png` and `zawyeh-sun.png`. The masthead uses both as **CSS masks over
  `currentColor`**, so they inherit `--mark` and cannot drift from the palette.
- `app/icon.svg` — `npm run favicon`, from `hasaleh favicon.png`, struck out of a
  drawn coin with `evenodd`. It no longer derives from the mesh, so **`npm run model`
  no longer regenerates it** — but it does still parse the palette out of
  `globals.css`, so re-run it after any colour change.

The masthead lockup is **sun, red rule, wordmark**. Three things about it:

- The sun is **first in the DOM** and the flex row follows `dir`, so it leads in both
  languages with no direction-specific rule. Reversing the DOM order would silently
  invert the hierarchy in both.
- `.wordmark` and `.sun` must stay **childless** — the accessible name is an
  `aria-label`, and any text node inside would be masked along with the drawing.
- Both are **sized by height**, with width from a `calc()` carrying the viewBox
  aspect. A redraw at a different aspect means updating that ratio, or the mask
  letterboxes inside a wrongly-shaped box.

Two things the tracer gets right that are easy to break:

- **Tolerance is in output units, not source pixels.** The same drawing at 1000 units
  wide and 32 units wide needs the same *visual* tolerance and wildly different source
  ones. `loopsToPath` converts. It also means the right tolerance depends on the
  source's resolution: the sun is a 257px drawing, so anything under ~4 units is finer
  than its own pixel staircase and simplifies nothing.
- **Winding comes from the edge walk**, not from a post-pass, which is what lets a
  traced glyph be punched out of a disc. Do not "fix" loop direction.

An XML comment cannot contain a double hyphen, so a generator that writes `--mark`
into one emits an SVG every parser rejects. It cost a debugging cycle once.

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
local Studio project. `sanity/schemaTypes/*.ts` are **mirrors** for version
history. Editing them changes nothing on its own, and they are excluded from `tsconfig.json`.
Two types are deployed: `ledgerEntry` and `jarda`. Both are bilingual — `labelAr`/`label`,
`noteAr`/`note`, `titleAr`/`title`, `bodyAr`/`body` — with Arabic first, and either side
may be left empty because the site falls back to the other language.

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
