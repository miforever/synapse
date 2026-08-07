"""Files attached to memories.

The daemon keeps its own copy of every attachment. Referencing the original
path instead would be cheaper, but a memory is supposed to outlive the tidy-up
that moved the file, and a path only resolves on the machine that has it —
neither of which suits a store agents write to and a canvas reads from.

Nothing a caller supplies is ever used to build a path. The name on disk is
derived from the file's own id, with an extension taken from the original only
after it has been reduced to alphanumerics, so an attachment called
`../../etc/passwd` is stored as harmlessly as any other.
"""

import asyncio
import logging
import mimetypes
import re
from pathlib import Path

import aiosqlite

from app.attachments.models import FileOut
from app.core.config import settings
from app.core.identifiers import new_id, utcnow_iso
from app.core.queries import fetch_all, fetch_one, row_to_dict

logger = logging.getLogger(__name__)

_INSERT = """
INSERT INTO files (id, node_id, name, media_type, size, stored_name, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
"""
_BY_ID = "SELECT * FROM files WHERE id = ?"
_BY_NODE = "SELECT * FROM files WHERE node_id = ? ORDER BY created_at"
_STORED_FOR_NODE = "SELECT stored_name FROM files WHERE node_id = ?"

DEFAULT_MEDIA_TYPE = "application/octet-stream"


class FileTooLarge(ValueError):
    """The upload exceeds the configured per-file ceiling."""


def store_root() -> Path:
    """The directory holding the bytes, created on first use."""
    root = Path(settings.files_path)
    root.mkdir(parents=True, exist_ok=True)
    return root


def display_name(raw: str) -> str:
    """The original filename, reduced to something safe to show.

    Only ever displayed — never used to open anything — but it still passes
    through here so a name carrying directory separators or control characters
    cannot mislead someone reading the drawer about what they are opening.
    """
    name = Path(raw).name.strip()
    name = re.sub(r"[\x00-\x1f]", "", name)
    return name[:200] or "untitled"


def _stored_name(file_id: str, original: str) -> str:
    suffix = Path(original).suffix.lower()
    # Alphanumerics only, so nothing in the caller's name can escape the store.
    safe = re.sub(r"[^a-z0-9.]", "", suffix)[:12]
    return f"{file_id}{safe}"


def _guess_type(name: str, declared: str | None) -> str:
    if declared and declared != DEFAULT_MEDIA_TYPE:
        return declared
    guessed, _ = mimetypes.guess_type(name)
    return guessed or DEFAULT_MEDIA_TYPE


def _to_file(row: aiosqlite.Row) -> FileOut:
    data = row_to_dict(row)
    # stored_name is where the bytes live on this machine, which is nobody
    # else's business — the id is the only handle a caller needs.
    data.pop("stored_name", None)
    return FileOut.model_validate(data)


async def attach_bytes(
    conn: aiosqlite.Connection,
    node_id: str,
    name: str,
    data: bytes,
    media_type: str | None = None,
) -> FileOut:
    """Take a copy of `data` and record it against a memory."""
    if len(data) > settings.max_file_bytes:
        raise FileTooLarge(
            f"{len(data)} bytes exceeds the {settings.max_file_bytes} byte limit"
        )

    file_id = new_id()
    shown = display_name(name)
    stored = _stored_name(file_id, shown)

    path = store_root() / stored
    # Off the event loop. A 50MB attachment written inline stalls every other
    # request and the WebSocket broadcasts sharing this loop — the same reason
    # embedding runs in a thread.
    await asyncio.to_thread(path.write_bytes, data)

    await conn.execute(
        _INSERT,
        (
            file_id,
            node_id,
            shown,
            _guess_type(shown, media_type),
            len(data),
            stored,
            utcnow_iso(),
        ),
    )
    await conn.commit()

    attached = await get_file(conn, file_id)
    assert attached is not None
    return attached


async def attach_path(conn: aiosqlite.Connection, node_id: str, source: str) -> FileOut:
    """Copy a file the caller can already see — the agent-side path.

    Reads it here rather than making the agent base64 a document into a tool
    call, which is what the token budget this whole daemon exists to protect
    would otherwise be spent on.
    """
    origin = Path(source).expanduser()
    if not origin.is_file():
        raise FileNotFoundError(source)
    if origin.stat().st_size > settings.max_file_bytes:
        raise FileTooLarge(source)

    data = await asyncio.to_thread(origin.read_bytes)
    return await attach_bytes(conn, node_id, origin.name, data)


async def get_file(conn: aiosqlite.Connection, file_id: str) -> FileOut | None:
    row = await fetch_one(conn, _BY_ID, (file_id,))
    return None if row is None else _to_file(row)


async def resolve_path(conn: aiosqlite.Connection, file_id: str) -> Path | None:
    """Where a file's bytes are, for the route that serves them."""
    row = await fetch_one(conn, _BY_ID, (file_id,))
    if row is None:
        return None
    path = store_root() / str(row["stored_name"])
    return path if path.is_file() else None


async def list_for_node(conn: aiosqlite.Connection, node_id: str) -> list[FileOut]:
    return [_to_file(row) for row in await fetch_all(conn, _BY_NODE, (node_id,))]


def _remove(stored_name: str) -> None:
    """Drop the bytes, tolerating their absence.

    A missing file is not worth failing a delete over: the row is going either
    way, and refusing would leave the memory pointing at an attachment nobody
    can open.
    """
    try:
        (store_root() / stored_name).unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not remove stored file %s", stored_name, exc_info=True)


async def delete_file(conn: aiosqlite.Connection, file_id: str) -> bool:
    row = await fetch_one(conn, _BY_ID, (file_id,))
    if row is None:
        return False

    await conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
    await conn.commit()
    _remove(str(row["stored_name"]))
    return True


async def purge_for_node(conn: aiosqlite.Connection, node_id: str) -> None:
    """Remove the bytes belonging to a memory that is about to be deleted.

    The rows cascade away with the node, but the disk does not: without this
    the store grows by every attachment of every memory ever deleted.
    """
    for row in await fetch_all(conn, _STORED_FOR_NODE, (node_id,)):
        _remove(str(row["stored_name"]))
