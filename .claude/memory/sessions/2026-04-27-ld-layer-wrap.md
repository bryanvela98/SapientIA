# 2026-04-27 — Day 6 wrap: LD layer end-of-day (Day 6 Commit 6/6)

## Done — memory housekeeping
- `progress.md` — Day 6 entry at top covering Commits 2/3/4/5 plus
  this wrap. Commit 1 (verification audit) is explicitly noted as
  deferred to the Day 7 wrap; the audit session-file template
  (`2026-04-27-verification-audit.md`) lives ready for transcription
  when human-driven runs happen.
- `next-steps.md` — overwritten for Day 7. Top sections:
  - Motor / voice-control stretch (ADR-021 slot): voice command
    grammar, push-to-activate Shift+V, barge-in cancels TTS.
  - Demo (90s) + deploy (Vercel/Fly.io vs Render).
  - Verification audit deferred from Day 6 Commit 1.
  - Day 6 user-driven LD verification carry-over.
  - Open questions for Day 7 + the standing backlog.
- `decisions.md` — three new ADRs:
  - **ADR-028** — Atkinson Hyperlegible as the dyslexia font
    (rationale vs OpenDyslexic and Lexend; self-host + OFL).
  - **ADR-029** — cap body font-size at 17px when cognitive +
    dyslexia stack (resolves the Day 5 next-steps open question;
    documents the compound-selector cascade rule).
  - **ADR-030** — opacity-only soft-fade for ADHD-focus, NEVER
    `aria-hidden` on transcript items (codifies the rule against
    a future regression).

## Day 6 commit hashes
- `cb4c6bf` Commit 2 — Atkinson font pipeline
- `49ef2d5` Commit 3 — dyslexia theme + useLearningMode
- `7770af4` Commit 4 — adhd-focus UI + Storage shim
- `19c1700` Commit 5 — max-questions-exceeded violation
- this commit — wrap

(Commit 1 deferred — no hash.)

## Suite state at end of Day 6
- Backend: **47/47 pytest** (+11 over Day 5's 36).
  - test_violations.py adds 9 pure-helper tests.
  - test_recap_nudge.py + others unchanged.
- Frontend: **40/40 vitest** (+15 over Day 5's 25).
  - useLearningMode.test.tsx adds 5.
  - useMinimizedUi.test.tsx adds 10.
- tsc + lint + build clean across all four implementation commits.

## Vitest suite map at end of Day 6
8 test files, 40 tests:
- `src/lib/__tests__/sentence.test.ts` — 8 (Day 5 Commit 1)
- `src/lib/__tests__/useCognitiveMode.test.tsx` — 4 (Day 5 Commit 4)
- `src/lib/__tests__/useLearningMode.test.tsx` — 5 (Day 6 Commit 3)
- `src/lib/__tests__/useMinimizedUi.test.tsx` — 10 (Day 6 Commit 4)
- `src/components/__tests__/LiveAnnouncer.test.tsx` — 4 (Day 5 Commit 1)
- `src/components/__tests__/RecapBubble.test.tsx` — 6 (Day 5 Commit 4)
- `src/components/__tests__/RecapButton.test.tsx` — 3 (Day 5 Commit 5)

## Backend test map at end of Day 6
`pytest tests -q` → 47 tests:
- `test_profile.py` — 11 (Day 4 + Day 5 Commit 2)
- `test_recap_nudge.py` — 12 (Day 5 Commits 3 + 5)
- `test_violations.py` — 9 (Day 6 Commit 5)
- `test_async_loop.py` — 4 integration
- `test_session_flow.py` — 2 integration
- `test_turns_hydration.py` — 3
- `test_history.py` — 6 (one added during Day 4 history work; recount matches)

(If the per-file count drifts from this snapshot, the test_history
count is the most likely culprit — it's the file with the most
incremental additions across days.)

## Known gaps going into Day 7
- **Verification audit (Day 6 Commit 1)** — VO/NVDA/Lighthouse/
  axe-core runs un-done. Session-file template exists, awaiting
  human transcription.
- **`validate_loop.py --profile cognitive-plain-language`** — the
  cognitive sentence-cap drift run still un-executed. Land in the
  Day 7 audit.
- **Worst-case-stack validate_loop preset** — the Day 6 Commit 6
  plan called for a new `--profile worst-case-stack` flag. Not
  added; rolling into Day 7's audit + Stretch profile work as
  needed.
- **Manual UI verification of Day 6 features** — Atkinson font
  rendering, ADHD older-turn fade, Shift+M chord behavior with
  composer focus. Listed in next-steps.md under "Carry-over from
  Day 6 — user-driven LD verification".

## Commit scope
This commit only touches `decisions.md` (tracked) and the local-only
memory files (`progress.md`, `next-steps.md`, six new session files
under `sessions/`). No code. The plan's optional Commit 6 items
(architecture-diagram update, validate_loop preset) were not
needed — the Day 6 architecture changes (font self-host, LD theme
block, minimize-UI chord, question-count violation) are adequately
captured in ADRs and the violations-table in docs/pedagogy.md.

## Day 7 preview
- **Motor / voice-control stretch.** Push-to-activate Shift+V hold
  (mirror of Shift+Space STT). Fixed command grammar: next, back,
  recap, send, slow down, read aloud, stop. Voice "minimize"
  routes through useMinimizedUi.
- **Demo recording.** 90s walk-through. Lead with earned-vs-told,
  fly through profiles, close on motor demo if it lands.
- **Deploy.** Vercel + Fly.io vs Render single-box. SQLite-in-prod
  is acceptable for hackathon judging.
- **Audit pass.** All deferred VO/NVDA/Lighthouse/axe-core +
  validate_loop runs land in the verification session file before
  deploy.