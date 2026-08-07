import aiosqlite

from app.core.identifiers import new_id, utcnow_iso
from app.core.queries import fetch_all, fetch_one, row_to_dict
from app.memories.models import EdgeCreate, EdgeOut

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
    """Return {node_id: [neighbor_ids]} for nodes reachable within `depth` hops.

    One query per hop rather than one per node. The frontier grows with the
    graph's branching factor, so asking per node meant a round trip for every
    memory reached — measured at 280 of them for a three-hop walk — where the
    whole ring can be fetched in a single statement.
    """
    frontier = {node_id}
    visited: dict[str, list[str]] = {}

    for _ in range(max(depth, 0)):
        if not frontier:
            break

        for current, neighbours in (await _neighbours_of(conn, frontier)).items():
            visited[current] = neighbours

        # Nodes named as neighbours but not yet expanded. Dead ends leave no
        # entry of their own, so they are recorded as reached with nothing
        # beyond them rather than being asked about again next hop.
        for reached in frontier:
            visited.setdefault(reached, [])

        frontier = {
            neighbour for neighbours in visited.values() for neighbour in neighbours
        } - visited.keys()

    return visited


async def _neighbours_of(
    conn: aiosqlite.Connection, node_ids: set[str]
) -> dict[str, list[str]]:
    """Every edge touching any of `node_ids`, grouped by which one it touches.

    An edge between two members of the frontier belongs to both, which is why
    each row is examined from both ends rather than assigned to one.
    """
    placeholders = ",".join("?" for _ in node_ids)
    rows = await fetch_all(
        conn,
        # noqa: S608 — placeholders are generated, never interpolated values.
        f"SELECT source_id, target_id FROM edges "  # noqa: S608
        f"WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})",
        (*node_ids, *node_ids),
    )

    grouped: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
    for row in rows:
        source, target = row["source_id"], row["target_id"]
        if source in grouped:
            grouped[source].append(target)
        if target in grouped:
            grouped[target].append(source)
    return grouped
