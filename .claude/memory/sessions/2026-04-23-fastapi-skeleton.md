# 2026-04-23 — FastAPI skeleton + async SQLite + domain models (Commit 2/5)

## Done
- Added deps: `aiosqlite`, `pydantic-settings`, `sse-starlette`, `pytest-asyncio`, plus `greenlet` (SQLAlchemy async hard requirement on Python 3.13).
- `app/config.py` — `Settings` via pydantic-settings; `anthropic_api_key` required, `database_url` defaults to `sqlite+aiosqlite:///./sapientia.db`, CORS origins include Vite (5173) and CRA (3000), model IDs surface from here.
- `app/db.py` — async engine + `AsyncSessionLocal` + `init_db()` + `get_db()` dependency generator.
- Domain models: `Learner` (UUID id + `accessibility_profile` JSON), `Session` (FK to learner, topic, cascading turn/earned/told relationships with `lazy="selectin"`), `Turn` (API-shaped `content` JSON + `display_text` + `tool_used`), `EarnedConcept`, `ToldConcept`.
- `app/routers/health.py` + `app/main.py` with lifespan `init_db()` and CORS middleware.
- Uvicorn starts clean on 8000; `sapientia.db` file created; 5 tables present; CORS preflight returns 200 with the right headers.

## Broke / gotchas
- **`.env` still held the Day 1 sync `DATABASE_URL=sqlite:///./tutor.db`**, which overrode the async default from `Settings`. Result: `InvalidRequestError: The asyncio extension requires an async driver to be used. The loaded 'pysqlite' is not async.` Fix: updated `.env` to `sqlite+aiosqlite:///./sapientia.db`. Lesson: the config default gets silently shadowed by `.env`; watch for this whenever env vars and defaults disagree.
- **`greenlet` not auto-installed on Python 3.13.** SQLAlchemy async lifts sync work into greenlets, and on 3.13 `pip install sqlalchemy` doesn't pull it in as a hard dep. `init_db()` crashed at `engine.begin()` with `No module named 'greenlet'`. Fix: pinned `greenlet>=3.0.0` in requirements.txt. Documented here so future env rebuilds don't repeat the diagnostic loop.
- IDE diagnostics (Pylance-style) complain "package X not installed in the selected environment" for everything in requirements.txt — the IDE interpreter is pointing somewhere other than `backend/.venv`. Ignoring; the actual venv is fine (`python -c "import sqlalchemy"` works).

## Schema decisions worth flagging (vs plan)
- `accessibility_profile` stored as raw `JSON` on `Learner` rather than a sub-table — it's small, versioned together, and we want to swap it atomically on profile edits. Matches plan.
- `Turn.content` is the **exact** list of API message blocks (dicts with `type`/`text`, or `type`/`tool_use_id`/`content`, or `type`/`id`/`name`/`input`). No re-wrapping logic lives at request time; reconstruction in Commit 4 is pure replay.
- `Turn.display_text` is nullable — assistant turns extract the primary teaching tool's `question` / `hint` / `answer`; user turns use the raw learner text. Bookkeeping-only assistant turns legitimately have `display_text = NULL`.
- `EarnedConcept` / `ToldConcept` kept as separate tables (not a JSON column on Session) — easier to query counts, add indexes, and render a "concepts earned in order" view later.

## Checkpoint 2
- ✅ `uvicorn app.main:app --port 8000` boots without exception.
- ✅ `curl http://localhost:8000/health` → `{"status":"ok"}`.
- ✅ `backend/sapientia.db` created on startup.
- ✅ `sqlite3 sapientia.db ".tables"` → `earned_concepts learners sessions told_concepts turns`.
- ✅ CORS preflight `OPTIONS /health` with `Origin: http://localhost:5173` → 200 with `access-control-allow-origin: http://localhost:5173`.

## Next action (Commit 3/5)
- Learner CRUD (`POST /learner`, `GET /learner/{id}`, `PATCH /learner/{id}/profile`), Session create + state (`POST /session`, `GET /session/{id}/state`). Anonymous identity via `X-Learner-ID` header — client generates UUID, server upserts. Turn/streaming endpoint deferred to Commit 5.