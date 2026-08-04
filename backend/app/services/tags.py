import aiosqlite


async def set_tags(conn: aiosqlite.Connection, node_id: str, tags: list[str]) -> None:
    """Replace a node's tags, registering any that are new."""
    await conn.executemany(
        "INSERT OR IGNORE INTO tags (name) VALUES (?)", [(t,) for t in tags]
    )
    await conn.execute("DELETE FROM node_tags WHERE node_id = ?", (node_id,))
    await conn.executemany(
        "INSERT OR IGNORE INTO node_tags (node_id, tag) VALUES (?, ?)",
        [(node_id, t) for t in tags],
    )


async def get_tags(conn: aiosqlite.Connection, node_id: str) -> list[str]:
    async with conn.execute(
        "SELECT tag FROM node_tags WHERE node_id = ? ORDER BY tag", (node_id,)
    ) as cursor:
        rows = await cursor.fetchall()
    return [r["tag"] for r in rows]


async def list_tags(conn: aiosqlite.Connection) -> list[dict[str, object]]:
    """All known tags with usage counts — powers canvas filters and autocomplete."""
    async with conn.execute(
        """
        SELECT tags.name, COUNT(node_tags.node_id) AS count
        FROM tags
        LEFT JOIN node_tags ON node_tags.tag = tags.name
        GROUP BY tags.name
        ORDER BY count DESC, tags.name
        """
    ) as cursor:
        rows = await cursor.fetchall()
    return [{"name": r["name"], "count": r["count"]} for r in rows]


async def find_nodes_by_tag(
    conn: aiosqlite.Connection, tag: str, limit: int = 20
) -> list[str]:
    async with conn.execute(
        "SELECT node_id FROM node_tags WHERE tag = ? LIMIT ?", (tag, limit)
    ) as cursor:
        rows = await cursor.fetchall()
    return [r["node_id"] for r in rows]
