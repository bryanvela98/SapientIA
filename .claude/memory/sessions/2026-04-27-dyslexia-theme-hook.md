# 2026-04-27 — Dyslexia-font theme + useLearningMode (Day 6 Commit 3/6)

## Done
- New `[data-learning='dyslexia-font'] body` block in `index.css`:
  - `font-family: var(--font-dyslexia)` — switches to the Atkinson
    chain established in Commit 2.
  - `letter-spacing: 0.02em` + `word-spacing: 0.06em` — light touch.
    Atkinson's metrics already do most of the legibility work; we
    don't need aggressive spacing.
- Compound selector
  `[data-learning='dyslexia-font'][data-cognitive='plain-language']
  body { line-height: 1.75 }` resolves the Day 5 next-steps open
  question — see ADR-029. Cognitive's 17px stays; line-height
  nudges +0.05 for Atkinson's metrics.
- `useLearningMode(profile)` — applies/removes `data-learning` on
  `<html>` with the value (`'dyslexia-font'` or `'adhd-focus'`),
  removes when profile.learning is `'none'`. Mirror of
  `useCognitiveMode` (ADR-027 pattern).
- Wired into Chat.tsx alongside `useTheme`, `useCognitiveMode`.
- 5 hook tests in `useLearningMode.test.tsx` — apply each value,
  default no-op, unmount cleanup, rerender swaps value.

## Design decisions
### Single attribute slot for two LD axes
The schema makes `learning` mutually exclusive (`Literal['dyslexia-
font', 'adhd-focus', 'none']`), so a single `data-learning`
attribute holding the value is enough. CSS scopes by the value:
`[data-learning='dyslexia-font']` and `[data-learning='adhd-focus']`
are independent blocks. If the schema ever splits the axes (rare),
this hook gets two attributes; not a now-problem.

### ADR-029 — cap body font-size at 17px
The Day 5 next-steps open question worried about cognitive (17px)
+ dyslexia (Atkinson) producing oversized text. Decision: don't
add another font-size bump; cap body at 17px regardless. Reasoning:
Atkinson at 17px renders comfortably (the typeface runs slightly
smaller than system-ui), and adding more pixels on top would
crowd the 60ch bubble max-width that cognitive already enforces.

### Cleanup on unmount
Like `useCognitiveMode`, the hook removes the attribute on unmount.
Matters mostly for vitest leak prevention; in prod the route lives
for the app's lifetime.

## Broke / gotchas
- **Storage shim wasn't needed for this hook.** `useLearningMode`
  doesn't persist anywhere — the profile is the source of truth.
  Kept the test-file scope tight to the attribute behavior; no
  localStorage interactions.
- **5 hook tests still 30/30 vitest** — Storage shim arrives in
  Commit 4 with the minimize-UI hook.

## Checkpoint gate
- ✅ `npm run test:ci` — 30/30 green at end of commit.
- ✅ tsc + lint + build clean.
- ⏳ Manual visual diff at `/chat` with `learning='dyslexia-font'`:
  font visibly shifts to Atkinson. Deferred to the audit.

## Follow-ups surfaced
- **ADR-029 logged** — cap body font-size when cognitive +
  dyslexia stack.
- **Composition with high-contrast** — three-way stack
  (high-contrast + cognitive + dyslexia) is exercised at the CSS
  level via independent attribute selectors. Manual visual check
  deferred to the audit.