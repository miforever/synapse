"""Vocabulary discovery tools.

Exposed so agents reuse existing classes and tags instead of minting
near-duplicates for concepts that are already represented.
"""

from app.core.database import db
from app.mcp.instance import mcp
from app.services import settings as settings_service
from app.services import tags as tags_service
from app.services import types as types_service


@mcp.tool
async def list_types() -> list[str]:
    """List known node classes. Prefer an existing one before inventing another."""
    return await types_service.list_types(db.conn)


@mcp.tool
async def list_tags() -> list[dict[str, object]]:
    """List known tags with usage counts. Prefer reusing an existing tag."""
    return [tag.model_dump() for tag in await tags_service.list_tags(db.conn)]


@mcp.tool
async def get_render_settings() -> dict[str, object]:
    """Report which media the canvas will render, so attachments aren't wasted.

    Read-only by design. These switches decide what agent-authored content is
    allowed to load, so writing them is the user's call, not an agent's.
    """
    return (await settings_service.get_settings(db.conn)).model_dump()
