import aiosqlite

from app.core.queries import fetch_column

_REGISTER = "INSERT OR IGNORE INTO node_types (name) VALUES (?)"
_LIST = "SELECT name FROM node_types ORDER BY name"


async def ensure_type(conn: aiosqlite.Connection, name: str) -> None:
    """Register a node class if it does not exist yet.

    Auto-registering beats rejecting the write: an agent hitting an unknown
    class mid-conversation should not lose the memory it was storing.
    Vocabulary can be merged later; a failed write cannot be recovered.
    """
    await conn.execute(_REGISTER, (name,))


async def list_types(conn: aiosqlite.Connection) -> list[str]:
    return await fetch_column(conn, _LIST)
