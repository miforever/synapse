"""Event contract for /ws/graph.

Payload shapes mirror the REST projections in app.models.graph, so the canvas
handles a live node exactly the way it handles one from the initial snapshot.
"""

from app.models.edges import EdgeOut
from app.models.nodes import NodeOut
from app.services.graph import from_edge, from_node
from app.ws.manager import manager

EVENT_NEW_NODE = "EVENT_NEW_NODE"


async def broadcast_new_node(node: NodeOut, edges: list[EdgeOut]) -> None:
    """Announce a freshly written memory to every connected canvas."""
    await manager.broadcast(
        EVENT_NEW_NODE,
        {
            "node": from_node(node).model_dump(),
            "edges": [from_edge(edge).model_dump() for edge in edges],
        },
    )
