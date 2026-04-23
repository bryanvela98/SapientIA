"""Async tutor loop — yields SSE-ready events per turn.

Design: we stream the SSE events to the client, but use non-streaming API calls
under the hood (ADR-014) so tool-use assembly stays simple. Day 3 can upgrade to
token-level streaming when the UI actually benefits.

Invariants:
- On a bookkeeping-only response, chain through up to 2x to force a teaching move (ADR-013).
- `turn_start` → 0+ `tool_decision` / `concept_earned` / `concept_told` → `turn_end`.
- `turn_end.assistant_content` carries the API-shaped content blocks to persist.
- `deliver_answer` on turn 1 is flagged as a violation but NOT blocked (we want
  to see it in the log, not crash the turn).
"""
from typing import AsyncIterator
from anthropic import AsyncAnthropic

from app.config import settings
from app.schemas.profile import AccessibilityProfile
from app.tutor.prompts import build_system_prompt
from app.tutor.tools import TOOLS

_async_client: AsyncAnthropic | None = None


def _client() -> AsyncAnthropic:
    global _async_client
    if _async_client is None:
        _async_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _async_client


BOOKKEEPING = {"mark_concept_earned"}
TEACHING_TOOLS = {"diagnose", "ask_socratic_question", "give_hint", "check_understanding", "deliver_answer"}


async def _single_call(messages: list[dict], system: str):
    return await _client().messages.create(
        model=settings.tutor_model,
        max_tokens=1024,
        system=system,
        tools=TOOLS,
        tool_choice={"type": "any"},
        messages=messages,
    )


def _block_to_dict(b) -> dict:
    if b.type == "text":
        return {"type": "text", "text": b.text}
    if b.type == "tool_use":
        return {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}
    raise ValueError(f"unexpected block type: {b.type}")


async def stream_turn(
    topic: str,
    profile: AccessibilityProfile,
    history: list[dict],
    turn_number: int,
) -> AsyncIterator[dict]:
    """Yield SSE-ready event dicts for one tutor turn.

    `history` must already include the latest user turn (with any needed tool_result
    pairing — call `build_user_message` first and append).
    """
    yield {"type": "turn_start", "turn_number": turn_number}
    system = build_system_prompt(topic, profile)
    violations: list[str] = []
    final_assistant_content = None

    for _ in range(2):  # at most one chain-through
        resp = await _single_call(history, system)
        content_blocks = [_block_to_dict(b) for b in resp.content]
        tool_uses = [b for b in content_blocks if b["type"] == "tool_use"]

        for tu in tool_uses:
            yield {"type": "tool_decision", "name": tu["name"], "input": tu["input"], "id": tu["id"]}
            if tu["name"] == "mark_concept_earned":
                yield {
                    "type": "concept_earned",
                    "concept": tu["input"]["concept"],
                    "evidence": tu["input"].get("evidence", ""),
                }
            elif tu["name"] == "deliver_answer":
                yield {
                    "type": "concept_told",
                    "concept": tu["input"]["concept"],
                    "justification": tu["input"].get("justification", ""),
                    "answer": tu["input"].get("answer", ""),
                }
                if turn_number == 1:
                    violations.append("deliver_answer on turn 1")

        tool_names = {tu["name"] for tu in tool_uses}
        if tool_names & TEACHING_TOOLS:
            final_assistant_content = content_blocks
            break

        # Bookkeeping-only — extend history with the assistant turn + a synthesized
        # tool_result user turn, then loop once to force a teaching move.
        history = history + [{"role": "assistant", "content": content_blocks}]
        history = history + [{
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": tu["id"], "content": "ok"}
                for tu in tool_uses
            ],
        }]

    if final_assistant_content is None:
        yield {"type": "error", "message": "model produced only bookkeeping after 2 attempts"}
        return

    yield {
        "type": "turn_end",
        "violations": violations,
        "assistant_content": final_assistant_content,
    }


def extract_primary(assistant_content: list[dict]) -> tuple[str | None, str | None]:
    """Return (tool_name, display_text) for the primary teaching tool call in
    an assistant content array. Bookkeeping-only content returns (None, None).
    """
    for b in assistant_content:
        if b.get("type") != "tool_use" or b.get("name") not in TEACHING_TOOLS:
            continue
        inp = b.get("input", {}) or {}
        text = inp.get("question") or inp.get("hint") or inp.get("answer")
        return b["name"], text
    return None, None