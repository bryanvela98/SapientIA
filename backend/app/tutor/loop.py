from anthropic import Anthropic
from app.schemas.profile import AccessibilityProfile
from app.tutor.prompts import build_system_prompt
from app.tutor.tools import TOOLS

client = Anthropic()

MODEL = "claude-opus-4-7"


class TutorState:
    def __init__(self, topic: str, profile: AccessibilityProfile):
        self.topic = topic
        self.profile = profile
        self.messages: list[dict] = []
        self.earned: list[dict] = []
        self.told: list[dict] = []
        self.turn_count = 0

    def snapshot(self) -> dict:
        return {
            "topic": self.topic,
            "turns": self.turn_count,
            "earned": [c["concept"] for c in self.earned],
            "told": [c["concept"] for c in self.told],
            "ratio": len(self.earned) / max(1, len(self.earned) + len(self.told)),
        }


def _build_user_turn(state: TutorState, learner_message: str):
    """Build the next user message. If the prior assistant turn used tools,
    we must return tool_result blocks for each tool_use id. The learner's
    natural-language reply rides on the primary (non-bookkeeping) tool."""
    if not state.messages or state.messages[-1]["role"] != "assistant":
        return learner_message

    prev = state.messages[-1]["content"]
    tool_uses = [b for b in prev if getattr(b, "type", None) == "tool_use"]
    if not tool_uses:
        return learner_message

    primary_id = next(
        (b.id for b in tool_uses if b.name != "mark_concept_earned"),
        tool_uses[0].id,
    )
    return [
        {
            "type": "tool_result",
            "tool_use_id": b.id,
            "content": learner_message if b.id == primary_id else "ok",
        }
        for b in tool_uses
    ]


BOOKKEEPING_TOOLS = {"mark_concept_earned"}


def _call_model(state: TutorState):
    return client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=build_system_prompt(state.topic, state.profile),
        tools=TOOLS,
        tool_choice={"type": "any"},
        messages=state.messages,
    )


def _record_tool_uses(state: TutorState, tool_uses: list) -> list[str]:
    all_names = []
    for tu in tool_uses:
        all_names.append(tu.name)
        if tu.name == "mark_concept_earned":
            state.earned.append(tu.input)
        elif tu.name == "deliver_answer":
            state.told.append({"concept": tu.input["concept"], "answer": tu.input["answer"]})
        if state.turn_count == 1 and tu.name == "deliver_answer":
            print(f"  [VIOLATION] deliver_answer on turn 1 for concept: {tu.input.get('concept')}")
    return all_names


def run_turn(state: TutorState, learner_message: str) -> dict:
    """Run one tutor turn. Returns the primary teaching action chosen by the model.

    If the first model response only contains bookkeeping (e.g. mark_concept_earned
    with no teaching move), we chain an extra call with an auto-generated nudge so
    the turn always produces a user-visible action.
    """
    state.turn_count += 1
    state.messages.append({"role": "user", "content": _build_user_turn(state, learner_message)})

    response = _call_model(state)
    tool_uses = [b for b in response.content if b.type == "tool_use"]
    if not tool_uses:
        raise RuntimeError(f"Model returned no tool use. Content: {response.content}")

    all_names = _record_tool_uses(state, tool_uses)
    state.messages.append({"role": "assistant", "content": response.content})

    teaching = [tu for tu in tool_uses if tu.name not in BOOKKEEPING_TOOLS]
    if not teaching:
        # Only bookkeeping fired — chain a follow-up to get a real teaching move.
        state.messages.append({
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": tu.id, "content": "ok"}
                for tu in tool_uses
            ],
        })
        follow = _call_model(state)
        follow_uses = [b for b in follow.content if b.type == "tool_use"]
        if not follow_uses:
            raise RuntimeError(f"Follow-up returned no tool use. Content: {follow.content}")
        all_names += _record_tool_uses(state, follow_uses)
        state.messages.append({"role": "assistant", "content": follow.content})
        teaching = [tu for tu in follow_uses if tu.name not in BOOKKEEPING_TOOLS]
        tool_uses = follow_uses  # for primary selection below

    primary = teaching[0] if teaching else tool_uses[0]
    return {"tool": primary.name, "input": primary.input, "all_tools": all_names}
