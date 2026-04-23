# Architecture

## Current (Day 1)
Script-only validation. `backend/scripts/validate_loop.py` drives a `TutorState` through the tool-use loop. A simulated learner (Haiku) provides replies.

## Target (end of week)
- FastAPI backend: `/session/start`, `/session/turn` (SSE), `/session/state`
- SQLite persistence: `Learner`, `Session`, `Turn`, `EarnedConcept`
- React frontend: chat UI, AccessibilityProfile picker, voice I/O, captions
- `AccessibilityProfile` flows into BOTH the system prompt AND the UI rendering
