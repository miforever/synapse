from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Exercises the real lifespan, so router wiring and DB startup are covered."""
    settings.db_path = ":memory:"
    with TestClient(app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_mcp_endpoint_is_live(client: TestClient) -> None:
    """Guards the mount path and the session manager's lifespan.

    A 404 means the mount path is wrong; a 500 means the MCP lifespan never
    ran, which would break every agent request at runtime.
    """
    response = client.get("/mcp")
    assert response.status_code not in (404, 500)


def test_graph_websocket_accepts_connections(client: TestClient) -> None:
    with client.websocket_connect("/ws/graph"):
        pass


def test_layout_endpoints_are_wired(client: TestClient) -> None:
    """Covers routing and validation; storage rules are tested at service level.

    Memories are created over MCP rather than REST, so this uses ids that do
    not exist — which also exercises the pruning of positions whose memory is
    gone, leaving an empty arrangement behind.
    """
    assert client.get("/layout/3d").json()["positions"] == {}

    saved = client.put(
        "/layout/3d",
        json={"positions": {"missing": {"x": 1.0, "y": 2.0, "z": 3.0}}},
    )
    assert saved.status_code == 200
    assert saved.json() == {"mode": "3d", "positions": {}}

    assert client.delete("/layout/3d").status_code == 200


def test_layout_rejects_an_unknown_mode(client: TestClient) -> None:
    assert client.get("/layout/holographic").status_code == 422
