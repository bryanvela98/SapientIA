# Architectural decisions

## ADR-001 — FastAPI over Flask
Date: 2026-04-22
Need async streaming to client (SSE/WebSocket) and clean Pydantic tool schemas. Flask adds friction for both. Decided: FastAPI.

## ADR-002 — No Agent SDK for MVP
The tutor loop is a single tool-use cycle per turn with explicit state in our DB. Agent SDK's orchestration is overkill and adds a dependency we don't need. Decided: use Anthropic Python SDK directly.

## ADR-003 — Skip MCP for week 1
MCP is a great stretch goal (expose learner progress as a server so any Claude client becomes a tutor) but would eat 1-2 days. Decided: defer to post-hackathon or day 7 if on-track.

## ADR-004 — Pedagogy lives in prompting, not content
We are not pre-authoring lessons. The Socratic loop is topic-agnostic. Differentiator is the prompt + tool contract + earned-vs-told tracking.

## ADR-005 — Accessibility profile affects prompt, not just UI
The `AccessibilityProfile` is threaded into the system prompt: reading grade level, chunk size, "always describe visuals verbally", pacing hints. Most teams would treat a11y as CSS only — we go deeper.

## ADR-006 — Model: claude-opus-4-7 for tutor
Date: 2026-04-22
Plan draft referenced `claude-opus-4-6` for the tutor, but the hackathon targets Opus 4.7 and that's the latest/most-capable Opus. Decided: use `claude-opus-4-7` for pedagogy; keep `claude-haiku-4-5-20251001` for the simulated-learner and cheap eval passes.

## ADR-007 — Session files named by implementation, not by day
Date: 2026-04-23
Day-number filenames (`day1.md`, `day2.md`) don't scale when a day produces 3–5 commits on different concerns. Switched to `YYYY-MM-DD-<implementation-title>.md`, one per commit when commits are meaningfully different work. Codified in `CLAUDE.md` and `.claude/memory/README.md`. Also: `.claude/memory/sessions/` plus `progress.md` and `next-steps.md` are gitignored — churny local context, not shared history.

## ADR-008 — SSE over WebSocket
Date: 2026-04-23
The tutor stream is one-way (server → client). SSE is simpler (plain HTTP), works fine with fetch-based clients via `ReadableStream`, and skips WebSocket ceremony. For the POST-with-body shape we use a streaming POST endpoint with `sse-starlette`'s `EventSourceResponse`; the browser side reads with `fetch` + `ReadableStream`, not `EventSource` (which is GET-only).

## ADR-009 — create_all on startup, no Alembic this week
Date: 2026-04-23
Schema churn is expected during a 7-day hackathon; blow away `sapientia.db` as needed. `db.init_db()` calls `Base.metadata.create_all` on FastAPI lifespan startup. Revisit Alembic post-hackathon.

## ADR-010 — Anonymous learners via X-Learner-ID header
Date: 2026-04-23
No auth for MVP. Client generates a UUID on first use and sends it back as `X-Learner-ID`. Server looks up the learner and 404s if unknown — no implicit upsert. The UUID is persisted client-side (localStorage) once Day 3 lands.

## ADR-011 — Server-side hint-level enforcement (pending implementation)
Date: 2026-04-23
Tool schema allows `level` ∈ {1,2,3} and the prompt now instructs the model to escalate 1→2→3. But the model can still jump ranks if prompt adherence slips. Plan: track last hint level per `concept_targeted` in the DB (new column or small table) and reject out-of-order escalations at the server. Deferred to Day 3+ when per-concept state management lands.

## ADR-012 — History stored in API-shaped message blocks
Date: 2026-04-23
`Turn.content` is the exact `content` array the Anthropic API received (user) or returned (assistant). Reconstruction is pure replay — no re-wrapping at request time. `build_user_message` is the only place that *creates* tool_result-paired content, and it runs BEFORE persistence so the DB already holds the correct shape for the next turn. This is the structural fix for Day 1's bug where plain-text learner messages followed tool_use assistant turns and triggered API 400s.

## ADR-013 — Chain-through on bookkeeping-only tool calls
Date: 2026-04-23
If a turn contains only `mark_concept_earned` (and no teaching tool), `stream_turn` extends history with that assistant turn + a synthesized `{"content":"ok"}` user message, then re-calls the model to force a teaching move. Bounded to 2 attempts before yielding an `error` event. This is the structural fix for Day 1's bug where a bookkeeping-only response left the caller with no user-visible teaching action.

## ADR-014 — Non-streaming API calls under the hood for Day 2
Date: 2026-04-23
`stream_turn` emits SSE events but calls `messages.create` without `stream=True` under the hood — tool-use assembly stays simple and robust across SDK versions. Day 3 can upgrade to token-level streaming with `messages.stream` and partial-block accumulation once a React UI can actually benefit from progressive rendering.

## ADR-015 — GET /session/{id}/turns for hydration, display-shaped not API-shaped
Date: 2026-04-24
Page refresh in the React UI needs to rebuild the transcript. Shipped a dedicated endpoint that returns `TurnOut[]` — `{turn_number, role, display_text, tool_used, created_at (ISO)}` — instead of leaking the API-shaped `content` blocks to the browser. The browser doesn't need the raw blocks (server rebuilds history from DB on every turn), and the display shape is leaner, less coupled to model internals, and easier to redact later if needed.

## ADR-016 — Hand-rolled SSE parser on the client
Date: 2026-04-24
`EventSource` is GET-only; our turn endpoint is POST-with-body. Considered `@microsoft/fetch-event-source` and a small async generator over `fetch` + `ReadableStream`. Chose the latter: ~40 lines, zero dependency, one-shot semantics (no reconnect, which we don't want on a completed turn). Event-boundary matches `\r\n\r\n` / `\n\n` / `\r\r` per spec — our first browser run silently swallowed every event because we only matched `\n\n` and sse-starlette emits `\r\n\r\n`.

## ADR-017 — Zustand for cross-route UI state
Date: 2026-04-24
Need cross-route state (learner, profile, session, live turn, debug decisions). Redux is overkill, `Context + useReducer` is more boilerplate than Zustand, TanStack Query doesn't fit (we have a streaming mutation, not a cacheable query). Zustand's `create` gives a single store with minimal ceremony; not load-bearing, trivial to migrate later. Store setters are stable references so selectors don't thrash effects.

## ADR-018 — Event-level streaming in Day 3; token streaming in Day 4
Date: 2026-04-24
`stream_turn` currently emits at `tool_decision` granularity (inherited from ADR-014). In the UI that produces "announcement bursts" — the whole tutor question appears and is announced in one go — rather than progressive reveal. Acceptable as a Day 3 baseline because `aria-live="polite" aria-atomic="false"` renders both cleanly. Day 4 upgrades to `messages.stream` with partial-block accumulation for token-level streaming, at which point the `applyDecision` reducer needs to append rather than replace on deltas.

## ADR-019 — AccessibilityProfile is edited, not just set once
Date: 2026-04-24
Users will toggle settings mid-session (turn on plain-language when a topic feels too dense, switch to ADHD-focus when scaffolding feels busy, etc.). `/onboarding` is reachable at any time from the chat header. `PATCH /learner/{id}/profile` has overwrite semantics — the whole profile is sent; partial-merge was considered and rejected as fiddly for a small profile where the UI always has the full state anyway. Driven client-side by shadcn RadioGroup per dimension + a live preview card that mirrors backend `to_prompt_guidance` so users see *what* changes before committing.

## ADR-020 — No auto-focus on form mount
Date: 2026-04-24
Removed the focus-on-first-radio effect from `/onboarding`. Caught during the VoiceOver sanity pass: auto-focus landed screen-reader users mid-form without hearing the h1 ("Tell me how you learn best") or the "accessibility is not a skin" description — exactly the preamble that justifies the form. Sighted keyboard users pay one extra Tab to reach the first control; screen-reader users get the context they need to understand what they're filling out. Rule going forward: don't steal focus away from document top on route mount unless there's a specific reason tied to keyboard-driven workflows (e.g., a modal opening).
