from pydantic import BaseModel
from typing import Literal


class AccessibilityProfile(BaseModel):
    visual: Literal["screen-reader", "low-vision", "none"] = "none"
    hearing: Literal["deaf", "hoh", "none"] = "none"
    cognitive: Literal["plain-language", "none"] = "none"
    learning: Literal["dyslexia-font", "adhd-focus", "none"] = "none"
    pacing: Literal["slow", "normal"] = "normal"

    def to_prompt_guidance(self) -> str:
        lines = []
        if self.visual == "screen-reader":
            lines.append("- Learner uses a screen reader. Describe any visual content verbally. No ASCII diagrams. Linear prose only.")
        if self.cognitive == "plain-language":
            lines.append("- Use grade-5 reading level. One idea per sentence. Define jargon on first use.")
        if self.learning == "adhd-focus":
            lines.append("- Ask exactly one question per turn. No multi-part questions.")
        if self.learning == "dyslexia-font":
            lines.append("- Keep sentences short. Avoid dense paragraphs.")
        if self.pacing == "slow":
            lines.append("- Take smaller steps. Check in more often.")
        return "\n".join(lines) if lines else "- No specific accessibility accommodations."
