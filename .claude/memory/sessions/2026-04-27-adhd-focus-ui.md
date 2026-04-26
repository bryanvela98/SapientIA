# 2026-04-27 — ADHD-focus UI: Shift+M chord + older-turn fade (Day 6 Commit 4/6)

## Done
### A. Minimize-UI chord
- `useMinimizedUi(profile)` — boolean state with ADR-024 explicit-
  only-persistence: profile flips the default (`adhd-focus → ON`),
  storage rules after explicit user toggle. Re-applies the default
  on profile flip only when no stored preference exists. Storage
  key `sapientia.ui.minimized`.
- `Shift+M` outside text inputs toggles. Inside `INPUT`,
  `TEXTAREA`, or `contentEditable`: no-op (capital M still types).
  Plain `M` without Shift: also no-op (so casual typing doesn't
  trigger anywhere). Same activeElement guard pattern as
  `useTtsKeyboard`.
- `MinimizeToggle` button in the chat-route header: ghost variant,
  `aria-pressed={minimized}`, `aria-keyshortcuts="Shift+M"`. Stays
  visible when minimized so the learner has a way back. Label
  flips: "Minimize UI" / "Restore UI".
- Hideable controls wrapped in `<span data-minimize-target>`:
  - Route header: ThemeToggle, TtsToggle, DebugPanelToggle,
    Edit-profile link.
  - Session card header: PacingToggle, RecapButton.
- Always visible: app title, ConceptBadges (turn count), New-topic
  link, MinimizeToggle, transcript, composer, SkipLink, error
  banners.
- CSS rule:
  `[data-focus-minimized='true'] [data-minimize-target] { display: none }`
  collapses them. CSS-only hide means tab order and AT both skip
  the elements.

### B. Older-turn soft-fade
- `[data-learning='adhd-focus'] ol[role='log'] > li:nth-last-child(n+5)`:
  opacity 0.55 with smooth 0.3s transition. `:hover` and
  `:focus-within` restore opacity to 1 so review affordances aren't
  visually dead.
- See ADR-030 — opacity is visual-only; transcript items must
  NEVER carry `aria-hidden`. Sighted ADHD users get the visual
  filter; SR users still walk the full log. The rule is codified
  in the ADR specifically because a future contributor might
  "helpfully" add aria-hidden to make the fade "consistent" — the
  ADR refuses that explicitly.

### C. Vitest Storage shim
- Vitest 4's jsdom localStorage ships missing `removeItem` (warning
  emitted at startup: `--localstorage-file was provided without a
  valid path`). The minimize hook persists via setItem/removeItem,
  so the missing method blocked all 10 new tests with `TypeError:
  localStorage.removeItem is not a function`.
- Replaced both localStorage and sessionStorage in `setup.ts` with
  a Map-backed Storage implementation (length getter, clear,
  getItem, key, removeItem, setItem). `vi.stubGlobal` installs it
  on globalThis so all hooks see the same Storage interface as
  the browser.
- `afterEach` clears both stores so per-test isolation actually
  works (vitest's per-file isolation doesn't reset the same jsdom
  window between tests).

## Design decisions
### Why Shift+M
Existing chords: `K` (TTS pause/resume outside inputs), `Shift+
Space` (STT push-to-talk inside composer). `Shift+M` outside
inputs is collision-free and follows the Shift+letter pattern.
The `M` was chosen for "minimize"; matches the button label.

### Why CSS `display: none` instead of conditional render
Conditional render would mean rendering different JSX trees based
on `minimized`. That's more code, more re-render churn, and
harder to extend if a future feature wants partial hide. CSS-only
hide via attribute selector lets the JSX stay constant; the
attribute toggles in/out, the browser elides the elements.
Tab order and SR experience are clean — `display: none` removes
elements from both, just like an unmounted React node.

### `:nth-last-child(n+5)` threshold
`n+5` means "every list item except the four most recent" —
roughly the last user/assistant pair (2 items) plus the live
bubble (1 item) plus a one-item buffer. If user testing shows
ADHD learners want more or less context, tune the value. The
plan suggested this number; we kept it.

## Broke / gotchas
- **`localStorage.removeItem is not a function`** in vitest 4 —
  see Storage shim above. Took one debugging cycle to identify
  (the test failure list was 10x identical errors). Once shim
  was in place, all 40 tests green on first run.
- **`data-minimize-target` on `<span>`** — TypeScript's React
  typings allow `data-*` attributes via index signature, so no
  cast needed. Verified during tsc; clean.
- **Don't wrap MinimizeToggle in `data-minimize-target`** — that
  would hide the button when minimized, which would lock the
  user out of the toolbar. Caught during the wiring; documented
  in the component comment.

## Checkpoint gate
- ✅ `npm run test:ci` — 40/40 green at end of commit.
- ✅ tsc + lint + build clean. Bundle +1.6 KB JS / +0.3 KB CSS.
- ⏳ Manual: with adhd-focus on, Shift+M hides controls; faded
  older turns still readable on hover; SkipLink still first Tab.
  Deferred to audit.
- ⏳ VoiceOver: faded turns still announce. Deferred to audit.

## Follow-ups surfaced
- **ADR-030 logged** — opacity-only soft-fade rule.
- **Storage shim** is a test-infra change not specific to this
  feature. Documented in the commit message; future tests get the
  shim for free.
- **Voice command "minimize"** for Day 7's motor stretch should
  route through `useMinimizedUi` rather than fighting Shift+M.