from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.database import db
from app.mcp.server import mcp
from app.ws.manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await db.connect(settings.db_path)
    try:
        yield
    finally:
        await db.disconnect()


app = FastAPI(title="SYNAPSE", lifespan=lifespan)
app.mount("/mcp", mcp.http_app())


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/graph")
async def ws_graph(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
