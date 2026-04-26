# 2026-04-28 — In-app keyboard & voice help dialog (post-Day 7)

Discoverability follow-up after the Day 7 wrap. The `Shift+V` chord
was already mentioned in the composer help line, but the 9-intent
voice grammar was only visible in the no-match error banner, and the
`K` (TTS pause/resume) and `Shift+M` (minimize) chords had no UI
surface at all.

## Done
- `frontend/src/lib/voice-commands.ts` — exported `COMMAND_PHRASES`
  derived from `GRAMMAR` so the help dialog renders the canonical
  phrase list. Single source of truth: parser and UI both read from
  the same array, so the help can't drift from what
  `parseCommand` actually accepts.
- `frontend/src/components/HelpDialog.tsx` — modal triggered by a
  "?" button in the chat header.
  - Built on the existing shadcn `Dialog` primitive (Radix under the
    hood, focus-trapped, Esc-to-close, scrim, all the a11y wiring
    free).
  - Two sections: **Keyboard** (Cmd/Ctrl+Enter, Shift+Space hold,
    Shift+V hold, Shift+M, K) and **Voice commands** (9 intents
    with phrase variants).
  - Each row dims with `(not available in this browser)` when the
    relevant browser feature is absent: voice rows when
    `voiceSupported=false`, dictation row when `sttSupported=false`,
    the K row when `ttsSupported=false`. Firefox sees STT/voice
    rows dimmed; Safari TTS-blocked sees the K row dimmed.
  - `<Kbd>` renders chord keys with consistent monospace styling.
- `Chat.tsx` — `webSpeechSupported = supportsStt()` computed at the
  outer `Chat()` level (one shared boolean for STT and voice — both
  use the Web Speech API), passed down to the trigger alongside
  `ttsSupported`. Trigger placed in the header next to ThemeToggle
  so it sits with the global controls.
- Tests: `frontend/src/components/__tests__/HelpDialog.test.tsx` —
  5 tests:
  - Closed by default until the trigger is clicked.
  - Open shows both Keyboard and Voice sections.
  - All 9 voice intent labels render + at least 2 phrase variants.
  - `voiceSupported=false` renders the "not available in this
    browser" italic note.
  - `ttsSupported=false` marks the K row with the unsupported tag.

## Design decisions
### Modal vs route
A `/help` route would be linkable but adds router state for content
most users open once. Modal beats route for a "show me the chord
sheet" gesture: Esc dismisses, no URL bookkeeping, no back-button
weirdness. The cost is non-shareable — but for a hackathon demo where
everyone running the app has the same controls, that's an acceptable
loss.

### Trigger placement
Header next to `ThemeToggle` rather than inside the session card
header. The chord set is global (Shift+M minimizes, Shift+V issues
voice commands, K controls TTS) — anchoring it next to the global
chrome row matches its scope. Critically, the trigger is NOT wrapped
in `data-minimize-target` because a learner who just minimized the UI
should still be able to find the chord that restores it.

### Single source of truth for the phrase list
`COMMAND_PHRASES` is computed from `GRAMMAR` at module load. If
someone adds an intent variant to `GRAMMAR`, the help dialog updates
automatically. If someone removes an intent, the type system catches
it at the `Record<CommandIntent['type'], readonly string[]>` cast in
voice-commands.ts and the `VOICE_ORDER` array in HelpDialog.tsx —
the loop over `VOICE_ORDER` would error at the lookup. Three guards:
schema-driven phrases, exhaustive labels, exhaustive order.

### Browser-feature awareness in the dialog
The dialog is rendered universally, but rows dim when the underlying
feature isn't available. A Firefox user opens the help and sees the
voice/dictation rows muted with "not available in this browser"
italic notes. This mirrors the existing pattern (MicButton hides
when `!stt.supported`, TtsToggle hides when `!isTtsSupported()`) but
gives the disabled rows a *reason* rather than disappearing — useful
context for a learner trying to figure out why a chord isn't working.

## Broke / gotchas
- **Shadcn dialog already in the project** — confirmed via
  `frontend/src/components/ui/dialog.tsx`. No new package install,
  no new wiring; it's the same primitive used elsewhere in the
  codebase (search-shaped: was added in an earlier day for some other
  modal need but I just consumed it).
- **`COMMAND_PHRASES` type cast** — used `as Record<…>` because the
  reduce can't narrow the accumulator type until the accumulator is
  actually populated. The type system catches a missing intent at
  the call site (HelpDialog's `VOICE_ORDER` array index lookup),
  which is good enough.

## Checkpoint gate
- ✅ `npm run test:ci` — 97/97 (92 prior + 5 dialog).
- ✅ `npx tsc --noEmit` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` succeeds. Bundle delta ~+12 KB JS / +0.5 KB CSS
  (Radix Dialog primitive's first import in this commit pulls in some
  weight; subsequent dialogs are cheap).
- ⏳ Manual: open the help, dismiss with Esc, verify focus returns to
  the trigger; tab through the dialog; verify SR announces the title
  and reads the keyboard + voice sections in order. Deferred to the
  audit that Commit 1 will eventually run.

## Follow-ups surfaced
- **Surface help on `/onboarding` too** — the chord set is documented
  here but onboarding learners may benefit. Trivial follow-up: import
  the same component and place it in the onboarding header.
- **Help dialog open-on-first-visit** — could detect a "have they
  seen the help?" localStorage flag and pop it open once. Adds
  paternalism; defer until a tester says "I had no idea Shift+V was
  a thing."
- **Help section for accessibility profiles** — what each axis does
  (visual / cognitive / learning / pacing). Currently lives in
  /onboarding's per-axis preview text; centralizing it here would
  duplicate. Defer.