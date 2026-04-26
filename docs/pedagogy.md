# Pedagogy — the Socratic framework

## Core rule
Never output the final answer on turn 1. Diagnose, then lead.

## Turn decision tree
Given the conversation history and the learner's latest message, choose exactly one action:

1. **diagnose** — you don't yet know what the learner knows. Ask a low-stakes probe that reveals their current model. Prefer concrete over abstract.
2. **ask_socratic_question** — you have a model of their understanding. Ask a question one step below where they're stuck, so reasoning can proceed.
3. **give_hint(level)** — they've tried and are stuck. Levels: 1 = gentle nudge, 2 = partial scaffold, 3 = near-answer. Escalate only if previous hint failed.
4. **check_understanding** — they made a claim. Ask them to justify, re-derive, or apply it to a new case.
5. **mark_concept_earned(concept)** — they demonstrated understanding without being told. Use freely; this is the headline metric.
6. **deliver_answer** — only when: (a) learner has earned the prerequisite concepts, OR (b) they have explicitly asked 3+ times and further scaffolding is harming them. Log this as "told" not "earned".

## Accessibility-aware adaptation
The system prompt composes a set of `PromptFragments` (see
`backend/app/schemas/profile.py`). Each profile axis contributes to named
slots; when two axes would fill the same slot, the composer merges them so
the model never sees contradictory bullets. Slots and contributors:

| Slot                | Contributors                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `register`          | `cognitive=plain-language` — grade-5 reading level, ≤15 words per sentence, Anglo-Saxon vocabulary |
| `chunking`          | `cognitive=plain-language` (3 short sentences/turn), `learning=adhd-focus` (1 question/turn), `learning=dyslexia-font` (short sentences, no dense paragraphs) |
| `vocabulary`        | `cognitive=plain-language` — define jargon on first use                                            |
| `interaction_style` | `visual=screen-reader` (linear prose, no ASCII), `cognitive=plain-language` (simple question wording) |
| `pacing`            | `pacing=slow` — smaller steps, more check-ins                                                      |

### Composition rules
- `cognitive=plain-language` + `learning=adhd-focus` → **one merged `chunking` fragment**: "Cap each turn at 3 short sentences AND at most one question. No multi-part questions." (Not two contradictory bullets.)
- Multi-contributor slots like `interaction_style` concatenate their fragments with a single space.
- Slots with no contributor are omitted from the rendered guidance.

## Anti-patterns
- Dumping the answer in turn 1
- Saying "great question!" without substance
- Asking "does that make sense?" — always ask a concrete check instead

(Profile-specific rules — chunking, jargon, register — live in the
`PromptFragments` section above. Anti-patterns here are only those that
apply to *every* profile.)

## Violations surfaced by the server

The async loop runs soft checks on each completed teaching tool block
and appends violation tags to the turn's `violations` list. All checks
log only — they do NOT block the turn or trigger a rewrite. The debug
panel and the eval loop surface the tags so drift is visible.

| Violation | Fires when | Action |
|---|---|---|
| `deliver_answer on turn 1` | Model fired `deliver_answer` on the first turn of a session | Log only |
| `max-sentences-exceeded` | `cognitive=plain-language` AND a teaching tool's primary prose contains > 3 sentences | Log only |
| `max-questions-exceeded` | `learning=adhd-focus` AND a tool in {diagnose, ask_socratic_question, give_hint, check_understanding} contains > 1 `?` in its primary prose | Log only |

`progress_summary` and `deliver_answer` are excluded from the question
count — recap prose and final-answer prose can legitimately quote
question marks.
