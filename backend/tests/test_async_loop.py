"""Integration tests for the async tutor loop. Hits the live Anthropic API —
run with:   pytest -m integration -s

The three things we care about:
1. A first turn yields turn_start → ≥1 tool_decision → turn_end with assistant_content.
2. Rebuilt history (simulating DB replay with tool_use/tool_result pairing) keeps
   the API happy across turns 2+.
3. When the injected history ends on a bookkeeping-only assistant turn, chain-through
   engages and we still reach a teaching tool by turn_end.
"""
import pytest

from app.schemas.profile import AccessibilityProfile
from app.tutor.async_loop import stream_turn, TEACHING_TOOLS


async def _collect(agen):
    return [ev async for ev in agen]


@pytest.mark.integration
async def test_first_turn_yields_teaching_move():
    history = [{"role": "user", "content": [{"type": "text", "text": "What is recursion?"}]}]
    events = await _collect(stream_turn("Recursion in programming", AccessibilityProfile(), history, 1))

    assert events[0]["type"] == "turn_start"
    assert events[-1]["type"] == "turn_end"
    assert events[-1].get("assistant_content"), "turn_end must carry assistant_content"
    assert events[-1]["violations"] == [], "no deliver_answer on turn 1"

    tool_names = {ev["name"] for ev in events if ev["type"] == "tool_decision"}
    assert tool_names & TEACHING_TOOLS, f"expected a teaching tool, got {tool_names}"
    assert not any(ev["type"] == "error" for ev in events)


@pytest.mark.integration
async def test_multiturn_rebuild_keeps_api_happy():
    """Simulate DB replay: user text → assistant tool_use → user tool_result → next turn."""
    assistant_turn = [
        {"type": "tool_use", "id": "toolu_fake1", "name": "ask_socratic_question",
         "input": {"question": "What happens when a function calls itself?", "concept_targeted": "self-reference"}},
    ]
    history = [
        {"role": "user", "content": [{"type": "text", "text": "I don't get recursion."}]},
        {"role": "assistant", "content": assistant_turn},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "toolu_fake1", "content": "Maybe it loops forever?"},
        ]},
    ]
    events = await _collect(stream_turn("Recursion in programming", AccessibilityProfile(), history, 2))

    assert events[0]["type"] == "turn_start" and events[0]["turn_number"] == 2
    assert any(ev["type"] == "tool_decision" for ev in events)
    assert events[-1]["type"] == "turn_end"
    assert not any(ev["type"] == "error" for ev in events)


@pytest.mark.integration
async def test_chain_through_recovers_from_bookkeeping_only():
    """Inject a history where the previous assistant turn fired ONLY mark_concept_earned,
    and this turn's initial model call is also likely to want to reinforce rather than
    teach. Assert that by turn_end we have a teaching move regardless.

    We can't force the model to fire bookkeeping-only on the fresh call deterministically,
    but we can exercise the post-only-bookkeeping recovery path by *starting* the history
    with a bookkeeping-only assistant turn and its tool_result, then asking it to continue.
    The loop itself handles chain-through when the response contains no teaching tool.
    """
    prior_assistant = [{
        "type": "tool_use", "id": "toolu_earn1", "name": "mark_concept_earned",
        "input": {"concept": "base case", "evidence": "learner said it stops when n=1"},
    }]
    history = [
        {"role": "user", "content": [{"type": "text", "text": "I think it stops when n is 1."}]},
        {"role": "assistant", "content": prior_assistant},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "toolu_earn1", "content": "ok"},
        ]},
    ]
    events = await _collect(stream_turn("Recursion in programming", AccessibilityProfile(), history, 3))

    assert events[-1]["type"] == "turn_end", f"expected turn_end, got {events[-1]}"
    tool_names = [ev["name"] for ev in events if ev["type"] == "tool_decision"]
    assert any(n in TEACHING_TOOLS for n in tool_names), \
        f"turn must include a teaching move (possibly via chain-through). Saw: {tool_names}"