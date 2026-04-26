# 2026-04-25 — Delta append + skip links + high-contrast (Day 4 Commit 3/6)

## Done
### Token-delta append (the load-bearing piece)
- `src/lib/types.ts` — added `TextDelta` variant to the SSE event union:
  `{ type: 'text_delta'; text: string; block_index: number }`. Added
  optional `block_index?` to `ToolDecision` for future per-block routing
  (not used by the UI today — `tool_choice: any` gives us exactly one
  teaching tool_use per turn).
- `src/lib/store.ts` — **split the reducer**:
  - `applyTextDelta(ev)` **appends** `ev.text` to `live.text`. Never
    replaces. This is the progressive-reveal path.
  - `applyDecision(ev)` only records metadata (`tool_name`,
    `hint_level`) and pushes into `decisions[]`. **Does NOT touch
    `live.text` anymore** — the text stream owns it. Prevents the Day 3
    class of bug where a late decision would overwrite accumulated
    chars (Commit `44a9a82` territory).
- `src/routes/Chat.tsx` — event loop now handles `text_delta` first in
  the chain; `tool_decision` still fires but is a metadata-only update.
  Dep-array on `useCallback` updated to include `applyTextDelta`.

### Skip links
- `src/components/SkipLink.tsx` — new component. `sr-only` by default,
  `focus:not-sr-only` reveals on focus with a high-contrast focus ring
  and fixed positioning so it's not masked by the header.
- `Chat.tsx` — `<SkipLink href="#composer">Skip to composer</SkipLink>`
  when on a session; `<SkipLink href="#topic-input">Skip to topic
  input</SkipLink>` on the picker route. Composer `<form>` gets
  `id="composer" tabIndex={-1}` so browser anchor navigation lands
  focus on the form; screen reader announces the form landmark, user
  Tabs to the labeled textarea.
- `Onboarding.tsx` — `<SkipLink href="#first-field">Skip to
  form</SkipLink>`. First RadioField wrapped in
  `<div id="first-field" tabIndex={-1} class="focus:outline-none">` so
  focus lands on the fieldset group; VO announces "Visual, group" first.

### High-contrast theme
- `src/index.css` — added `[data-theme='high-contrast']` block
  overriding the oklch palette: pure black background, pure white
  foreground, saturated yellow (`oklch(0.88 0.22 95)`) focus ring,
  bright red for destructive. Targets WCAG AAA (21:1 for body text).
- `src/lib/useTheme.ts` — tri-state hook: `light | dark | high-contrast`.
  Applies BOTH a `.dark` class (so Tailwind `dark:` utilities fire in
  dark AND high-contrast) AND a `data-theme` attribute (so the palette
  overrides kick in). Light removes both. Persisted in
  `localStorage` under `sapientia.ui.theme`.
- `src/components/ThemeToggle.tsx` — shadcn `Select` cycling the three
  themes. Labeled "Theme" + `aria-label="Color theme"`. Lives in the
  Chat header next to the debug switch.

## Design decisions
- **Why `applyDecision` stops touching `live.text`**: the Day 3 reducer
  overwrote `live.text` on every decision with
  `d.input.question/hint/answer`. That was correct when we only had
  event-level streaming (one tool_decision per turn = one replace).
  With token-level streaming it would race: text_delta appends one
  character at a time, but tool_decision arrives at the end with the
  whole string, and the final set would… actually also land the right
  thing. **But**: if text_delta ever ran slightly ahead (fast SDK on
  small payload), tool_decision's final replace could look like a
  one-frame "reset and reappear" to the user. Safer to make the two
  reducers orthogonal: text_delta owns the text channel, tool_decision
  owns the metadata channel.
- **Why wrap the first fieldset in a div for skip target**: couldn't
  attach `id` + `tabIndex` to the shadcn RadioField component without
  changing its signature. A wrapper div is less invasive and keeps
  the fieldset semantics intact.
- **Why Select for theme toggle instead of Switch**: three states
  (light, dark, high-contrast) — Switch is binary. Tried a cycle
  button first; Select is more discoverable and the options announce
  individually to screen readers.

## Broke / gotchas
- **JSX fragment + nested close tags**: adding `<SkipLink>` outside the
  `<main>` required wrapping the whole return in `<>…</>`. The tsc
  feedback caught each unclosed tag quickly.
- **`.dark` class + `data-theme="high-contrast"` interaction**: shadcn
  components use `dark:` utilities for surface colors. If I set only
  `data-theme="high-contrast"` and dropped the `.dark` class, bits of
  light-mode styling leaked through (e.g., button hover states). Fixed
  by applying both `.dark` class and `data-theme` attribute for
  non-light themes. Light removes both.
- The wrapper div around the first RadioField has
  `className="focus:outline-none"` so the skip-link-driven focus
  doesn't show an ugly default browser outline (focus still goes to
  the radio on next Tab; ring shows there).

## Checkpoint gate
Code-level:
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` — 378 kB JS (119 kB gz); +1 kB over Commit 1 for
  SkipLink + ThemeToggle + useTheme.

Browser-verifiable (deferred to pause before Commit 4):
- ⏳ New tutor turn: text visibly streams in, not all-at-once.
- ⏳ Tab from page load on `/chat` → first focusable is the skip link;
  Enter follows it; focus lands on the composer.
- ⏳ Theme toggle cycles light → dark → high-contrast; persists
  across reload; high-contrast shows black/white/yellow focus rings.
- ⏳ Lighthouse a11y score on `/chat` ≥ 95 in high-contrast.

## Open questions / deferred
- **Skip link invisibility when inside a transformed ancestor**: CSS
  `focus:fixed` lifts the skip link out of the flow, but if an
  ancestor creates a stacking context, `z-50` might not be enough.
  So far no issue observed; flag if it shows up.
- **Theme auto-detection from `prefers-color-scheme`**: not wired
  today. The user explicitly picks a theme. Could hook that up as an
  "auto" fourth option later.

## Next action (Commit 4 — TTS)
- Pause for browser verification first. The token-level streaming is
  the single highest-risk change of Day 4; if something's off,
  Commit 4's TTS layer would amplify the bug.
- After verify, ship `src/lib/tts.ts` + `src/hooks/useTtsForLiveTurn.ts`
  + `src/components/TtsToggle.tsx`. Auto-play for
  `visual=low-vision`, toggle-off default for `visual=screen-reader`
  (SR clash). One-time gesture banner for deep-linked `/chat` sessions.