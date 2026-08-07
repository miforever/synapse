"""The index read agents reach for first."""

from app.core.database import db
from app.mcp.instance import mcp
from app.search import service as search_service


@mcp.tool
async def search_index(query: str, limit: int = 5) -> list[dict[str, str]]:
    """Search memories by keyword and meaning, returning lightweight candidates.

    Combines exact full-text matching with semantic similarity, so a query
    phrased differently from the stored wording still finds it. Returns only
    id, type, title and summary — call read_node for the full content.
    """
    results = await search_service.search(db.conn, query, limit)
    return [result.model_dump() for result in results]
