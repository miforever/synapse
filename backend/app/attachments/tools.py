"""Attaching files to a memory, and citing what it was written from."""

from app.attachments import files as files_service
from app.attachments import sources as sources_service
from app.attachments.models import SourceCreate
from app.core.database import db
from app.mcp.instance import mcp
from app.memories import nodes as nodes_service
from app.memories.tools import _announce


@mcp.tool
async def attach_file(node_id: str, path: str) -> dict[str, object] | None:
    """Attach a file on this machine to an existing memory.

    The daemon copies the bytes into its own store, so the memory keeps working
    after the original is moved or deleted. Reference it from the memory's
    Markdown as `[[file:NAME]]`, using the returned `name`, and the canvas
    renders it inline as something you can open.

    Returns None if the memory does not exist.
    """
    if await nodes_service.get_node(db.conn, node_id) is None:
        return None

    try:
        attached = await files_service.attach_path(db.conn, node_id, path)
    except FileNotFoundError:
        return {"error": f"No file at {path}"}
    except files_service.FileTooLarge:
        return {"error": f"{path} is larger than this daemon will store"}

    await _announce(node_id)
    return {"file": attached.model_dump(mode="json")}


@mcp.tool
async def detach_file(file_id: str) -> dict[str, object]:
    """Remove an attachment from its memory, deleting the stored copy."""
    record = await files_service.get_file(db.conn, file_id)
    deleted = await files_service.delete_file(db.conn, file_id)

    if deleted and record is not None:
        await _announce(record.node_id)
    return {"deleted": deleted, "file_id": file_id}


@mcp.tool
async def cite_source(
    node_id: str,
    url: str,
    title: str = "",
    snippet: str = "",
) -> dict[str, object] | None:
    """Record where a memory's claims came from.

    Cite the page you actually read, with the line you took from it as
    `snippet` — a summary nobody can check is worth much less than the same
    summary with its receipts. Nothing is fetched: what you saw is what is
    stored.

    Sources are numbered in the order they are cited, and the memory's Markdown
    refers to them as `[[src:1]]`, which the canvas renders as a citation the
    reader can hover to see the source behind it.

    Returns None if the memory does not exist.
    """
    if await nodes_service.get_node(db.conn, node_id) is None:
        return None

    try:
        cited = await sources_service.cite(
            db.conn, node_id, SourceCreate(url=url, title=title, snippet=snippet)
        )
    except sources_service.UnusableSource:
        return {"error": f"{url} is not an http(s) address a reader could open"}

    await _announce(node_id)
    return {"source": cited.model_dump(mode="json")}


@mcp.tool
async def uncite_source(source_id: str) -> dict[str, object]:
    """Remove a citation from its memory."""
    record = await sources_service.get_source(db.conn, source_id)
    deleted = await sources_service.delete_source(db.conn, source_id)

    if deleted and record is not None:
        await _announce(record.node_id)
    return {"deleted": deleted, "source_id": source_id}
