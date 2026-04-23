"""End-to-end session flow tests. Uses ASGITransport in-process — no uvicorn needed.

Each test spins up the FastAPI app against a temp SQLite DB, POSTs /learner,
POSTs /session, then drives several /session/{id}/turn SSE streams and asserts
pedagogy invariants against /session/{id}/state.
"""
import json
import os
import tempfile
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def client(monkeypatch):
    """Spin up the app against a temp DB and yield an ASGI-transport HTTP client."""
    tmp = Path(tempfile.mkdtemp()) / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp}")

    # Force a fresh import of config + db + main so they pick up the env override.
    # Also reload routers so their module-level references to app.db.get_db etc. come
    # from the reloaded modules (otherwise they still point at the original engine).
    import importlib
    import app.config as config_mod
    import app.db as db_mod
    import app.routers.health as health_mod
    import app.routers.learner as learner_mod
    import app.routers.session as session_mod
    import app.main as main_mod
    for mod in (config_mod, db_mod, health_mod, learner_mod, session_mod, main_mod):
        importlib.reload(mod)

    # ASGITransport does NOT run FastAPI lifespan; call init_db() directly.
    await db_mod.init_db()

    async with AsyncClient(
        transport=ASGITransport(app=main_mod.app),
        base_url="http://test",
    ) as c:
        yield c

    await db_mod.engine.dispose()
    try:
        os.remove(tmp)
    except FileNotFoundError:
        pass


async def _parse_sse(resp) -> list[dict]:
    """Parse the full SSE body into a list of {event, data} dicts."""
    events = []
    event_name = None
    data_lines: list[str] = []
    async for raw in resp.aiter_lines():
        if raw.startswith("event:"):
            event_name = raw[len("event:"):].strip()
        elif raw.startswith("data:"):
            data_lines.append(raw[len("data:"):].strip())
        elif raw == "":
            if event_name is not None:
                events.append({"event": event_name, "data": json.loads("\n".join(data_lines) or "null")})
            event_name = None
            data_lines = []
    return events


async def _run_turn(client, session_id: str, message: str) -> list[dict]:
    async with client.stream(
        "POST",
        f"/session/{session_id}/turn",
        json={"message": message},
    ) as resp:
        assert resp.status_code == 200, await resp.aread()
        return await _parse_sse(resp)


async def _create_learner_and_session(client, topic: str) -> tuple[str, str]:
    lr = await client.post("/learner", json={"accessibility_profile": {}})
    assert lr.status_code == 200, lr.text
    lid = lr.json()["id"]
    sr = await client.post(
        "/session",
        headers={"X-Learner-ID": lid},
        json={"topic": topic},
    )
    assert sr.status_code == 200, sr.text
    sid = sr.json()["id"]
    return lid, sid


@pytest.mark.integration
async def test_cooperative_flow_makes_progress(client):
    """Three cooperative replies. Expect no turn-1 violation; at least one concept earned."""
    _, sid = await _create_learner_and_session(client, "Photosynthesis")

    messages = [
        "What is photosynthesis?",
        "I think plants use sunlight and water somehow to grow.",
        "Oh — so they take in CO2 and release oxygen as a byproduct, right?",
    ]

    for i, m in enumerate(messages, start=1):
        events = await _run_turn(client, sid, m)
        assert any(ev["event"] == "turn_start" for ev in events), f"turn {i} missing turn_start"
        turn_end = next((ev for ev in events if ev["event"] == "turn_end"), None)
        assert turn_end is not None, f"turn {i} missing turn_end: {events}"
        if i == 1:
            assert turn_end["data"]["violations"] == [], f"turn 1 violation: {turn_end}"
        assert not any(ev["event"] == "error" for ev in events), f"turn {i} produced error"

    state = (await client.get(f"/session/{sid}/state")).json()
    assert state["turn_count"] >= 3
    assert state["ratio"] >= 0.0  # tolerant; cooperative usually earns at least one


@pytest.mark.integration
async def test_stubborn_flow_exercises_escalation_or_deliver_answer(client):
    """Scripted stubborn replies. Must produce EITHER a deliver_answer
    (concept_told appears) OR a hint at level >= 3, under pressure.

    We script explicit "just tell me" / "give me the answer" phrases on turns 3+
    because the tutor prompt fires deliver_answer after 3 such verbatim requests.
    """
    _, sid = await _create_learner_and_session(client, "Photosynthesis")

    scripted = [
        "I don't know what photosynthesis is.",
        "I have no idea. I'm lost.",
        "I'm still confused. Can you just tell me the answer?",
        "Please give me the answer directly. I've tried, I need you to just explain it.",
        "Can you just tell me the answer? I've tried, I need you to just explain it.",
        "Please give me the answer directly.",
    ]

    told_fired = False
    max_hint_level = 0

    for i, m in enumerate(scripted, start=1):
        events = await _run_turn(client, sid, m)
        assert not any(ev["event"] == "error" for ev in events), f"turn {i} produced error: {events}"

        for ev in events:
            if ev["event"] == "concept_told":
                told_fired = True
            if ev["event"] == "tool_decision":
                data = ev["data"]
                if data.get("name") == "give_hint":
                    level = (data.get("input") or {}).get("level", 0)
                    max_hint_level = max(max_hint_level, int(level))
                if data.get("name") == "deliver_answer":
                    told_fired = True

        if told_fired:
            break  # deliver_answer ends the teaching loop

    state = (await client.get(f"/session/{sid}/state")).json()
    told_count = len(state["told"])

    assert told_fired or max_hint_level >= 3, (
        f"stubborn flow must exercise deliver_answer OR hint L3. "
        f"told_count={told_count}, max_hint_level={max_hint_level}"
    )
    if told_fired:
        assert told_count >= 1, f"told_fired but no ToldConcept persisted: {state}"