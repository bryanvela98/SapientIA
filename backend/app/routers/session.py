from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.learner import Learner
from app.models.session import Session
from app.schemas.session import SessionCreate, SessionOut, SessionState

router = APIRouter()


@router.post("", response_model=SessionOut)
async def create_session(
    body: SessionCreate,
    x_learner_id: str = Header(..., alias="X-Learner-ID"),
    db: AsyncSession = Depends(get_db),
) -> SessionOut:
    learner = await db.get(Learner, x_learner_id)
    if learner is None:
        raise HTTPException(status_code=404, detail="learner not found; create one with POST /learner first")
    session = Session(learner_id=x_learner_id, topic=body.topic)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionOut(id=session.id, learner_id=session.learner_id, topic=session.topic)


@router.get("/{session_id}/state", response_model=SessionState)
async def get_state(session_id: str, db: AsyncSession = Depends(get_db)) -> SessionState:
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    earned = [{"concept": c.concept, "evidence": c.evidence} for c in session.earned]
    told = [{"concept": c.concept, "justification": c.justification} for c in session.told]
    turn_count = max((t.turn_number for t in session.turns), default=0)
    ratio = len(earned) / max(1, len(earned) + len(told))
    return SessionState(
        id=session.id,
        topic=session.topic,
        turn_count=turn_count,
        earned=earned,
        told=told,
        ratio=ratio,
    )