# 2026-04-26 — Vitest setup + first dual-live-region test (Day 5 Commit 1/6)

## Done
- vitest 4.1.5 installed with `@testing-library/react` 16.3, `jest-dom`,
  `user-event`, `jsdom`. `test` + `test:ci` scripts in package.json.
- `vitest.config.ts` is orthogonal to `vite.config.ts` — only the React
  plugin and the `@/` alias. The `@tailwindcss/vite` plugin is
  intentionally NOT loaded in jsdom: Tailwind v4 + jsdom has bitten other
  projects, and we don't need Tailwind to evaluate for a unit test. If
  CSS-dependent assertions come up later, `css: true` can flip back.
- `src/test/setup.ts` — `matchMedia` stub (jsdom lacks it; `useTheme`
  needs it the instant any routed component mounts), `afterEach(cleanup)`.
- `src/test/render.tsx` — `renderWithRouter` helper around `MemoryRouter`.
  Not used by the first tests (neither LiveAnnouncer nor findLastSentenceEnd
  need routing) but kept as a small investment so the first routed test
  doesn't rewrite this.
- Paid back the deferred item from Day 4's session log: `LiveAnnouncer.
  test.tsx` asserts `role="alert"` + `aria-live="assertive"` +
  `aria-atomic="true"` + sr-only class, announce-on-earned, 4s clear with
  fake timers, and the ADR-022 watermark-rebase-after-resetSession
  regression guard.
- Extracted `findLastSentenceEnd` from `useTtsForLiveTurn` into
  `src/lib/sentence.ts`. Both call sites (the hook and the new test)
  import from there; zero behavior change for the hook.

## Design decisions
- **Why a separate `vitest.config.ts` instead of extending `vite.config.ts`
  via `mergeConfig`?** Tests don't need Tailwind v4's `@tailwindcss/vite`
  plugin, and loading it under jsdom is an unpredictable-cost proposition
  (it walks the CSS graph). The configs share the `@/` alias verbatim; if
  we grow a second alias, DRY it into a shared `aliases.ts` rather than
  merging the full Vite plugin list.
- **Why extract `findLastSentenceEnd` before testing it?** Leaving it as
  an internal function inside the hook means the only way to test it is
  through the hook — which means rendering a component, driving store
  updates, and asserting `speak()` got called. For a pure string helper
  with 8 boundary cases, that's a lot of ceremony. One-line export, one
  line import change, eight tiny tests.

## Broke / gotchas
- **First `sentence.test.ts` run failed on the `e.g.` case.** I had
  written `expect(findLastSentenceEnd('so e.g. the thing')).toBe(-1)` on
  the assumption the function would refuse to treat any `e.g.` as a
  boundary. The function actually DOES treat the trailing `. ` as a
  boundary (the first `.` followed by `g` is correctly skipped, but the
  second `.` followed by space is a terminator). The function's behavior
  is correct for TTS — speaking "so e.g." then pausing is fine — I had
  just written the wrong expectation. Updated the test to assert the
  actual boundary position rather than -1.
- **`npm run test:ci` runs `vitest run --reporter=verbose`.** `vitest`
  alone defaults to watch mode; `run` is one-shot. `--reporter=verbose`
  gives per-test pass/fail lines, which I find easier to read in the CI
  output than dots.

## Checkpoint gate
- ✅ `npm run test:ci` — 12/12 green (4 component + 8 pure).
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` clean (390.03 kB JS, 123.16 kB gz — unchanged from
  the Day 4 baseline; the sentence helper was a pure extraction and the
  tests don't ship).

## Follow-ups surfaced
- None for this commit's code. The setup unblocks reducer tests (store
  slice of progress_summary in Commit 3) and component tests
  (RecapBubble in Commit 4, RecapButton in Commit 5) — those are their
  own items in `next-steps.md`.