import json

import aiosqlite

from app.core.identifiers import new_id, utcnow_iso
from app.core.queries import fetch_all, fetch_one, row_to_dict
from app.models.nodes import NodeCreate, NodeOut, NodeSearchResult
from app.services import tags as tags_service
from app.services import types as types_service

_INSERT = """
INSERT INTO nodes
    (id, type, title, summary, content, thumbnail_url, metadata,
     created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
_BY_ID = "SELECT * FROM nodes WHERE id = ?"
_SEARCH = """
SELECT nodes.id, nodes.type, nodes.title, nodes.summary
FROM nodes_fts
JOIN nodes ON nodes.id = nodes_fts.id
WHERE nodes_fts MATCH ?
ORDER BY rank
LIMIT ?
"""


def _to_node(row: aiosqlite.Row, tags: list[str]) -> NodeOut:
    data = row_to_dict(row)
    data["metadata"] = json.loads(data["metadata"])
    data["tags"] = tags
    return NodeOut.model_validate(data)


async def create_node(conn: aiosqlite.Connection, data: NodeCreate) -> NodeOut:
    node_id = new_id()
    now = utcnow_iso()
    await types_service.ensure_type(conn, data.type)
    await conn.execute(
        _INSERT,
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
    row = await fetch_one(conn, _BY_ID, (node_id,))
    if row is None:
        return None
    return _to_node(row, await tags_service.get_tags(conn, node_id))


async def search_index(
    conn: aiosqlite.Connection, query: str, limit: int = 5
) -> list[NodeSearchResult]:
    rows = await fetch_all(conn, _SEARCH, (query, limit))
    return [NodeSearchResult.model_validate(row_to_dict(row)) for row in rows]
