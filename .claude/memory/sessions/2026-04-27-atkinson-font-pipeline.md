# 2026-04-27 — Atkinson Hyperlegible asset pipeline (Day 6 Commit 2/6)

## Done
- Picked Atkinson Hyperlegible over OpenDyslexic and Lexend — see
  ADR-028 for the comparison.
- 4 latin woff2 files self-hosted under
  `frontend/public/fonts/atkinson-hyperlegible/`: Regular, Bold,
  Italic, BoldItalic. ~47 KB total — much smaller than the plan's
  150 KB estimate (modern subsetted woff2 is impressive).
- OFL.txt copied verbatim from the upstream `googlefonts/atkinson-
  hyperlegible` repo. Required by SIL OFL 1.1 for redistribution
  (we redistribute by serving from public/).
- `@font-face` blocks in `index.css` for all four faces with
  `font-display: swap` — paint the fallback first, swap when the
  woff2 arrives. No FOIT, slight FOUT.
- `--font-dyslexia: 'Atkinson Hyperlegible', system-ui, …` exposed
  in `:root`. Commit 3's LD theme block consumes it.
- `index.html` preloads only Regular (~11 KB cost on every page
  load regardless of profile). Bold and Italic load on demand via
  the @font-face declaration.

## Design decisions
### Where to source the woff2
Two paths considered:
- **Upstream googlefonts repo** — ships TTF only; we'd need to
  convert to woff2 ourselves. Adds a build step and a tooling
  decision (woff2-encoder choice). Rejected.
- **Google Fonts CSS API with desktop UA** — request `https://
  fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,
  wght@0,400;0,700;1,400;1,700&display=swap` with a real Chrome UA;
  Google returns CSS pointing at woff2 URLs at fonts.gstatic.com.
  We curl those URLs to download the files. **Shipped this path.**
  Pro: zero build tooling, latin-subset already optimized. Con: the
  hash in the URL changes when fonts update; if we ever want to
  refresh, re-fetch.

### Latin-only subset, no unicode-range
Google Fonts ships TWO files per face — `latin` and `latin-ext` —
with `unicode-range` in the @font-face block so browsers download
lazily. We took just `latin` (smaller per face) and dropped the
unicode-range. Tradeoff: non-Latin content (accented characters
beyond ISO-8859-1) falls back to the next family in --font-dyslexia
instead of using a separate latin-ext file. For an English-primary
tutor, that's fine; accented characters in topic names render in
system-ui rather than Atkinson, but are still legible.

### Preload only Regular
Bold and Italic load on demand. Unconditional preload of all four
adds ~46 KB to first paint for every visitor; dyslexia-font is a
minority opt-in. Regular is the only face that lands on first
paint when the toggle is on. If Lighthouse flags the ~11 KB
Regular preload for non-dyslexia users, swap to a dynamic `<link>`
injected only when `profile.learning === 'dyslexia-font'`.

## Broke / gotchas
- **First Google Fonts curl** without a desktop UA returned woff
  + woff2 + .otf URLs (legacy mode for old browsers). Adding a
  Chrome UA narrowed to woff2-only. Saved later confusion.
- **OFL.txt URL.** The upstream repo path is
  `https://raw.githubusercontent.com/googlefonts/atkinson-
  hyperlegible/main/OFL.txt` — needed `-L` on curl for the
  redirect to follow.
- **Hash in the URL.** The `v12` segment + the per-face hash
  in the woff2 URL is Google's internal version pinning. If the
  font updates upstream, our hashes go stale. Acceptable for the
  hackathon; refresh manually if needed.

## Checkpoint gate
- ✅ All 5 files (4 woff2 + OFL.txt) under
  `frontend/public/fonts/atkinson-hyperlegible/`.
- ✅ `npm run build` succeeds; `dist/fonts/atkinson-hyperlegible/`
  contains the same 5 files post-build.
- ✅ `--font-dyslexia` defined in `:root` of index.css.
- ✅ Preload `<link>` in `index.html` for Regular.
- ⏳ DevTools Network tab shows woff2 200 on first paint —
  manual verification step deferred to the audit.

## Follow-ups surfaced
- **ADR-028 logged** — Atkinson choice + self-hosting rationale.
- **OpenDyslexic as a post-hackathon user-selectable option** —
  some dyslexic readers prefer it; "user picks the face" is a
  small UI add-on backlogged under "TTS voice picker"-style
  dropdowns.