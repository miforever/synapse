from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, Field

from app.core.slug import slugify

# `type` is an open vocabulary backed by the node_types table rather than a
# closed enum: agents can register new classes at runtime. Slugifying on the
# way in keeps 'Task'/'task'/'TASK' from becoming three distinct classes.
NodeType = Annotated[str, BeforeValidator(slugify), Field(max_length=40)]
TagName = Annotated[str, BeforeValidator(slugify), Field(max_length=40)]

# Relations stay a closed set — they define graph semantics, not vocabulary.
RelationType = Literal["depends_on", "relates_to", "blocks", "part_of"]


class NodeTypeOut(BaseModel):
    name: str
    label: str
    color: str


class NodeCreate(BaseModel):
    type: NodeType
    title: str = Field(max_length=100)
    summary: str = Field(max_length=250)
    content: str = ""
    thumbnail_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[TagName] = Field(default_factory=list)


class NodeOut(BaseModel):
    id: str
    type: str
    title: str
    summary: str
    content: str
    thumbnail_url: str | None
    metadata: dict[str, Any]
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class NodeSearchResult(BaseModel):
    id: str
    type: str
    title: str
    summary: str


class EdgeCreate(BaseModel):
    source_id: str
    target_id: str
    relation_type: RelationType
    weight: float = Field(default=1.0, ge=0.0, le=1.0)


class EdgeOut(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation_type: RelationType
    weight: float
    created_at: datetime
