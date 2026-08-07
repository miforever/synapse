"""Every route the canvas and any HTTP client can reach.

Assembled from the feature packages rather than from a routes directory: a
package owns its own endpoints, and this is the one place that says which of
them the daemon serves.
"""

from fastapi import APIRouter

from app.api.routes import health
from app.attachments.routes import router as attachments_router
from app.canvas.routes import router as canvas_router
from app.memories.routes import router as memories_router
from app.search.routes import router as search_router

router = APIRouter()
router.include_router(health.router)
router.include_router(canvas_router)
router.include_router(memories_router)
router.include_router(search_router)
router.include_router(attachments_router)
