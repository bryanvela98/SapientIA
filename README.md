# SapientIA — Inclusive Socratic Tutor

AI tutor that teaches instead of answering, adapted to four accessibility profiles.

## Setup
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env   # paste your real key
python scripts/validate_loop.py
```

## Project docs
- `CLAUDE.md` — non-negotiables and memory protocol
- `docs/pedagogy.md` — the Socratic framework
- `docs/architecture.md` — system design
- `.claude/memory/` — session context for long runs

Built for Build With Opus 4.7, April 2026.
