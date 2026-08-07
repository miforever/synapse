from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.database import db
from app.models.files import FileOut
from app.models.sources import SourceCreate, SourceOut
from app.services import files as files_service
from app.services import nodes as nodes_service
from app.services import sources as sources_service
from app.ws.events import broadcast_node_updated

router = APIRouter(tags=["attachments"])


@router.post("/nodes/{node_id}/files", status_code=201)
async def attach_file(node_id: str, upload: UploadFile) -> FileOut:
    """Attach a file to a memory, keeping a copy in the daemon's own store."""
    node = await nodes_service.get_node(db.conn, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

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

    # Every open canvas redraws the memory with its new attachment, the same
    # way it would for any other edit.
    updated = await nodes_service.get_node(db.conn, node_id)
    if updated is not None:
        await broadcast_node_updated(updated)
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

    node = await nodes_service.get_node(db.conn, record.node_id)
    if node is not None:
        await broadcast_node_updated(node)


@router.post("/nodes/{node_id}/sources", status_code=201)
async def cite_source(node_id: str, source: SourceCreate) -> SourceOut:
    """Record where a memory's claims came from."""
    if await nodes_service.get_node(db.conn, node_id) is None:
        raise HTTPException(status_code=404, detail="Node not found")

    try:
        cited = await sources_service.cite(db.conn, node_id, source)
    except sources_service.UnusableSource as bad:
        raise HTTPException(
            status_code=422,
            detail="A source must be an http(s) URL a reader can open",
        ) from bad

    node = await nodes_service.get_node(db.conn, node_id)
    if node is not None:
        await broadcast_node_updated(node)
    return cited


@router.delete("/sources/{source_id}", status_code=204)
async def remove_source(source_id: str) -> None:
    record = await sources_service.get_source(db.conn, source_id)
    if record is None or not await sources_service.delete_source(db.conn, source_id):
        raise HTTPException(status_code=404, detail="Source not found")

    node = await nodes_service.get_node(db.conn, record.node_id)
    if node is not None:
        await broadcast_node_updated(node)
