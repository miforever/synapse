from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.fields import NodeType, Summary, TagName, Title


class NodeCreate(BaseModel):
    type: NodeType
    title: Title
    summary: Summary
    content: str = ""
    thumbnail_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[TagName] = Field(default_factory=list)


class NodeUpdate(BaseModel):
    """Partial update. Omitted fields keep their stored value.

    `tags` is replace-not-merge: passing [] clears them, omitting it leaves
    them alone. Without that distinction there is no way to remove a tag.
    """

    type: NodeType | None = None
    title: Title | None = None
    summary: Summary | None = None
    content: str | None = None
    thumbnail_url: str | None = None
    metadata: dict[str, Any] | None = None
    tags: list[TagName] | None = None


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
    """Deliberately narrow: the index read agents pay tokens for."""

    id: str
    type: str
    title: str
    summary: str
