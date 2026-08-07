from fastapi import APIRouter

from app.api.routes import attachments, graph, health, layout, settings

router = APIRouter()
router.include_router(health.router)
router.include_router(graph.router)
router.include_router(attachments.router)
router.include_router(layout.router)
router.include_router(settings.router)
