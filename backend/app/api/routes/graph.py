from fastapi import APIRouter, HTTPException

from app.core.database import db
from app.models.graph import GraphSnapshot
from app.models.nodes import NodeOut, NodeSearchResult, NodeUpdate
from app.services import edges as edges_service
from app.services import graph as graph_service
from app.services import nodes as nodes_service
from app.ws.events import broadcast_node_deleted, broadcast_node_updated

router = APIRouter(tags=["graph"])


@router.get("/graph")
async def read_graph() -> GraphSnapshot:
    """The whole graph, projected down to what the canvas needs to draw."""
    return await graph_service.get_snapshot(db.conn)


@router.get("/search")
async def search(q: str, limit: int = 20) -> list[NodeSearchResult]:
    """Full-text search over titles, summaries, and content.

    Returns ranked candidates. When hybrid vector ranking lands the response
    shape stays the same — only the ordering changes.
    """
    if not q.strip():
        return []
    return await nodes_service.search_index(db.conn, q, limit)


@router.get("/nodes/{node_id}")
async def read_node(node_id: str) -> NodeOut:
    """Full node including Markdown content — fetched when a node is opened."""
    node = await nodes_service.get_node(db.conn, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.patch("/nodes/{node_id}")
async def update_node(node_id: str, patch: NodeUpdate) -> NodeOut:
    node = await nodes_service.update_node(db.conn, node_id, patch)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    await broadcast_node_updated(node)
    return node


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(node_id: str) -> None:
    if not await nodes_service.delete_node(db.conn, node_id):
        raise HTTPException(status_code=404, detail="Node not found")
    await broadcast_node_deleted(node_id)


@router.delete("/edges/{edge_id}", status_code=204)
async def delete_edge(edge_id: str) -> None:
    if not await edges_service.delete_edge(db.conn, edge_id):
        raise HTTPException(status_code=404, detail="Edge not found")
