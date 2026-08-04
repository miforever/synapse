from fastmcp import FastMCP

from app.core.database import db
from app.models.schemas import EdgeCreate, NodeCreate
from app.services import edges as edges_service
from app.services import nodes as nodes_service
from app.services import tags as tags_service
from app.services import types as types_service

mcp: FastMCP = FastMCP("synapse")


@mcp.tool
async def list_types() -> list[dict[str, str]]:
    """List known node classes. Prefer an existing class before inventing one."""
    return [t.model_dump() for t in await types_service.list_types(db.conn)]


@mcp.tool
async def list_tags() -> list[dict[str, object]]:
    """List known tags with usage counts. Prefer reusing an existing tag."""
    return await tags_service.list_tags(db.conn)


@mcp.tool
async def search_index(query: str, limit: int = 5) -> list[dict[str, str]]:
    """FTS5 search returning lightweight candidate nodes (id, title, summary, type)."""
    results = await nodes_service.search_index(db.conn, query, limit)
    return [r.model_dump() for r in results]


@mcp.tool
async def read_node(node_id: str) -> dict[str, object] | None:
    """Fetch full Markdown content and immediate edge links for a node."""
    node = await nodes_service.get_node(db.conn, node_id)
    if node is None:
        return None
    node_edges = await edges_service.list_edges_for_node(db.conn, node_id)
    return {"node": node.model_dump(), "edges": [e.model_dump() for e in node_edges]}


@mcp.tool
async def traverse_graph(node_id: str, depth: int = 1) -> dict[str, list[str]]:
    """Walk N steps outward from a node to build a localized structural context map."""
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
    """Persist a new node and optional connecting edges.

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
    created_edges = []
    for target_id in linked_to or []:
        edge = await edges_service.create_edge(
            db.conn,
            EdgeCreate(
                source_id=node.id, target_id=target_id, relation_type="relates_to"
            ),
        )
        created_edges.append(edge)
    # TODO(phase-2): broadcast EVENT_NEW_NODE over the /ws/graph WebSocket.
    return {"node": node.model_dump(), "edges": [e.model_dump() for e in created_edges]}
