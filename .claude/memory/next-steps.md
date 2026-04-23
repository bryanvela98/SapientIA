# Next steps

## Immediate (Day 2)
- [ ] FastAPI app skeleton (`backend/app/main.py`)
- [ ] `/session/start` and `/session/turn` endpoints with SSE streaming
- [ ] SQLAlchemy models: `Learner`, `Session`, `Turn`, `EarnedConcept`
- [ ] Thread `AccessibilityProfile` into system prompt builder
- [ ] Integration test: full session end-to-end via httpx

## Open questions
- Exact tool-use contract for `give_hint`: should hint level be 1-3 or 1-5?
- Storage for earned concepts: JSON column on Session, or separate table? (Lean separate table.)
- Authentication for MVP — skip entirely and use anonymous sessions?
