"""Day 1 validation: run the Socratic loop against 3 topics with a simulated learner.

The simulated learner is another Claude call playing a curious but confused student.
This lets us run the pedagogy end-to-end without a human in the loop.
"""
import sys
import argparse
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from anthropic import Anthropic
from app.tutor.loop import TutorState, run_turn
from app.schemas.profile import AccessibilityProfile

client = Anthropic()

LEARNER_SYSTEM = """You are simulating a curious but confused student learning a new topic. You are NOT a tutor. Your job is to:
- Ask beginner questions
- Respond honestly to the tutor's Socratic prompts
- Sometimes get the right idea (if you reason through a hint)
- Sometimes stay stuck (if the hint is too subtle)
- Never pretend to know more than you do

Topic you're learning: {topic}

Keep responses under 3 sentences. Act like a real learner."""


def simulate_learner_reply(topic: str, tutor_message: str, history: list[dict]) -> str:
    msgs = history + [{"role": "user", "content": tutor_message}]
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=LEARNER_SYSTEM.format(topic=topic),
        messages=msgs,
    )
    return response.content[0].text


def run_topic(topic: str, opening_learner_msg: str, max_turns: int = 10) -> dict:
    print(f"\n{'='*60}\nTOPIC: {topic}\n{'='*60}")
    state = TutorState(topic=topic, profile=AccessibilityProfile())
    learner_history: list[dict] = []

    learner_msg = opening_learner_msg
    print(f"\n[Learner T0]: {learner_msg}")

    for i in range(max_turns):
        result = run_turn(state, learner_msg)
        tutor_text = result["input"].get("question") or result["input"].get("hint") or result["input"].get("answer", "")
        print(f"\n[Tutor T{i+1} -> {result['tool']}]: {tutor_text}")
        if len(result["all_tools"]) > 1:
            print(f"    (also: {result['all_tools']})")

        if result["tool"] == "deliver_answer":
            print("  -> Tutor delivered answer. Ending.")
            break

        learner_history.append({"role": "assistant", "content": tutor_text})
        learner_msg = simulate_learner_reply(topic, tutor_text, learner_history)
        learner_history.append({"role": "user", "content": learner_msg})
        print(f"\n[Learner T{i+1}]: {learner_msg}")

    snap = state.snapshot()
    print(f"\n--- Summary for {topic} ---")
    print(json.dumps(snap, indent=2))
    return snap


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", type=str, default=None)
    args = parser.parse_args()

    topics = [
        ("Photosynthesis", "Hi, can you tell me what photosynthesis is?"),
        ("Recursion in programming", "I keep hearing about recursion but I don't get it."),
        ("The meaning of the poem 'Stopping by Woods on a Snowy Evening'", "I read this poem and I think it's just about a guy in the snow?"),
    ]
    if args.topic:
        topics = [(args.topic, f"Can you teach me about {args.topic}?")]

    results = []
    for topic, opener in topics:
        results.append(run_topic(topic, opener))

    print("\n\n=== FINAL REPORT ===")
    for r in results:
        print(f"  {r['topic']}: earned {len(r['earned'])}, told {len(r['told'])}, ratio {r['ratio']:.2f}")


if __name__ == "__main__":
    main()
