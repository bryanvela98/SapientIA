# 2026-04-26 — Structured prompt fragments (Day 5 Commit 2/6)

## Done
- `AccessibilityProfile` gained a `PromptFragments` dataclass + a
  `to_fragments()` method. Each axis fills one or more named slots:
  `register`, `chunking`, `vocabulary`, `interaction_style`, `pacing`.
  `to_prompt_guidance()` now renders the filled slots as
  `- **Slot:** text` bullets in a fixed order. Empty input → "No
  specific accessibility accommodations." (unchanged).
- `cognitive=plain-language` fills four slots: grade-5 register (≤15
  words/sentence, Anglo-Saxon vocabulary), 3-short-sentence chunking
  cap, define-on-first-use vocabulary, simple-question interaction
  style. The jargon rule moved out of the global anti-patterns block
  — it now lives in the vocabulary fragment so it's only applied when
  plain-language is set.
- **Composition rule**: `cognitive=plain-language + learning=adhd-focus`
  emits ONE merged `chunking` fragment: "Cap each turn at 3 short
  sentences AND at most one question. No multi-part questions." The
  two axes would otherwise emit contradictory bullets ("3 short
  sentences" and "one question per turn") that'd confuse the model.
- **Multi-contributor slot**: `interaction_style` joins `visual=screen-
  reader` ("describe visuals verbally, linear prose") with `cognitive=
  plain-language` ("simple wording for Socratic questions") in one
  bullet. No contradiction; just concatenate with a space.
- `validate_loop.py --profile {none, cognitive-plain-language}` and
  per-turn sentence-length stats (avg w/sent, count over 20).
- `docs/pedagogy.md` now has a slot × contributor table + the
  composition rule section.
- 11 profile tests (4 existing + 7 new): composition merge, single-
  contributor correctness, pacing-plus-register orthogonality,
  screen-reader-alone interaction style, dyslexia-font-alone chunking,
  snapshot of the worst-case combo.

## Design decisions
- **Where does `PromptFragments` live?** The Day 5 plan suggested
  `backend/app/tutor/prompts.py`. That would create a circular import
  (`prompts.py` already imports `AccessibilityProfile` from
  `app.schemas.profile`). Put the dataclass + `to_fragments` method in
  `profile.py` next to the profile itself; `prompts.py` still only sees
  the `to_prompt_guidance()` public method. If more modules need
  fragment-level access, we can extract to a neutral `fragments.py` —
  not worth it yet.
- **Fixed slot order.** `(register, chunking, vocabulary,
  interaction_style, pacing)`. Chosen so the MOST assertive rules come
  first (register shapes every word, chunking shapes structure,
  vocabulary is a specific directive). Having a fixed order means the
  snapshot test is stable across refactors.
- **Section heading unchanged.** Plan mused about renaming `##
  Accessibility profile` to `## Adaptation`. Kept the existing heading
  — less churn, the snapshot test would have had to change anyway, and
  the bolded bullet labels carry the new structure visibly. If the name
  matters pedagogically, revisit.
- **Did NOT execute `validate_loop.py` against the real API.** Credit
  budget conservatism; the plan explicitly notes this is an artifact
  for the session log, not a CI test. Next-steps.md has a reminder to
  run it once Day 6 lands and capture the numbers.

## Broke / gotchas
- **`test_to_prompt_guidance_picks_up_each_flag` already asserted
  `"screen reader" in g.lower()`.** The new interaction_style fragment
  preserves that exact phrase ("Learner uses a screen reader. Describe
  any visual content verbally…") so the existing test still passes.
  Would have been easy to drop the phrase by accident in the refactor;
  the assertion caught it on the first run.
- **Backward compat via `to_prompt_guidance() -> str`.** Single call
  site in `build_system_prompt` didn't need changes, which means the
  old system-prompt tests still exercised the new code path. Nice.

## Checkpoint gate
- ✅ `pytest tests -q` — 24/24 green.
- ✅ Rendered worst-case combo prints cleanly and under 3100 chars —
  prompt token cost unchanged order-of-magnitude.

## Follow-ups surfaced
- **ADR-025 logged.** See decisions.md.
- **Frontend `previewSample`** in `lib/preview.ts` didn't need an
  update — the openers mirror the *semantic* adaptation (short
  sentences, one question, etc.), not the literal prompt text. Intent
  preserved.