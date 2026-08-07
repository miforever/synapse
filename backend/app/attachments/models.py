"""Files attached to a memory, and the sources it cites.

Kept together because they are the same idea seen twice: something outside the
memory that the memory points at. One is stored here, the other lives on the
web, and the difference is what each model records.
"""

from pydantic import BaseModel, Field, computed_field

from app.core.base import CreatedModel


class FileOut(CreatedModel):
    """A file attached to a memory, as the canvas and agents see it."""

    id: str
    node_id: str
    name: str
    media_type: str
    size: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        """Where to fetch the bytes.

        Derived rather than stored: the route owns this shape, and a column
        holding a URL would be wrong the moment the route moved.
        """
        return f"/files/{self.id}"


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
