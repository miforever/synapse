import json
import uuid
from datetime import UTC, datetime

import aiosqlite

from app.models.schemas import NodeCreate, NodeOut, NodeSearchResult
from app.services import tags as tags_service
from app.services import types as types_service


def _row_to_node(row: aiosqlite.Row, tags: list[str]) -> NodeOut:
    return NodeOut(
        id=row["id"],
        type=row["type"],
        title=row["title"],
        summary=row["summary"],
        content=row["content"],
        thumbnail_url=row["thumbnail_url"],
        metadata=json.loads(row["metadata"]),
        tags=tags,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def create_node(conn: aiosqlite.Connection, data: NodeCreate) -> NodeOut:
    node_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()
    await types_service.ensure_type(conn, data.type)
    await conn.execute(
        """
        INSERT INTO nodes
            (id, type, title, summary, content, thumbnail_url, metadata,
             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            node_id,
            data.type,
            data.title,
            data.summary,
            data.content,
            data.thumbnail_url,
            json.dumps(data.metadata),
            now,
            now,
        ),
    )
    if data.tags:
        await tags_service.set_tags(conn, node_id, data.tags)
    await conn.commit()
    node = await get_node(conn, node_id)
    assert node is not None
    return node


async def get_node(conn: aiosqlite.Connection, node_id: str) -> NodeOut | None:
    async with conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)) as cursor:
        row = await cursor.fetchone()
    if row is None:
        return None
    return _row_to_node(row, await tags_service.get_tags(conn, node_id))


async def search_index(
    conn: aiosqlite.Connection, query: str, limit: int = 5
) -> list[NodeSearchResult]:
    async with conn.execute(
        """
        SELECT nodes.id, nodes.type, nodes.title, nodes.summary
        FROM nodes_fts
        JOIN nodes ON nodes.id = nodes_fts.id
        WHERE nodes_fts MATCH ?
        ORDER BY rank
        LIMIT ?
        """,
        (query, limit),
    ) as cursor:
        rows = await cursor.fetchall()
    return [
        NodeSearchResult(
            id=r["id"], type=r["type"], title=r["title"], summary=r["summary"]
        )
        for r in rows
    ]
