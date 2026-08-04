"""Whole-graph reads for the canvas."""

import aiosqlite

from app.core.queries import fetch_all, row_to_dict
from app.models.edges import EdgeOut
from app.models.graph import GraphEdge, GraphNode, GraphSnapshot
from app.models.nodes import NodeOut

# group_concat keeps tags to one query instead of one per node.
_NODES = """
SELECT
    nodes.id,
    nodes.type,
    nodes.title,
    nodes.summary,
    nodes.thumbnail_url,
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


def _to_graph_node(row: aiosqlite.Row) -> GraphNode:
    data = row_to_dict(row)
    raw_tags = data.pop("tags", "")
    data["tags"] = raw_tags.split(",") if raw_tags else []
    return GraphNode.model_validate(data)


async def get_snapshot(conn: aiosqlite.Connection) -> GraphSnapshot:
    node_rows = await fetch_all(conn, _NODES)
    edge_rows = await fetch_all(conn, _EDGES)
    return GraphSnapshot(
        nodes=[_to_graph_node(row) for row in node_rows],
        edges=[GraphEdge.model_validate(row_to_dict(row)) for row in edge_rows],
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
