import aiosqlite

from app.models.schemas import NodeTypeOut

DEFAULT_COLOR = "#94A3B8"


async def ensure_type(
    conn: aiosqlite.Connection, name: str, color: str = DEFAULT_COLOR
) -> None:
    """Register a node type if it does not exist yet.

    Auto-registering beats rejecting the write: an agent hitting an unknown
    class mid-conversation should not lose the memory it was trying to store.
    Vocabulary can be merged later; a failed write cannot be recovered.
    """
    await conn.execute(
        "INSERT OR IGNORE INTO node_types (name, label, color) VALUES (?, ?, ?)",
        (name, name.replace("_", " ").title(), color),
    )


async def list_types(conn: aiosqlite.Connection) -> list[NodeTypeOut]:
    async with conn.execute(
        "SELECT name, label, color FROM node_types ORDER BY name"
    ) as cursor:
        rows = await cursor.fetchall()
    return [
        NodeTypeOut(name=r["name"], label=r["label"], color=r["color"]) for r in rows
    ]
