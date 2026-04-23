"""Integration test for GET /session/{id}/turns — the hydration endpoint the
frontend uses to rebuild transcripts on page refresh.

Reuses the `client` fixture shape from test_session_flow.py (temp DB, in-process
ASGITransport, init_db() called explicitly since ASGITransport doesn't fire the
FastAPI lifespan).
"""
import json
import os
import tempfile
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def client(monkeypatch):
    tmp = Path(tempfile.mkdtemp()) / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp}")
    import importlib
    import app.config as config_mod
    import app.db as db_mod
    import app.routers.health as health_mod
    import app.routers.learner as learner_mod
    import app.routers.session as session_mod
    import app.main as main_mod
    for mod in (config_mod, db_mod, health_mod, learner_mod, session_mod, main_mod):
        importlib.reload(mod)
    await db_mod.init_db()
    async with AsyncClient(transport=ASGITransport(app=main_mod.app), base_url="http://test") as c:
        yield c
    await db_mod.engine.dispose()
    try:
        os.remove(tmp)
    except FileNotFoundError:
        pass


async def _parse_sse(resp) -> list[dict]:
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


@pytest.mark.integration
async def test_get_turns_returns_ordered_replay(client):
    """After running 2 turns, GET /turns returns 4 rows (2 user + 2 assistant),
    ordered by turn_number, with display_text populated and tool_used set on
    assistant rows only."""
    lr = await client.post("/learner", json={"accessibility_profile": {}})
    lid = lr.json()["id"]
    sr = await client.post(
        "/session",
        headers={"X-Learner-ID": lid},
        json={"topic": "Photosynthesis"},
    )
    sid = sr.json()["id"]

    for msg in ("What is photosynthesis?", "I think plants use sunlight somehow."):
        async with client.stream("POST", f"/session/{sid}/turn", json={"message": msg}) as resp:
            assert resp.status_code == 200
            events = await _parse_sse(resp)
            assert any(ev["event"] == "turn_end" for ev in events)

    turns = (await client.get(f"/session/{sid}/turns")).json()

    assert len(turns) == 4, f"expected 4 rows (2 user + 2 assistant), got {len(turns)}"
    assert [t["turn_number"] for t in turns] == [1, 1, 2, 2]
    assert [t["role"] for t in turns] == ["user", "assistant", "user", "assistant"]
    for t in turns:
        assert t["display_text"], f"display_text should be non-empty, got {t}"
    for t in turns:
        if t["role"] == "assistant":
            assert t["tool_used"] is not None, f"assistant turn missing tool_used: {t}"
        else:
            assert t["tool_used"] is None, f"user turn should have no tool_used: {t}"
    for t in turns:
        assert t["created_at"], "created_at should be ISO string"


@pytest.mark.integration
async def test_get_turns_404_for_unknown_session(client):
    resp = await client.get("/session/nonexistent-uuid/turns")
    assert resp.status_code == 404