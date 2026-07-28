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
| Schema | `ledgerEntry` and `jarda`, MCP-managed on workspace `default` |
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
Studio project. The files in [sanity/schemaTypes/](sanity/schemaTypes/) are
**mirrors** of it for reference and version history, not the source of truth.
Editing them changes nothing on its own.

Both types are bilingual, Arabic field first: `labelAr`/`label` and `noteAr`/`note`
on an entry, `titleAr`/`title` and `bodyAr`/`body` on a جردة. Either side may be left
empty — the site falls back to the other language, so a half-translated document
still renders rather than going blank.

Two consequences:

- The MCP schema format takes declarative values only, so the deployed version
  drops every `preview.prepare`, the `initialValue` date default, and the
  `validation` rules. Those live in the mirrors for whenever the types are adopted
  into a real Studio.
- When the larger Zawyeh site gets a proper Studio in its own repo, adopt this type
  into it and deploy with `npx sanity@latest schema deploy` from then on. Mixing
  the two is what makes deployed and source schemas drift apart.

### Sample entries

Seven samples were used to verify the whole chain, then unpublished so no invented
figures sit on a public ledger. They are drafts in the Studio — publish any of them
to bring them back, or delete them and start recording real ones.

`data/seed-entries.json` plus `npm run seed` (needs `SANITY_WRITE_TOKEN`) remains
available if you ever want to bulk-import from a file again.

## الجردة — the monthly stocktake

A second document type in the Studio, alongside the ledger entry. Once a month, in
prose, **why** the money went where it went — so the ledger says more than what was
spent, and the reasoning is public alongside the figures.

In the rail it is a ruled band across both columns: the month, what moved through it,
and a line to open it. Closed by default; hovering or focusing it fills the band with
ink; clicking expands the reasoning in place.

Five treatments were mocked up before this one — an inverted band, a bookmark tab, a
margin brace, and two ruled variants. Notes on why this one:

- **It spans both columns and paints over the spine.** Structural, not decorative: a
  transaction belongs to one side of a T-account, and a month's reckoning belongs to
  the whole page. It is the only row that crosses.
- **Ink only on hover, never at rest.** A permanently inverted band was the most
  striking option and the wrong one — the newest entry is already an ink block, and a
  second persistent invert would stop the invert meaning "this is the live one".
- **It opens in place, not in a dialog.** The About modal already owns that gesture,
  and a reckoning belongs inside the ledger rather than floating over it.
- **The highlight has no transition.** A fade between paper and ink passes through
  every midtone in between, which is the one thing this palette forbids. It snaps.

Two rules the data side keeps:

- **The totals beside it are derived, never typed.** `view()` computes each month's in
  and out from the entries. An editor able to type a total could contradict the ledger
  printed directly beneath it — on a transparency page, that is the one bug that must
  not ship. Do not add an amount field to this type.
- **It sits at the head of its month**, above that month's newest entry. A real ledger
  totals at the *end* of a period, but this rail runs newest-first, so "below July's
  entries" is chronologically June and reads ambiguously.

Months with no published جردة simply flow on — an empty divider every month would be
worse than none. At most one is shown per month: if two documents claim the same
month, the most recently edited wins.

`/api/ledger` gained a `reviews` array. `entries` is untouched, so anything already
consuming that endpoint keeps working.

### Month names

The Arabic page uses the **Levantine** months — كانون الثاني، شباط، آذار، نيسان، أيار،
حزيران، تموز، آب، أيلول، تشرين الأول، تشرين الثاني، كانون الأول — not the
transliterated Gregorian ones (يوليو، أغسطس), which read as Gulf or Egyptian press and
would sound borrowed on a ledger kept in Amman. They are hardcoded in `lib/i18n.ts`
rather than taken from `toLocaleDateString('ar-JO')`, whose answer has changed between
ICU versions; the month a reader sees should not depend on which Node built the page.

The year appears only when it is not the current one, matching how entry dates behave.

## The ledger keeps Amman time

`LEDGER_TIME_ZONE` in `lib/format.ts` is `Asia/Amman`, and every date the site shows
resolves through it.

This started as a real bug the جردة exposed. On local time the same entry rendered as
`31.07` in Amman and `01.08` in London — and once entries were grouped into months, an
entry could sit under a month whose date it did not display. It also removes a
server/client split: each جردة's totals are derived on the server, which runs UTC,
while the dates beside them are formatted in the browser.

The domain answer settles it: this is a Jordanian organisation's book. A figure
recorded on the 31st was recorded on the 31st, and it should say so to someone reading
anywhere.

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

Re-run it after a rescan. The OBJ stays the source of truth.

### Getting the processed model back out

`public/hasaleh.mesh` is a custom binary only this app reads. To get the cleaned-up
model into something Blender, Rhino, C4D or a slicer can open:

```bash
npm run obj
```

That writes `hasaleh media/hasaleh-processed.obj` — 33,460 triangles against the raw
scan's 265k and about a tenth the size, with the 2.31° lean straightened, centred on
the origin, scaled to 2.1 units tall, and smooth normals recomputed. No UVs, because
the scan has none. To trade file size
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

- **Three inks, from a دفتر الديوان.** The palette is read off an Ottoman-era
  ledger book rather than invented: warm cream paper, entries written in a
  blue-black iron-gall ink, and a column grid printed in red *before* anyone wrote a
  figure on it.

  | token | value | is |
  | --- | --- | --- |
  | `--ground` | `#f3ece1` | the paper |
  | `--mark` | `#1a3a6b` | anything a hand puts on it |
  | `--rule` | `#b0453c` | anything the press put there first |

  That division is the whole discipline, and it is why three colours do not read as
  three colours: **nothing written is ever red, and no rule is ever ink.** Emphasis
  is still inversion, never hue — the newest entry is an ink block, not a red one.

  Ink is 9.6:1 on the paper, up from the 7.15:1 of the sapphire-on-white this
  replaces, so it is comfortably AAA and gives the fine dithered detail on the
  object more to stand against. It stays navy rather than going black because it has
  to read as ink. The rule is 4.8:1 — past 3:1 for non-text graphics with room
  spare, and deliberately well short of the ink, because a ruling that competes with
  the writing is a ruling drawn wrong.

  The ruling follows the book too. In the دفتر the vertical column rules are
  unbroken red and the horizontal ruling is much finer, so `--rule-v` is solid and
  `--rule-h` / `--rule-h-faint` stay dithered. The dither is no longer there to fake
  a lighter value — the colour does that now — it is there to keep the page one
  raster.

  **The three tokens in `app/globals.css` are the single source of truth.**
  `MoneyBox.tsx` reads `--ground` and `--mark` at runtime and
  `scripts/make-favicon.mjs` parses `--mark` out of the stylesheet, so the palette is
  never restated. That indirection exists because it was once hardcoded in three
  places and silently kept the old colour through a palette change — the favicon
  stopped matching the site and nothing caught it. The one place a value *is*
  restated is `themeColor` in `app/layout.tsx`: Next resolves viewport metadata on
  the server, before a stylesheet exists, so it cannot read a custom property. It is
  commented there and has to be changed by hand alongside `--ground`.

  The object itself is still strictly two colours. Red never touches the dither.
  **`MoneyBox.tsx` reads both tokens out of the stylesheet at runtime**, so the
  WebGL dither uses exactly the same pair as the CSS checkerboards and the palette
  is never duplicated in JS. It deliberately does not build a `THREE.Color`: three
  would convert into its linear working space, and the dither pass writes straight
  to the canvas with no sRGB encode, which renders the colour far too dark.
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
  would render as grey. A 50% scrim of the *paper* colour half-erases the page
  instead, veiling it without introducing a value that is not in the palette.

## The drawn marks

Every brand asset on the page is a **real brush drawing**, traced to vector — no type,
no bitmaps:

```bash
npm run marks        # hasaleh logo.png    -> public/wordmark.svg
                     # zawyeh-sun.png      -> public/zawyeh-sun.svg
npm run favicon      # hasaleh favicon.png -> app/icon.svg (on the coin)
```

The sun lives in the shared `zawyeh space/media/`, not in `hasaleh media/`, and is
referenced across the sub-brand boundary rather than copied in. It belongs to the
parent brand and every Zawyeh property should draw the same file; a local copy is how
two Zawyehs end up on one website.

The tracing is shared, in `scripts/lib/trace-bitmap.mjs`. It is exact rather than
curve-fitted: every boundary between an inked pixel and a blank one becomes a directed
unit edge with the ink on its left, and the edges link head-to-tail into closed loops.
That gives correct winding for free, so the counters inside the ه and the ص stay holes
— and it is what lets a traced glyph be punched out of a disc with `evenodd`.

Simplification is Douglas-Peucker with **the tolerance stated in output units, not
source pixels**. That matters twice over. It means the same drawing rendered 200px wide
and 16px wide wants the same number; and it means the right number depends on the
source's resolution. The logo is 1367px wide and simplifies well at 1.1 units of a
1000-unit viewBox — 7300 traced points down to 346, 4.5 KB. The sun is only 257px, so
at anything under about 4 units the trace is finer than its own pixel staircase and
removes almost nothing (1327 points, 15 KB); at 4 it is 225 points and 3.2 KB and
indistinguishable at 200px, let alone the 34px it is drawn at. Past about 9 its long
lower-left ray visibly facets.

### The masthead lockup

**Zawyeh's sun, a red rule, then this ledger's name.** The order is the hierarchy: the
institution, then the thing that belongs to it. The rule is solid, like every vertical
in this palette — at that length a dithered one reads as five dots rather than a
divider.

The sun is **first in the DOM**, and the flex row follows `dir`, so it leads in both
languages — rightmost in Arabic, leftmost in English — without a direction-specific
rule anywhere.

Both marks are **CSS masks over `currentColor`**: the shape comes from the asset, the
colour from the cascade, so they take `--mark` like every other stroke on the page and
cannot drift apart from it. Both are sized by *height*, with width from a `calc()`
carrying the viewBox aspect, so a redraw at a different pixel size does not resize the
masthead — but a redraw at a different *aspect* means updating that ratio.

The sun is set taller than the wordmark (2.65rem against 2rem) because it is a compact
mark next to a wide one: matching their heights leaves the sun looking like a bullet.

Both masked elements deliberately have **no text child**: the accessible name is an
`aria-label`, because a real text node inside would be masked along with the drawing
and show through the letterforms as nonsense. The masthead is also centre-aligned
rather than baseline-aligned now — with no type left on that side, a flex baseline
falls to the first mark's bottom margin edge and dropped the nav well below the lockup.

### The favicon

`app/icon.svg` is the **حص mark struck on a coin**, and it took three revisions to get
there. Each failure is worth knowing:

1. **The money box itself**, traced from the scan's own silhouette. Accurate, and at
   the 16px a favicon is actually shown at, unreadable — a hollow ovoid with a nub,
   which is a lamp or a vase or nothing. (The icon no longer derives from the mesh, so
   `npm run model` no longer runs it.)
2. **A plain milled coin.** Reads at every size, says nothing about Hasaleh in
   particular.
3. **Both.** The coin carries the shape, the drawn mark carries the identity.

One path, `fill-rule: evenodd`, so the disc and the mark punched out of it are a single
silhouette that works on any background — which a favicon has to, because it sits in
browser chrome and cannot assume the paper behind it. Nothing is stroked.

Three proportions, all of them constrained rather than chosen:

- **Reeds shallow and frequent** (24 at 0.8 units). The first attempt used 14 at 1.5
  and read unmistakably as *gear teeth* — a cog, not a coin. Below about a unit of
  depth they stop being teeth and become milling. At 16px they fall under a device
  pixel each and average back into a slightly soft edge, which is the correct
  failure: it degrades to a plain disc, not to a sprocket.
- **The mark 22 units wide.** The drawing is about 1.67× wider than tall, so width is
  what binds. At 24 it reaches past the notch floor and eats into the milling, which
  reads as a broken rim rather than a struck face.
- **No inner ring.** The mark is the device now. A ring as well is too much detail for
  a 32-unit box, and inverting the rim proportions — a wide band around a small
  centre — reads as a washer.

The mark alone, without the coin, was tried and rejected: at 1.67:1 it fits the square
so poorly that at 16px it collapses into a flat squiggle. The disc is what gives it
presence at the size that matters.

It also carries a `prefers-color-scheme: dark` rule — the ink disappears against a
dark browser toolbar, so it lightens to `--mark-on-dark` there. Both colours are read
from `globals.css` at generation time, never restated in the script.

## Structure

```
app/
  page.tsx                 reads the ledger, renders the bank
  layout.tsx               metadata, loads globals.css
  globals.css              all design tokens and layout
  page.tsx                 Arabic, RTL
  en/page.tsx              English, LTR
  icon.svg                 favicon, the حص mark struck on a coin
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
  lib/trace-bitmap.mjs     bitmap -> SVG outlines; shared by the two below
  make-favicon.mjs         mark PNG -> coin in app/icon.svg
  make-marks.mjs           logo + sun PNGs -> traced SVGs in public/
  seed-sanity.mjs          one-time import of the sample entries
data/
  seed-entries.json        sample data for the import; unused at runtime
public/
  hasaleh.mesh             generated by npm run model
  wordmark.svg             generated by npm run marks
  zawyeh-sun.svg           generated by npm run marks
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
