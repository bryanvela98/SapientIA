# 2026-04-26 — Pacing toggle + "Recap so far" button (Day 5 Commit 5/6)

## Done
### Backend — force_recap
- `TurnRequest.force_recap: bool = False`.
- `stream_turn(..., force_recap=False)` and `build_system_prompt(...,
  force_recap=False)` thread the flag through.
- `maybe_recap_nudge(..., force=False)`: when `force=True`, returns a
  strong directive ("learner has EXPLICITLY asked for a recap. Fire
  `progress_summary` this turn — do not ask a Socratic question
  instead") regardless of the `unrecapped` counter. Force wins over
  the soft wording so the button is predictable.
- 3 new backend tests: force directive content, precedence over soft
  nudge wording, `build_system_prompt` threading.

### Frontend — Recap so far
- `streamTurn(sessionId, message, { forceRecap? })`. When set, adds
  `force_recap: true` to the POST body (matching the pydantic field
  name).
- `RecapButton` component — outline variant, disabled when
  `earnedCount === 0` (with explanatory tooltip: "Recaps unlock after
  your first earned concept"), disabled while a turn is streaming
  (spam-click guard). Click fires a synthetic user turn with text
  `"[user requested recap]"` and `forceRecap: true`.
- `onRecapRequest` in `Chat.tsx` mirrors `onSend`'s SSE-consumption
  loop but with the synthetic message + `forceRecap` option. The
  synthetic user turn is persisted as a normal user Turn so hydration
  preserves the recap request.
- `RecapButton.test.tsx` — 3 tests (disabled-when-empty,
  enabled-after-earn, disabled-respects-streaming-guard).

### Frontend — Slow down (pacing toggle)
- `PacingToggle` Switch. ON → profile.pacing='slow', OFF → 'normal'.
  Simple presentation component; caller owns PATCH.
- `onPacingToggle` in `Chat.tsx`: optimistic update (store first),
  then `updateProfile(learner.id, next)`. On failure, revert the
  store and surface the error. Disabled when no learner is resolved
  yet (new anonymous visitors land on /onboarding first so this is
  mostly a safety case).
- **Mid-stream pacing toggle** lands on the NEXT turn — the current
  turn's system prompt is already on the wire. Documented in the
  PacingToggle component comment; no attempt to hot-swap.

## Design decisions
### Synthetic user message text
`"[user requested recap]"` — brackets make it visibly distinct from
typed user messages in the transcript, so sighted users reading the
scrollback can tell this was a button click, not a typed request. The
server sees it as any other user content; the `force_recap` flag on
the TurnRequest is what actually changes behavior.

### No cross-tab mirroring of the pacing toggle
Plan mentioned "mirrored across tabs via the storage event". Skipped
— zustand isn't cross-tab by default, a storage-event relay is extra
scope, and the single-tab hackathon demo path doesn't hit the
limitation. Backlogged in next-steps.md.

### Disabled state on RecapButton
Two layers:
1. **External disabled prop** — set `true` while streaming (from the
   parent's `streaming` state). Prevents spam-clicking a second recap
   while the first is still arriving.
2. **Internal disabled** — set `true` when `earnedCount === 0`. The
   tooltip explains why. Catches "why is this button dead" confusion
   without adding an extra info icon.

## Broke / gotchas
- **Flaky integration test on first run.** `test_text_delta_events_
  assemble_primary_text` failed once with an assertion about the
  assembled string, passed cleanly on re-run. Real-API tests
  occasionally vary; the failure wasn't about Commit 5 code.
  Re-ran full suite → 36/36 green.
- **`useCallback` dep array had to include `addRecap`**. Vitest
  + the store selectors meant every add-to-array caused the callback
  to close over a stale reference; listing addRecap in deps keeps the
  closure in sync. Same pattern as Commit 3's `onSend`.
- **TS import cleanup**. The edits left
  `AccessibilityProfile` imported in `Chat.tsx` after I stopped
  needing it. `tsc --noEmit` caught the unused-type on first run and
  `no-unused-vars` followed. Removed in the same commit.

## Checkpoint gate
- ✅ `pytest tests -q` — 36/36 green.
- ✅ `npm run test:ci` — 25/25 green (6 suites).
- ✅ `tsc` + `lint` clean. `npm run build` 393.97 kB JS (+1.7 kB).
- ⏳ Manual: click Recap with 3+ earned → recap fires; toggle Slow
  mid-stream → next turn uses slow pacing, current turn unchanged. In
  the Commit 6 audit.

## Follow-ups surfaced
- **No new ADR.** The force_recap flag is a small extension of ADR-026's
  soft-nudge decision, not a new architectural choice.
- **Next turn's system prompt with force_recap=true.** Model strongly
  biased to fire `progress_summary` but still free to refuse if the
  content demands otherwise (e.g., learner wrote a message between
  clicking the button and the POST landing). Acceptable — refusals
  surface in the tool_decision stream.