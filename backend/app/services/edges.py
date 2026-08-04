import aiosqlite

from app.core.identifiers import new_id, utcnow_iso
from app.core.queries import fetch_all, fetch_one, row_to_dict
from app.models.edges import EdgeCreate, EdgeOut

_INSERT = """
INSERT INTO edges (id, source_id, target_id, relation_type, weight, created_at)
VALUES (?, ?, ?, ?, ?, ?)
"""
_BY_ID = "SELECT * FROM edges WHERE id = ?"
_FOR_NODE = "SELECT * FROM edges WHERE source_id = ? OR target_id = ?"


def _to_edge(row: aiosqlite.Row) -> EdgeOut:
    return EdgeOut.model_validate(row_to_dict(row))


async def create_edge(conn: aiosqlite.Connection, data: EdgeCreate) -> EdgeOut:
    edge_id = new_id()
    await conn.execute(
        _INSERT,
        (
            edge_id,
            data.source_id,
            data.target_id,
            data.relation_type,
            data.weight,
            utcnow_iso(),
        ),
    )
    await conn.commit()

    row = await fetch_one(conn, _BY_ID, (edge_id,))
    assert row is not None
    return _to_edge(row)


async def list_edges_for_node(
    conn: aiosqlite.Connection, node_id: str
) -> list[EdgeOut]:
    rows = await fetch_all(conn, _FOR_NODE, (node_id, node_id))
    return [_to_edge(row) for row in rows]


async def delete_edge(conn: aiosqlite.Connection, edge_id: str) -> bool:
    cursor = await conn.execute("DELETE FROM edges WHERE id = ?", (edge_id,))
    await conn.commit()
    return cursor.rowcount > 0


async def traverse_graph(
    conn: aiosqlite.Connection, node_id: str, depth: int = 1
) -> dict[str, list[str]]:
    """Return {node_id: [neighbor_ids]} for nodes reachable within `depth` hops."""
    frontier = {node_id}
    visited: dict[str, list[str]] = {}

    for _ in range(max(depth, 0)):
        for current in frontier:
            edges = await list_edges_for_node(conn, current)
            visited[current] = [
                edge.target_id if edge.source_id == current else edge.source_id
                for edge in edges
            ]

        frontier = {
            neighbor for neighbors in visited.values() for neighbor in neighbors
        } - visited.keys()
        if not frontier:
            break

    return visited
