import aiosqlite

from app.core.queries import fetch_all, fetch_column, row_to_dict
from app.memories.models import TagOut

_REGISTER = "INSERT OR IGNORE INTO tags (name) VALUES (?)"
_CLEAR_FOR_NODE = "DELETE FROM node_tags WHERE node_id = ?"
_LINK = "INSERT OR IGNORE INTO node_tags (node_id, tag) VALUES (?, ?)"
_FOR_NODE = "SELECT tag FROM node_tags WHERE node_id = ? ORDER BY tag"
_NODES_WITH_TAG = "SELECT node_id FROM node_tags WHERE tag = ? LIMIT ?"
_LIST_WITH_COUNTS = """
SELECT tags.name, COUNT(node_tags.node_id) AS count
FROM tags
LEFT JOIN node_tags ON node_tags.tag = tags.name
GROUP BY tags.name
ORDER BY count DESC, tags.name
"""


async def set_tags(conn: aiosqlite.Connection, node_id: str, tags: list[str]) -> None:
    """Replace a node's tags, registering any that are new."""
    await conn.executemany(_REGISTER, [(tag,) for tag in tags])
    await conn.execute(_CLEAR_FOR_NODE, (node_id,))
    await conn.executemany(_LINK, [(node_id, tag) for tag in tags])


async def get_tags(conn: aiosqlite.Connection, node_id: str) -> list[str]:
    return await fetch_column(conn, _FOR_NODE, (node_id,))


async def list_tags(conn: aiosqlite.Connection) -> list[TagOut]:
    """All known tags with usage counts — powers canvas filters and autocomplete."""
    rows = await fetch_all(conn, _LIST_WITH_COUNTS)
    return [TagOut.model_validate(row_to_dict(row)) for row in rows]


async def find_nodes_by_tag(
    conn: aiosqlite.Connection, tag: str, limit: int = 20
) -> list[str]:
    return await fetch_column(conn, _NODES_WITH_TAG, (tag, limit))
