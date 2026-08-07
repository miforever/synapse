"""Event contract for /ws/graph.

Payload shapes mirror the REST projections in app.models.graph, so the canvas
handles a live node exactly the way it handles one from the initial snapshot.
"""

from app.canvas.graph import from_edge, from_node
from app.memories.models import EdgeOut, NodeOut
from app.ws.manager import manager

EVENT_NEW_NODE = "EVENT_NEW_NODE"
EVENT_NODE_UPDATED = "EVENT_NODE_UPDATED"
EVENT_NODE_DELETED = "EVENT_NODE_DELETED"


async def broadcast_new_node(node: NodeOut, edges: list[EdgeOut]) -> None:
    """Announce a freshly written memory to every connected canvas."""
    await manager.broadcast(
        EVENT_NEW_NODE,
        {
            "node": from_node(node).model_dump(),
            "edges": [from_edge(edge).model_dump() for edge in edges],
        },
    )


async def broadcast_node_updated(node: NodeOut) -> None:
    """Announce an edited memory so open canvases redraw it."""
    await manager.broadcast(EVENT_NODE_UPDATED, {"node": from_node(node).model_dump()})


async def broadcast_node_deleted(node_id: str) -> None:
    """Announce a removal. Edges cascade, so clients drop them by endpoint."""
    await manager.broadcast(EVENT_NODE_DELETED, {"node_id": node_id})
