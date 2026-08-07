"""Whole-graph reads for the canvas."""

import aiosqlite

from app.canvas.models import GraphEdge, GraphNode, GraphSnapshot
from app.core.identifiers import utcnow_iso
from app.core.queries import fetch_all, fetch_one, row_to_dict
from app.memories.models import EdgeOut, NodeOut

# group_concat keeps tags to one query instead of one per node.
_NODES = """
SELECT
    nodes.id,
    nodes.type,
    nodes.title,
    nodes.summary,
    nodes.thumbnail_url,
    nodes.status,
    nodes.target_date,
    COALESCE(GROUP_CONCAT(node_tags.tag), '') AS tags
FROM nodes
LEFT JOIN node_tags ON node_tags.node_id = nodes.id
GROUP BY nodes.id
ORDER BY nodes.created_at
"""

_EDGES = """
SELECT id, source_id AS source, target_id AS target, relation_type, weight
FROM edges
"""

# The same projection, narrowed to what changed. Edges have no updated_at —
# they are created and deleted, never edited — so `created_at` is the whole
# story for them.
_NODES_SINCE = _NODES.replace(
    "GROUP BY nodes.id", "WHERE nodes.updated_at > ?\nGROUP BY nodes.id"
)
_EDGES_SINCE = _EDGES + " WHERE created_at > ?"
_DELETED_SINCE = "SELECT id FROM deleted_nodes WHERE deleted_at > ?"

# The database's clock, so `as_of` is comparable with the timestamps the rows
# were written with — a Python clock could sit either side of SQLite's.
_NOW = "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS now"


def _to_graph_node(row: aiosqlite.Row) -> GraphNode:
    data = row_to_dict(row)
    raw_tags = data.pop("tags", "")
    data["tags"] = raw_tags.split(",") if raw_tags else []
    return GraphNode.model_validate(data)


async def get_snapshot(
    conn: aiosqlite.Connection, since: str | None = None
) -> GraphSnapshot:
    """The whole graph, or everything that changed after `since`.

    `as_of` is read *before* the rows, not after. Taking it afterwards would
    put anything written during the read into a window the client has already
    been told it has, and that memory would never be sent.
    """
    now_row = await fetch_one(conn, _NOW)
    as_of = str(now_row["now"]) if now_row else utcnow_iso()

    if since is None:
        node_rows = await fetch_all(conn, _NODES)
        edge_rows = await fetch_all(conn, _EDGES)
        deleted: list[str] = []
    else:
        node_rows = await fetch_all(conn, _NODES_SINCE, (since,))
        edge_rows = await fetch_all(conn, _EDGES_SINCE, (since,))
        deleted = [row["id"] for row in await fetch_all(conn, _DELETED_SINCE, (since,))]

    return GraphSnapshot(
        nodes=[_to_graph_node(row) for row in node_rows],
        edges=[GraphEdge.model_validate(row_to_dict(row)) for row in edge_rows],
        deleted=deleted,
        as_of=as_of,
        complete=since is None,
    )


def from_node(node: NodeOut) -> GraphNode:
    """Project a stored node down to what the canvas draws."""
    return GraphNode.model_validate(node.model_dump())


def from_edge(edge: EdgeOut) -> GraphEdge:
    return GraphEdge(
        id=edge.id,
        source=edge.source_id,
        target=edge.target_id,
        relation_type=edge.relation_type,
        weight=edge.weight,
    )
