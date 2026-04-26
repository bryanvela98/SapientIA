# 2026-04-23 — SSE turn endpoint + smoke + integration tests (Commit 5/5)

## Done
- `POST /session/{id}/turn` wired in `routers/session.py`:
  1. Load session, learner, existing turns (ordered, via `lazy="selectin"` relationship).
  2. `build_user_message(req.message, prior_assistant)` → persist the user turn
     with API-shaped `content` (text OR tool_result blocks).
  3. `rebuild_history(turns)` + new user_msg → feed into `stream_turn`.
  4. Per-event side-effects: `concept_earned` → insert `EarnedConcept`,
     `concept_told` → insert `ToldConcept`.
  5. On `turn_end`, capture `assistant_content` and persist an assistant `Turn`
     with `display_text` + `tool_used` via `extract_primary`.
  6. Return `EventSourceResponse(event_gen())` — each event yields `{event, data: json}`.
- `scripts/smoke.sh` — creates learner + session, runs 2 turns via `curl -N`, prints
  `/state`. Smokes the whole flow end-to-end.
- `tests/test_session_flow.py` — two integration tests via `httpx.AsyncClient(transport=ASGITransport(app))`:
  1. **Cooperative flow** — 3 turns, asserts turn_start/turn_end presence, no turn-1
     violation, no `error` events, `turn_count >= 3` after.
  2. **Stubborn flow** — 6 scripted replies escalating to "just tell me" verbatim.
     Asserts (a) `deliver_answer` fired **or** (b) hint level 3 observed. Either
     proves the escalation infrastructure works under genuine pressure.

## Broke / gotchas
- **ASGITransport doesn't trigger FastAPI lifespan.** Initial test run failed with
  `no such table: learners` because `init_db()` (wired to lifespan) never fired.
  Fix: the `client` fixture reloads `app.config` / `app.db` / `app.routers.*` / `app.main`
  (so env-based settings pick up the temp DB) and explicitly calls `await db_mod.init_db()`
  before yielding the client. Modules must be reloaded in dep order — routers depend
  on `get_db`, which depends on `AsyncSessionLocal`, which depends on `settings`.
- Had to include the router modules in the reload set. Missed them initially and
  the routers kept a stale reference to the original engine, hitting a different
  (non-existent) DB at request time.
- `SQLAlchemy` emits a `DeprecationWarning` on `datetime.utcnow()` in our model
  defaults. Non-blocking, known, deferred — ADR-style note: switch to
  `datetime.now(datetime.UTC)` when we next touch models.
- The smoke-run DB shows `earned/told = 0` because the cooperative messages on
  turns 1-2 don't yet demonstrate a concept outright — tutor is still probing.
  That's correct pedagogy; the integration test uses more-committed scripted
  answers to prove the event pipeline persists rows.

## Checkpoint 5
- ✅ `./backend/scripts/smoke.sh` runs end-to-end, prints populated state
  (`turn_count: 2`, SSE events visible on stdout).
- ✅ `pytest backend/tests/ -m integration -s` — 5/5 pass (54s):
  - `test_first_turn_yields_teaching_move`
  - `test_multiturn_rebuild_keeps_api_happy`
  - `test_chain_through_recovers_from_bookkeeping_only`
  - `test_cooperative_flow_makes_progress`
  - `test_stubborn_flow_exercises_escalation_or_deliver_answer`
- ✅ SQLite has rows in `learners`, `sessions`, `turns` after a live run; the
  stubborn-flow test itself asserts that either `told_concepts >= 1` **or**
  a `give_hint` with `level = 3` landed.
- ✅ CORS preflight validated in Commit 2; no new CORS surface here.

## Open questions / deferred
- **Token-level streaming.** `stream_turn` emits at tool_decision granularity, so
  the UI will see the whole tutor question appear in one SSE event. Upgrade when
  Day 3's React shell exists and can benefit.
- **Ping/keepalive for SSE.** `sse-starlette` will emit pings by default, but
  current turns are short (<10s). Worth passing `ping_interval` explicitly when
  longer multi-tool turns become realistic.
- **`GET /session/{id}/turns`** for page-refresh hydration — not needed Day 2,
  flagged in Day 3 next-steps.
- **Hint-level server-side enforcement** (ADR-011 pending) — the model now
  escalates L1→L2→L3 via prompt rules; tracking last-hint-level per concept in
  the DB is a correctness upgrade for Day 3+.

## Next action (Day 2 wrap)
- Update `.claude/memory/progress.md` with the Day 2 batch.
- Overwrite `.claude/memory/next-steps.md` with Day 3 plan (React shell, baseline a11y).
- Append ADR-007 through ADR-014 to `.claude/memory/decisions.md`.