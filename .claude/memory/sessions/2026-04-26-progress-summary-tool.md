# 2026-04-26 — progress_summary tool + recap nudge (Day 5 Commit 3/6)

## Done
### New teaching tool
- `progress_summary` added to `app/tutor/tools.py`. Schema: `summary`
  (1–2 short sentences), `concepts_recapped: string[]`, `next_focus:
  string`. Tool description explains the pacing-nudge contract so the
  model understands when the server will prompt it.
- `progress_summary` joined `TEACHING_TOOLS` in `async_loop.py`. Three
  downstream consequences:
  1. Chain-through (ADR-013) skips recap-only turns — recap IS a valid
     terminal teaching move, not bookkeeping.
  2. `extract_primary` falls through to `summary` when `question` /
     `hint` / `answer` are absent, so persisted `Turn.display_text`
     carries the recap verbatim.
  3. Soft `max-sentences-exceeded` check also applies — but the recap
     schema says "1–2 short sentences" so this almost never fires for
     recaps.
- `PRIMARY_TEXT_FIELDS` gained `"summary"` so token deltas stream recap
  prose progressively, matching how question/hint/answer already stream.
- New `progress_summary` SSE event fires at `content_block_stop` with
  `{summary, concepts_recapped, next_focus}` — distinct from
  `tool_decision` so the client can route recap payloads to their own
  slice of state without guessing tool names.

### Server-side recap nudge
- `maybe_recap_nudge(unrecapped, threshold=3, max_over_threshold=6)` in
  `prompts.py`. Returns a `## Pacing nudge` block naming the concept
  count; returns `None` below threshold or past the cap.
- `build_system_prompt(topic, profile, unrecapped=0)` threads the count
  and invokes the nudge. Dedicated `{recap_nudge}` slot in the template,
  positioned between `## Accessibility profile` and `## Anti-patterns`.
- `routers/session.py` computes `unrecapped` from already-loaded
  `session.turns` + `session.earned` — no additional DB query. The
  watermark is the newest `tool_used='progress_summary'` turn's
  `created_at`; before the first recap, every earned counts.

### Soft sentence check
- When `profile.cognitive == 'plain-language'` and a teaching tool's
  primary prose contains >3 sentence enders, append
  `"max-sentences-exceeded"` to the turn's violations list. Doesn't
  block; surfaces drift in the existing violations channel so it shows
  up in the debug panel.
- Sentence counting uses the same `[.!?]+\s+|[.!?]+$|\n+` heuristic as
  the frontend `findLastSentenceEnd` + `validate_loop.py`. Consistent
  across all three means no surprises when the debug panel says one
  thing and the TTS heuristic said another.

### Frontend
- `progress_summary` in `ToolName`; `ProgressSummary` SSE variant;
  `Recap` convenience type. `TEACHING_TOOLS` array extended (used by
  `applyDecision` to recognize live.tool_name).
- `store.recaps: Recap[]` + `addRecap(event)` action. `resetSession`
  clears. Recaps get stamped with `turn_number` from `s.live` at
  capture time so Commit 4 can match persisted turns back to their
  structured fields.
- `Chat.tsx`: `progress_summary` event fires `addRecap`. Visual
  treatment deferred to Commit 4.

## Design decisions
### Soft nudge vs hard tool injection — see ADR-026
Two designs considered for "make the model recap at N earned
concepts":
- **Hard**: switch `tool_choice` to `{"type":"tool","name":"progress_
  summary"}` on the triggered turn. Deterministic but brittle — if the
  learner just said "I'm confused, pause a sec", we'd force a recap
  anyway. Rejected.
- **Soft**: inject a prompt block naming the count. Model still picks
  freely. Shipped.

### max_over_threshold cap
If the model ignores the nudge twice, threshold condition stays true
next turn → we'd re-nudge every turn forever. The `max_over_threshold`
parameter (default 6) suppresses the nudge past `threshold + 6`
unrecapped concepts. Meaning: after roughly three model refusals, we
back off. This is a proxy for "consecutive nudges" — not perfect
(recap ↘ 0, earn 9, nudge fires again), but pragmatic and honest
about the soft-constraint nature.

### Counter from in-memory session, not a new query
`session.turns` and `session.earned` are already loaded via
`lazy="selectin"` on the `Session` relationship. Walking them costs
nothing extra; a dedicated `SELECT MAX(created_at) WHERE tool_used =
'progress_summary'` would be another roundtrip. Risk: if a future
session gets very large (100+ turns) the Python walk would be linear,
but at hackathon scale it's a non-issue.

## Broke / gotchas
- **The tool-7 description I added mentions `## Pacing nudge` in
  prose**, which means my first `test_build_system_prompt_omits_nudge_
  by_default` asserted globally and failed — the phrase appears in the
  tool description even when no nudge is injected. Fixed by asserting
  the specific block form (`\n## Pacing nudge\n`) plus the unique
  "concepts since the last recap" substring.
- **Adding progress_summary to TEACHING_TOOLS changed chain-through
  semantics silently.** The existing `test_chain_through_recovers_from_
  bookkeeping_only` still passed — it was mocked to start from a
  mark_concept_earned-only history, which is bookkeeping-only
  regardless of progress_summary's membership. Worth being aware of.

## Checkpoint gate
- ✅ `pytest tests -q` — 33/33 green at end of commit.
- ⏳ Manual "drive a session past 3 earned concepts and watch for a
  `progress_summary` SSE event + recap bubble" — deferred because the
  bubble visual treatment lands in Commit 4. Full end-to-end smoke will
  be in the Commit 6 audit.
- ⏳ `validate_loop.py --persona cooperative` regression check —
  deferred for API credits.

## Follow-ups surfaced
- **ADR-026 logged.** See decisions.md.
- **Hydration**: after a page reload, `concepts_recapped` and
  `next_focus` are lost (only `display_text` + `tool_used` come back
  from `GET /turns`). RecapBubble will show summary-only after reload.
  If this matters, add `tool_input` to `TurnOut` OR
  `GET /session/{id}/recaps`. Backlogged in next-steps.md.