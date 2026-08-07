from pydantic import computed_field

from app.models.base import CreatedModel


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
