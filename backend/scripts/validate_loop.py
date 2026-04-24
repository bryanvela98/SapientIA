"""Validation: run the Socratic loop against 3 topics with a simulated learner.

The simulated learner is another Claude (Haiku) call. We support multiple personas
so we can stress-test the hint escalation ladder and the deliver_answer branch,
not just the happy path.
"""
import sys
import argparse
import json
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from anthropic import Anthropic
from app.tutor.loop import TutorState, run_turn
from app.schemas.profile import AccessibilityProfile

client = Anthropic()

# Keep the map narrow on purpose — profiles are combinatorial and adding
# every combo as a CLI string is busywork. Extend as Day 5+ commits need.
PROFILE_PRESETS: dict[str, AccessibilityProfile] = {
    "none": AccessibilityProfile(),
    "cognitive-plain-language": AccessibilityProfile(cognitive="plain-language"),
}


_SENTENCE_SPLIT = re.compile(r"[.!?]+\s+|[.!?]+$|\n+")


def _sentence_lengths(text: str) -> list[int]:
    parts = [s.strip() for s in _SENTENCE_SPLIT.split(text) if s and s.strip()]
    return [len(s.split()) for s in parts]

PERSONAS = {
    "cooperative": """You are a curious, cooperative student. Reason through hints. Get things right when you can. Admit confusion honestly. Keep replies under 3 sentences.""",
    "stubborn": """You are a deeply stuck student. You are burned out, have near-zero prior knowledge on this topic, and cannot reason your way through hints. Your goal is to GET THE ANSWER GIVEN TO YOU, not to reason it out.

HARD RULES — follow every single one strictly:

1. NEVER produce the correct answer or a correct synthesis. Not even partially. Not even "oh is it X?". Do not name the concept. Do not piece together hints into an insight. If you feel yourself about to connect the dots, stop and say you're lost instead.

2. Do NOT rephrase the tutor's hint back in a way that shows understanding. The most you can do is say "I don't get what you mean by that" or "that hint didn't help me, I'm still lost."

3. Do NOT summarize, synthesize, or "put it in your own words." If asked to, refuse: "I can't — I still don't understand it."

4. EVERY reply of yours must contain at least one of these phrases verbatim: "I don't know", "I have no idea", "I'm completely lost", "I'm still confused", "that didn't help".

5. Starting with your THIRD reply (turn 3) and every reply after that, you MUST include one of these exact phrases: "can you just tell me the answer?", "please give me the answer directly", "I've tried, I need you to just explain it". Use them verbatim. Do not paraphrase. The tutor needs this phrasing to recognize your request.

6. Even after the tutor directly delivers the answer, do NOT synthesize it cleanly. Just say "okay, I think I sort of get it now, but I'd need to see it again."

7. Under 2 sentences per reply. Be terse and tired, not elaborate.

You are NOT trying to impress the tutor. You are a burned-out student trying to get this class over with. The tutor's job is to eventually recognize you need the answer delivered. Help them by asking explicitly.""",
    "misconceived": """You are a student with a specific wrong mental model about the topic.

Rules you must follow:
- On your very first reply, commit to ONE plausible misconception about the topic and state it confidently.
- For the next 2-3 turns, defend that misconception even when the tutor challenges it. Twist their questions to fit your wrong model.
- Only revise your view when the tutor presents a concrete counterexample or fact that your model clearly cannot explain.
- When you revise, acknowledge the mismatch, but do not leap to the full correct answer — take it a step at a time.
- Keep replies under 3 sentences.""",
}


def simulate_learner_reply(topic: str, persona: str, tutor_message: str, history: list[dict]) -> str:
    msgs = history + [{"role": "user", "content": tutor_message}]
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=f"{PERSONAS[persona]}\n\nTopic you're learning: {topic}",
        messages=msgs,
    )
    return response.content[0].text


def run_topic(
    topic: str,
    opening_learner_msg: str,
    persona: str,
    max_turns: int = 10,
    profile: AccessibilityProfile | None = None,
) -> dict:
    profile = profile or AccessibilityProfile()
    print(f"\n{'='*60}\nTOPIC: {topic}   (persona: {persona})\n{'='*60}")
    state = TutorState(topic=topic, profile=profile)
    learner_history: list[dict] = []
    tool_decisions: list[dict] = []
    sentence_lengths_per_turn: list[list[int]] = []

    learner_msg = opening_learner_msg
    print(f"\n[Learner T0]: {learner_msg}")

    for i in range(max_turns):
        result = run_turn(state, learner_msg)
        tutor_text = result["input"].get("question") or result["input"].get("hint") or result["input"].get("answer", "")
        level = result["input"].get("level")
        tag = f"{result['tool']}" + (f" L{level}" if level else "")
        print(f"\n[Tutor T{i+1} -> {tag}]: {tutor_text}")
        if len(result["all_tools"]) > 1:
            print(f"    (also: {result['all_tools']})")
        lens = _sentence_lengths(tutor_text)
        sentence_lengths_per_turn.append(lens)
        if lens:
            avg = sum(lens) / len(lens)
            over = [n for n in lens if n > 20]
            flag = f"  (avg {avg:.1f} w/sent across {len(lens)} sent"
            if over:
                flag += f"; {len(over)} over 20 — soft violation"
            flag += ")"
            print(flag)
        tool_decisions.append({
            "turn": i + 1,
            "tool": result["tool"],
            "level": level,
            "all_tools": result["all_tools"],
            "sentence_lengths": lens,
        })

        if result["tool"] == "deliver_answer":
            print("  -> Tutor delivered answer. Ending.")
            break

        learner_history.append({"role": "assistant", "content": tutor_text})
        learner_msg = simulate_learner_reply(topic, persona, tutor_text, learner_history)
        learner_history.append({"role": "user", "content": learner_msg})
        print(f"\n[Learner T{i+1}]: {learner_msg}")

    snap = state.snapshot()
    snap["persona"] = persona
    snap["tool_decisions"] = tool_decisions
    snap["delivered_answer"] = any(d["tool"] == "deliver_answer" for d in tool_decisions)
    hint_levels = [d["level"] for d in tool_decisions if d["tool"] == "give_hint" and d["level"] is not None]
    snap["max_hint_level"] = max(hint_levels) if hint_levels else 0
    snap["hint_levels_seen"] = hint_levels
    all_lens = [n for turn_lens in sentence_lengths_per_turn for n in turn_lens]
    snap["avg_words_per_sentence"] = (
        round(sum(all_lens) / len(all_lens), 2) if all_lens else 0.0
    )
    snap["sentences_over_20_words"] = sum(1 for n in all_lens if n > 20)
    print(f"\n--- Summary for {topic} ({persona}) ---")
    print(json.dumps({k: v for k, v in snap.items() if k != "tool_decisions"}, indent=2))
    return snap


def print_matrix(results_by_persona: dict[str, list[dict]]) -> None:
    print("\n\n=== PERSONA × TOPIC MATRIX ===")
    personas = list(results_by_persona.keys())
    topics = [r["topic"] for r in results_by_persona[personas[0]]]
    header = f"{'Topic':<56} | " + " | ".join(f"{p:>14}" for p in personas)
    print(header)
    print("-" * len(header))
    for i, topic in enumerate(topics):
        short = topic if len(topic) <= 54 else topic[:53] + "…"
        cells = []
        for p in personas:
            r = results_by_persona[p][i]
            e = len(r["earned"])
            t = len(r["told"])
            hint_tag = f" h{r['max_hint_level']}" if r["max_hint_level"] else ""
            ans_tag = " A" if r["delivered_answer"] else ""
            cells.append(f"{e}e/{t}t/{r['ratio']:.2f}{hint_tag}{ans_tag}")
        print(f"{short:<56} | " + " | ".join(f"{c:>14}" for c in cells))
    print("\nLegend: Ne/Nt/ratio  hN=max hint level seen  A=deliver_answer fired")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", type=str, default=None)
    parser.add_argument("--persona", choices=list(PERSONAS.keys()) + ["all"], default="cooperative")
    parser.add_argument("--max-turns", type=int, default=10)
    parser.add_argument(
        "--profile",
        choices=list(PROFILE_PRESETS.keys()),
        default="none",
        help="AccessibilityProfile preset to run the tutor under.",
    )
    args = parser.parse_args()

    topics = [
        ("Photosynthesis", "Hi, can you tell me what photosynthesis is?"),
        ("Recursion in programming", "I keep hearing about recursion but I don't get it."),
        ("The meaning of the poem 'Stopping by Woods on a Snowy Evening'", "I read this poem and I think it's just about a guy in the snow?"),
    ]
    if args.topic:
        topics = [(args.topic, f"Can you teach me about {args.topic}?")]

    personas_to_run = list(PERSONAS.keys()) if args.persona == "all" else [args.persona]
    profile = PROFILE_PRESETS[args.profile]
    print(f"\nPROFILE: {args.profile} -> {profile.model_dump()}")

    results_by_persona: dict[str, list[dict]] = {}
    for persona in personas_to_run:
        print(f"\n\n##### PERSONA: {persona} #####")
        results_by_persona[persona] = [
            run_topic(topic, opener, persona, max_turns=args.max_turns, profile=profile)
            for topic, opener in topics
        ]

    print("\n\n=== FINAL REPORT ===")
    for persona, results in results_by_persona.items():
        print(f"\n[{persona}]")
        for r in results:
            tag = f"{len(r['earned'])}e/{len(r['told'])}t ratio {r['ratio']:.2f}"
            extras = []
            if r["max_hint_level"]:
                extras.append(f"max hint L{r['max_hint_level']}")
            if r["delivered_answer"]:
                extras.append("deliver_answer fired")
            extra_str = f"  [{', '.join(extras)}]" if extras else ""
            print(f"  {r['topic']}: {tag}{extra_str}")

    if len(personas_to_run) > 1:
        print_matrix(results_by_persona)


if __name__ == "__main__":
    main()