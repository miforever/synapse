"""Memory read/write tools — the progressive disclosure path.

Agents work index -> fetch -> traverse so recall costs a fraction of the
context that replaying a transcript would.
"""

import logging

from app.core.database import db
from app.mcp.instance import mcp
from app.models.edges import EdgeCreate
from app.models.nodes import NodeCreate, NodeUpdate
from app.models.sources import SourceCreate
from app.services import edges as edges_service
from app.services import files as files_service
from app.services import nodes as nodes_service
from app.services import search as search_service
from app.services import sources as sources_service
from app.ws.events import (
    broadcast_new_node,
    broadcast_node_deleted,
    broadcast_node_updated,
)

logger = logging.getLogger(__name__)


async def _announce(node_id: str) -> None:
    """Tell every open canvas the memory changed.

    Re-read rather than passed in: what a tool holds after writing is the file
    or source, not the memory carrying it, and canvases redrawing from a stale
    node would drop the very thing that prompted the broadcast.
    """
    node = await nodes_service.get_node(db.conn, node_id)
    if node is not None:
        await broadcast_node_updated(node)


@mcp.tool
async def search_index(query: str, limit: int = 5) -> list[dict[str, str]]:
    """Search memories by keyword and meaning, returning lightweight candidates.

    Combines exact full-text matching with semantic similarity, so a query
    phrased differently from the stored wording still finds it. Returns only
    id, type, title and summary — call read_node for the full content.
    """
    results = await search_service.search(db.conn, query, limit)
    return [result.model_dump() for result in results]


@mcp.tool
async def read_node(node_id: str) -> dict[str, object] | None:
    """Fetch a node's full Markdown content and its immediate connections."""
    node = await nodes_service.get_node(db.conn, node_id)
    if node is None:
        return None
    connections = await edges_service.list_edges_for_node(db.conn, node_id)
    return {
        "node": node.model_dump(),
        "edges": [edge.model_dump() for edge in connections],
    }


@mcp.tool
async def traverse_graph(node_id: str, depth: int = 1) -> dict[str, list[str]]:
    """Walk N steps outward to build a localized structural map."""
    return await edges_service.traverse_graph(db.conn, node_id, depth)


@mcp.tool
async def add_memory(
    title: str,
    summary: str,
    content: str,
    type: str,
    linked_to: list[str] | None = None,
    tags: list[str] | None = None,
    files: list[str] | None = None,
    sources: list[str] | None = None,
    status: str | None = None,
    target_date: str | None = None,
) -> dict[str, object]:
    """Persist a new memory, its tags, and optional edges to existing nodes.

    An unrecognized `type` is registered automatically rather than rejected;
    call list_types() first to reuse the existing vocabulary where it fits.

    `files` are paths on this machine, copied into the daemon's own store.
    Mention one from `content` as `[[file:NAME]]` and the canvas renders it
    where you wrote it, as something the reader can open.

    `sources` are the URLs this memory was written from, cited in order and
    referred to from `content` as `[[src:1]]`. Use cite_source instead when you
    have the page's title and the line you took from it — those are what make a
    citation worth following.

    `status` (todo, doing, done, dropped) and `target_date` (YYYY-MM-DD) mark a
    memory as work with a state. Set them on plans and issues, and leave them
    off everything else — a fact is not "todo". Memories carrying a status
    appear on the roadmap.
    """
    node = await nodes_service.create_node(
        db.conn,
        NodeCreate(
            type=type,
            title=title,
            summary=summary,
            content=content,
            tags=tags or [],
            status=status,  # type: ignore[arg-type]
            target_date=target_date,
        ),
    )

    attached = []
    for source in files or []:
        try:
            attached.append(await files_service.attach_path(db.conn, node.id, source))
        except (FileNotFoundError, files_service.FileTooLarge):
            # One unreachable path must not lose the memory that was just
            # written. The response says what was stored; the caller can see
            # what is missing from it.
            logger.warning("Could not attach %s to %s", source, node.id)

    cited = []
    for url in sources or []:
        try:
            cited.append(
                await sources_service.cite(db.conn, node.id, SourceCreate(url=url))
            )
        except sources_service.UnusableSource:
            logger.warning("Ignoring unusable source %s on %s", url, node.id)

    created = [
        await edges_service.create_edge(
            db.conn,
            EdgeCreate(
                source_id=node.id, target_id=target_id, relation_type="relates_to"
            ),
        )
        for target_id in linked_to or []
    ]

    # Re-read so the broadcast and the response carry the attachments.
    stored = await nodes_service.get_node(db.conn, node.id) or node
    await broadcast_new_node(stored, created)
    return {
        "node": stored.model_dump(mode="json"),
        "edges": [edge.model_dump() for edge in created],
        "files": [item.model_dump(mode="json") for item in attached],
        "sources": [item.model_dump(mode="json") for item in cited],
    }


@mcp.tool
async def set_status(
    node_id: str, status: str, target_date: str | None = None
) -> dict[str, object] | None:
    """Mark where a piece of work stands: todo, doing, done or dropped.

    The operation worth its own tool, because it is the one an agent performs
    while doing something else — finishing a task should cost one call, not a
    read and a general update.

    `dropped` rather than deleting: what was decided against, and why, is worth
    as much later as what was done. Returns None if the memory does not exist.
    """
    node = await nodes_service.update_node(
        db.conn,
        node_id,
        NodeUpdate.model_validate(
            {"status": status, **({"target_date": target_date} if target_date else {})}
        ),
    )
    if node is None:
        return None

    await broadcast_node_updated(node)
    return {"node": node.model_dump(mode="json")}


@mcp.tool
async def read_roadmap() -> list[dict[str, str | None]]:
    """Every memory carrying a status, soonest first.

    The cheap read for "what is in flight" — id, title, status and target date
    only. Follow up with read_node on whichever one matters.
    """
    return await nodes_service.list_roadmap(db.conn)


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


@mcp.tool
async def detach_file(file_id: str) -> dict[str, object]:
    """Remove an attachment from its memory, deleting the stored copy."""
    record = await files_service.get_file(db.conn, file_id)
    deleted = await files_service.delete_file(db.conn, file_id)

    if deleted and record is not None:
        await _announce(record.node_id)
    return {"deleted": deleted, "file_id": file_id}


@mcp.tool
async def update_memory(
    node_id: str,
    title: str | None = None,
    summary: str | None = None,
    content: str | None = None,
    type: str | None = None,
    tags: list[str] | None = None,
    status: str | None = None,
    target_date: str | None = None,
) -> dict[str, object] | None:
    """Correct an existing memory. Omitted fields are left untouched.

    Passing `tags` replaces the whole set, so send the full list rather than
    just the additions. Returns None if the memory no longer exists.
    """
    patch = NodeUpdate.model_validate(
        {
            key: value
            for key, value in {
                "title": title,
                "summary": summary,
                "content": content,
                "type": type,
                "tags": tags,
                "status": status,
                "target_date": target_date,
            }.items()
            if value is not None
        }
    )

    node = await nodes_service.update_node(db.conn, node_id, patch)
    if node is None:
        return None

    await broadcast_node_updated(node)
    return {"node": node.model_dump()}


@mcp.tool
async def delete_memory(node_id: str) -> dict[str, object]:
    """Remove a memory and every edge touching it.

    Use this for memories that turned out to be wrong; a store you cannot
    correct accumulates confidently stated mistakes.
    """
    deleted = await nodes_service.delete_node(db.conn, node_id)
    if deleted:
        await broadcast_node_deleted(node_id)
    return {"deleted": deleted, "node_id": node_id}


@mcp.tool
async def link_memories(
    source_id: str,
    target_id: str,
    relation_type: str = "relates_to",
    weight: float = 1.0,
) -> dict[str, object]:
    """Connect two existing memories."""
    edge = await edges_service.create_edge(
        db.conn,
        EdgeCreate(
            source_id=source_id,
            target_id=target_id,
            relation_type=relation_type,  # type: ignore[arg-type]
            weight=weight,
        ),
    )
    return {"edge": edge.model_dump()}


@mcp.tool
async def unlink_memories(edge_id: str) -> dict[str, object]:
    """Remove a connection between two memories, leaving both in place."""
    return {"deleted": await edges_service.delete_edge(db.conn, edge_id)}
