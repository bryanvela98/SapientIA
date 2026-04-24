from dataclasses import dataclass
from pydantic import BaseModel, ConfigDict
from typing import Literal


@dataclass
class PromptFragments:
    """Structured a11y guidance broken into named slots.

    Each profile axis contributes to one or more slots; when multiple axes
    would fill the same slot with potentially conflicting text (e.g.,
    `cognitive=plain-language` + `learning=adhd-focus` both targeting
    `chunking`), `AccessibilityProfile.to_fragments` composes a merged
    fragment instead of emitting two contradictory bullets.

    `to_prompt_guidance` renders the filled slots as a bulleted list for
    the system prompt's '## Accessibility profile' section. Order is fixed
    (see `_SLOT_ORDER`) so snapshots are stable across profile permutations.
    """

    register: str | None = None
    chunking: str | None = None
    vocabulary: str | None = None
    interaction_style: str | None = None
    pacing: str | None = None


_SLOT_LABELS = {
    "register": "Register",
    "chunking": "Chunking",
    "vocabulary": "Vocabulary",
    "interaction_style": "Interaction style",
    "pacing": "Pacing",
}

_SLOT_ORDER: tuple[str, ...] = (
    "register",
    "chunking",
    "vocabulary",
    "interaction_style",
    "pacing",
)


class AccessibilityProfile(BaseModel):
    # `extra="ignore"` keeps forward-compat: old learner rows in dev DBs may
    # still carry a `hearing` field from before ADR-021. Pydantic should drop
    # it silently rather than raising `extra_forbidden`.
    model_config = ConfigDict(extra="ignore")

    visual: Literal["screen-reader", "low-vision", "none"] = "none"
    cognitive: Literal["plain-language", "none"] = "none"
    learning: Literal["dyslexia-font", "adhd-focus", "none"] = "none"
    pacing: Literal["slow", "normal"] = "normal"

    def to_fragments(self) -> PromptFragments:
        frags = PromptFragments()

        if self.cognitive == "plain-language":
            frags.register = (
                "Write at a grade-5 reading level. Short sentences, aim for "
                "≤15 words each. Use everyday words. Prefer Anglo-Saxon "
                "vocabulary over Latinate ('use' not 'utilize', 'help' not "
                "'facilitate')."
            )
            frags.vocabulary = (
                "Define any technical term the FIRST time you use it. Format: "
                "'X (which means …)'. Don't define the same term twice."
            )

        interaction_bits: list[str] = []
        if self.visual == "screen-reader":
            interaction_bits.append(
                "Learner uses a screen reader. Describe any visual content "
                "verbally. No ASCII diagrams. Linear prose only."
            )
        if self.cognitive == "plain-language":
            interaction_bits.append(
                "Open-ended Socratic questions are still allowed but use "
                "simple wording — 'What do you think happens if…' is fine; "
                "avoid 'Consider the implications of…'."
            )
        if interaction_bits:
            frags.interaction_style = " ".join(interaction_bits)

        # chunking — composition rule: when cognitive=plain-language AND
        # learning=adhd-focus both fire, emit one merged fragment instead of
        # two bullets that would tell the model "3 short sentences" on one
        # line and "one question per turn" on another.
        if self.cognitive == "plain-language" and self.learning == "adhd-focus":
            frags.chunking = (
                "Cap each turn at 3 short sentences AND at most one question. "
                "No multi-part questions."
            )
        elif self.cognitive == "plain-language":
            frags.chunking = (
                "Cap each turn at 3 short sentences. If you need more, break "
                "it into a follow-up by asking a question first."
            )
        elif self.learning == "adhd-focus":
            frags.chunking = (
                "Ask exactly one question per turn. No multi-part questions."
            )
        elif self.learning == "dyslexia-font":
            frags.chunking = "Keep sentences short. Avoid dense paragraphs."

        if self.pacing == "slow":
            frags.pacing = "Take smaller steps. Check in more often."

        return frags

    def to_prompt_guidance(self) -> str:
        frags = self.to_fragments()
        lines: list[str] = []
        for slot in _SLOT_ORDER:
            value = getattr(frags, slot)
            if value:
                lines.append(f"- **{_SLOT_LABELS[slot]}:** {value}")
        if not lines:
            return "- No specific accessibility accommodations."
        return "\n".join(lines)