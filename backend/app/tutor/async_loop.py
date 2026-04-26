"""Async tutor loop — yields SSE-ready events per turn.

Design: uses `messages.stream` under the hood for token-level deltas, then
synthesizes `text_delta` events from `input_json_delta` chunks. Our tutor never
emits plain text blocks — tool_choice={"type":"any"} forces every message into
a tool_use — so the primary teaching prose lives inside
`tool_use.input.question | .hint | .answer`. We track those three fields as
the partial JSON grows and emit incremental characters.

Invariants:
- On a bookkeeping-only response, chain through up to 2x (ADR-013).
- Event order (happy path):
    turn_start → (text_delta)* → tool_decision → (concept_earned|concept_told)? → turn_end
  `tool_decision` fires at content_block_stop with the complete input, so the
  Day 3 Chat UI keeps working without change while Commit 3 switches to
  progressive text_delta consumption.
- `turn_end.assistant_content` carries the API-shaped content blocks so the
  Turn row is persisted in the shape the next turn's history replay expects
  (ADR-012).
- `deliver_answer` on turn 1 surfaces as a violation, not a crash.
"""
import json
import re
from typing import AsyncIterator

from anthropic import AsyncAnthropic

from app.config import settings
from app.schemas.profile import AccessibilityProfile
from app.tutor.prompts import build_system_prompt
from app.tutor.tools import TOOLS

_async_client: AsyncAnthropic | None = None


def _client() -> AsyncAnthropic:
    global _async_client
    if _async_client is None:
        _async_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _async_client


BOOKKEEPING = {"mark_concept_earned"}
TEACHING_TOOLS = {
    "diagnose",
    "ask_socratic_question",
    "give_hint",
    "check_understanding",
    "deliver_answer",
    # Recap is a valid terminal teaching move on its own — it consolidates
    # earned concepts and points at what's next (see tools.py). Including it
    # in TEACHING_TOOLS suppresses chain-through (ADR-013) so a recap-only
    # turn doesn't trigger a second model call.
    "progress_summary",
}
PRIMARY_TEXT_FIELDS = ("question", "hint", "answer", "summary")

# Sentence terminators followed by whitespace or end-of-text. Mirrors the
# heuristic in scripts/validate_loop.py and frontend/src/lib/sentence.ts.
_SENTENCE_SPLIT_RE = re.compile(r"[.!?]+\s+|[.!?]+$|\n+")


def _count_sentences(text: str) -> int:
    return sum(1 for s in _SENTENCE_SPLIT_RE.split(text) if s and s.strip())


# Tools whose primary text is "the question(s) the model is asking". Excludes
# `progress_summary` (recap prose may contain rhetorical/quoted '?') and
# `deliver_answer` (final-answer prose may quote questions inside it). Mirror
# of the cognitive sentence check, narrower scope: only flag drift on tools
# whose contract is "ask a question", because that's where adhd-focus's
# "one question per turn" rule actually applies.
_QUESTIONING_TOOLS = frozenset(
    {"diagnose", "ask_socratic_question", "give_hint", "check_understanding"}
)


def _count_questions_in_primary(input_obj: dict) -> int:
    """Counts literal '?' in the primary teaching text. Heuristic: a multi-
    question turn almost always has multiple '?'. False positives from quoted
    or rhetorical question marks are rare in tutor output and the metric is
    soft (logged not blocking), so we accept them rather than tokenize prose.
    """
    prose = next(
        (input_obj.get(k) for k in PRIMARY_TEXT_FIELDS if input_obj.get(k)),
        "",
    )
    return prose.count("?")


def _extract_primary_text(partial_json: str) -> str:
    """Best-effort extraction of the current value of question/hint/answer
    from a possibly-unterminated JSON string. Returns '' if no matching
    field has appeared yet. Mid-escape chunks fall back to the raw captured
    substring, which is corrected on the next delta.
    """
    for key in PRIMARY_TEXT_FIELDS:
        m = re.search(f'"{re.escape(key)}"\\s*:\\s*"', partial_json)
        if not m:
            continue
        start = m.end()
        i = start
        while i < len(partial_json):
            ch = partial_json[i]
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                break
            i += 1
        raw = partial_json[start:i]
        try:
            return json.loads('"' + raw + '"')
        except json.JSONDecodeError:
            return raw
    return ""


async def _stream_one_attempt(
    history: list[dict],
    system: str,
    turn_number: int,
    violations: list[str],
    state: dict,
    profile: AccessibilityProfile,
) -> AsyncIterator[dict]:
    """Stream one messages.stream call. Yields SSE-ready events as they arrive.
    Populates `state["blocks"]` (list of API-shaped tool_use dicts) and
    `state["teaching"]` (bool) on completion."""
    per_block: dict[int, dict] = {}
    final_blocks: list[dict] = []

    async with _client().messages.stream(
        model=settings.tutor_model,
        max_tokens=1024,
        system=system,
        tools=TOOLS,
        tool_choice={"type": "any"},
        messages=history,
    ) as stream:
        async for event in stream:
            etype = getattr(event, "type", None)

            if etype == "content_block_start":
                block = event.content_block
                if getattr(block, "type", None) == "tool_use":
                    per_block[event.index] = {
                        "name": block.name,
                        "id": block.id,
                        "partial_json": "",
                        "last_text_len": 0,
                    }

            elif etype == "content_block_delta":
                delta = event.delta
                if getattr(delta, "type", None) != "input_json_delta":
                    continue
                acc = per_block.get(event.index)
                if acc is None:
                    continue
                acc["partial_json"] += delta.partial_json
                current = _extract_primary_text(acc["partial_json"])
                if len(current) > acc["last_text_len"]:
                    new_chars = current[acc["last_text_len"]:]
                    acc["last_text_len"] = len(current)
                    yield {
                        "type": "text_delta",
                        "text": new_chars,
                        "block_index": event.index,
                    }

            elif etype == "content_block_stop":
                acc = per_block.get(event.index)
                if acc is None:
                    continue
                try:
                    input_obj = (
                        json.loads(acc["partial_json"]) if acc["partial_json"] else {}
                    )
                except json.JSONDecodeError:
                    input_obj = {}

                final_blocks.append(
                    {
                        "type": "tool_use",
                        "id": acc["id"],
                        "name": acc["name"],
                        "input": input_obj,
                    }
                )

                # Emit tool_decision with the fully-known input. Day 3 frontend
                # depends on this for live.text; Commit 3 will also consume
                # text_delta events for progressive reveal.
                yield {
                    "type": "tool_decision",
                    "name": acc["name"],
                    "id": acc["id"],
                    "input": input_obj,
                    "block_index": event.index,
                }

                if acc["name"] == "mark_concept_earned":
                    yield {
                        "type": "concept_earned",
                        "concept": input_obj.get("concept", ""),
                        "evidence": input_obj.get("evidence", ""),
                    }
                elif acc["name"] == "deliver_answer":
                    yield {
                        "type": "concept_told",
                        "concept": input_obj.get("concept", ""),
                        "justification": input_obj.get("justification", ""),
                        "answer": input_obj.get("answer", ""),
                    }
                    if turn_number == 1:
                        violations.append("deliver_answer on turn 1")
                elif acc["name"] == "progress_summary":
                    yield {
                        "type": "progress_summary",
                        "summary": input_obj.get("summary", ""),
                        "concepts_recapped": input_obj.get("concepts_recapped", []),
                        "next_focus": input_obj.get("next_focus", ""),
                    }

                # Soft chunking check: when plain-language is set, the prompt
                # caps teaching turns at ~3 short sentences. Flag over-emits
                # as a violation without blocking — the prompt fragment does
                # the real enforcement; this surfaces drift in telemetry.
                if profile.cognitive == "plain-language" and acc["name"] in TEACHING_TOOLS:
                    prose = next(
                        (input_obj.get(k) for k in PRIMARY_TEXT_FIELDS if input_obj.get(k)),
                        "",
                    )
                    if _count_sentences(prose) > 3:
                        violations.append("max-sentences-exceeded")

                # Soft single-question check: when adhd-focus is set, the
                # prompt's chunking fragment caps teaching turns at one
                # question. Mirrors the sentence-cap pattern (logged not
                # blocking). Excludes progress_summary + deliver_answer
                # because their prose can legitimately quote '?' marks.
                if (
                    profile.learning == "adhd-focus"
                    and acc["name"] in _QUESTIONING_TOOLS
                    and _count_questions_in_primary(input_obj) > 1
                ):
                    violations.append("max-questions-exceeded")

    state["blocks"] = final_blocks
    state["teaching"] = any(
        b["name"] in TEACHING_TOOLS for b in final_blocks if b["type"] == "tool_use"
    )


async def stream_turn(
    topic: str,
    profile: AccessibilityProfile,
    history: list[dict],
    turn_number: int,
    unrecapped: int = 0,
    force_recap: bool = False,
) -> AsyncIterator[dict]:
    """Yield SSE-ready event dicts for one tutor turn.

    `history` must already include the latest user turn (with any needed
    tool_result pairing — call `build_user_message` first and append).

    `unrecapped` is the count of earned concepts accumulated since the last
    `progress_summary` in this session. The server-side router tracks this
    (Turn.tool_used='progress_summary' as a watermark) and hands it in; the
    prompt builder appends a soft pacing nudge when it crosses the threshold.

    `force_recap` promotes the nudge to a strong directive when the learner
    hit the in-chat "Recap so far" control — the prompt shifts from
    'consider firing progress_summary' to 'the learner asked, do it now'.
    """
    yield {"type": "turn_start", "turn_number": turn_number}
    system = build_system_prompt(
        topic, profile, unrecapped=unrecapped, force_recap=force_recap
    )
    violations: list[str] = []
    current_history = history
    final_content: list[dict] | None = None

    for _ in range(2):  # at most one chain-through
        state: dict = {"blocks": None, "teaching": False}
        async for ev in _stream_one_attempt(
            current_history, system, turn_number, violations, state, profile
        ):
            yield ev

        if not state["blocks"]:
            continue
        if state["teaching"]:
            final_content = state["blocks"]
            break

        # Bookkeeping-only — extend history with the assistant turn + a
        # synthesized tool_result user turn, then loop once to force a teaching
        # move. The retry path must also stream (not fall back to non-stream),
        # otherwise the chain-through silently regresses us to a non-streaming
        # turn — see Day 4 plan's carry-forward risks.
        current_history = current_history + [
            {"role": "assistant", "content": state["blocks"]},
            {
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": b["id"], "content": "ok"}
                    for b in state["blocks"]
                    if b["type"] == "tool_use"
                ],
            },
        ]

    if final_content is None:
        yield {
            "type": "error",
            "message": "model produced only bookkeeping after 2 attempts",
        }
        return

    yield {
        "type": "turn_end",
        "violations": violations,
        "assistant_content": final_content,
    }


def extract_primary(
    assistant_content: list[dict],
) -> tuple[str | None, str | None]:
    """Return (tool_name, display_text) for the primary teaching tool call in
    an assistant content array. Bookkeeping-only content returns (None, None).
    `progress_summary` surfaces its `summary` field as the display text.
    """
    for b in assistant_content:
        if b.get("type") != "tool_use" or b.get("name") not in TEACHING_TOOLS:
            continue
        inp = b.get("input", {}) or {}
        text = next((inp.get(k) for k in PRIMARY_TEXT_FIELDS if inp.get(k)), None)
        return b["name"], text
    return None, None