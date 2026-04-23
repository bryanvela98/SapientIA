# Memory system

Purpose: let future Claude sessions resume with full context after long gaps.

## Files
- `progress.md` — append-only log of completed milestones. Newest at top.
- `next-steps.md` — running list of what's next. Overwrite freely.
- `decisions.md` — architectural decision records. Append-only.
- `sessions/YYYY-MM-DD-<topic>.md` — end-of-session summaries. One per working session.

## Session protocol
At session start: read `progress.md`, `next-steps.md`, latest session file.
At session end: write a new session file covering what was done, what broke, open questions, next action.
