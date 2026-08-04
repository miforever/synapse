from fastapi import APIRouter

from app.api.routes import graph, health, settings

router = APIRouter()
router.include_router(health.router)
router.include_router(graph.router)
router.include_router(settings.router)
