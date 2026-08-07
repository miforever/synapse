"""Canvas-facing projections of the graph.

Deliberately lighter than NodeOut: the canvas only needs enough to draw and
label a node. Full Markdown content is fetched on demand when a node is
opened, so a graph with thousands of memories stays cheap to load.

Link fields are named `source`/`target` because that is what the force-graph
renderer expects, sparing the client a transform pass over every edge.
"""

from pydantic import BaseModel

from app.models.fields import RelationType


class GraphNode(BaseModel):
    id: str
    type: str
    title: str
    summary: str
    thumbnail_url: str | None = None
    tags: list[str] = []


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation_type: RelationType
    weight: float


class GraphSnapshot(BaseModel):
    """The graph, whole or as a delta.

    A client caching the graph passes back `as_of` from its last read and gets
    only what has changed since — including `deleted`, without which a removed
    memory would sit on its canvas until a full reload. On a full read the list
    is empty and there is nothing to reconcile.
    """

    nodes: list[GraphNode]
    edges: list[GraphEdge]
    deleted: list[str] = []
    # The moment this snapshot describes. Pass it back as `since` next time —
    # taken from the database's own clock, so a client whose clock is skewed
    # cannot ask for a window that never closes.
    as_of: str
    # False when the reply is a delta, so a client that has lost its cache
    # knows it cannot treat this as the whole graph.
    complete: bool = True
