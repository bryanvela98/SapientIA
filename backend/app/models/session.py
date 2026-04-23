import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String, ForeignKey("learners.id"), index=True)
    topic: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    turns = relationship(
        "Turn",
        cascade="all, delete-orphan",
        backref="session",
        lazy="selectin",
        order_by="Turn.turn_number",
    )
    earned = relationship(
        "EarnedConcept",
        cascade="all, delete-orphan",
        backref="session",
        lazy="selectin",
    )
    told = relationship(
        "ToldConcept",
        cascade="all, delete-orphan",
        backref="session",
        lazy="selectin",
    )