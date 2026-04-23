"""Pure-function tests for history reconstruction — no API required."""
from types import SimpleNamespace

from app.tutor.history import build_user_message, rebuild_history


def _turn(role, content):
    # Turn rows expose .role and .content attributes; SimpleNamespace is enough
    # to stand in for the SQLAlchemy model in unit tests.
    return SimpleNamespace(role=role, content=content, turn_number=0)


def test_build_user_message_no_prior_returns_text_block():
    msg = build_user_message("hi", None)
    assert msg == {"role": "user", "content": [{"type": "text", "text": "hi"}]}


def test_build_user_message_prior_assistant_without_tools_stays_text():
    prior = _turn("assistant", [{"type": "text", "text": "hello!"}])
    msg = build_user_message("yo", prior)
    assert msg["content"] == [{"type": "text", "text": "yo"}]


def test_build_user_message_pairs_single_tool_use():
    prior = _turn("assistant", [{
        "type": "tool_use",
        "id": "toolu_A",
        "name": "ask_socratic_question",
        "input": {"question": "q?"},
    }])
    msg = build_user_message("I think X", prior)
    assert msg["content"] == [
        {"type": "tool_result", "tool_use_id": "toolu_A", "content": "I think X"}
    ]


def test_build_user_message_primary_rides_on_teaching_tool_bookkeeping_gets_ok():
    prior = _turn("assistant", [
        {"type": "tool_use", "id": "toolu_earn", "name": "mark_concept_earned", "input": {"concept": "c"}},
        {"type": "tool_use", "id": "toolu_ask", "name": "ask_socratic_question", "input": {"question": "q?"}},
    ])
    msg = build_user_message("my reply", prior)
    assert msg["content"] == [
        {"type": "tool_result", "tool_use_id": "toolu_earn", "content": "ok"},
        {"type": "tool_result", "tool_use_id": "toolu_ask", "content": "my reply"},
    ]


def test_rebuild_history_preserves_order_and_shape():
    t1 = _turn("user", [{"type": "text", "text": "hi"}])
    t2 = _turn("assistant", [{"type": "tool_use", "id": "a", "name": "diagnose", "input": {"question": "?"}}])
    t3 = _turn("user", [{"type": "tool_result", "tool_use_id": "a", "content": "idk"}])
    history = rebuild_history([t1, t2, t3])
    assert history == [
        {"role": "user", "content": [{"type": "text", "text": "hi"}]},
        {"role": "assistant", "content": [{"type": "tool_use", "id": "a", "name": "diagnose", "input": {"question": "?"}}]},
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "a", "content": "idk"}]},
    ]