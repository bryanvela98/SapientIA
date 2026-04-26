# 2026-04-23 — Learner + Session CRUD (Commit 3/5)

## Done
- `schemas/learner.py`: `LearnerCreate`, `LearnerOut`, `ProfileUpdate`.
- `schemas/session.py`: `SessionCreate`, `SessionOut`, `SessionState` (turn_count, earned, told, ratio).
- `routers/learner.py`: `POST /learner`, `GET /learner/{id}`, `PATCH /learner/{id}/profile`.
- `routers/session.py`: `POST /session` (reads `X-Learner-ID` header, validates learner exists), `GET /session/{id}/state`.
- `SessionState.turn_count` computed as `max(turn_number)` across session turns (0 when empty). `ratio = earned / (earned + told)` with a `max(1, ...)` guard.
- Registered both routers in `main.py` under `/learner` and `/session`.

## PATCH semantics decision
Plan left this open ("PATCH partial-update or overwrite?"). **Chose overwrite.** Rationale:
- `AccessibilityProfile` is small (5 optional literal fields, each with a "none" sentinel).
- Pydantic fills defaults on parse, so a PATCH with `{"learning": "adhd-focus"}` already implies `visual=none`, `hearing=none`, etc. — a user who wants to preserve their current screen-reader flag has to resend it. That is a footgun, BUT the alternative (partial merge) is also a footgun because it silently keeps stale state when the UI resets a field.
- The UI will always send the full profile anyway (it's a form, not a diff). Partial-merge semantics would only matter for scripted clients, which we don't have.
- Future: if we ever add a programmatic client that really does want partial updates, add a dedicated `POST /learner/{id}/profile:merge` endpoint rather than overloading PATCH.

## Identity decision
No auth. `POST /learner` returns a UUID; clients pass it back via `X-Learner-ID`. Server rejects unknown IDs with 404. Client should generate-and-save locally on first visit. Documented as ADR-010.

## Broke / gotchas
- Initially wrote the session router's `POST /session` to use `Header(None, alias="X-Learner-ID")` (defaulting to None, then returning 400). Switched to `Header(..., alias="X-Learner-ID")` so FastAPI auto-422s on missing header — cleaner error, one less branch to test.
- `PATCH /profile` returns the full `LearnerOut` so the client can confirm the merge without a second GET.

## Checkpoint 3
- ✅ `POST /learner` returns id + full profile (defaults filled).
- ✅ `POST /session` with `X-Learner-ID` returns session with topic.
- ✅ `GET /session/{id}/state` returns `{turn_count: 0, ratio: 0.0, earned: [], told: []}`.
- ✅ `PATCH /learner/{id}/profile` overwrites; subsequent `GET` confirms persistence.

## Next action (Commit 4/5)
- `tutor/history.py`: `build_user_message` (wraps learner text in tool_result blocks if prior assistant turn had tool_uses; primary vs bookkeeping split) + `rebuild_history` (Turn rows → API-ready messages list).
- `tutor/async_loop.py`: `stream_turn` yielding `turn_start` / `tool_decision` / `concept_earned` / `concept_told` / `turn_end` events; chain-through on bookkeeping-only responses; non-streaming API under the hood.
- `tests/test_async_loop.py`: integration-marked tests that drive stream_turn against the live API.