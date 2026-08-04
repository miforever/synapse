"""Database schema definition and seed vocabulary.

Kept separate from connection handling so the DDL reads as one document.
"""

# Every timestamp column uses the same UTC ISO-8601 expression.
_NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"

TABLES = f"""
CREATE TABLE IF NOT EXISTS node_types (
    name TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT {_NOW}
);

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL REFERENCES node_types(name) ON UPDATE CASCADE,
    title TEXT NOT NULL CHECK (length(title) <= 100),
    summary TEXT NOT NULL CHECK (length(summary) <= 250),
    content TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT,
    metadata TEXT NOT NULL DEFAULT '{{}}',
    created_at TEXT NOT NULL DEFAULT {_NOW},
    updated_at TEXT NOT NULL DEFAULT {_NOW}
);

CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL CHECK (
        relation_type IN ('depends_on', 'relates_to', 'blocks', 'part_of')
    ),
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
    created_at TEXT NOT NULL DEFAULT {_NOW}
);

CREATE TABLE IF NOT EXISTS tags (
    name TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT {_NOW}
);

-- Single-row key/value store for user preferences.
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT {_NOW}
);

CREATE TABLE IF NOT EXISTS node_tags (
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL REFERENCES tags(name) ON DELETE CASCADE,
    PRIMARY KEY (node_id, tag)
);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_node_tags_tag ON node_tags(tag);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
"""

# Mirrors node text into an FTS5 index so search_index stays sub-millisecond.
FULLTEXT = """
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

SCHEMA = TABLES + INDEXES + FULLTEXT

PRAGMAS = (
    "PRAGMA journal_mode=WAL",
    "PRAGMA synchronous=NORMAL",
    "PRAGMA foreign_keys=ON",
)

# Seeded on boot; agents may register further classes at runtime. How each is
# rendered (colour, icon, label casing) is entirely the canvas's concern.
#
# Deliberately coarse. A class is the *shape* of a thing and carries one colour
# on the canvas; anything more specific belongs in tags. A pet is an `object`
# tagged `animal`, not its own class — unless a given user tracks enough of
# them to justify registering one, which they can do without a migration.
DEFAULT_NODE_TYPES: tuple[str, ...] = (
    # Entities
    "person",
    "organization",
    "place",
    "object",
    # Work
    "project",
    "plan",
    "issue",
    "event",
    # Knowledge
    "idea",
    "fact",
    "decision",
    "preference",
    "resource",
)
