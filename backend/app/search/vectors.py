"""Vector storage and nearest-neighbour lookup, backed by sqlite-vec.

Vectors live in a virtual table alongside the graph in the same file, so a
memory and its embedding are one thing to back up and one thing to delete.
"""

import struct
from weakref import WeakSet

import aiosqlite

from app.core.queries import fetch_all

# Which connections have the extension loaded. Kept here rather than as an
# attribute on the connection so the flag is typed, and weak so closing a
# connection does not leave an entry behind.
_enabled: WeakSet[aiosqlite.Connection] = WeakSet()


def mark_available(conn: aiosqlite.Connection) -> None:
    _enabled.add(conn)


_UPSERT = "INSERT OR REPLACE INTO node_vectors (node_id, embedding) VALUES (?, ?)"
_DELETE = "DELETE FROM node_vectors WHERE node_id = ?"
_SEARCH = """
SELECT node_id, distance
FROM node_vectors
WHERE embedding MATCH ? AND k = ?
ORDER BY distance
"""


def available(conn: aiosqlite.Connection) -> bool:
    """Whether sqlite-vec loaded for this connection."""
    return conn in _enabled


def serialize(vector: list[float]) -> bytes:
    """Pack as float32, the layout sqlite-vec expects."""
    return struct.pack(f"{len(vector)}f", *vector)


async def upsert(conn: aiosqlite.Connection, node_id: str, vector: list[float]) -> None:
    if not available(conn):
        return
    await conn.execute(_UPSERT, (node_id, serialize(vector)))


async def delete(conn: aiosqlite.Connection, node_id: str) -> None:
    if not available(conn):
        return
    await conn.execute(_DELETE, (node_id,))


async def search(
    conn: aiosqlite.Connection, vector: list[float], limit: int
) -> list[tuple[str, float]]:
    """Nearest neighbours as (node_id, distance), closest first."""
    if not available(conn):
        return []
    rows = await fetch_all(conn, _SEARCH, (serialize(vector), limit))
    return [(row["node_id"], row["distance"]) for row in rows]


async def count(conn: aiosqlite.Connection) -> int:
    if not available(conn):
        return 0
    rows = await fetch_all(conn, "SELECT COUNT(*) AS n FROM node_vectors")
    return int(rows[0]["n"]) if rows else 0
