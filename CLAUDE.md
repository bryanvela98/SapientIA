# SapientIA — Inclusive Socratic Tutor

## What this is
A web app that teaches any topic through Socratic dialogue, adapted to four accessibility profiles (visual, hearing, cognitive, learning disabilities). Built for the Build With Opus 4.7 hackathon.

## Non-negotiables
1. **Teach, don't tell.** The tutor never outputs the final answer on turn 1. It diagnoses, asks leading questions, gives graded hints. Final answers only after the learner demonstrates understanding.
2. **Earned vs. told.** Every concept is tagged as either earned (learner reasoned to it) or told (tutor had to give it). The earned ratio is the headline metric.
3. **Accessibility is not a skin.** The `AccessibilityProfile` affects BOTH the UI AND the system prompt (reading level, chunking, pacing, verbal image descriptions).
4. **Streaming everywhere.** Tutor responses stream. UI has `aria-live="polite"` so screen readers announce tokens.

## Stack
- Backend: FastAPI (async), Anthropic Python SDK, SQLAlchemy + SQLite
- Frontend: React + TypeScript + Tailwind + shadcn/ui (Radix under the hood, accessible by default)
- Voice: Web Speech API (STT + SpeechSynthesis)
- Model: `claude-opus-4-7` for pedagogy, `claude-haiku-4-5-20251001` for cheap evaluation passes

## Memory system (read this before starting any session)
Before you do anything, read in order:
1. `.claude/memory/progress.md` — what's done
2. `.claude/memory/next-steps.md` — what's next
3. `.claude/memory/decisions.md` — why things are the way they are
4. The latest file in `.claude/memory/sessions/` — what happened last

After you finish a meaningful chunk of work:
- Append a new entry to `.claude/memory/progress.md`
- Update `.claude/memory/next-steps.md`
- If you made an architectural choice, log it in `.claude/memory/decisions.md`
- End the session by writing `.claude/memory/sessions/YYYY-MM-DD-<topic>.md`

## Accessibility priority order (MVP → stretch)
1. Visual impairment / blindness
2. Hearing impairment
3. Cognitive / intellectual disabilities
4. Learning disabilities (dyslexia, ADHD)
5. Non-disabled users

## Pedagogy quick reference
See `docs/pedagogy.md` and the `socratic-tutor` skill in `.claude/skills/`.

## Build timeline (7 days)
- Day 1: Core Socratic loop as a script, no UI
- Day 2: FastAPI server, streaming, persistence
- Day 3: React shell + baseline a11y
- Day 4: Visual impairment layer (voice I/O, screen reader)
- Day 5: Hearing impairment layer
- Day 6: Cognitive + LD layers
- Day 7: Polish, demo video, deploy
