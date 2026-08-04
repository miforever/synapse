from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import aiosqlite

from app.core.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS node_types (
    name TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#94A3B8',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL REFERENCES node_types(name) ON UPDATE CASCADE,
    title TEXT NOT NULL CHECK (length(title) <= 100),
    summary TEXT NOT NULL CHECK (length(summary) <= 250),
    content TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL CHECK (
        relation_type IN ('depends_on', 'relates_to', 'blocks', 'part_of')
    ),
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tags (
    name TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS node_tags (
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL REFERENCES tags(name) ON DELETE CASCADE,
    PRIMARY KEY (node_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_node_tags_tag ON node_tags(tag);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    id UNINDEXED,
    title,
    summary,
    content,
    tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
    INSERT INTO nodes_fts (rowid, id, title, summary, content)
    VALUES (new.rowid, new.id, new.title, new.summary, new.content);
END;

CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
    DELETE FROM nodes_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
    UPDATE nodes_fts
    SET title = new.title, summary = new.summary, content = new.content
    WHERE rowid = new.rowid;
END;
"""

# Seeded on boot; agents may register further types at runtime via add_memory.
DEFAULT_NODE_TYPES: tuple[tuple[str, str, str], ...] = (
    ("person", "Person", "#00FF66"),
    ("project", "Project", "#00F0FF"),
    ("idea", "Idea", "#FFB800"),
    ("event", "Event", "#A855F7"),
    ("fact", "Fact", "#94A3B8"),
    ("plan", "Plan", "#38BDF8"),
    ("issue", "Issue", "#FB7185"),
)


async def init_db(db_path: str | None = None) -> aiosqlite.Connection:
    """Open a connection, apply PRAGMAs, and ensure the schema exists."""
    conn = await aiosqlite.connect(db_path or settings.db_path)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA synchronous=NORMAL")
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(SCHEMA)
    await conn.executemany(
        "INSERT OR IGNORE INTO node_types (name, label, color) VALUES (?, ?, ?)",
        DEFAULT_NODE_TYPES,
    )
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


@asynccontextmanager
async def lifespan_db() -> AsyncIterator[None]:
    await db.connect()
    try:
        yield
    finally:
        await db.disconnect()
