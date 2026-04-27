# SapientIA — Inclusive Socratic Tutor

A web tutor that teaches *any* topic through Socratic dialogue, adapted to four accessibility profiles (visual, cognitive, learning disabilities, motor / no-hands voice control).

> **Earned, not told.** The tutor never hands you the answer on turn 1. It diagnoses, asks leading questions, and gives graded hints. Final answers only land after the learner demonstrates understanding — and every concept is tagged as either *earned* (you reasoned to it) or *told* (the tutor had to give it). The earned ratio is the headline metric.

## Why it exists

Most AI tools optimize for *answering*. That's a bad pedagogy default — it offloads cognition instead of building it. SapientIA flips the contract: the model is given a 6-tool schema (`diagnose`, `ask_socratic_question`, `give_hint` with hint levels 1→3, `check_understanding`, `mark_concept_earned`, `deliver_answer`) and the prompt enforces escalation rather than capitulation.

Accessibility is treated as a first-class axis, not a CSS skin. The learner's `AccessibilityProfile` flows into **both** the system prompt (reading register, sentence chunking, single-question rule) **and** the UI (font swaps, focus rings, ARIA-live priority, voice control). See [ADR-005](.claude/memory/decisions.md) for the rationale.

## Quick start

You'll need an [Anthropic API key](https://console.anthropic.com), Python 3.11+, and Node 20+.

```bash
# 1. Backend — FastAPI + SQLite
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env       # paste your real key
uvicorn app.main:app --reload --port 8000        # runs at http://localhost:8000

# 2. Frontend — Vite + React + Tailwind
cd ../frontend
npm install
npm run dev                                       # runs at http://localhost:5173
```

Open `http://localhost:5173`, complete the onboarding (pick an accessibility profile or keep defaults), pick a topic, and start a session.

### Optional: smoke-test the loop without the UI

```bash
cd backend
python scripts/validate_loop.py                  # cooperative learner, default profile
python scripts/validate_loop.py --persona stubborn --turns 3
python scripts/validate_loop.py --profile cognitive-plain-language
```

Prints per-turn metrics (avg words/sentence, sentence over-cap counts, violations) and the final earned-vs-told ratio.

## Accessibility layers

Each layer is opt-in via the profile picker on `/onboarding`. Layers compose orthogonally — the data-attribute selectors stack cleanly (`[data-cognitive='plain-language'][data-learning='dyslexia-font']` is a valid combination, see [ADR-027](/.claude/memory/decisions.md), [ADR-029](/.claude/memory/decisions.md)).

| Profile axis | What it changes in the UI | What it changes in the prompt |
|---|---|---|
| `visual=screen-reader` | Skip-link, dual ARIA live regions (polite transcript + assertive milestones), token-level streaming, focus visible at 3px, optional TTS read-aloud | Verbal image descriptions; pacing fragment hints |
| `visual=low-vision` | TTS defaults ON; same focus polish | Same as screen-reader for prose |
| `cognitive=plain-language` | 17px / 1.7 line-height; 60ch bubble max-width; 3px focus offset; `progress_summary` recap bubble; in-chat pacing toggle and "Recap so far" button | Grade-5 register, ≤15 words/sentence, 3-sentence chunking cap, define-on-first-use vocabulary; soft `max-sentences-exceeded` violation when drift detected |
| `learning=dyslexia-font` | [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont) self-hosted (4 woff2, ~47 KB total); 0.02em letter-spacing; 0.06em word-spacing | None (the typeface is the intervention) |
| `learning=adhd-focus` | Older transcript turns fade to 0.55 opacity (restored on hover/focus); `Shift+M` minimize chord hides non-essential chrome; minimize defaults ON for this profile | Single-question rule; soft `max-questions-exceeded` violation when drift detected |
| `pacing=slow` | Optimistic in-chat toggle; PATCHes profile | Slows sentence cadence and pause beats |

## Voice & keyboard control

Click the **Help** button in the chat header for an in-app reference, or:

| Chord | Action | Where |
|---|---|---|
| `Cmd/Ctrl + Enter` | Send the message | Composer |
| `Shift + Space` (hold) | Dictate into the composer | Composer focus required |
| `Shift + V` (hold) | Issue a voice command | Outside text inputs |
| `Shift + M` | Minimize / restore the toolbar | Anywhere |
| `K` | Pause / resume read-aloud | When TTS is speaking |

Voice command vocabulary (hold `Shift+V`, then speak):

`recap` · `send` · `slow down` / `slower` · `normal pace` / `speed up` · `read aloud` · `stop reading` · `stop` / `cancel` · `minimize` / `hide controls` · `restore` / `maximize`

Web Speech API support: Chrome, Edge, Safari (full); Firefox (no STT/voice — UI dims gracefully).

## Stack

- **Backend** — FastAPI · Anthropic Python SDK · SQLAlchemy + aiosqlite · `sse-starlette` (token-level SSE)
- **Frontend** — React 19 · TypeScript · Vite 8 · Tailwind v4 · shadcn/ui (Radix primitives)
- **State** — Zustand
- **Voice** — Web Speech API (STT + SpeechSynthesis)
- **Tests** — pytest (47) on the backend; Vitest + Testing Library (97) on the frontend
- **Models** — `claude-opus-4-7` for the tutor; `claude-haiku-4-5-20251001` for the simulated-learner eval

## Project structure

```
backend/
  app/
    main.py              # FastAPI app, lifespan, CORS
    config.py            # pydantic-settings
    db.py                # SQLAlchemy engine + create_all on startup
    models/              # Learner, Session, Turn, EarnedConcept
    routers/             # /health /learner /session
    schemas/profile.py   # AccessibilityProfile + PromptFragments (ADR-025)
    tutor/
      prompts.py         # build_system_prompt + maybe_recap_nudge
      tools.py           # 7-tool contract incl. progress_summary
      async_loop.py      # stream_turn — SSE token streaming + violations
  scripts/validate_loop.py
  tests/                 # 47 pytest tests (profile, recap, violations, history, hydration, integration)

frontend/
  src/
    routes/              # Onboarding.tsx, Chat.tsx
    components/          # MicButton, MinimizeToggle, RecapBubble, VoiceCommandBanner, HelpDialog, ...
    hooks/               # useStt, useTtsForLiveTurn, useTtsKeyboard, useVoiceCommands, useVoiceCommandDispatch
    lib/                 # api.ts, store (zustand), stt.ts, tts.ts, voice-commands.ts, useCognitiveMode, useLearningMode, useMinimizedUi, useTts, useTheme
  public/fonts/atkinson-hyperlegible/   # self-hosted (OFL 1.1)

docs/                    # architecture.md, pedagogy.md
.claude/memory/          # decisions.md (ADRs, tracked); progress / next-steps / sessions (gitignored)
CLAUDE.md                # non-negotiables + memory protocol for AI-assisted work
```

## Project docs

- [`CLAUDE.md`](CLAUDE.md) — non-negotiables, memory protocol, voice-control quick reference
- [`docs/pedagogy.md`](docs/pedagogy.md) — the 7-tool Socratic framework + violations table
- [`docs/architecture.md`](docs/architecture.md) — system design at a glance
- [`.claude/memory/decisions.md`](/.claude/memory/decisions.md) — 33 ADRs covering every architectural choice
- [`.claude/memory/sessions/`](/.claude/memory/sessions/) — per-commit session logs (gitignored; local context for long AI runs)

## Status

- Cloud deploy — codebase is deploy-ready (single-process, SQLite-backed, no auth) but no Render / Vercel / Fly.io provisioning.

## Pedagogy non-negotiables

1. **Teach, don't tell.** The tutor never outputs the final answer on turn 1.
2. **Earned vs. told.** Every concept is tagged. The earned ratio is the headline metric.
3. **Accessibility is not a skin.** The profile affects BOTH the prompt AND the UI.
4. **Streaming everywhere.** Tutor responses stream; live regions are wired so screen readers announce tokens politely while milestones (concept earned, progress recap) jump the queue.

See [`CLAUDE.md`](CLAUDE.md) for the full set.

