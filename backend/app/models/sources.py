from pydantic import BaseModel, Field

from app.models.base import CreatedModel


class SourceCreate(BaseModel):
    """A citation being recorded against a memory.

    Only the URL is required. An agent that has just read a page knows its
    title and the line it took, but one recording a link in passing does not,
    and refusing the citation for want of a title would lose the URL too.
    """

    url: str
    title: str = ""
    site: str = ""
    snippet: str = Field(default="", max_length=600)


class SourceOut(CreatedModel):
    """A citation, as the canvas and agents see it."""

    id: str
    node_id: str
    url: str
    title: str
    site: str
    snippet: str
    # 1-based, and stable: `[[src:2]]` in the memory's text means the second
    # source, so this is what the prose is pointing at.
    position: int
