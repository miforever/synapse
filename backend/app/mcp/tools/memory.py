"""Memory read/write tools — the progressive disclosure path.

Agents work index -> fetch -> traverse so recall costs a fraction of the
context that replaying a transcript would.
"""

from app.core.database import db
from app.mcp.instance import mcp
from app.models.edges import EdgeCreate
from app.models.nodes import NodeCreate
from app.services import edges as edges_service
from app.services import nodes as nodes_service
from app.ws.events import broadcast_new_node


@mcp.tool
async def search_index(query: str, limit: int = 5) -> list[dict[str, str]]:
    """Full-text search returning lightweight candidates (id, type, title, summary)."""
    results = await nodes_service.search_index(db.conn, query, limit)
    return [result.model_dump() for result in results]


@mcp.tool
async def read_node(node_id: str) -> dict[str, object] | None:
    """Fetch a node's full Markdown content and its immediate connections."""
    node = await nodes_service.get_node(db.conn, node_id)
    if node is None:
        return None
    connections = await edges_service.list_edges_for_node(db.conn, node_id)
    return {
        "node": node.model_dump(),
        "edges": [edge.model_dump() for edge in connections],
    }


@mcp.tool
async def traverse_graph(node_id: str, depth: int = 1) -> dict[str, list[str]]:
    """Walk N steps outward to build a localized structural map."""
    return await edges_service.traverse_graph(db.conn, node_id, depth)


@mcp.tool
async def add_memory(
    title: str,
    summary: str,
    content: str,
    type: str,
    linked_to: list[str] | None = None,
    tags: list[str] | None = None,
) -> dict[str, object]:
    """Persist a new memory, its tags, and optional edges to existing nodes.

    An unrecognized `type` is registered automatically rather than rejected;
    call list_types() first to reuse the existing vocabulary where it fits.
    """
    node = await nodes_service.create_node(
        db.conn,
        NodeCreate(
            type=type,
            title=title,
            summary=summary,
            content=content,
            tags=tags or [],
        ),
    )

    created = [
        await edges_service.create_edge(
            db.conn,
            EdgeCreate(
                source_id=node.id, target_id=target_id, relation_type="relates_to"
            ),
        )
        for target_id in linked_to or []
    ]

    await broadcast_new_node(node, created)
    return {
        "node": node.model_dump(),
        "edges": [edge.model_dump() for edge in created],
    }
