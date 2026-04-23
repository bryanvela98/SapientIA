"""Pure-function tests for AccessibilityProfile. No API required."""
from app.schemas.profile import AccessibilityProfile


def test_defaults_populate_when_empty():
    p = AccessibilityProfile.model_validate({})
    assert p.visual == "none"
    assert p.cognitive == "none"
    assert p.learning == "none"
    assert p.pacing == "normal"


def test_forward_compat_ignores_dropped_hearing_field():
    """ADR-021 removed `hearing`. Existing learner rows in dev DBs may still
    carry `{"hearing": "deaf"}` in their JSON profile. Validation must NOT
    raise — extra fields are silently dropped."""
    p = AccessibilityProfile.model_validate({"hearing": "deaf"})
    assert not hasattr(p, "hearing")
    assert p.visual == "none"


def test_round_trip_all_four_dimensions():
    payload = {
        "visual": "screen-reader",
        "cognitive": "plain-language",
        "learning": "adhd-focus",
        "pacing": "slow",
    }
    p = AccessibilityProfile.model_validate(payload)
    assert p.model_dump() == payload


def test_to_prompt_guidance_picks_up_each_flag():
    p = AccessibilityProfile(visual="screen-reader", cognitive="plain-language")
    g = p.to_prompt_guidance()
    assert "screen reader" in g.lower()
    assert "grade-5" in g

    # No flags set -> falls back to the default single-line message.
    default = AccessibilityProfile().to_prompt_guidance()
    assert "no specific" in default.lower()