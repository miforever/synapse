"""What a memory carries: the files attached to it and the sources it cites.

Both are edits to a memory as far as anyone watching is concerned, so every
route here ends the same way — by re-reading the node and broadcasting it, so
open canvases redraw it exactly as they would for a change to its text.
"""

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.attachments import files as files_service
from app.attachments import sources as sources_service
from app.attachments.models import FileOut, SourceCreate, SourceOut
from app.core.database import db
from app.memories import nodes as nodes_service
from app.ws.events import broadcast_node_updated

router = APIRouter(tags=["attachments"])


async def _require_node(node_id: str) -> None:
    if await nodes_service.get_node(db.conn, node_id) is None:
        raise HTTPException(status_code=404, detail="Node not found")


async def _announce(node_id: str) -> None:
    """Tell every open canvas the memory changed.

    Re-read rather than passed in: the caller holds the file or source it just
    wrote, not the memory carrying it, and a broadcast of a stale node would
    have canvases redraw without the very thing that prompted it.
    """
    node = await nodes_service.get_node(db.conn, node_id)
    if node is not None:
        await broadcast_node_updated(node)


@router.post("/nodes/{node_id}/files", status_code=201)
async def attach_file(node_id: str, upload: UploadFile) -> FileOut:
    """Attach a file to a memory, keeping a copy in the daemon's own store."""
    await _require_node(node_id)

    try:
        attached = await files_service.attach_bytes(
            db.conn,
            node_id,
            upload.filename or "untitled",
            await upload.read(),
            upload.content_type,
        )
    except files_service.FileTooLarge as too_large:
        # 413 rather than 400: the request was well formed, it was just bigger
        # than this daemon is willing to store.
        raise HTTPException(status_code=413, detail=str(too_large)) from too_large

    await _announce(node_id)
    return attached


@router.get("/files/{file_id}")
async def read_file(file_id: str) -> FileResponse:
    """Serve an attachment's bytes."""
    record = await files_service.get_file(db.conn, file_id)
    path = await files_service.resolve_path(db.conn, file_id)
    if record is None or path is None:
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path,
        media_type=record.media_type,
        # inline, so images and PDFs open in the tab rather than downloading;
        # filename restores the original name for anyone who saves it.
        filename=record.name,
        content_disposition_type="inline",
    )


@router.delete("/files/{file_id}", status_code=204)
async def remove_file(file_id: str) -> None:
    record = await files_service.get_file(db.conn, file_id)
    if record is None or not await files_service.delete_file(db.conn, file_id):
        raise HTTPException(status_code=404, detail="File not found")

    await _announce(record.node_id)


@router.post("/nodes/{node_id}/sources", status_code=201)
async def cite_source(node_id: str, source: SourceCreate) -> SourceOut:
    """Record where a memory's claims came from."""
    await _require_node(node_id)

    try:
        cited = await sources_service.cite(db.conn, node_id, source)
    except sources_service.UnusableSource as bad:
        raise HTTPException(
            status_code=422,
            detail="A source must be an http(s) URL a reader can open",
        ) from bad

    await _announce(node_id)
    return cited


@router.delete("/sources/{source_id}", status_code=204)
async def remove_source(source_id: str) -> None:
    record = await sources_service.get_source(db.conn, source_id)
    if record is None or not await sources_service.delete_source(db.conn, source_id):
        raise HTTPException(status_code=404, detail="Source not found")

    await _announce(record.node_id)
