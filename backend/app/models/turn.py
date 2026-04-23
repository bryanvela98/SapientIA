from datetime import datetime, timezone
from sqlalchemy import String, Integer, JSON, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Turn(Base):
    """One API-shaped message in a session. `content` stores the exact blocks
    the Anthropic API received (user) or returned (assistant), so history
    reconstruction is a pure replay — no re-wrapping at request time.
    """
    __tablename__ = "turns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("sessions.id"), index=True)
    turn_number: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String)  # "user" | "assistant"
    content: Mapped[list] = mapped_column(JSON)  # exact API message content blocks
    display_text: Mapped[str | None] = mapped_column(String, nullable=True)
    tool_used: Mapped[str | None] = mapped_column(String, nullable=True)  # primary teaching tool
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))