import aiosqlite

from app.core.config import settings
from app.core.schema import DEFAULT_NODE_TYPES, PRAGMAS, SCHEMA

SEED_TYPES_SQL = "INSERT OR IGNORE INTO node_types (name) VALUES (?)"


async def init_db(db_path: str | None = None) -> aiosqlite.Connection:
    """Open a connection, apply PRAGMAs, and ensure the schema exists."""
    conn = await aiosqlite.connect(db_path or settings.db_path)
    conn.row_factory = aiosqlite.Row
    for pragma in PRAGMAS:
        await conn.execute(pragma)
    await conn.executescript(SCHEMA)
    await conn.executemany(SEED_TYPES_SQL, [(name,) for name in DEFAULT_NODE_TYPES])
    await conn.commit()
    return conn


class Database:
    """Holds the single shared aiosqlite connection for the daemon's lifetime."""

    def __init__(self) -> None:
        self._conn: aiosqlite.Connection | None = None

    async def connect(self, db_path: str | None = None) -> None:
        self._conn = await init_db(db_path)

    async def disconnect(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("Database is not connected")
        return self._conn


db = Database()
