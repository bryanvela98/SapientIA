# 2026-04-25 — Scope change: drop hearing, reserve slot for motor/voice (Day 4 Commit 1/6)

## Done
- **Backend** `backend/app/schemas/profile.py`:
  - Dropped the `hearing: Literal["deaf", "hoh", "none"]` field.
  - Added `model_config = ConfigDict(extra="ignore")` so any existing
    dev-DB learner row with `{"hearing": "deaf"}` JSON still validates
    instead of raising `extra_forbidden`. Verified in a repl run: a
    payload `{"hearing": "deaf", "visual": "screen-reader"}` parses
    cleanly, `hearing` is gone from the output, `visual` is preserved.
  - `to_prompt_guidance` was already hearing-free — no logic change.
- **Frontend**:
  - `src/lib/types.ts` — dropped `hearing` from `AccessibilityProfile`
    and from `defaultProfile`.
  - `src/lib/preview.ts` — `profileSummary` no longer considers
    `hearing`. `previewSample` was already hearing-free.
  - `src/routes/Onboarding.tsx` — removed the Hearing `RadioField`
    entirely. Now 4 fieldsets: Visual, Cognitive, Learning, Pacing.
  - `src/lib/store.ts` pulls `defaultProfile` from `types.ts`, so the
    default flows through automatically.
- **Tests** — `backend/tests/test_profile.py` (new file, 4 tests):
  1. `test_defaults_populate_when_empty` — empty payload gets all defaults.
  2. `test_forward_compat_ignores_dropped_hearing_field` — legacy payload
     with `{"hearing": "deaf"}` validates; `hearing` attribute is gone;
     other fields take their defaults.
  3. `test_round_trip_all_four_dimensions` — full non-default payload
     round-trips through `model_dump`.
  4. `test_to_prompt_guidance_picks_up_each_flag` — `screen-reader` and
     `plain-language` both surface in the guidance string; empty profile
     falls back to the "no specific accommodations" message.
- **Docs** — `CLAUDE.md` was already updated by the Day 4 planner (priority
  order lists motor as #4 stretch; the "hearing dropped (ADR-021)" note
  is in place). `docs/pedagogy.md` and `socratic-tutor/SKILL.md` never
  mentioned hearing, so nothing to reconcile there.
- **ADRs** — `ADR-021 — Drop hearing profile dimension, reserve slot for
  motor / voice-control stretch` appended to `decisions.md`.

## Checkpoint gate
- ✅ `pytest tests/ -q` → 16 passed in 58s (was 12; +4 for new profile tests).
- ✅ Frontend: `tsc --noEmit` clean, `npm run lint` clean, `npm run build`
  clean (376 kB JS / 119 kB gz — slight drop from dropping the Hearing
  RadioField subtree).
- ✅ `grep -rn "hearing" backend/ frontend/src/` returns only:
  - comments in `profile.py` + `test_profile.py` (the `extra="ignore"`
    forward-compat explanation), and
  - the `validate_loop.py` learner utterance ("I keep hearing about
    recursion…") — false positive as expected.
- ✅ `POST /learner` with a legacy `{"hearing": "deaf", "visual":
  "screen-reader"}` profile parses; response omits `hearing` entirely.
  (Verified via `LearnerCreate.model_validate` — no HTTP round trip
  needed since it's the same schema path.)

## Broke / gotchas
- Nothing real. The `model_config = ConfigDict(extra="ignore")` goes at
  the **top** of the class body in Pydantic v2, not as a nested `class
  Config`. Easy to get wrong.
- I initially appended ADR-021 in the wrong spot (before ADR-020 instead
  of after). Rearranged to keep chronological order in `decisions.md`.

## Open questions / deferred
- **Alembic or manual migration?** Profile is stored as JSON on the
  `learners` row, so there's no SQL schema change — pydantic's
  `extra="ignore"` handles read-path legacy rows. Next write resets to
  the new shape. Still no Alembic needed (ADR-009 holds).
- **Motor/voice UX research** — what command grammar do motor-first
  tools typically expose? Day 7 scope; note `commandr` and Talon
  Voice's patterns as a starting point when we get there.

## Next action (Commit 2/6)
- Backend `async_loop.stream_turn` switches from `messages.create` to
  `messages.stream` async context manager; emits `text_delta` SSE events
  for each `content_block_delta.text_delta`; tool_decision fires on
  `content_block_start` (earlier in the pipeline); `turn_end` still on
  `message_stop` with the full API-shaped content blocks for DB persist.
  Keep ADR-013 chain-through working on the streaming path — don't fall
  back to `messages.create` on retry.