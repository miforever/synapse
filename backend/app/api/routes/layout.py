from fastapi import APIRouter

from app.core.database import db
from app.models.layout import CanvasMode, Layout, LayoutUpdate
from app.services import layout as layout_service

router = APIRouter(tags=["layout"])


@router.get("/layout/{mode}")
async def read_layout(mode: CanvasMode) -> Layout:
    """Positions the user arranged by hand, so a graph opens as they left it."""
    return await layout_service.get_layout(db.conn, mode)


@router.put("/layout/{mode}")
async def write_layout(mode: CanvasMode, update: LayoutUpdate) -> Layout:
    """Replace the arrangement wholesale — the canvas sends everything it pins."""
    return await layout_service.save_layout(db.conn, mode, update.positions)


@router.delete("/layout/{mode}")
async def reset_layout(mode: CanvasMode) -> Layout:
    """Forget the arrangement and let the simulation lay the graph out afresh."""
    return await layout_service.clear_layout(db.conn, mode)
