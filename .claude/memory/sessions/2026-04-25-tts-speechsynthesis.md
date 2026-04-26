# 2026-04-25 — TTS via SpeechSynthesis (Day 4 Commit 4/6)

## Done
### Core TTS plumbing
- `src/lib/tts.ts` — thin wrapper over `window.speechSynthesis`. Key
  pieces:
  - `isTtsSupported()` — feature detect. Hides the toggle on Firefox /
    older mobile Safari instead of crashing.
  - `getVoices()` — async voice cache. Chrome populates voices via the
    `voiceschanged` event, so calling `synth.getVoices()` on mount
    typically returns `[]`. The promise resolves on first non-empty
    return, with a 2s fallback timeout so callers don't hang on browsers
    that never fire the event.
  - `pickVoice(locale, voices)` — exact-locale → same-prefix → default
    fallback chain.
  - `speak(text, opts)` — enqueues an utterance. `interrupt: true`
    cancels in-flight; default false so `concept_earned` lands after the
    sentence currently playing (per plan). Voice assignment is best-
    effort — only attempts to set `utt.voice` if the cache is warm.
  - `pause() / resume() / cancel()` and a tri-state `ttsStatus()`
    (`idle | speaking | paused`) used by the `K` keybinding.

### Profile-aware toggle + autoplay-gesture tracking
- `src/lib/useTts.ts` —
  - `defaultTtsEnabled(profile)` — `visual=low-vision` defaults ON,
    everything else OFF. Screen-reader default is explicitly OFF to
    avoid synth/SR audio clash (the learner can opt in if they want the
    synth voice instead).
  - `useTtsEnabled(profile)` — localStorage-persisted toggle under
    `sapientia.ui.ttsEnabled`. Stored value wins over profile default so
    an explicit user choice survives profile edits.
  - `useAudioArmed()` — tracks the browser's autoplay-policy gesture
    requirement. Chrome/Safari silently drop `speak()` until the tab
    receives a user gesture; we track this via sessionStorage (survives
    reload on the same tab, fresh tab re-arms). Auto-arms on the first
    `pointerdown` or `keydown` anywhere in the document; also exposes
    an explicit `arm()` for the banner button.

### Live-turn subscriber with sentence buffering
- `src/hooks/useTtsForLiveTurn.ts` — the load-bearing piece. Subscribes
  to the Zustand `live` turn, `earned`, and `told` arrays:
  - Tracks `spokenOffsetRef` (how many chars of `live.text` we've
    already consumed) and `bufferRef` (un-spoken tail waiting for a
    sentence boundary). On every `text_delta`-driven store update we
    append the fresh slice to the buffer and, if `findLastSentenceEnd`
    returns a non-negative index, speak everything up to that point
    and keep the remainder.
  - `findLastSentenceEnd(buf)` — walks the buffer, treats `. ! ? \n` as
    candidates, requires the *next* char to be whitespace or end-of-
    buffer (one-char lookahead also skips a closing quote/bracket). Why
    the whitespace requirement: avoids speaking "e.g." as a full
    sentence mid-word. Why not regex: I wanted left-to-right single-
    pass tracking of the **last** valid end so we don't speak micro-
    fragments when the model emits two sentences in one delta.
  - On turn boundary (`live.turn_number` changes) we `cancel()` and
    reset — prevents the previous turn's tail from playing over the
    new one.
  - On turn_end (`live → null`) we flush any remaining buffer so a
    trailing "Answer?" without a final period still gets spoken.
  - `concept_earned` / `concept_told` get their own discrete utterances
    — short, queued (no interrupt) — so the milestone lands *after* the
    current sentence finishes. Uses `earnedCountRef`/`toldCountRef` as
    watermarks to avoid re-announcing history on remount.

### UI
- `src/components/TtsToggle.tsx` — shadcn `Switch` + visible "Read
  aloud" label + `<kbd>K</kbd>` hint that appears when TTS is enabled.
  `aria-keyshortcuts="K"` for SR exposure. Lives in the chat header
  next to `ThemeToggle`; only rendered when `isTtsSupported()`.
- `src/components/AudioArmBanner.tsx` — dismissible banner rendered at
  the top of `ChatSession` when `ttsEnabled && !ttsArmed`. Copy reads
  "Click to enable audio. Your browser blocks speech until you
  interact with the page." Not strictly required (the global gesture
  listener also arms on any interaction), but makes the requirement
  legible instead of silent.
- `src/hooks/useTtsKeyboard.ts` — window-level `K` handler. Skips
  input/textarea/contenteditable targets so typing "k" mid-word
  doesn't hijack speech. Pauses when status is `speaking`, resumes when
  `paused`, no-op when `idle`.

### Wire-up in Chat.tsx
- Top-level `Chat` owns `useTtsEnabled` + `useAudioArmed` + the
  `useTtsForLiveTurn` / `useTtsKeyboard` subscriptions so there's one
  source of truth. `ChatSession` receives `ttsEnabled`, `ttsArmed`,
  `onArmAudio` by prop (no context, no store bloat — follows the same
  pattern as `debugOpen`).
- Header order (session route): DebugToggle · TtsToggle · ThemeToggle ·
  profile summary · New topic · Edit profile. TtsToggle is hidden on
  unsupported browsers so the header collapses cleanly.

## Design decisions
- **Sentence boundary vs per-token speech.** Per-token
  `SpeechSynthesis.speak()` cancels whatever's playing and restarts, so
  you get stuttered word-at-a-time speech with no prosody. Sentence
  buffering gives the synth a full clause to intonate — sounds like
  actual reading. Latency cost: the first sentence delays until the
  model emits a period, not a huge deal for a ~2s first-sentence.
- **Default OFF for `visual=screen-reader`.** Tempting to auto-play
  for screen-reader users ("they need audio"), but they *already* have
  audio via the SR. Running both causes a double-utterance clash that
  is actively harmful. Let them opt in if they prefer the synth voice.
- **Gesture arming via sessionStorage, not localStorage.** A fresh tab
  on Chrome/Safari enforces the autoplay policy regardless of what
  happened in a prior tab. sessionStorage matches that scope exactly.
- **`K` only outside inputs.** A global `K` shortcut would steal every
  lowercase k the user types. Checking `activeElement.tagName` at the
  listener layer is uglier than `Radix Shortcut` but has no extra deps.
- **Why a banner AND a silent auto-arm.** Either one alone is worse:
  auto-arm-only leaves the user wondering why no audio until they
  happen to click; banner-only without auto-arm means a user who
  clicks Send first hears nothing for the first turn. Both = robust.

## Broke / gotchas
- **Strict-mode double-mount re-announcing earned concepts.** Initial
  implementation captured `earnedCountRef = useRef(0)`, so in dev's
  strict-mode double-invoke the second mount saw `earned.length > 0`
  and re-spoke every existing item. Fixed by initialising the refs to
  `earned.length`/`told.length` at mount so they represent "already
  observed," not "zero."
- **`live.text` reference churn vs content.** Zustand produces a new
  `live` object on every reducer call, so the subscriber effect fires
  on every `text_delta`. Correct — what we want. Dependency array is
  `[live, ...]` not `[live.text, ...]` because `live` can go to null
  (turn_end) and we need to flush.
- **Voice cache cold-start silence.** First `speak()` call on Chrome
  can land before `voiceschanged` fires. I opted to *not* block the
  speak on `getVoices()` — the utterance still plays with the browser
  default voice; the first call just misses the locale-preferred
  voice. Subsequent calls get the preferred voice from the warmed
  cache. Avoids a multi-hundred-ms delay on the very first sentence.

## Checkpoint gate
Code-level:
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` — 384 kB JS (121 kB gz); +6 kB over Commit 3 for
  tts.ts + useTts.ts + hooks + TtsToggle + AudioArmBanner.

Browser-verifiable (deferred to pause before Commit 5):
- ⏳ `visual=low-vision` profile: start a session, see TTS toggle ON by
  default, hear synth voice streaming sentences as the tutor replies.
- ⏳ Toggle OFF mid-turn → speech cuts immediately, no tail utterance.
- ⏳ `K` outside composer pauses/resumes; typing `k` inside the
  textarea does nothing.
- ⏳ Deep-link to `/chat/:id` with TTS enabled → "Enable audio" banner
  shows; clicking anywhere dismisses it; banner does not reappear on
  the same tab after reload.
- ⏳ `concept_earned` announced as its own utterance after the in-
  flight sentence completes.
- ⏳ Firefox: TTS toggle hidden, no console errors, typing still works.

## Open questions / deferred
- **No unit test for `findLastSentenceEnd` / buffer flush.** The plan
  calls for one but the frontend has no test runner set up yet
  (package.json has no vitest / jest). Rather than bolt vitest in
  under this commit, deferred as a standalone setup task — likely
  first use will be the dual-live-region DOM test in Commit 6.
- **Voice picker UI.** Today we auto-pick the default voice for the
  user's locale. If the locale has multiple synth voices with very
  different quality (Safari Daniel vs Samantha, etc.), the user has
  no way to choose. Flag if anyone reports robotic output.
- **Rate / pitch controls.** Hard-coded at 1.0/1.0. Low-vision users
  sometimes prefer 1.2x–1.5x rate. Would go into a TTS settings
  disclosure if we add voice picker.
- **Banner dismissal persistence.** Banner reappears across tabs
  (sessionStorage scope). Acceptable — it's one click. If we ever
  promote to localStorage, a user who disables audio in the browser
  settings would lose the escape hatch.

## Next action (Commit 5 — STT push-to-talk)
- Pause for browser verification of the TTS flow first.
- After verify, ship `src/lib/stt.ts` (feature detect +
  `createRecognizer` wrapper), `MicButton` in the composer, Space-to-
  hold with 200ms gate inside the textarea, interim/final result
  rendering, pause-TTS-during-recording wiring. Hide the mic entirely
  on Firefox (no SpeechRecognition).