"""Finding a memory."""

from fastapi import APIRouter

from app.core.database import db
from app.memories.models import NodeSearchResult
from app.search import service as search_service

router = APIRouter(tags=["search"])


@router.get("/search")
async def search(q: str, limit: int = 20) -> list[NodeSearchResult]:
    """Search memories by keyword and meaning.

    Full-text and semantic rankings are fused, so exact terms and paraphrases
    both find their memory.
    """
    return await search_service.search(db.conn, q, limit)
