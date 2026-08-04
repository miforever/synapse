from fastapi import APIRouter, HTTPException

from app.core.database import db
from app.models.graph import GraphSnapshot
from app.models.nodes import NodeOut
from app.services import graph as graph_service
from app.services import nodes as nodes_service

router = APIRouter(tags=["graph"])


@router.get("/graph")
async def read_graph() -> GraphSnapshot:
    """The whole graph, projected down to what the canvas needs to draw."""
    return await graph_service.get_snapshot(db.conn)


@router.get("/nodes/{node_id}")
async def read_node(node_id: str) -> NodeOut:
    """Full node including Markdown content — fetched when a node is opened."""
    node = await nodes_service.get_node(db.conn, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    return node
