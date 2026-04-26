# 2026-04-23 — Async tutor loop + history reconstruction (Commit 4/5)

## Done
- `tutor/history.py` — `build_user_message(learner_text, prior_assistant_turn)` wraps
  the text in `tool_result` blocks paired to any `tool_use` ids on the prior assistant
  turn. Text rides on the primary (non-bookkeeping) tool; bookkeeping gets `"ok"`.
  `rebuild_history(turns)` = pure replay of persisted API-shaped content.
- `tutor/async_loop.py` — `stream_turn(topic, profile, history, turn_number)` yields:
  `turn_start` → N × (`tool_decision` + optional `concept_earned` / `concept_told`)
  → `turn_end{violations, assistant_content}`. On bookkeeping-only responses, it
  chain-throughs once (extending history with the assistant turn + synthetic "ok"
  tool_results) and re-calls. After 2 failed attempts, emits `error` and returns.
- `extract_primary(assistant_content)` helper — pulls `(tool_name, display_text)`
  for persistence layer; will be used by the SSE route in Commit 5.
- `AsyncAnthropic` client is lazy-initialized (not at import time) so tests can
  import modules without `ANTHROPIC_API_KEY` being set.
- Under the hood: non-streaming `messages.create` (ADR-014). We *emit* SSE events
  to the client but don't token-stream yet; upgrade when UI benefits in Day 3.

## Tests
- `tests/test_history.py` — 5 unit tests, pure functions, no API: empty prior,
  text-only prior, single tool_use pairing, primary-vs-bookkeeping split on
  multiple tool_uses, and rebuild_history ordering.
- `tests/test_async_loop.py` — 3 integration tests, `-m integration`, hits live API:
  1. First turn yields `turn_start` → ≥1 teaching tool_decision → `turn_end` with
     `assistant_content`, no violations.
  2. Multi-turn rebuild: synthetic 3-message history with proper tool_use/tool_result
     pairing; turn 2 completes without API error.
  3. Chain-through: injected history ends with bookkeeping-only prior assistant turn
     + its "ok" tool_result; current turn still reaches a teaching move.
- `pytest.ini`: `asyncio_mode = auto` (pytest-asyncio), `integration` marker declared.
- `conftest.py`: adds `backend/` to `sys.path`, loads `.env` so integration tests
  pick up `ANTHROPIC_API_KEY`.

## Broke / gotchas
- `AsyncAnthropic()` auto-reads the key from env at construction. If `Settings()`
  is imported at collection time but `.env` isn't loaded yet (depending on how
  pytest picks up the conftest), initialization fails. Fix: lazy-init via `_client()`
  so the module is safe to import before env is set. The pattern is also friendlier
  for dep-injection in future tests that want to swap clients.
- Kept `tool_choice={"type": "any"}` — the model *must* return a tool. If we
  relaxed this, the bookkeeping-only recovery path wouldn't be enough; we'd also
  need to handle text-only responses. Skip for now.

## Checkpoint 4
- ✅ `pytest backend/tests/ -v` (unit + integration) green — 8 tests, ~14s.
- ✅ Bookkeeping-only history recovers via chain-through (test 3 exercises this
  deterministically by seeding the history; no need to wait for the model to
  randomly emit bookkeeping-only).
- ✅ Across first-turn / multi-turn / bookkeeping-start histories, zero `error`
  events; `turn_end.assistant_content` always populated.

## Open questions / deferred
- Token streaming to the client. Current design yields at a tool_decision granularity
  — the UI will see the full tutor question land in one event. Fine for Day 2; Day 3
  may want true token streaming via `messages.stream` and partial-block accumulation.
- Hint-level enforcement is still prompt-only. ADR-011 is still pending: track the
  last-hint-level per concept server-side and reject L3-after-none escalations. Not
  needed for Day 2's green checkpoint but worth wiring when we do per-concept state.

## Next action (Commit 5/5)
- `POST /session/{id}/turn` — SSE endpoint. Load session+learner+turns, call
  `build_user_message`, persist the user turn, run `stream_turn`, persist each
  `concept_earned` / `concept_told` as it arrives, persist the final assistant
  turn (with `display_text` + `tool_used` via `extract_primary`).
- `scripts/smoke.sh` — end-to-end curl flow.
- `tests/test_session_flow.py` — ASGITransport in-process test (cooperative +
  scripted-stubborn flow to deterministically exercise deliver_answer / L3).