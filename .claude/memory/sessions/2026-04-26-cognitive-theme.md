# 2026-04-26 — Cognitive theme + RecapBubble (Day 5 Commit 4/6)

## Done
### Cognitive theme CSS block — see ADR-027
- New `[data-cognitive='plain-language']` block in `index.css`:
  - `body` font-size 17px, line-height 1.7
  - `*:focus-visible` outline 3px solid var(--ring), 3px offset
  - transcript bubbles (`[role='log'] > li > div` and their first-child
    wrapper) max-width 60ch, +0.625rem vertical padding, line-height 1.75
- Orthogonal to `[data-theme='high-contrast']` — no variable touched by
  both. Cognitive only touches layout/type; high-contrast only touches
  palette. Documented in ADR-027.

### useCognitiveMode hook
- `frontend/src/lib/useCognitiveMode.ts` — `useEffect` that sets or
  removes `data-cognitive="plain-language"` on `<html>` based on
  `profile.cognitive`. Cleanup removes the attribute on unmount so
  vitest doesn't leak state between tests (in prod the hook lives for
  the app's lifetime and cleanup mostly doesn't matter).
- Wired into the Chat route root (`Chat.tsx`) alongside `useTheme`,
  `useTtsForLiveTurn`, and `useTtsKeyboard`.

### RecapBubble component
- `frontend/src/components/RecapBubble.tsx` — distinct from
  `AssistantBubble`. `<li>` wrapper, inner `div role="group" aria-
  label="Progress recap" aria-live="polite" aria-atomic="false"` with
  3px left-accent border + muted/40 tint. "Recap" uppercase label,
  summary prose, optional bullet list of concepts, optional "Next:"
  line.
- `Chat.tsx` iterates `turns` and branches on `tool_used ===
  'progress_summary'` to render `RecapBubble` instead of
  `AssistantBubble`. Enriches with `concepts_recapped` + `next_focus`
  from the session-scoped `recaps` store when the turn_number matches;
  after a reload (when the store's empty), it renders with summary
  only — see the hydration caveat in the Commit 3 session file.
- `LiveAssistantBubble` also routes to `RecapBubble` when the
  streaming tool is progress_summary, so the styling lands from the
  first token rather than popping in when the turn commits.

### Onboarding pacing auto-bump
- Selecting `cognitive=plain-language` via the Cognitive radio now
  auto-bumps `pacing` to `slow` (only when currently `normal`) and
  surfaces a polite inline note under the pacing Select: "We nudged
  pacing to Slow to match plain-language mode. You can change it
  below."
- Any explicit pacing change clears the note. This avoids the
  paternalistic pattern of a system-set value re-setting itself every
  time a user bounces around the form.

### Tests
- `RecapBubble.test.tsx` — 6 tests (role + label, summary prose, concepts
  list when provided, concepts omitted when empty/undefined, next-focus
  with "Next:" prefix, empty-summary + streaming fallback).
- `useCognitiveMode.test.tsx` — 4 tests using `renderHook` (applies on
  plain-language, no-op on default, removes on unmount, toggles off on
  rerender with cognitive=none).

## Design decisions
### Why `aria-live="polite"` on the recap, not assertive?
A recap is important but chronology-respecting — it should wait for the
current live turn's sentence to finish. Assertive would interrupt, which
is what `LiveAnnouncer` is for (milestones that JUMP the queue:
`concept_earned`, `concept_told`). Polite on the recap means "announce
when the SR gets a quiet moment."

### Why scope the CSS to `[role='log'] > li > div` rather than class-based?
- Class-based targeting (`.chat-bubble`) would require adding a
  semantic class to every bubble. More churn, more room to miss one.
- `[role='log']` is already set on the transcript `<ol>`. Every bubble
  is a direct `<li>` child with a `<div>` wrapper. Two levels of
  specificity is enough to scope without bleeding.
- One drawback: if we ever add non-bubble children to the log list,
  the selector catches them too. Documented in ADR-027.

### Why the hook returns `void` instead of `[ enabled, setEnabled ]`?
The cognitive mode IS the profile — there's no separate toggle and no
per-user override. The hook is just a DOM-side-effect wrapper. If we
ever add a per-session "preview cognitive mode without saving to
profile" feature, upgrade to `[value, setValue]`.

## Broke / gotchas
- **`RecapBubble` must render inside an `<ol>` or `<ul>`.** It uses
  `<li>` as the top-level element, and the HTML spec doesn't allow a
  bare `<li>`. Added an explicit wrapper in every test render
  (`<ol>{ui}</ol>`) — without it you get a console warning that
  confuses the test output.
- **`useCognitiveMode` cleanup matters for tests.** The first test
  applies `data-cognitive`; without the unmount cleanup, the second
  test would see the attribute already set. With the cleanup, fresh
  state every test. In production this also matters if the Chat route
  unmounts while cognitive was active — the attribute vanishes.
- **`LiveAssistantBubble` routing to `RecapBubble` mid-stream.** Works
  because `applyDecision` sets `live.tool_name` at `content_block_stop`
  on any teaching tool — including `progress_summary`. Before that
  point, `live.tool_name` is null and the plain bubble renders with
  "Thinking…". That's the right default — we don't know yet this is a
  recap until the model commits to the tool.

## Checkpoint gate
- ✅ `npm run test:ci` — 22/22 green (5 suites).
- ✅ `npx tsc` + `npm run lint` clean.
- ✅ `npm run build` — 392.25 kB JS (+2 kB for RecapBubble + hook +
  event wiring), 37.88 kB CSS (+1 kB for the cognitive block).
- ⏳ Visual diff with cognitive=none vs cognitive=plain-language —
  Commit 6 audit item.
- ⏳ High-contrast + cognitive compose — Commit 6 audit item.

## Follow-ups surfaced
- **ADR-027 logged.** See decisions.md.
- **Layout shift mid-session.** Toggling `cognitive=plain-language`
  via `/onboarding` while a session is active will resize the bubbles
  → the `<ol role="log">` reflows → VO may re-announce visible
  content. Not verified; if testers hit it, gate the shift behind a
  route remount. Added to next-steps.md.
- **Cognitive + dyslexia-font metric clash** (Day 6 preview). 17px
  base + OpenDyslexic-class wide metrics could look oversized on
  small screens. Decide in Day 6 whether cognitive-set type-scale
  should back off when dyslexia-font is also active.