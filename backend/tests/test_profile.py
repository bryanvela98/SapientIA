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


def test_plain_language_fills_four_fragments():
    """cognitive=plain-language alone contributes register, vocabulary,
    chunking, and interaction_style. Pacing stays empty."""
    p = AccessibilityProfile(cognitive="plain-language")
    frags = p.to_fragments()
    assert frags.register is not None
    assert frags.vocabulary is not None
    assert frags.chunking is not None
    assert frags.interaction_style is not None
    assert frags.pacing is None
    assert "grade-5" in frags.register
    assert "first" in frags.vocabulary.lower()
    assert "3 short sentences" in frags.chunking


def test_plain_language_plus_adhd_focus_merges_chunking():
    """Composition rule: when both axes fire, the chunking slot holds ONE
    merged fragment with both constraints, not two contradictory lines."""
    p = AccessibilityProfile(cognitive="plain-language", learning="adhd-focus")
    frags = p.to_fragments()

    assert frags.chunking is not None
    # Merged form must express both constraints in a single fragment.
    assert "3 short sentences" in frags.chunking
    assert "one question" in frags.chunking.lower()

    # Rendered guidance must NOT emit two separate chunking bullets.
    rendered = p.to_prompt_guidance()
    chunking_bullets = [line for line in rendered.splitlines() if line.startswith("- **Chunking")]
    assert len(chunking_bullets) == 1, rendered


def test_adhd_focus_alone_uses_single_question_fragment():
    p = AccessibilityProfile(learning="adhd-focus")
    frags = p.to_fragments()
    assert frags.chunking is not None
    assert "one question per turn" in frags.chunking.lower()
    # Without plain-language, no register / vocabulary contributions.
    assert frags.register is None
    assert frags.vocabulary is None


def test_slow_pacing_plus_plain_language_composes_cleanly():
    """Both register fragment AND pacing fragment should appear when the
    two independent axes are set."""
    p = AccessibilityProfile(cognitive="plain-language", pacing="slow")
    rendered = p.to_prompt_guidance()
    assert "**Register:**" in rendered
    assert "**Pacing:**" in rendered
    assert "smaller steps" in rendered.lower()
    assert "grade-5" in rendered


def test_dyslexia_font_gets_short_sentences_chunking():
    p = AccessibilityProfile(learning="dyslexia-font")
    frags = p.to_fragments()
    assert frags.chunking is not None
    assert "short" in frags.chunking.lower()


def test_screen_reader_contributes_interaction_style():
    p = AccessibilityProfile(visual="screen-reader")
    frags = p.to_fragments()
    assert frags.interaction_style is not None
    assert "verbally" in frags.interaction_style.lower()
    # Alone, it doesn't borrow plain-language fragments.
    assert frags.register is None


def test_canonical_combo_snapshot():
    """Snapshot of a canonical worst-case combo. Edit intentionally; this
    test is a tripwire for unintentional prompt drift."""
    p = AccessibilityProfile(
        visual="screen-reader",
        cognitive="plain-language",
        learning="adhd-focus",
        pacing="slow",
    )
    rendered = p.to_prompt_guidance()
    expected = (
        "- **Register:** Write at a grade-5 reading level. Short sentences, "
        "aim for ≤15 words each. Use everyday words. Prefer Anglo-Saxon "
        "vocabulary over Latinate ('use' not 'utilize', 'help' not 'facilitate').\n"
        "- **Chunking:** Cap each turn at 3 short sentences AND at most one "
        "question. No multi-part questions.\n"
        "- **Vocabulary:** Define any technical term the FIRST time you use it. "
        "Format: 'X (which means …)'. Don't define the same term twice.\n"
        "- **Interaction style:** Learner uses a screen reader. Describe any "
        "visual content verbally. No ASCII diagrams. Linear prose only. "
        "Open-ended Socratic questions are still allowed but use simple "
        "wording — 'What do you think happens if…' is fine; avoid "
        "'Consider the implications of…'.\n"
        "- **Pacing:** Take smaller steps. Check in more often."
    )
    assert rendered == expected