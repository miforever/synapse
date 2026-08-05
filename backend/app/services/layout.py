"""Persistence for hand-arranged node positions.

Stored as one JSON blob per canvas mode rather than a row per node. The client
always writes the whole set it is holding, so a blob makes a save a single
statement and cannot leave the arrangement half-written. It also means
positions for deleted memories are dropped by the next save instead of
needing their own cleanup.
"""

import json

import aiosqlite

from app.core.identifiers import utcnow_iso
from app.core.queries import fetch_one
from app.models.layout import CanvasMode, Layout, Position

_GET = "SELECT positions FROM layouts WHERE mode = ?"
_UPSERT = """
INSERT INTO layouts (mode, positions, updated_at) VALUES (?, ?, ?)
ON CONFLICT(mode) DO UPDATE SET positions = excluded.positions,
                                updated_at = excluded.updated_at
"""
_DELETE = "DELETE FROM layouts WHERE mode = ?"


async def get_layout(conn: aiosqlite.Connection, mode: CanvasMode) -> Layout:
    row = await fetch_one(conn, _GET, (mode,))
    if row is None:
        return Layout(mode=mode)

    stored = json.loads(row["positions"])
    return Layout(
        mode=mode,
        positions={
            node_id: Position.model_validate(value) for node_id, value in stored.items()
        },
    )


async def save_layout(
    conn: aiosqlite.Connection,
    mode: CanvasMode,
    positions: dict[str, Position],
) -> Layout:
    """Replace the arrangement for one mode.

    Positions for memories that no longer exist are dropped here rather than
    on read: the canvas would ignore them anyway, and leaving them in the file
    means a long-lived graph slowly accumulates dead entries.
    """
    kept = await _existing_only(conn, positions)
    payload = json.dumps({node_id: p.model_dump() for node_id, p in kept.items()})
    await conn.execute(_UPSERT, (mode, payload, utcnow_iso()))
    await conn.commit()
    return Layout(mode=mode, positions=kept)


async def clear_layout(conn: aiosqlite.Connection, mode: CanvasMode) -> Layout:
    await conn.execute(_DELETE, (mode,))
    await conn.commit()
    return Layout(mode=mode)


async def _existing_only(
    conn: aiosqlite.Connection, positions: dict[str, Position]
) -> dict[str, Position]:
    if not positions:
        return {}

    placeholders = ",".join("?" for _ in positions)
    sql = f"SELECT id FROM nodes WHERE id IN ({placeholders})"  # noqa: S608
    async with conn.execute(sql, list(positions)) as cursor:
        alive = {row[0] for row in await cursor.fetchall()}

    return {node_id: p for node_id, p in positions.items() if node_id in alive}
