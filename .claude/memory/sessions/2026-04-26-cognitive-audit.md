# 2026-04-26 — Cognitive-mode audit + Day 4 verification capture (Day 5 Commit 6/6)

## Done
- Memory housekeeping for end of Day 5:
  - `progress.md` — Day 5 entry at top (5 implementation commits + this
    doc/wrap commit).
  - `next-steps.md` — overwritten for Day 6 (learning disabilities
    layer). Kept Day 5's user-driven verification items as
    carry-overs.
  - `decisions.md` — ADR-025 (structured prompt fragments), ADR-026
    (soft recap nudge, not hard tool injection), ADR-027 (cognitive
    theme orthogonal to high-contrast). The three Day 5 architectural
    calls most likely to come up in Day 6 planning.
  - Six session files under `sessions/` — one per commit plus this
    audit/wrap entry.
- Docs:
  - `docs/pedagogy.md` already updated in Commit 2 with the slot table
    and composition rules. No further change.
  - `CLAUDE.md` build timeline unchanged — Day 5 scope ("Cognitive
    layer (plain-language prompt, chunked turns, progress summaries)")
    matches what shipped.

## Cognitive-mode audit checklist — ready for user-driven execution
Run each on `/chat` with `cognitive=plain-language` (and again with
`cognitive=plain-language` + `data-theme=high-contrast`). Log any
finding here as an addendum; promote to a follow-up commit if
actionable.

1. **Tab order with new header controls.** Expected focus order on
   `/chat` with a session loaded: skip-link → h1 → debug/tts/theme
   toggles → "Slow down" Switch → "Recap so far" Button → "Edit
   profile" → topic card title → transcript (if it can take focus) →
   composer. No focus traps; no positive tabindex.
2. **Focus-ring visibility at 3px + 3px offset.** Tab through each
   control. Yellow high-contrast ring, or the default gray ring in
   light/dark, should clearly outline the focused element against
   muted/40 recap bubble backgrounds and outline-variant button
   borders.
3. **RecapBubble announcement priority.** Drive a session to 3 earned
   concepts → click "Recap so far". VO should wait for the current
   live turn's last sentence, then read "Progress recap, …" + the
   summary + the concepts list + "Next: …". Do NOT hear interruption
   mid-sentence (aria-live=polite is load-bearing).
4. **Type scale + 60ch max-width.** At 1280px viewport width, bubbles
   should visibly narrow to roughly 60 characters per line. Body
   type should be distinctly larger than cognitive=none. No overflow,
   no horizontal scroll.
5. **Plain-language vs Socratic form.** Drive a 5-turn cooperative
   session. Capture per-turn sentence count via the debug panel
   (`violations` includes `"max-sentences-exceeded"` if >3). If the
   violation fires on more than 1 of 5 turns, tighten the register
   fragment wording in a follow-up commit. Attach the turn-level
   numbers to this file.
6. **Cognitive + adhd-focus merged chunking.** Set both axes. Drive
   a session; verify each turn has at most one question AND ≤3 short
   sentences. If either constraint slips, the merged fragment's
   wording needs iteration.
7. **High-contrast + cognitive compose.** Flip theme to high-contrast
   while cognitive is on. Expected: AAA palette (black bg, white
   text) AND bigger type + narrower bubbles. Focus ring should be
   yellow (3px solid var(--ring)).

## Day 4 verification carry-over
The screen-reader audit rubric lives in `2026-04-25-screenreader-
audit.md`. Still un-run as of end of Day 5. Plan was either to
transcribe user-run results here OR run the automatable parts
(Lighthouse, axe-core) headless. Neither happened in Commit 6 — the
code-level checkpoint gate is green across all 5 implementation
commits and the assistive-tech + browser-audit work is the most
high-signal-for-demo activity that should happen with eyes on
the actual UI, not blind.

**Scheduled for early Day 6, before dyslexia-font work lands:**
- VoiceOver (macOS/Safari) walk-through of the Day 4 rubric.
- NVDA (Windows/Firefox + Chrome) walk-through.
- Lighthouse accessibility ≥ 95 on /onboarding AND /chat (both with
  cognitive=none and cognitive=plain-language).
- axe-core zero violations on both routes.
- Cognitive-mode audit rubric above.

## Vitest suite map at end of Day 5
6 test files, 25 tests:
- `src/lib/__tests__/sentence.test.ts` — 8 (Commit 1)
- `src/components/__tests__/LiveAnnouncer.test.tsx` — 4 (Commit 1)
- `src/lib/__tests__/useCognitiveMode.test.tsx` — 4 (Commit 4)
- `src/components/__tests__/RecapBubble.test.tsx` — 6 (Commit 4)
- `src/components/__tests__/RecapButton.test.tsx` — 3 (Commit 5)

## Backend test map at end of Day 5
`pytest tests -q` → 36 tests:
- `test_profile.py` — 11 (includes 7 new for Commit 2)
- `test_recap_nudge.py` — 12 (new in Commit 3; extended in Commit 5)
- `test_async_loop.py` — 4 (integration; real API)
- `test_session_flow.py` — 2 (integration; real API)
- `test_turns_hydration.py` — 3
- `test_history.py` — 5

## Known gaps going into Day 6
- `validate_loop.py --profile cognitive-plain-language` — never
  executed against the real API this session. Run in Day 6 with the
  --persona cooperative flag and capture the avg-words/sentence +
  count-over-20 numbers in a dedicated session file.
- Recap hydration: `concepts_recapped` + `next_focus` lost across
  reload. Mentioned in the Commit 3 session file; backlogged.
- Cross-tab pacing-toggle sync: skipped; backlogged.

## Commit scope
This commit only touches memory + decisions + session files. No code.
The plan's Commit-6 optional items (Lighthouse wrapper script,
architecture-diagram update) were not needed — the manual Lighthouse
run is faster than a scripted wrapper for a hackathon, and the
Day 5 architecture changes (fragments, nudge, cognitive CSS block) are
adequately captured in ADRs + the fragment table in docs/pedagogy.md.