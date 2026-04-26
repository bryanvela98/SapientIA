# 2026-04-27 — max-questions-exceeded violation (Day 6 Commit 5/6)

## Done
- New soft check at the same content_block_stop site as the
  cognitive sentence-cap check from Day 5 Commit 3:
  - When `profile.learning == 'adhd-focus'` AND tool name is in
    `_QUESTIONING_TOOLS = {diagnose, ask_socratic_question,
    give_hint, check_understanding}` AND
    `_count_questions_in_primary(input_obj) > 1`, append
    `"max-questions-exceeded"` to the turn's `violations` list.
  - `progress_summary` and `deliver_answer` excluded — recap and
    final-answer prose can legitimately contain quoted '?'.
- Pure helper `_count_questions_in_primary(input_obj)` walks
  `PRIMARY_TEXT_FIELDS` for the first populated field and counts
  literal `?`. Heuristic: a multi-question turn almost always
  has multiple `?`. False positives from quoted/rhetorical
  question marks accepted (rare in tutor prose; metric is non-
  blocking; the prompt is the primary control).
- 9 pure-helper tests in `test_violations.py`:
  - Zero/one/two/three '?' counts.
  - Picks first populated PRIMARY_TEXT_FIELDS hit (question,
    hint, answer, summary).
  - `_QUESTIONING_TOOLS` excludes progress_summary + deliver_answer.
  - `_QUESTIONING_TOOLS` covers each Socratic-question tool.
  - `_QUESTIONING_TOOLS ⊆ TEACHING_TOOLS` (chain-through correctness).
  - Sentence and question helpers are independent.
- `docs/pedagogy.md` gains a "Violations surfaced by the server"
  table listing all three soft violations + their gating rules.

## Design decisions
### Soft check, not retry
Same call as Day 5 Commit 3's sentence cap (and ADR-026's soft
nudge): log only, no rewrite, no retry. The prompt is the primary
control; the violation surfaces drift in the existing violations
channel for the debug panel and `validate_loop.py` to flag.

### `_QUESTIONING_TOOLS` membership
The plan suggested the set; we kept exactly that:
`{diagnose, ask_socratic_question, give_hint, check_understanding}`.
- `diagnose` asks a probe question.
- `ask_socratic_question` is by definition a question.
- `give_hint` often asks a leading question after the hint.
- `check_understanding` asks for re-derivation or application.
- `progress_summary` summarizes; if it ends with "what's next?",
  that's prose, not a multi-question turn. Excluded.
- `deliver_answer` is the answer turn; quoted '?' in answer prose
  is normal. Excluded.
- `mark_concept_earned` is bookkeeping; no primary text. Excluded
  by virtue of not being in TEACHING_TOOLS' question-bearing
  subset.

### Why count `?` literals, not parse sentences
Parsing prose into "sentences ending in ?" is error-prone (split
on ., !, ? — which interacts with the existing sentence counter,
abbreviations, etc.). The literal `?` count is robust, fast, and
the false-positive rate (quoted '?', "?!" idioms) is low enough
to accept in a non-blocking metric. If validate_loop ever shows
the metric spamming on quoted '?' across a real session, tighten
to "count `?` not preceded by an open-quote" — but YAGNI today.

## Broke / gotchas
- **First test count was off** — I expected 47 to mean +12 over
  the prior 35; turned out the prior baseline was 36 (test_recap_
  nudge had 12, not the 9 my mental count had). Fixed in the
  commit message.
- **Pure-helper testing.** Originally considered an integration
  test driving a 2-question turn against the real API. Rejected:
  flaky (model output varies), expensive (real API call), slow
  (1 minute per turn). The pure helper covers the same logic
  with deterministic input-output pairs.

## Checkpoint gate
- ✅ `pytest tests -q` — 47/47 backend at end of commit.
- ✅ Helpers and membership are pure-tested.
- ⏳ Manual: drive an adhd-focus session, watch the debug panel
  for the violation when the tutor drifts. Deferred to audit.
- ⏳ `validate_loop.py` integration — the audit pass should
  capture the violation count alongside the existing
  `max-sentences-exceeded` count.

## Follow-ups surfaced
- **No new ADR.** The soft-check pattern is established by ADR-026
  + Day 5 Commit 3; this commit is a parallel application of the
  same pattern, not a new architectural choice.
- **`validate_loop.py --profile worst-case-stack`** — Day 6
  Commit 6 plan called for a new flag. Skipped (along with the
  human-driven audit). Add to `validate_loop.py` when running
  the deferred audit if needed.