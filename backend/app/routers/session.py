import json

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.db import get_db
from app.models.concept import EarnedConcept, ToldConcept
from app.models.learner import Learner
from app.models.session import Session
from app.models.turn import Turn
from app.schemas.profile import AccessibilityProfile
from app.schemas.session import SessionCreate, SessionOut, SessionState, TurnOut
from app.tutor.async_loop import extract_primary, stream_turn
from app.tutor.history import build_user_message, rebuild_history

router = APIRouter()


class TurnRequest(BaseModel):
    message: str
    # Set by the in-chat "Recap so far" control (Day 5 Commit 5). Promotes
    # the soft pacing nudge in the system prompt to a strong directive so
    # the model fires progress_summary this turn regardless of the
    # unrecapped counter.
    force_recap: bool = False


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


@router.get("/{session_id}/turns", response_model=list[TurnOut])
async def get_turns(session_id: str, db: AsyncSession = Depends(get_db)) -> list[TurnOut]:
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return [
        TurnOut(
            turn_number=t.turn_number,
            role=t.role,
            display_text=t.display_text or "",
            tool_used=t.tool_used,
            created_at=t.created_at.isoformat(),
        )
        for t in session.turns
    ]


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


@router.post("/{session_id}/turn")
async def run_turn(session_id: str, body: TurnRequest, db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    learner = await db.get(Learner, session.learner_id)
    if learner is None:
        raise HTTPException(status_code=404, detail="learner not found")
    profile = AccessibilityProfile(**(learner.accessibility_profile or {}))

    turns = list(session.turns)  # ordered by turn_number via relationship
    prior_assistant = next((t for t in reversed(turns) if t.role == "assistant"), None)
    next_number = (turns[-1].turn_number + 1) if turns else 1

    # Count earned concepts since the last progress_summary recap turn. The
    # watermark is the newest assistant turn with tool_used='progress_summary';
    # before the first recap, every earned concept is unrecapped. Feeds the
    # soft pacing nudge in build_system_prompt.
    recap_turns = [t for t in turns if t.tool_used == "progress_summary"]
    last_recap_at = recap_turns[-1].created_at if recap_turns else None
    unrecapped = sum(
        1 for c in session.earned
        if last_recap_at is None or c.created_at > last_recap_at
    )

    user_msg = build_user_message(body.message, prior_assistant)

    user_turn = Turn(
        session_id=session_id,
        turn_number=next_number,
        role="user",
        content=user_msg["content"],
        display_text=body.message,
    )
    db.add(user_turn)
    await db.commit()

    history = rebuild_history(turns) + [user_msg]
    topic = session.topic

    async def event_gen():
        final_assistant = None
        async for ev in stream_turn(
            topic,
            profile,
            history,
            next_number,
            unrecapped=unrecapped,
            force_recap=body.force_recap,
        ):
            if ev["type"] == "concept_earned":
                db.add(EarnedConcept(
                    session_id=session_id,
                    concept=ev["concept"],
                    evidence=ev.get("evidence", ""),
                ))
                await db.commit()
            elif ev["type"] == "concept_told":
                db.add(ToldConcept(
                    session_id=session_id,
                    concept=ev["concept"],
                    justification=ev.get("justification", ""),
                ))
                await db.commit()
            elif ev["type"] == "turn_end":
                final_assistant = ev.get("assistant_content")
            yield {"event": ev["type"], "data": json.dumps(ev)}

        if final_assistant is not None:
            tool_name, display_text = extract_primary(final_assistant)
            db.add(Turn(
                session_id=session_id,
                turn_number=next_number,
                role="assistant",
                content=final_assistant,
                display_text=display_text,
                tool_used=tool_name,
            ))
            await db.commit()

    return EventSourceResponse(event_gen())