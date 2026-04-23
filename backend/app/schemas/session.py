from pydantic import BaseModel


class SessionCreate(BaseModel):
    topic: str


class SessionOut(BaseModel):
    id: str
    learner_id: str
    topic: str


class SessionState(BaseModel):
    id: str
    topic: str
    turn_count: int
    earned: list[dict]
    told: list[dict]
    ratio: float


class TurnOut(BaseModel):
    turn_number: int
    role: str  # "user" | "assistant"
    display_text: str
    tool_used: str | None
    created_at: str