# SapientIA — Inclusive Socratic Tutor

## What this is
A web app that teaches any topic through Socratic dialogue, adapted to four accessibility profiles (visual, cognitive, learning disabilities, and — stretch — motor / no-hands voice control). Built for the Build With Opus 4.7 hackathon.

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
- End the session by writing `.claude/memory/sessions/YYYY-MM-DD-<implementation-title>.md`. **Use an implementation title, not a day number.** Good: `2026-04-23-fastapi-skeleton.md`, `2026-04-23-sse-streaming.md`, `2026-04-24-voice-io.md`. Bad: `day2.md`, `day3.md`. Multiple session files per calendar day are fine and expected — one per commit when the commits cover distinct pieces of work.

## Accessibility priority order (MVP → stretch)
1. Visual impairment / blindness
2. Cognitive / intellectual disabilities
3. Learning disabilities (dyslexia, ADHD)
4. Motor impairment / no-hands (voice control) — **stretch, last-days only**
5. Non-disabled users

Note: hearing impairment was intentionally dropped (ADR-021). Rationale: the app is text-first and fully visible on screen, so deaf/HoH learners already have parity without a dedicated layer. The slot was reallocated to motor/voice control for users who cannot use a keyboard or mouse — a harder problem that actually needs new UX.

## Pedagogy quick reference
See `docs/pedagogy.md` and the `socratic-tutor` skill in `.claude/skills/`.

## Build timeline (7 days — actual delivered scope)
- Day 1: Core Socratic loop as a script, no UI ✓
- Day 2: FastAPI server, streaming, persistence ✓
- Day 3: React shell + baseline a11y ✓
- Day 4: Visual impairment layer (TTS, STT push-to-talk, token streaming, screen-reader polish) ✓
- Day 5: Cognitive layer (plain-language prompt, chunked turns, progress summaries) ✓
- Day 6: Learning disabilities layer (Atkinson font, dyslexia theme, ADHD focus mode + Shift+M minimize chord, max-questions soft violation) ✓
- Day 7: Motor / voice-control stretch — voice command grammar + Shift+V hold + dispatch + barge-in (cancels TTS); local demo. **Deferred: cloud deploy** (demoing locally, not deployed for hackathon submission). **Deferred: VO/NVDA/Lighthouse/axe-core verification audit** (template at `.claude/memory/sessions/2026-04-27-verification-audit.md` ready for transcription when human-driven runs happen).

## Voice control quick reference
Hold **Shift+V** outside the composer to issue a voice command (Web Speech API, where supported). Vocabulary: `recap`, `send`, `slow down` / `slower`, `normal pace` / `speed up`, `read aloud`, `stop reading`, `stop` / `cancel`, `minimize` / `hide controls`, `restore` / `maximize`. Voice activation cancels in-flight TTS (barge-in). See ADR-032 (grammar rationale) and ADR-033 (minimize routes through `useMinimizedUi` single source of truth).
