"""Where a memory's claims came from.

A memory written from a web search is only as good as what it was read out of,
and an agent that summarises three pages into four sentences has thrown away
the one thing a reader needs to check it. Sources keep that: the link, what it
was called, and the line the claim came from.

Nothing here fetches anything. The daemon does not go out to the network to
enrich a citation — that would make writing a memory depend on a site being up,
and would quietly send the user's reading list to whatever host was cited. What
the agent saw when it read the page is what gets stored.
"""

import re
from urllib.parse import urlparse

import aiosqlite

from app.core.identifiers import new_id, utcnow_iso
from app.core.queries import fetch_all, fetch_one, row_to_dict
from app.models.sources import SourceCreate, SourceOut

_INSERT = """
INSERT INTO sources
    (id, node_id, url, title, site, snippet, position, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
"""
_BY_ID = "SELECT * FROM sources WHERE id = ?"
_BY_NODE = "SELECT * FROM sources WHERE node_id = ? ORDER BY position, created_at"
_NEXT_POSITION = "SELECT COALESCE(MAX(position), 0) + 1 FROM sources WHERE node_id = ?"

# Schemes worth storing. A citation is something a reader can go and check, and
# `javascript:` or `data:` in a field the canvas renders as a link is a way in
# rather than a reference.
ALLOWED_SCHEMES = ("http", "https")


class UnusableSource(ValueError):
    """The URL is not something a reader could open."""


def site_of(url: str) -> str:
    """The host, as a reader would name it.

    `www.` is dropped because nobody says it, and the result is shown as the
    source's identity when it has no title.
    """
    host = urlparse(url).netloc.lower()
    host = host.split("@")[-1].split(":")[0]
    return re.sub(r"^www\.", "", host)


def _validate(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in ALLOWED_SCHEMES or not parsed.netloc:
        raise UnusableSource(url)
    return url.strip()


def _to_source(row: aiosqlite.Row) -> SourceOut:
    return SourceOut.model_validate(row_to_dict(row))


async def cite(
    conn: aiosqlite.Connection, node_id: str, data: SourceCreate
) -> SourceOut:
    """Record a citation against a memory, at the end of its list."""
    url = _validate(data.url)

    row = await fetch_one(conn, _NEXT_POSITION, (node_id,))
    position = int(row[0]) if row else 1

    source_id = new_id()
    await conn.execute(
        _INSERT,
        (
            source_id,
            node_id,
            url,
            data.title.strip(),
            # Derived when the caller did not say, so the canvas always has
            # something to label a citation with.
            data.site.strip() or site_of(url),
            data.snippet.strip(),
            position,
            utcnow_iso(),
        ),
    )
    await conn.commit()

    stored = await get_source(conn, source_id)
    assert stored is not None
    return stored


async def get_source(conn: aiosqlite.Connection, source_id: str) -> SourceOut | None:
    row = await fetch_one(conn, _BY_ID, (source_id,))
    return None if row is None else _to_source(row)


async def list_for_node(conn: aiosqlite.Connection, node_id: str) -> list[SourceOut]:
    return [_to_source(row) for row in await fetch_all(conn, _BY_NODE, (node_id,))]


async def delete_source(conn: aiosqlite.Connection, source_id: str) -> bool:
    """Remove a citation.

    The remaining positions are deliberately left as they are. Renumbering
    would silently repoint every `[[src:N]]` after the gap at a different
    source, which is a worse outcome than a citation list that counts 1, 3, 4.
    """
    cursor = await conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    await conn.commit()
    return cursor.rowcount > 0
