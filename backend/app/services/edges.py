import uuid
from datetime import UTC, datetime

import aiosqlite

from app.models.schemas import EdgeCreate, EdgeOut


def _row_to_edge(row: aiosqlite.Row) -> EdgeOut:
    return EdgeOut(
        id=row["id"],
        source_id=row["source_id"],
        target_id=row["target_id"],
        relation_type=row["relation_type"],
        weight=row["weight"],
        created_at=row["created_at"],
    )


async def create_edge(conn: aiosqlite.Connection, data: EdgeCreate) -> EdgeOut:
    edge_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()
    await conn.execute(
        """
        INSERT INTO edges (id, source_id, target_id, relation_type, weight, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (edge_id, data.source_id, data.target_id, data.relation_type, data.weight, now),
    )
    await conn.commit()
    async with conn.execute("SELECT * FROM edges WHERE id = ?", (edge_id,)) as cursor:
        row = await cursor.fetchone()
    assert row is not None
    return _row_to_edge(row)


async def list_edges_for_node(
    conn: aiosqlite.Connection, node_id: str
) -> list[EdgeOut]:
    async with conn.execute(
        "SELECT * FROM edges WHERE source_id = ? OR target_id = ?",
        (node_id, node_id),
    ) as cursor:
        rows = await cursor.fetchall()
    return [_row_to_edge(r) for r in rows]


async def traverse_graph(
    conn: aiosqlite.Connection, node_id: str, depth: int = 1
) -> dict[str, list[str]]:
    """Return {node_id: [neighbor_ids]} for nodes reachable within `depth` hops."""
    frontier = {node_id}
    visited: dict[str, list[str]] = {}
    for _ in range(max(depth, 0)):
        next_frontier: set[str] = set()
        for current in frontier:
            if current in visited:
                continue
            edges = await list_edges_for_node(conn, current)
            neighbors = [
                e.target_id if e.source_id == current else e.source_id for e in edges
            ]
            visited[current] = neighbors
            next_frontier.update(neighbors)
        frontier = next_frontier - visited.keys()
        if not frontier:
            break
    return visited
