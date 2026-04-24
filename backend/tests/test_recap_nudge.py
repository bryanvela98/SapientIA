"""Unit tests for the progress_summary recap plumbing.

Covers maybe_recap_nudge thresholds + build_system_prompt composition. The
integration path (real Anthropic API → progress_summary SSE) is exercised
manually per the Day 5 plan; keeping these offline keeps CI cheap.
"""
from app.schemas.profile import AccessibilityProfile
from app.tutor.async_loop import (
    PRIMARY_TEXT_FIELDS,
    TEACHING_TOOLS,
    _count_sentences,
    extract_primary,
)
from app.tutor.prompts import build_system_prompt, maybe_recap_nudge


def test_nudge_suppressed_below_threshold():
    assert maybe_recap_nudge(0) is None
    assert maybe_recap_nudge(2) is None


def test_nudge_fires_at_threshold():
    msg = maybe_recap_nudge(3)
    assert msg is not None
    assert "## Pacing nudge" in msg
    assert "3 concepts" in msg
    assert "progress_summary" in msg


def test_nudge_suppressed_past_cap():
    """After threshold + max_over_threshold earnings without a recap, the
    model has plainly ignored the nudge; stop nagging."""
    assert maybe_recap_nudge(3, threshold=3, max_over_threshold=6) is not None
    assert maybe_recap_nudge(9, threshold=3, max_over_threshold=6) is not None
    assert maybe_recap_nudge(10, threshold=3, max_over_threshold=6) is None


def test_build_system_prompt_omits_nudge_by_default():
    sp = build_system_prompt("Recursion", AccessibilityProfile())
    # The tool-7 description mentions the nudge heading in prose, so we can't
    # assert "## Pacing nudge" globally. The injected block is unique —
    # it lives on its own line and names the concept count.
    assert "\n## Pacing nudge\n" not in sp
    assert "concepts since the last recap" not in sp


def test_build_system_prompt_injects_nudge_when_unrecapped_above_threshold():
    sp = build_system_prompt("Recursion", AccessibilityProfile(), unrecapped=3)
    assert "\n## Pacing nudge\n" in sp
    assert "3 concepts since the last recap" in sp
    # Nudge lands between the a11y block and anti-patterns, not after the
    # earning rules (position matters for the model reading top-down).
    nudge_idx = sp.index("\n## Pacing nudge\n")
    anti_idx = sp.index("## Anti-patterns")
    earning_idx = sp.index("## Earning rules")
    assert nudge_idx < anti_idx < earning_idx


def test_progress_summary_is_a_teaching_tool():
    """Membership in TEACHING_TOOLS suppresses chain-through (ADR-013) —
    a recap-only turn is a valid terminal move, not bookkeeping-only."""
    assert "progress_summary" in TEACHING_TOOLS


def test_primary_text_fields_include_summary():
    """Token streaming extracts summary deltas the same way it extracts
    question/hint/answer — otherwise recap turns would not stream."""
    assert "summary" in PRIMARY_TEXT_FIELDS


def test_extract_primary_surfaces_summary_as_display_text():
    """Persisted Turn.display_text for a recap should be the summary prose."""
    assistant_content = [
        {
            "type": "tool_use",
            "id": "toolu_recap1",
            "name": "progress_summary",
            "input": {
                "summary": "You've now connected sunlight, water, and CO2.",
                "concepts_recapped": ["sunlight-as-energy", "CO2-in"],
                "next_focus": "glucose output",
            },
        }
    ]
    name, text = extract_primary(assistant_content)
    assert name == "progress_summary"
    assert text == "You've now connected sunlight, water, and CO2."


def test_count_sentences_matches_frontend_heuristic():
    assert _count_sentences("") == 0
    assert _count_sentences("One sentence.") == 1
    assert _count_sentences("One. Two. Three.") == 3
    # Soft check fires above 3 — the fourth sentence pushes into violation.
    assert _count_sentences("One. Two. Three. Four.") == 4
    # Newlines separate too, so bulleted prose is counted generously.
    assert _count_sentences("A\nB\nC") == 3