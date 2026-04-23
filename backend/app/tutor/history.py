"""History reconstruction: turn persisted API-shaped message blocks back into
the list of {role, content} dicts the Anthropic API expects, and build the next
user message so tool_use blocks on the last assistant turn are paired with
tool_result blocks.

Invariant (ADR-012): Turn.content is stored in the exact shape the API received
(user) or returned (assistant). Reconstruction is pure replay — no re-wrapping.
"""
from app.models.turn import Turn

BOOKKEEPING = {"mark_concept_earned"}


def build_user_message(learner_text: str, prior_assistant_turn: Turn | None) -> dict:
    """Build a user message dict. If the prior assistant turn used tools, wrap
    the learner's text in tool_result blocks (one per tool_use id). The text
    rides on the primary teaching tool's result; bookkeeping tools get "ok".
    """
    if prior_assistant_turn is None:
        return {"role": "user", "content": [{"type": "text", "text": learner_text}]}

    tool_uses = [b for b in prior_assistant_turn.content if b.get("type") == "tool_use"]
    if not tool_uses:
        return {"role": "user", "content": [{"type": "text", "text": learner_text}]}

    primary_id = next(
        (tu["id"] for tu in tool_uses if tu["name"] not in BOOKKEEPING),
        tool_uses[0]["id"],
    )
    blocks = []
    for tu in tool_uses:
        blocks.append({
            "type": "tool_result",
            "tool_use_id": tu["id"],
            "content": learner_text if tu["id"] == primary_id else "ok",
        })
    return {"role": "user", "content": blocks}


def rebuild_history(turns: list[Turn]) -> list[dict]:
    """Persisted Turn rows → API-ready messages list (pure replay)."""
    return [{"role": t.role, "content": t.content} for t in turns]