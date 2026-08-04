from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import router as api_router
from app.core.config import settings
from app.core.database import db
from app.mcp.server import mcp
from app.ws.routes import router as ws_router

# path="/" keeps the endpoint at /mcp once mounted, rather than /mcp/mcp.
mcp_app = mcp.http_app(path="/")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await db.connect(settings.db_path)
    try:
        # The MCP app carries its own lifespan; without running it the
        # streamable-HTTP session manager never starts and every agent
        # request fails with an uninitialized task group.
        async with mcp_app.lifespan(app):
            yield
    finally:
        await db.disconnect()


def create_app() -> FastAPI:
    app = FastAPI(title="SYNAPSE", lifespan=lifespan)
    app.include_router(api_router)
    app.include_router(ws_router)
    app.mount("/mcp", mcp_app)
    return app


app = create_app()
