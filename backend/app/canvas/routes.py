"""What the views read: the graph, arrangements, and preferences."""

from fastapi import APIRouter

from app.canvas import graph as graph_service
from app.canvas import layout as layout_service
from app.canvas import settings as settings_service
from app.canvas.models import (
    CanvasMode,
    GraphSnapshot,
    Layout,
    LayoutUpdate,
    Settings,
    SettingsPatch,
)
from app.core.database import db

router = APIRouter(tags=["canvas"])


@router.get("/graph")
async def read_graph(since: str | None = None) -> GraphSnapshot:
    """The graph, projected down to what the canvas needs to draw.

    Pass the `as_of` from a previous read as `since` to get only what has
    changed — memories written or edited, edges added, and the ids of anything
    deleted. A client with a cached graph then pays for the difference rather
    than for the whole store on every load.
    """
    return await graph_service.get_snapshot(db.conn, since)


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


@router.get("/settings")
async def read_settings() -> Settings:
    return await settings_service.get_settings(db.conn)


@router.patch("/settings")
async def patch_settings(patch: SettingsPatch) -> Settings:
    return await settings_service.update_settings(db.conn, patch)
