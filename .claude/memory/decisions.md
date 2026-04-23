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
