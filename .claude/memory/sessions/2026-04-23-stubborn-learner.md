# 2026-04-23 — Stubborn-learner mode + pedagogy tightening (Commit 1/5 of Day 2)

## Done
- `prompts.py`: added "Earning rules" block — `mark_concept_earned` only when learner JUST demonstrated the concept in their latest message; one concept per turn as default; no double-marking.
- `prompts.py`: replaced the single-line `deliver_answer` condition with an explicit two-branch rule: (a) earned prerequisites, or (b) learner explicitly asked 3+ times in phrasing like "just tell me". Also added an explicit hint-level escalation rule so L1→L2→L3 progression is actually followed.
- `validate_loop.py`: added `--persona {cooperative,stubborn,misconceived,all}` (default `cooperative`). Stubborn/misconceived prompts are aggressive — stubborn in particular forces verbatim "just tell me" phrases starting turn 3, bans synthesis, bans piecing hints together.
- `validate_loop.py`: added `--max-turns` override (default 10), per-turn tool-decision tracking (records hint levels), `delivered_answer` flag, `max_hint_level`, and a persona × topic matrix printer.

## Matrix (final stubborn run, after two prompt-tuning iterations)

| Topic          | cooperative | stubborn       | misconceived |
|----------------|-------------|----------------|--------------|
| Photosynthesis | 6e/0t 1.00  | 2e/1t 0.67 L1 A| 5e/0t 1.00 L2|
| Recursion      | 8e/0t 1.00  | 1e/0t 1.00 L2  | 7e/0t 1.00   |
| Frost poem     | 6e/0t 1.00  | 0e/1t 0.00 L3 A| 5e/0t 1.00   |

`A` = `deliver_answer` fired. `Ln` = max hint level observed.

## Checkpoint 1 results
- ✅ `deliver_answer` fired (2 of 3 stubborn topics)
- ✅ Hints escalated to L3 at least once (Frost)
- ✅ Stubborn ratios meaningfully below 1.00 (0.67, 0.00 — Recursion held 1.00)
- ✅ Cooperative still ≥ 0.8 (all 1.00; earning rule didn't over-tighten)

## Broke / gotchas
- **Iteration 1 of stubborn persona was too soft.** Haiku-as-learner is genuinely smart: hints cued it into correct answers even when the prompt said "do not guess." Fix: forbid synthesis outright, mandate verbatim "just tell me" phrases starting turn 3, cap replies at 2 sentences.
- **Tutor respected "just tell me" 3× rule only after explicit prompt tightening.** The original "asked 3+ times" language was too fuzzy — the tutor interpreted "almost there" as grounds to keep scaffolding even under explicit pressure. Reworded to enumerate the verbatim phrases ("just tell me", "give me the answer directly", …) and to state that continuing to scaffold past that point is harm, not pedagogy.
- **Recursion under stubborn still held ratio 1.00.** The learner conceded a basic factual probe ("they're not first in line") which the tutor counted as earned, and the explicit 3×-tell-me threshold hadn't cleared. This is probably fine — the tutor's judgment was defensible — but it does mean the stubborn persona isn't a guaranteed deliver_answer trigger on every topic.

## Open questions
- The misconceived persona is too cooperative on correction — after 1-2 turns of counter-evidence, Haiku flips to the correct view and stops defending the misconception. A harder version would explicitly script "defend the misconception through turn N even if shown counter-evidence." Deferred; not critical for Day 2.
- `check_understanding` fires liberally even on early turns. The tighter earning rule didn't reduce it much. Might be fine — it's a bonus nudge, not a bookkeeping call — but worth watching.
- Commit 5's scripted-reply integration test should target the deterministic deliver_answer path (`told_count ≥ 1`) rather than depending on Haiku's cooperation.

## Next action (Commit 2/5)
- FastAPI skeleton, config via pydantic-settings, async SQLAlchemy + aiosqlite, domain models (Learner/Session/Turn/EarnedConcept/ToldConcept), `/health` endpoint.