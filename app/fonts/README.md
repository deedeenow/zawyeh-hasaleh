# Arabic font drop-in

Put the font file here (`.woff2` strongly preferred, `.otf`/`.ttf` accepted) and
tell me the filename — wiring it is a three-line change:

1. `app/fonts.ts` declares it with `next/font/local`, which self-hosts and
   preloads it, so there is no network round-trip to Google and no layout shift.
2. `app/layout.tsx` puts the generated class on `<html>`.
3. `--display-ar` / `--body-ar` in `app/globals.css` point at the CSS variable
   the loader exposes.

Two things to check when choosing:

- **It must cover Arabic-Indic shaping**, not just isolated letterforms — the
  glyphs have to join. Decorative display faces often break at 13px, which is why
  Diwan Kufi was rejected here.
- **Latin coverage is optional.** Latin text and all figures stay in Copperplate
  and Menlo, so the Arabic face only needs Arabic.

A variable font is ideal — one file covers every weight.
