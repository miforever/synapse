"""Memory read/write tools — the progressive disclosure path.

Agents work index -> fetch -> traverse so recall costs a fraction of the
context that replaying a transcript would.
"""

from app.core.database import db
from app.mcp.instance import mcp
from app.models.edges import EdgeCreate
from app.models.nodes import NodeCreate, NodeUpdate
from app.services import edges as edges_service
from app.services import nodes as nodes_service
from app.services import search as search_service
from app.ws.events import (
    broadcast_new_node,
    broadcast_node_deleted,
    broadcast_node_updated,
)


@mcp.tool
async def search_index(query: str, limit: int = 5) -> list[dict[str, str]]:
    """Search memories by keyword and meaning, returning lightweight candidates.

    Combines exact full-text matching with semantic similarity, so a query
    phrased differently from the stored wording still finds it. Returns only
    id, type, title and summary — call read_node for the full content.
    """
    results = await search_service.search(db.conn, query, limit)
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


@mcp.tool
async def update_memory(
    node_id: str,
    title: str | None = None,
    summary: str | None = None,
    content: str | None = None,
    type: str | None = None,
    tags: list[str] | None = None,
) -> dict[str, object] | None:
    """Correct an existing memory. Omitted fields are left untouched.

    Passing `tags` replaces the whole set, so send the full list rather than
    just the additions. Returns None if the memory no longer exists.
    """
    patch = NodeUpdate.model_validate(
        {
            key: value
            for key, value in {
                "title": title,
                "summary": summary,
                "content": content,
                "type": type,
                "tags": tags,
            }.items()
            if value is not None
        }
    )

    node = await nodes_service.update_node(db.conn, node_id, patch)
    if node is None:
        return None

    await broadcast_node_updated(node)
    return {"node": node.model_dump()}


@mcp.tool
async def delete_memory(node_id: str) -> dict[str, object]:
    """Remove a memory and every edge touching it.

    Use this for memories that turned out to be wrong; a store you cannot
    correct accumulates confidently stated mistakes.
    """
    deleted = await nodes_service.delete_node(db.conn, node_id)
    if deleted:
        await broadcast_node_deleted(node_id)
    return {"deleted": deleted, "node_id": node_id}


@mcp.tool
async def link_memories(
    source_id: str,
    target_id: str,
    relation_type: str = "relates_to",
    weight: float = 1.0,
) -> dict[str, object]:
    """Connect two existing memories."""
    edge = await edges_service.create_edge(
        db.conn,
        EdgeCreate(
            source_id=source_id,
            target_id=target_id,
            relation_type=relation_type,  # type: ignore[arg-type]
            weight=weight,
        ),
    )
    return {"edge": edge.model_dump()}


@mcp.tool
async def unlink_memories(edge_id: str) -> dict[str, object]:
    """Remove a connection between two memories, leaving both in place."""
    return {"deleted": await edges_service.delete_edge(db.conn, edge_id)}
