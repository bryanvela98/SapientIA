# Memory system

Purpose: let future Claude sessions resume with full context after long gaps.

## Files
- `progress.md` — append-only log of completed milestones. Newest at top.
- `next-steps.md` — running list of what's next. Overwrite freely.
- `decisions.md` — architectural decision records. Append-only.
- `sessions/YYYY-MM-DD-<implementation-title>.md` — end-of-session summaries. One per logical implementation chunk (usually one per commit). **Name by what you built, not by day number.** Good: `2026-04-23-fastapi-skeleton.md`, `2026-04-23-sse-streaming.md`. Bad: `day1.md`, `day2.md`.

## Session protocol
At session start: read `progress.md`, `next-steps.md`, `decisions.md`, and the most recent 2–3 session files.
At session end: write a new session file covering what was done, what broke, open questions, next action. If the session produced multiple commits on different concerns, write one session file per commit.