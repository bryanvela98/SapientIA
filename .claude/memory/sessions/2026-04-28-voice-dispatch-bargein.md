# 2026-04-28 — Voice command dispatch + barge-in (Day 7 Commit 3/6)

Wires the parsed `CommandIntent`s from Commit 2 to the matching outer-
component actions, plus barge-in semantics: voice activation cancels
any in-flight TTS (mirror of STT-cancels-TTS from Day 4 Commit 5).

## Done
- `frontend/src/hooks/useVoiceCommandDispatch.ts` — pure dispatch
  table. Takes 8 deps (`onRecap`, `onSend`, `setPacing`,
  `setTtsEnabled`, `setMinimized`, `cancelTts`, `stopVoice`,
  `armAudio`) and returns a `useCallback` that switches on
  `intent.type` to fire the right action.
  - `tts-on` arms audio first, then sets `setTtsEnabled(true)`. Voice
    activation IS a user gesture per browser autoplay policy, so this
    works without an explicit click on the AudioArmBanner — the gesture
    is consumed when the recognizer's keyup fires.
  - `tts-off` disables TTS AND calls `cancelTts()` so the in-flight
    utterance silences immediately.
  - `cancel` calls both `cancelTts` and `stopVoice` (the user wants
    quiet — no synth, no recognizer).
  - `minimize-on/off` route through the `setMinimized` setter from
    `useMinimizedUi`, NOT a direct localStorage write — single source
    of truth (ADR-033).
- `Chat.tsx` wiring:
  - `ChatSession` now receives `setTtsEnabled` and `setMinimized` as
    props from the outer `Chat()`. Required because `useTtsEnabled`
    and `useMinimizedUi` are called at the `Chat()` level (their state
    drives header chrome) but the dispatch lives inside `ChatSession`
    where the session-scoped action callbacks (`onRecapRequest`,
    `onSend`, `onPacingToggle`) are defined.
  - `voiceStopRef` carries `voice.stop` into the dispatch so the
    `cancel` intent can stop the recognizer without a circular ref.
    Updated in an effect (lint rule `react-hooks/refs` forbids ref
    writes during render).
  - `useVoiceCommands({ onDispatch: dispatchVoice, onActivate:
    cancelTts })` — the activation hook fires the moment the user
    presses Shift+V (before the recognizer even runs), cancelling
    in-flight TTS so the mic doesn't pick up the synth voice and so
    the learner gets immediate quiet.
- Tests:
  - `frontend/src/hooks/__tests__/useVoiceCommandDispatch.test.tsx` —
    9 tests: each intent fires the right dep, `tts-on` ordering
    (arm → enable), `tts-off` calls both setter + cancelTts,
    `cancel` calls both cancelTts + stopVoice, `minimize-*` routes
    through the hook setter, no cross-contamination (a single intent
    only fires its declared deps).
  - `frontend/src/components/__tests__/VoiceCommandBanner.test.tsx` —
    6 tests: idle renders nothing, listening shows assertive live-
    region with the prompt, parsed shows the heard label, dispatched
    shows the check + label, no-match error shows the help list,
    other recognizer errors render the message verbatim.

## Design decisions
### `useVoiceCommandDispatch` extracted as a hook (not inline in Chat)
The dispatch table is 9 branches plus deps wiring; inlining it in
Chat.tsx would have meant another 60-line useCallback with a deps
array of 8 items. Extracting also lets the unit tests assert each
branch's exact behavior without rendering the full Chat component
tree (which would pull in router, store, all the streaming hooks).
The hook is small enough that "is this a worthwhile abstraction?"
isn't really at stake — it's the test-affordance that justified it.

### `tts-on` arms audio before enabling
Browser autoplay policy: SpeechSynthesis silently drops `speak()`
calls until the tab has received a user gesture. Voice command
activation is a user gesture (Shift+V keydown). The dispatch table's
`tts-on` branch arms audio explicitly via `useAudioArmed`'s setter
before flipping the TTS toggle, so the next tutor turn's TTS plays
on Safari/Chrome without requiring the AudioArmBanner click.

### `cancel` does NOT setMinimized or setPacing
"Cancel" is specifically about silencing — TTS off, recognizer off.
It doesn't restore default pacing or unminimize the UI; those are
separate intents. Keeps the mental model clean: "stop" silences,
"restore" un-minimizes, "speed up" un-slows.

### Voice "minimize" routes through useMinimizedUi
Codified in ADR-033 (logged in Commit 6). The plan called this out
as a "critical rule" — if voice "minimize" wrote to localStorage
directly, the keyboard chord (Shift+M) and the voice command would
race for the source of truth. By routing through `setMinimized`
(the hook's update fn), both paths converge on the same state +
the same persistence rule.

### Barge-in fires on `onActivate`, not on parse
The plan considered firing barge-in only after a successful parse,
but the rationale for cancelling early is stronger: the moment the
learner presses Shift+V, they don't want to hear the synth voice
while speaking — both because mic feedback corrupts the recognizer
and because the user's intent is "I'm taking control now." Mirrors
STT-cancels-TTS exactly.

## Broke / gotchas
- **Ref write during render** — initially wrote
  `voiceStopRef.current = voice.stop` directly in the function body.
  Lint flagged with `react-hooks/refs: Cannot update ref during
  render`. Fixed by wrapping in a `useEffect(() => { … }, [voice.stop])`.
- **Forward-references in `useVoiceCommandDispatch` deps** — the
  arrows `() => onRecapRequest()` and `() => onSend(message)` look
  up identifiers that are declared *later* in the same render scope.
  Works because the arrow body is only invoked at voice-command time
  (TDZ check happens at call time, by which point the consts are
  initialized). Documented in the dispatch hook's comment so a
  future contributor doesn't try to "fix" the ordering.
- **Unused `minimized` prop on ChatSession** — initially threaded
  `minimized` through as a prop alongside `setMinimized`, then
  realized ChatSession never reads it (the `data-focus-minimized`
  attribute is applied at `<html>` level by the hook itself). Pruned.

## Checkpoint gate
- ✅ `npm run test:ci` — 92/92 (77 prior + 9 dispatch + 6 banner).
- ✅ `npx tsc --noEmit` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` clean. Bundle delta ~+0.8 KB JS.
- ⏳ Manual: each grammar entry triggers its action; `minimize` via
  voice toggles the same Shift+M state; TTS cancels on voice
  activation. Deferred to the audit (Commit 1, deferred per user).

## Follow-ups surfaced
- **ADR-033 logging** — voice "minimize" routes through useMinimizedUi
  (single source of truth). Ladders into the wrap commit.
- **`armAudio` ordering** — currently arms then enables in the
  dispatch hook. If a future change adds a third TTS-related path
  (e.g. a dedicated TTS rate control via voice), factor the
  arm-then-enable into a small utility so the policy isn't repeated.
- **Voice command grammar expansion** — the post-hackathon backlog
  in `next-steps.md` lists freeform parsing + multi-step intents.
  The current `useVoiceCommandDispatch` switch statement is the
  natural extension point.