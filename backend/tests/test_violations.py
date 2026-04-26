"""Unit tests for the soft violation checks in async_loop.

Both checks (`max-sentences-exceeded` from Day 5 Commit 3 and
`max-questions-exceeded` from Day 6 Commit 5) are pure-helper-driven —
exercising them against the real Anthropic stream is integration-level
work that lives in test_async_loop.py. These tests target the helpers
and the membership tables directly.
"""
from app.tutor.async_loop import (
    PRIMARY_TEXT_FIELDS,
    TEACHING_TOOLS,
    _QUESTIONING_TOOLS,
    _count_questions_in_primary,
    _count_sentences,
)


# -- _count_questions_in_primary ----------------------------------------------

def test_zero_questions_in_empty_input():
    assert _count_questions_in_primary({}) == 0


def test_zero_questions_in_declarative_prose():
    assert _count_questions_in_primary({"hint": "Recursion has a base case."}) == 0


def test_one_question():
    assert _count_questions_in_primary({"question": "What is the base case?"}) == 1


def test_two_questions_fires():
    inp = {"question": "What is the base case? And what stops the recursion?"}
    assert _count_questions_in_primary(inp) == 2


def test_three_questions_fires():
    inp = {
        "question": "What is X? What is Y? Why do they differ?"
    }
    assert _count_questions_in_primary(inp) == 3


def test_counts_question_in_summary_field_too():
    """progress_summary's primary text is `summary`, not `question`. The
    helper walks PRIMARY_TEXT_FIELDS in order; the fact that the count
    runs across any primary field is intentional — the violation gating
    by tool name (in async_loop) is what excludes summary from the rule."""
    inp = {"summary": "We covered X. Why does it work?"}
    assert _count_questions_in_primary(inp) == 1


def test_picks_first_populated_primary_field():
    """If both `question` and `hint` are present, the helper uses the first
    PRIMARY_TEXT_FIELDS hit. The async_loop never produces this combo (one
    tool emits one field), but the helper is robust to it."""
    # PRIMARY_TEXT_FIELDS = (question, hint, answer, summary)
    inp = {"question": "Q?", "hint": "Two ? marks ?"}
    assert _count_questions_in_primary(inp) == 1


# -- Membership / structure ---------------------------------------------------

def test_questioning_tools_excludes_progress_summary_and_deliver_answer():
    """Recap prose and final-answer prose can legitimately quote '?'.
    The check must not fire on those tools even if their text contains
    multiple question marks."""
    assert "progress_summary" not in _QUESTIONING_TOOLS
    assert "deliver_answer" not in _QUESTIONING_TOOLS


def test_questioning_tools_covers_the_question_emitting_set():
    """Every Socratic-question-style tool should be in the set so the
    adhd-focus rule actually fires for them."""
    assert "diagnose" in _QUESTIONING_TOOLS
    assert "ask_socratic_question" in _QUESTIONING_TOOLS
    assert "give_hint" in _QUESTIONING_TOOLS
    assert "check_understanding" in _QUESTIONING_TOOLS


def test_questioning_tools_is_subset_of_teaching_tools():
    """A questioning tool must also be a teaching tool — otherwise the
    chain-through logic in stream_turn would treat it as bookkeeping."""
    assert _QUESTIONING_TOOLS.issubset(TEACHING_TOOLS)


# -- Cross-helper sanity ------------------------------------------------------

def test_count_sentences_independent_of_question_count():
    """A turn with multiple sentences but one question fires only the
    sentence-cap violation, not the question-count one. Drives home the
    independence of the two checks."""
    text = "First idea. Second idea. Third idea. What do you think happens next?"
    assert _count_sentences(text) == 4
    assert _count_questions_in_primary({"question": text}) == 1