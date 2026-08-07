from typing import Any

from pydantic import BaseModel, Field

from app.models.base import TimestampedModel
from app.models.fields import NodeType, Summary, TagName, Title
from app.models.files import FileOut
from app.models.sources import SourceOut


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


class NodeOut(TimestampedModel):
    id: str
    type: str
    title: str
    summary: str
    content: str
    thumbnail_url: str | None
    metadata: dict[str, Any]
    tags: list[str]
    # Carried with the memory rather than fetched separately: the drawer needs
    # them the moment it opens, and content can reference them inline.
    files: list[FileOut] = Field(default_factory=list)
    # What the memory cites. Ordered, because the text refers to them by
    # number.
    sources: list[SourceOut] = Field(default_factory=list)


class NodeSearchResult(BaseModel):
    """Deliberately narrow: the index read agents pay tokens for."""

    id: str
    type: str
    title: str
    summary: str
