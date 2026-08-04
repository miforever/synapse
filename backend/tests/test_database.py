import aiosqlite


async def test_pragmas_applied(conn: aiosqlite.Connection) -> None:
    async with conn.execute("PRAGMA journal_mode") as cursor:
        row = await cursor.fetchone()
    assert row is not None
    # in-memory databases report 'memory' instead of 'wal'
    assert row[0] in ("wal", "memory")

    async with conn.execute("PRAGMA foreign_keys") as cursor:
        row = await cursor.fetchone()
    assert row is not None
    assert row[0] == 1


async def test_schema_tables_exist(conn: aiosqlite.Connection) -> None:
    async with conn.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
    ) as cursor:
        rows = await cursor.fetchall()
    names = {r[0] for r in rows}
    assert {"nodes", "edges", "nodes_fts"} <= names
