# SapientIA backend

FastAPI + Anthropic SDK backend for the inclusive Socratic tutor.

## Day 1 — script-only validation

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env   # paste your real key
python scripts/validate_loop.py
```

Expected: earned-vs-told ratio printed per topic, no `deliver_answer` on turn 1.

## Structure
- `app/schemas/profile.py` — `AccessibilityProfile` pydantic model, feeds into the system prompt.
- `app/tutor/prompts.py` — Socratic system prompt builder.
- `app/tutor/tools.py` — 6-tool contract (diagnose, ask_socratic_question, give_hint, check_understanding, mark_concept_earned, deliver_answer).
- `app/tutor/loop.py` — one-turn runner; maintains `TutorState` with earned/told lists.
- `scripts/validate_loop.py` — drives the loop with a Haiku-simulated learner.
