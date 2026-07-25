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

## Languages

Arabic is the **primary** language and English the alternate, and that ordering is
structural rather than cosmetic:

| | |
| --- | --- |
| `/` | Arabic, RTL |
| `/en` | English, LTR |

- RTL is the base layout in `globals.css`; LTR is the override. Retrofitting RTL
  onto an LTR design is the expensive direction, so it was built the other way.
- **The T-account mirrors.** `grid-column: 1` is the side you read first — the
  right in RTL, the left in LTR — so money in stays "first" in both without a
  second rule.
- **Arabic never gets letter-spacing.** It is cursive; tracking severs the joins
  between letters. Every tracked atom un-tracks itself under
  `.shell:lang(ar)`.
- Those selectors are anchored to `.shell`, **not** bare `:lang(ar)`. The document
  element is `lang="ar"`, so an unanchored `:lang(ar) .eyebrow` also matches on the
  English route — which silently applied an Arabic font to Latin text and, because
  font fallback is per-glyph, ate the word spaces.
- **The Arabic page uses Arabic-Indic digits** (`٠١٢٣٤٥٦٧٨٩`), converted in one
  place — `toArabicDigits` in `lib/i18n.ts`, exposed as `dict.digits()`. It
  deliberately leaves `.` and `,` alone rather than substituting the Arabic
  decimal (U+066B) and thousands (U+066C) separators, which are patchily supported
  and risk tofu. Two consequences worth knowing: Menlo has no Arabic-Indic digits,
  so Arabic figures fall to an Arabic face, and **the ledger columns no longer
  align to the pixel** — no Arabic face here has monospaced numerals. That is the
  price of the correct digits.
- **Latin figures stay Menlo**, wrapped in `.num`
  (`direction: ltr; unicode-bidi: isolate`). Without the isolate, RTL's bidi
  reordering moves a leading minus to the far side and `−515` renders as `515−`.
- **Entry text is authored in both languages.** The Studio has Arabic and English
  fields for both "what for" and the note, ordered Arabic-first. `label` holds the
  English and `labelAr` the Arabic — asymmetric internally, but the Studio titles
  make it obvious and it avoided migrating live documents.
  A missing Arabic label is a **warning, not an error**, so it never blocks
  publishing, and `pickText` falls back to the other language rather than rendering
  a blank row. A half-translated entry still shows.

### Swapping the Arabic font

The Arabic faces in `--display-ar` / `--body-ar` are a **placeholder** (Geeza Pro —
plain but correctly shaped). Diwan Kufi was tried and rejected: it is decorative
and its glyphs collide at 13px. Drop a file into `app/fonts/` and see the README
there; wiring it via `next/font/local` is a three-line change.

## Money

The currency is the **Jordanian dinar**, which divides into **1000 fils, not 100**.
So amounts carry up to three decimals (`12.500`), and the app's integer minor unit
is a fils. All of that lives in one place — `lib/currency.ts`.

- Sanity stores `amount` in **major units** (an editor types `12.5`, meaning twelve
  and a half dinars). The conversion to integer minor units happens once, in
  `coerceEntry`. That is why moving from cents to fils needed no data migration.
- `GET /api/ledger` publishes `currency: "JOD"`, `minorPerMajor` and `decimals`, so
  any consumer — the larger Zawyeh site included — can format the figures without
  guessing.
- The display form is per-language: `JOD` in English, `د.أ` in Arabic, from the
  dictionary. The ISO code stays in the API.
- Ledger rows show sign and figure only. The currency is stated by the column heads
  and the balance; repeating it on every row is noise.
- To switch to a cent currency, set `minorPerMajor: 100` / `decimals: 2` in
  `lib/currency.ts` and loosen the `amount` validator on the Sanity schema.

## How the design works

- **Two colours.** Deep emerald `#046b4a` on white `#ffffff`, no accent. Emphasis
  is inversion, never hue. The tokens are `--ground` and `--mark` — the ground is
  the paper, the mark is everything drawn on it.
  The green is dark on purpose: at 6.55:1 against white it clears AA comfortably
  for the 13px body and 10px eyebrows. Every bright "signal" green fails AA at
  those sizes, so a lighter one is not available without dropping text contrast.
  **`MoneyBox.tsx` reads both tokens out of the stylesheet at runtime**, so the
  WebGL dither uses exactly the same pair as the CSS checkerboards and the palette
  is never duplicated in JS. It deliberately does not build a `THREE.Color`: three
  would convert into its linear working space, and the dither pass writes straight
  to the canvas with no sRGB encode, which renders the green far too dark.
  The render target still clears to black — the scene is rendered as *luminance* and
  compared against the dither threshold, so a light clear would read as
  "everything on". Colour is applied only in the final screen pass.
- **One raster.** `--px: 3px` in `app/globals.css` sets the block size for every
  apparent grey — rules, the ledger spine, the scrollbar — and `DITHER_PIXEL` in
  `app/components/MoneyBox.tsx` matches it, so the WebGL dither and the CSS
  patterns land on the same grid. Change both together or neither.
- **Type.** Copperplate for display and labels, Menlo for everything else and all
  Latin figures. The scale was raised roughly 15–20% across the board; `--rail`
  widened with it, or every label in the ledger wrapped. Both ship with macOS, so there are no font downloads; on Windows and
  Linux the stacks in `--display` / `--mono` fall back. Swap in a self-hosted face
  via `next/font/local` when you want it identical everywhere.
- **The ledger is a T-account.** Money in hangs left of the dithered spine, money
  out hangs right. The newest entry is the only inverted row.
- **Size.** The box scales `0.92`–`1.08` from balance against its all-time peak —
  deliberately subtle — plus a damped ±`0.10` spring pulse when a new transaction
  lands. Constants are at the top of `MoneyBox.tsx`.
- **Framing.** The camera sits at 4.4, which makes the box about 27% larger than it
  was and fills ~82% of the frame height at rest — 157 dither blocks tall rather
  than 124. `MAX_VISUAL_SCALE` caps the rendered scale so a pulse on top of a high
  balance compresses instead of pushing the nub and the base out of frame.
  The camera only pulls back once the canvas is narrower than **the object itself**,
  a figure measured from the mesh (`measureObjectAspect`, ~0.709 here). It used to be
  a hardcoded 1.1, which was right for the wider-than-tall placeholder model this was
  first written against and, after the swap, was quietly pulling the camera back on
  almost every layout.
- **Fine detail is raster-bound, not mesh-bound.** The coin slot is about 1.4% of the
  object's height, so even at this size it spans barely two dither blocks — near the
  floor of what an 8×8 Bayer dither can express. Decimation is *not* the culprit: the
  shipped mesh carries the same rotational asymmetry as the raw scan (24% radius
  spread at the shoulder against 25% raw), so the geometry is there. The shader
  expands contrast about the midtones to buy shallow features an extra step or two.
  The remaining lever is `--px`: dropping the raster from 3px to 2px would put ~235
  blocks on the object and ~3.3 on the slot, at the cost of a finer, less chunky
  texture across the whole page.
- **Coins.** A coin drops through the slot at random intervals (3.5–9s), each one
  entering from a different offset, tumbling at its own rate, and turning from
  face-on to edge-on as it arrives — which is the only way a coin gets into a slot.
  It is not faded or shrunk away: it sinks inside the closed shell and the depth
  buffer occludes it, which is both the simplest way to hide something in a 1-bit
  render and what actually happens.
  A real **money-in** entry drops one too, and **only that coin makes the box
  flinch** when it lands. Ambient coins deliberately do not — if the box twitched at
  random, the pulse would stop meaning "something happened". Nothing drops on money
  out: a hasaleh only takes coins through the slot.
  The slot's height is **measured from the mesh** (`findSlotHeight`), not hardcoded —
  it is the highest point still wide enough to be the sphere's shoulder, which on
  this scan is y≈0.787, right where the profile narrows into the apex nub. A rescan
  stays correct.
- **Load.** The dither threshold ramps from 1, so the image develops in over
  ~1.15s. That is the only entrance animation; `prefers-reduced-motion` skips it
  along with the rotation and the bob.
- **The About dialog dims with a checkerboard, not a translucent black** — which
  would render as grey. A 50% scrim of pure ink half-erases the page instead,
  dimming it without leaving 1-bit.

## The favicon

`app/icon.svg` is **generated from the scan**, not drawn by hand:

```bash
npm run favicon
```

Because the Hasaleh is a body of revolution, its silhouette is completely
determined by the maximum radius at each height. The script measures `r(y)` from
`public/hasaleh.mesh` and mirrors that profile about the axis, so the outline is
the real object's, to within the band resolution.

`npm run model` runs it too, since the icon derives from the mesh.

Tuned for where a favicon is actually seen: 26 bands rather than the mesh's full
detail (which becomes noise at 16px), a deliberately heavy 3-unit stroke (a thin
one vanishes at that size), and two smoothing passes to take the scan's
measurement jitter out of the outline. It also carries a
`prefers-color-scheme: dark` rule — the deep brand green disappears against a dark
browser toolbar, so it lightens to `#34d399` there.

## Structure

```
app/
  page.tsx                 reads the ledger, renders the bank
  layout.tsx               metadata, loads globals.css
  globals.css              all design tokens and layout
  page.tsx                 Arabic, RTL
  en/page.tsx              English, LTR
  icon.svg                 favicon, generated from the scan
  components/
    Bank.tsx               client shell, polls for new entries
    MoneyBox.tsx           loads the scan + Bayer dither post-pass
    Ledger.tsx             the T-account rail
    About.tsx              modal, focus-trapped
  api/
    ledger/route.ts        GET, public and CORS-open
lib/
  i18n.ts                  ar/en dictionaries, direction, Arabic plurals
  currency.ts              JOD, 1000 fils, 3 decimals — one source of truth
  sanity.ts                read-only client, no token
  ledger.ts                GROQ query + the balance derivation
  types.ts                 shapes shared with client components
  format.ts                money and date formatting
sanity/
  schemaTypes/
    ledgerEntry.ts         copy into your Studio project
scripts/
  prepare-model.mjs        OBJ -> decimated, uprighted binary mesh
  make-favicon.mjs         mesh -> silhouette outline in app/icon.svg
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
