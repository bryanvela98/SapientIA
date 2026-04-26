# 2026-04-25 — STT push-to-talk (Day 4 Commit 5/6)

## Done
### Core STT wrapper
- `src/lib/stt.ts` — thin wrapper around `window.SpeechRecognition /
  webkitSpeechRecognition`:
  - `supportsStt()` — feature detect via `getCtor()` (checks both the
    standard and `webkit`-prefixed constructors). Firefox returns false
    — the entire mic UI is gated on this and unmounts cleanly.
  - Inline types for `SpeechRecognition` — the Web Speech API is still
    not in lib.dom.d.ts as of TS 6. Pulling
    `@types/dom-speech-recognition` for one file wasn't worth the dep
    cost; minimal `SrInstance` / `SrResultEventLike` shapes cover what
    we use.
  - `createRecognizer({lang, interim, continuous})` — builds a
    configured instance, wires the four events (start/end/result/
    error), and returns a thin `Recognizer` with `start / stop / abort
    / on`. `start()` and `stop()` swallow the "already running / not
    started" exceptions that the spec throws on invalid state, so
    callers can call them optimistically.
  - `continuous: false` (default) — push-to-talk maps cleanly to a
    single-utterance lifecycle: press/hold to open the mic, release to
    submit the final. `continuous: true` would queue results per
    natural pause, which is the wrong mental model for PTT.
  - `sttErrorMessage(code)` — readable messages for the most common
    error codes (`not-allowed`, `no-speech`, `audio-capture`, `network`,
    `aborted`). `aborted` returns an empty string so a user-triggered
    stop doesn't produce a banner.

### React hook
- `src/hooks/useStt.ts` — `useStt({lang, onFinal})` returns
  `{supported, listening, interim, error, start, stop, clearError}`.
  - Recognizer is lazy: `ensureRecognizer()` builds on first `start()`
    call so we don't request mic permission on mount.
  - Interim results write to `interim` state for live preview;
    `onFinal` gets the committed transcript and `interim` clears. The
    consumer owns merging final text into its own state (textarea
    value) — hook stays opinionated only about the recognizer.
  - `onFinal` is kept in a "latest ref" pattern (updated in an
    always-firing `useEffect`) so changing the callback identity
    doesn't rebuild the recognizer. React 19's stricter hooks lint
    forbids ref writes during render, which is why the effect runs on
    every commit.
  - On unmount we `.abort()` and null the ref — guards against the
    "hot reload left a mic open" dev-only nuisance.

### UI components
- `src/components/MicButton.tsx` — lucide `Mic` / `MicOff` icon pair
  with visible "Dictate" / "Stop" label for SR parity. `aria-pressed`
  flips on listening, `aria-keyshortcuts="Shift+Space"` exposes the
  hotkey to assistive tech. Disabled while the tutor is streaming
  (can't dictate a message while the previous one is in flight).
- `src/components/ListeningBanner.tsx` — visible recording indicator
  (pulsing red dot via Tailwind's `animate-ping`) + "Listening…" text
  in an `aria-live="assertive"` region so screen-reader users learn
  the mic is hot *immediately*. The interim preview is nested in a
  `polite` inner span to avoid firing SR announcements on every
  keystroke-equivalent recognition delta.

### Composer integration (Chat.tsx)
- `useStt` lives in `ChatSession`; `onFinal` appends to `message`
  state with a joining space if the textarea already has content. Not
  replacing — lets the user dictate mid-sentence after typing a
  prefix.
- **Keyboard: Shift+Space hold** instead of the plan's bare-Space +
  200ms gate. Reason: intercepting every space on the textarea for a
  timer either adds noticeable latency to normal typing
  (preventDefault then maybe-insert) or requires retroactively deleting
  the just-inserted space when the timer fires (race-prone, cursor-
  position-sensitive). Shift+Space has no keyboard conflict, only
  fires when focus is in the composer, and the preventDefault keeps
  the space out of the textarea. Document-level `keydown`/`keyup`
  listeners manage the arm → start → stop dance.
- Cancel TTS on `startDictation()` — prevents the tutor's synth voice
  being captured as the user's input. We don't resume TTS on stop (the
  user is about to send; no audio needed).
- Interim results render below the textarea in italic muted styling;
  final results flow through `onFinal` into the textarea value, with
  interim clearing on finalization (no visible "jump").
- Error banner for `stt.error` with a Dismiss button — keeps the
  permission-denied / network-failure surface manageable without
  stealing focus.

### Composer-help text
- Reads "Cmd/Ctrl + Enter to send · hold Shift+Space to dictate" when
  STT is supported, plain Cmd/Ctrl hint on Firefox. Discoverable
  without a tooltip.

## Design decisions
- **Shift+Space over 200ms-Space-hold.** The plan offered both; I went
  with Shift+Space. The 200ms gate is clever but the UX is awkward
  either way: you either slow down typing or pull inserted chars back
  out. A modifier key has zero false-positive risk in prose-heavy
  textareas.
- **Click-toggle on MicButton, not click-and-hold.** Click-and-hold on
  touch devices competes with selection gestures and gets aggressive
  on iOS. Toggle semantics (`aria-pressed`) are the WAI-ARIA canonical
  button-as-switch pattern; matches what a screen-reader user will
  expect.
- **`interim` preview stays outside the textarea value.** If we merged
  interim into `message`, we'd have to diff-and-replace on every
  delta, and the user's own typed prefix would be hard to preserve.
  Keeping interim as a separate muted-italic span below is cleaner,
  SR-friendlier (nested `polite` region doesn't spam), and lets the
  user keep typing while dictating if they want.
- **Cancel TTS on listening start, don't resume on stop.** Resuming
  would be nice-ergonomically but most users stop dictating right
  before hitting Send, and the in-flight TTS was from the previous
  turn. Starting a new turn will flush anything lingering anyway.

## Broke / gotchas
- **`onFinalRef.current = onFinal` during render.** Initial useStt
  code set the ref directly in the component body. React 19's
  `react-hooks/refs` ESLint rule flags this (ref writes during render
  can cause stale reads under concurrent rendering). Moved to an
  always-firing `useEffect` that updates the ref on commit. One extra
  effect per render, negligible.
- **SpeechRecognition spec throws on already-started / not-started.**
  Calling `.start()` on an active recognizer throws
  `InvalidStateError`; same for `.stop()` on a not-started one. The
  wrapper swallows those — safer than forcing callers to guard every
  call.
- **Global keydown listener vs composer-scoped.** Chose global
  `keydown`/`keyup` with an `activeElement === composerRef.current`
  check rather than binding to the textarea directly. Reason: when
  the user releases Shift before Space (or vice versa), the keyup
  might not fire on the textarea if focus moved. Global listener +
  armed flag handles the out-of-order release cleanly.
- **`aborted` is intentionally empty-messaged.** Every stop() fires an
  `error` with code `aborted`. Showing the error banner on every stop
  would be noise; the empty message short-circuits the banner render.

## Checkpoint gate
Code-level:
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` — 389 kB JS (123 kB gz); +5 kB over Commit 4 for
  stt.ts + useStt + MicButton + ListeningBanner.

Browser-verifiable (deferred):
- ⏳ Chrome: click Dictate → mic permission prompt → grant → pulsing
  red dot appears → speak → Stop → transcript appended to textarea.
- ⏳ Hold Shift+Space in composer → same flow. Release → stops.
- ⏳ Firefox: MicButton hidden, no console errors, Shift+Space does
  nothing special, typing still works.
- ⏳ Permission denied: red banner with a dismiss button, no crash.
- ⏳ Go offline, try to dictate: banner reads "Voice input requires an
  internet connection."
- ⏳ With TTS on + tutor speaking: clicking Dictate cancels speech
  within ~100ms, no double-capture.
- ⏳ Send a dictated message → tutor replies → concept flow still
  works (no regression).

## Open questions / deferred
- **Unit tests for recognizer wiring.** Same blocker as Commit 4 — no
  test runner in frontend yet. Mocking `SpeechRecognition` would be
  straightforward with vitest once we add it.
- **Continuous mode for longer answers.** Current single-shot mode
  stops on the first natural pause. For longer dictation (60s+), we'd
  want `continuous: true` with a visible "recording time" indicator so
  users know the limit. Defer unless a demo persona hits it.
- **Cursor-position-aware insertion.** `onFinal` appends at the end of
  `message`. If the user has their cursor mid-text, they might prefer
  insertion at the cursor. Textarea-ref-based insertion is fiddly with
  controlled components; skipped for Commit 5.
- **Pause-TTS-while-typing** (Commit 6 plan item) not done here — the
  plan groups it with the screen-reader audit work.

## Next action (Commit 6 — SR audit + dual live regions)
- `src/components/LiveAnnouncer.tsx` — dedicated polite + assertive
  live regions so transcript stream and milestone events don't compete.
- `<ol role="log">` refinement on the transcript.
- `keydown` in composer cancels in-flight TTS (documented plan item).
- Manual VoiceOver / NVDA audit pass — capture findings as ADR-022+ if
  anything surprising.