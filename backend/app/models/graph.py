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
    nodes: list[GraphNode]
    edges: list[GraphEdge]
