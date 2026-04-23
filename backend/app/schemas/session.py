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