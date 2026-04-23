from pydantic import BaseModel
from app.schemas.profile import AccessibilityProfile


class LearnerCreate(BaseModel):
    accessibility_profile: AccessibilityProfile = AccessibilityProfile()


class LearnerOut(BaseModel):
    id: str
    accessibility_profile: AccessibilityProfile


class ProfileUpdate(BaseModel):
    accessibility_profile: AccessibilityProfile