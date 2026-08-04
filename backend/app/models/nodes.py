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
