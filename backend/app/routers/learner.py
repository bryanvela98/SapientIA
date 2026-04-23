from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.learner import Learner
from app.schemas.learner import LearnerCreate, LearnerOut, ProfileUpdate
from app.schemas.profile import AccessibilityProfile

router = APIRouter()


def _to_out(learner: Learner) -> LearnerOut:
    return LearnerOut(
        id=learner.id,
        accessibility_profile=AccessibilityProfile(**(learner.accessibility_profile or {})),
    )


@router.post("", response_model=LearnerOut)
async def create_learner(body: LearnerCreate, db: AsyncSession = Depends(get_db)) -> LearnerOut:
    learner = Learner(accessibility_profile=body.accessibility_profile.model_dump())
    db.add(learner)
    await db.commit()
    await db.refresh(learner)
    return _to_out(learner)


@router.get("/{learner_id}", response_model=LearnerOut)
async def get_learner(learner_id: str, db: AsyncSession = Depends(get_db)) -> LearnerOut:
    learner = await db.get(Learner, learner_id)
    if learner is None:
        raise HTTPException(status_code=404, detail="learner not found")
    return _to_out(learner)


@router.patch("/{learner_id}/profile", response_model=LearnerOut)
async def update_profile(
    learner_id: str,
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> LearnerOut:
    learner = await db.get(Learner, learner_id)
    if learner is None:
        raise HTTPException(status_code=404, detail="learner not found")
    learner.accessibility_profile = body.accessibility_profile.model_dump()
    await db.commit()
    await db.refresh(learner)
    return _to_out(learner)