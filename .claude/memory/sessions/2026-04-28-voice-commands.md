# 2026-04-28 — Voice command infrastructure (Day 7 Commit 2/6)

Day 7's first implementable commit (Commit 1 — verification audit — is
still deferred until after the full implementation lands per user
direction). Ships the plumbing for hands-free use; the dispatch table
that wires intents to actions is Commit 3.

## Done
- `frontend/src/lib/voice-commands.ts` — fixed-keyword grammar.
  - 9 `CommandIntent` variants: `recap`, `send`, `pacing-slow`,
    `pacing-normal`, `tts-on`, `tts-off`, `cancel`, `minimize-on`,
    `minimize-off`.
  - `parseCommand(transcript)` normalizes whitespace + case + drops
    trailing punctuation, then exact-match → length-sorted prefix-match.
    "stop reading" beats "stop" on prefix because the longer phrase is
    sorted first in `ALL_PHRASES`.
  - `COMMAND_LABELS` (display strings) + `COMMAND_HELP_LIST` (short
    list shown in the no-match banner) co-located with the grammar.
- `frontend/src/hooks/useVoiceCommands.ts` — recognizer lifecycle +
  state machine.
  - States: `idle | listening | parsed | dispatched | error`.
  - On final transcript: matched → `parsed`; after 250ms calls
    `onDispatch` and transitions to `dispatched`; after 800ms returns
    to `idle`. Unmatched → `error` with `lastError = 'no-match'`,
    auto-resets after 3s.
  - On recognizer error event: `error` with the friendly message from
    `sttErrorMessage`, auto-reset after 3s.
  - `interim: false, continuous: false` because commands are a single
    utterance; we don't render preview text and the lifecycle ends on
    the first final.
  - Lazy recognizer creation + reuse (300–500ms ctor cost on Chrome).
  - `onActivate` callback fires on every `start()` for Commit 3's
    barge-in (cancel TTS).
- `frontend/src/components/VoiceCommandBanner.tsx` — banner UI.
  - `role="status" aria-live="assertive"` so SR users hear state
    transitions.
  - Distinct visual treatment from `ListeningBanner`: blue pulse for
    listening/parsed, emerald check for dispatched, destructive for
    error. Sighted learners can tell command mode from dictation mode
    at a glance.
  - Pulse hidden from AT (`aria-hidden`); the colored dot is decorative.
  - `data-voice-state` attribute exposed for E2E selectors.
- `frontend/src/components/VoiceCommandButton.tsx` — click-activated
  mirror of Shift+V for users without keyboard access. `aria-pressed`
  + `aria-keyshortcuts="Shift+V"`.
- `Chat.tsx` wiring:
  - `useVoiceCommands()` instantiated alongside `useStt`.
  - Shift+V keyboard hold listener mirrors the Shift+Space STT chord
    pattern but **activeElement guard is inverted**: voice commands
    only fire *outside* text inputs (so typing capital V in the
    composer still types V).
  - `<VoiceCommandBanner>` rendered in the session card next to
    `<ListeningBanner>`.
  - `<VoiceCommandButton>` rendered next to `<MicButton>` — same
    toggle pattern, distinct icon (`Megaphone`).
  - Composer help line gains "hold Shift+V for voice commands" when
    voice is supported.
- Tests:
  - `frontend/src/lib/__tests__/voice-commands.test.ts` — 27 tests:
    19 grammar entries × exact-match, mixed case, whitespace variants,
    trailing punctuation, prefix-match precedence (`stop reading` beats
    `stop`), prefix-match trailing-words (`stop please`, `recap
    quickly`), no-match returns null, empty/whitespace null, every
    intent has a label.
  - `frontend/src/hooks/__tests__/useVoiceCommands.test.tsx` — 8 tests:
    happy-path lifecycle (idle→listening→parsed→dispatched), no-match
    error path, recognizer error path with auto-reset, `supported=false`
    no-op, `onActivate` fires on start, end-before-final returns to
    idle, end-after-final preserves parsed, unmount aborts.

## Design decisions
### Grammar shape — fixed keywords, not freeform
ADR-032 (logged in the wrap commit). Fixed grammar gives predictable UX
and tests cleanly. Freeform / multi-step intents like "go back two
turns" are explicitly post-hackathon. The 9-intent set covers the
critical accessibility actions (recap, pacing, TTS, minimize) plus
basic navigation (send, cancel).

### State machine vs flat function
The barge-in / cancel paths fork cleanly along state transitions: TTS
cancel happens on `start()` (the `onActivate` hook), not on parse;
banner styling is a pure function of state; the 250ms parsed flash and
3s error timeout are state-bound timers. A flat function would
collapse all of that into ad-hoc booleans.

### Why `interim: false`
Commands are single utterances; rendering interim text would just be
distracting "umm…" noise, and the parser only acts on the final
transcript anyway. STT (dictation) keeps `interim: true` because the
preview is useful for the learner to see what was captured before the
final.

### Distinct visual + chord from STT
- STT chord: Shift+Space, fires *inside* composer, red pulse banner.
- Voice command chord: Shift+V, fires *outside* text inputs, blue pulse.

The activeElement guards are inverted on purpose — STT dictates *into*
a textarea, so it requires composer focus; voice commands target page
chrome and shouldn't fire while the learner is typing prose.

### `onDispatch` undefined in Commit 2
The state machine still transitions through `parsed → dispatched →
idle` even with no dispatch callback — the banner shows what was heard,
which is a useful demo even before actions wire. This is the explicit
bisection point the plan calls out: "ship Commit 2 without the
dispatch wiring; Commit 3 picks it up."

## Broke / gotchas
- **`vi.mock` factory hoisting** — vi.mock is hoisted above imports, so
  references to closure variables fail with TDZ. Fixed by using
  `vi.hoisted(() => …)` to declare the shared `recMock` + handlers map
  before vi.mock evaluates. This is the documented vitest pattern for
  this exact case.
- **Lint warning on the keyboard-effect deps array** — using
  `voice.start, voice.stop` directly trips the exhaustive-deps rule,
  which wants the whole `voice` object (would force re-binding the
  listener on every state change). Fixed by lifting into local
  `useCallback` wrappers (`startVoiceCommand`, `stopVoiceCommand`),
  same pattern the existing STT effect uses.
- **`end` event ordering** — the recognizer emits `end` after `result`,
  which would clobber the `parsed` state if we naively reset to idle.
  Fixed with a functional setState that only transitions to idle when
  the prior state was `listening`.

## Checkpoint gate
- ✅ `npm run test:ci` — 77/77 (40 prior + 27 grammar + 8 hook + 2
  rebalanced test counts).
- ✅ `npx tsc --noEmit` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` succeeds; bundle delta ~+3.2 KB JS.
- ⏳ Manual: Shift+V outside composer shows the banner; release stops;
  capital V in composer types V. Deferred to the audit.
- ⏳ No regression on Shift+Space STT — also deferred.

## Follow-ups surfaced
- **Dispatch wiring (Commit 3)** — wires each `CommandIntent` to its
  action: `recap` → `triggerForceRecap`, `send` → `composerSubmit`,
  `pacing-*` → `setPacing`, `tts-*` → TTS toggle, `cancel` →
  `cancelTts + voice.stop`, `minimize-*` → `useMinimizedUi.setMinimized`.
- **Barge-in (Commit 3)** — wire `onActivate: cancelTts` so voice
  activation cancels in-flight TTS, mirroring the STT-cancels-TTS
  rule from Day 4 Commit 5.
- **ADR-032 logging** — fixed-grammar choice gets an ADR in the wrap
  commit (Commit 6).