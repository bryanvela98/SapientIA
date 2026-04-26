# 2026-04-25 — Token-level streaming (Day 4 Commit 2/6)

## Done
- Rewrote `backend/app/tutor/async_loop.py` to use `client.messages.stream(...)`
  as an async context manager. Iterates raw `MessageStreamEvent` objects from
  the Anthropic SDK.
- Synthesized `text_delta` SSE events from `input_json_delta` chunks: since
  `tool_choice={"type":"any"}` forces every tutor message into a `tool_use`,
  the API never emits plain `text_delta` deltas on its own — the tutor's
  question/hint/answer lives inside `tool_use.input`. Tracked three primary
  text fields (`question`, `hint`, `answer`) with a tolerant partial-JSON
  extractor and emitted only the newly-added characters each delta.
- Kept `tool_decision` emission at `content_block_stop` with the fully-parsed
  input. Rationale: Day 3's Chat UI reads `tool_decision.input.question` into
  the live bubble; moving tool_decision to `content_block_start` (as the plan
  suggested) would break the UI until Commit 3 lands. Current order:
  `turn_start` → `text_delta` × N → `tool_decision` (full input) →
  `concept_earned` / `concept_told` (if applicable) → `turn_end`.
- Kept `mark_concept_earned` / `deliver_answer` side-events firing at
  `content_block_stop` with the now-parseable input.
- Chain-through (ADR-013) preserved: if a stream attempt yields no teaching
  tool, extend history with the assistant turn + synthesized `tool_result`
  user message, then stream again. The retry path also uses
  `messages.stream` — **never** falls back to `messages.create` — per the
  Day 4 plan's carry-forward risk.
- `extract_primary(assistant_content)` helper unchanged; downstream
  persistence in `routers/session.py` continues to write only on
  `concept_earned`, `concept_told`, and `turn_end`, so `text_delta` events
  don't 10× the DB row count.

## The partial-JSON extractor
The SDK emits `content_block_delta` events with `delta.type="input_json_delta"`
and `delta.partial_json: str`. Concatenating those gives a growing JSON blob
that eventually parses cleanly at `content_block_stop`. Mid-stream, we need
to recover the current value of `question` / `hint` / `answer`.

Approach:
1. For each of the three field names, search for `"<key>"\s*:\s*"` in the
   accumulated buffer.
2. Walk forward from the key's value-start, respecting `\\` escape pairs,
   until an unescaped `"` or end-of-buffer.
3. `json.loads('"' + captured + '"')` to unescape Unicode / standard JSON
   escapes. If we're mid-escape (buffer ends in `\`), that raises — fall
   back to returning the raw captured bytes.
4. Emit a `text_delta` only when the extracted string has *grown* past the
   last emitted length; the delta payload is just the new characters.

This is ~20 lines and handles the common cases (quotes in the question,
Unicode escapes, punctuation). Known edge: if the model emits `rationale`
before `question`, the extractor waits for `question` to appear — no
text_delta fires during the rationale phase, which is fine: rationale
isn't displayed to the learner.

## Tests
- `test_text_delta_events_assemble_primary_text` (new): asserts ≥2
  `text_delta` events fire per cooperative turn, and their concatenation
  (filtered by `block_index`) exactly matches the primary field of the
  final `tool_decision.input`. This proves the extractor is lossless across
  the stream.
- Existing 3 `test_async_loop.py` integration tests all pass unchanged —
  the contract for `turn_start` / `tool_decision` / `turn_end` / `error`
  is preserved.
- `test_session_flow.py` cooperative + stubborn flows pass unchanged —
  they don't assert on `text_delta` specifically, but they do consume the
  whole SSE stream and check the end-state invariants (deliver_answer OR
  hint L3 in stubborn, no errors, etc.).
- Full backend suite: **17/17 green in 59s** (+1 from the new test).

## Broke / gotchas
- **Pydantic validator** on `event.delta.type` — the Anthropic SDK returns
  a union type for `delta`; Python's `getattr(delta, "type", None)` handles
  `input_json_delta` vs `text_delta` vs `thinking_delta` (the last may
  appear if extended thinking is enabled; we skip it).
- **JSON partial escapes**: the `json.loads` unescape trick raises on mid-
  escape. Fell back to raw bytes so the UI at worst sees `\` in the middle
  of a text_delta that's corrected on the next chunk.
- **SDK buffering risk** from the plan: in practice we saw clean chunk-by-
  chunk streaming on Opus 4.7 — no need to pin a narrower SDK version.
  `anthropic>=0.40.0` continues to work.

## Checkpoint gate
- ✅ `pytest backend/tests -q` → 17 passed in 59s. No DeprecationWarning.
- ✅ New `test_text_delta_events_assemble_primary_text` proves token-level
  streaming is live and lossless.
- ✅ Chain-through retry stays on the streaming path — verified by
  `test_chain_through_recovers_from_bookkeeping_only` still passing with
  the new implementation.
- ✅ No `turn` row duplication: session router only writes on
  `concept_earned`, `concept_told`, and `turn_end`.

## Open questions / deferred
- **ADR-018 pending closure**: event-level streaming was ADR-018's
  placeholder; Day 4 has now upgraded to token-level. Will close
  ADR-018 and log the new semantics as part of the Day 4 end-of-day
  memory updates (ADR-022-ish).
- **Browser perception**: whether token-level streaming noticeably
  improves the `aria-live` announcement cadence is a user-visible
  question answered in Commit 3 + Commit 6's VO pass.

## Next action (Commit 3/6)
- Frontend `src/lib/types.ts`: add `TextDelta` variant to the SSE event
  union.
- Frontend `src/lib/store.ts`: `applyTextDelta(ev)` appends to
  `live.text` (not replace). `applyDecision(ev)` for `tool_decision`
  should NO LONGER overwrite `live.text` if text_delta events are
  streaming — just record the decision and lock in the tool_name/hint_level.
- `SkipLink` component.
- `ThemeToggle` + high-contrast palette under `[data-theme="high-contrast"]`.
- Lighthouse a11y score on `/chat` ≥ 95.