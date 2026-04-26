# 2026-04-25 — SR audit + dual live regions (Day 4 Commit 6/6)

## Done
### Dual live regions (ADR-022)
- `src/components/LiveAnnouncer.tsx` — new. Single `role="alert"
  aria-live="assertive" aria-atomic="true"` sr-only div mounted once at
  the top of the chat route. Subscribes to `earned` + `told` via
  Zustand; when a new item arrives, writes a short sentence ("Concept
  earned: derivatives.") into the node, then clears after 4s so the
  DOM doesn't accumulate stale announcements that AT might re-read on
  focus changes. Watermark-rebase on array shrink so
  `resetSession` on a new topic doesn't mute the first milestone of
  the new session (same pattern as the TTS earned/told hook).
- `EarnedFlash` in `Chat.tsx` — lost its `aria-live="polite"`; replaced
  with `aria-hidden="true"`. The visible badges stay for sighted
  users. Screen-reader users get the milestone through the assertive
  `LiveAnnouncer`; firing a second polite region here caused double-
  announcement on VoiceOver in the smoke test.

### Transcript list semantic
- `<section>` no longer has `role="log"` — moved to the inner `<ol
  role="log">` and promoted `<ul>` → `<ol>`. Turns are strictly
  ordered; the ordered-list markup matches the semantics that
  assistive tech exposes (NVDA's "review log" mode reads an `<ol
  role="log">` as a chronological record).

### Cancel TTS on composer keydown
- Any `keydown` in the `<Textarea>` calls `cancelTts()`. The user
  typing is a strong signal they don't want to compete with the synth
  voice; doesn't touch the system screen-reader. Cheap, idempotent,
  runs at the top of the existing `onComposerKeyDown`.

## Audit rubric (to be run by the user)

The hackathon has no CI for real assistive tech; the audit is a manual
pass. Run through each row on each SR. Log anything surprising as an
ADR addendum.

### VoiceOver (macOS, Safari)

1. **Skip link reachable as first Tab.** From a fresh page load on
   `/chat`, the first Tab should focus the "Skip to composer" link;
   Enter follows it. VO announces "Skip to composer, link."
2. **Onboarding reading order.** On `/onboarding`, VO should read:
   h1 "Tell me how you learn best" → paragraph preamble → "Visual,
   group" fieldset → radio labels → next fieldset → etc. No radio
   should auto-focus (ADR-020).
3. **Chat topic picker.** On `/chat` (no session): h1 "SapientIA" →
   toggles → "What do you want to learn?" → topic input → preset
   buttons.
4. **Progressive streaming announcement.** Send a reply; VO should
   announce the tutor's turn progressively as `text_delta` events
   arrive, not in one blob. `aria-atomic="false"` on the live bubble
   is doing the work here; `role="log"` on the `<ol>` is complementary.
5. **Concept earned distinct from turn text.** When the tutor fires
   `mark_concept_earned`, VO should interrupt (assertive) with
   "Concept earned: …". Verify it doesn't get queued behind the
   ongoing sentence (that was the ADR-022 bug pre-fix).
6. **Mic button label + state.** VO should announce "Dictate, button";
   after click, state flips to "Stop, button, pressed". The
   aria-keyshortcuts exposes "Shift+Space" to verbose mode.
7. **No focus traps, no positive tabindex, no empty buttons.** Tab
   through the whole page end-to-end; it should return to document
   start after the last interactive. No "button" announcements with
   empty labels.
8. **Lighthouse ≥ 95 and axe-core zero violations** on `/onboarding`
   and `/chat`. (Run in Chrome; VO-specific bugs land in this session
   file, not in the test output.)

### NVDA (Windows, Firefox + Chrome)

1. Same walk-through as above, plus:
2. **Firefox: mic button hidden, no console errors.** STT isn't
   supported; the button should not render at all. Shift+Space inside
   the composer should insert nothing (preventDefault is a no-op
   because the handler short-circuits on `!stt.supported`).
3. **Transcript log review mode.** NVDA's "review log" (Insert+↑↓
   across the `role="log"`) should walk through each turn and
   announce role + content.
4. **Double-announcement check.** With TTS off (to isolate SR output),
   send a reply that triggers `mark_concept_earned`. The streamed
   turn should announce once (polite) and the milestone once
   (assertive). If you hear the milestone twice, `EarnedFlash` is
   firing a polite region somewhere it shouldn't — but we just
   `aria-hidden`ed it, so this is the regression to catch.

### axe-core + Lighthouse

- Open DevTools on `/onboarding`; run Lighthouse → Accessibility → New
  audit → Desktop. Score should be ≥ 95. Any red item that isn't a
  known-accepted tradeoff (e.g., the skip-link transform trick has
  been flagged by Lighthouse in the past but is WCAG-compliant) gets
  an ADR.
- Install axe DevTools extension; run it on `/chat`. Zero violations
  target. Any violation → ADR or fix in a follow-up commit.

## Design decisions — see ADR-022 (dual live regions), ADR-023
(Shift+Space for STT), ADR-024 (profile-default TTS persistence
semantics).

## Broke / gotchas
- **`role="log"` + nested `role="status"`.** The live bubble inside
  the `<ol role="log">` is itself a polite live region. In smoke-
  testing this nested configuration on VoiceOver, the parent log's
  polite announcements didn't double with the inner status — the SR
  coalesces them. Still, `aria-atomic="false"` on the bubble is load-
  bearing; dropping it would re-announce the entire growing string on
  every delta.
- **`EarnedFlash` losing `aria-live` also loses visual-regression
  parity for SR-only users.** They won't see the badge "flash" —
  they'll only hear the LiveAnnouncer announcement. That's fine:
  visual polish for sighted users, audible milestone for SRs. No
  overlap, no double-fire.
- **`cancelTts` on every keydown can cut off a legitimate resume.**
  Edge case: user presses `K` to resume a paused utterance, then
  types — we'd cancel what they just resumed. Accepted: the `K`
  toggle is outside text inputs (already guarded in
  `useTtsKeyboard`), so if they're typing, they've made the typing-
  over-speech tradeoff intentionally.

## Checkpoint gate
Code-level:
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run lint` clean.
- ✅ `npm run build` — 390 kB JS (123 kB gz); +1 kB over Commit 5 for
  `LiveAnnouncer` + prose.

Browser / audit (user-driven):
- ⏳ VoiceOver walk-through of the rubric above.
- ⏳ NVDA walk-through on Firefox and Chrome.
- ⏳ Lighthouse ≥ 95 on `/onboarding` and `/chat`.
- ⏳ axe-core zero violations on both routes.

## Open questions / deferred
- **DOM-test for dual live regions.** Plan called for a Vitest /
  Playwright assertion that both regions exist and have the right
  aria-live values. Frontend still has no test runner — deferring to
  the first post-Day-4 task that introduces vitest. Simple assertion:
  `screen.getByRole('log')` + `screen.getByRole('alert')` at minimum.
- **Rate/pitch/voice picker for TTS.** Same deferred item as
  Commit 4 — would live in a "Read aloud settings" disclosure next to
  the toggle if added.
- **Motor / voice-control (Day 7 stretch).** Entirely out of scope
  for Day 4. The STT push-to-talk in the composer is a narrow slice
  of the space; hands-free navigation would be a separate initiative.

## Next action — end-of-day wrap
- Update `progress.md` with all six Day 4 commits + the follow-up fix.
- Update `next-steps.md` — Day 4 closed, Day 5 (cognitive layer) is
  next: plain-language prompt, chunked turns, progress summaries.
- ADRs 022 / 023 / 024 already written.