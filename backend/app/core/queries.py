"""Thin helpers over aiosqlite cursors.

Every read would otherwise repeat the same `async with conn.execute(...)`
dance just to reach fetchone/fetchall.
"""

from collections.abc import Mapping, Sequence
from typing import Any

import aiosqlite

Params = Sequence[Any] | Mapping[str, Any]


async def fetch_one(
    conn: aiosqlite.Connection, sql: str, params: Params = ()
) -> aiosqlite.Row | None:
    async with conn.execute(sql, params) as cursor:
        return await cursor.fetchone()


async def fetch_all(
    conn: aiosqlite.Connection, sql: str, params: Params = ()
) -> list[aiosqlite.Row]:
    async with conn.execute(sql, params) as cursor:
        return list(await cursor.fetchall())


async def fetch_column(
    conn: aiosqlite.Connection, sql: str, params: Params = ()
) -> list[Any]:
    """First column of every row — for id and name lookups."""
    return [row[0] for row in await fetch_all(conn, sql, params)]


def row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    # .keys() is required: sqlite3.Row is not a Mapping, so iterating it
    # directly yields values rather than column names.
    return {key: row[key] for key in row.keys()}  # noqa: SIM118
