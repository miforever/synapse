import json
import re

import aiosqlite

from app.core.identifiers import new_id, utcnow_iso
from app.core.queries import fetch_all, fetch_one, row_to_dict
from app.models.nodes import NodeCreate, NodeOut, NodeSearchResult, NodeUpdate
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


async def update_node(
    conn: aiosqlite.Connection, node_id: str, data: NodeUpdate
) -> NodeOut | None:
    """Apply a partial update. Returns None if the node is gone."""
    if await get_node(conn, node_id) is None:
        return None

    fields = data.model_dump(exclude_unset=True, exclude={"tags"})
    if "type" in fields:
        await types_service.ensure_type(conn, fields["type"])
    if "metadata" in fields:
        fields["metadata"] = json.dumps(fields["metadata"])

    if fields:
        fields["updated_at"] = utcnow_iso()
        assignments = ", ".join(f"{column} = ?" for column in fields)
        await conn.execute(
            f"UPDATE nodes SET {assignments} WHERE id = ?",  # noqa: S608
            (*fields.values(), node_id),
        )

    # Distinguish "not provided" from "provided empty": only an explicit list
    # replaces the tags.
    if data.tags is not None:
        await tags_service.set_tags(conn, node_id, data.tags)

    await conn.commit()
    return await get_node(conn, node_id)


async def delete_node(conn: aiosqlite.Connection, node_id: str) -> bool:
    """Remove a node. Its edges and tag links cascade away with it."""
    cursor = await conn.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
    await conn.commit()
    return cursor.rowcount > 0


def build_fts_query(raw: str) -> str:
    """Turn free text into a safe FTS5 expression.

    Raw input cannot go straight into MATCH: a stray quote or a bare `AND`
    raises a syntax error rather than returning nothing. Each word is stripped
    of syntax characters and quoted, then given a `*` so search-as-you-type
    matches prefixes — typing "syn" should find "SYNAPSE".
    """
    terms = [re.sub(r'["*^:()\-]', " ", word).strip() for word in raw.split()]
    return " ".join(f'"{term}"*' for term in terms if term)


async def search_index(
    conn: aiosqlite.Connection, query: str, limit: int = 5
) -> list[NodeSearchResult]:
    expression = build_fts_query(query)
    if not expression:
        return []
    rows = await fetch_all(conn, _SEARCH, (expression, limit))
    return [NodeSearchResult.model_validate(row_to_dict(row)) for row in rows]
