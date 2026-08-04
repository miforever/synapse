from fastapi import APIRouter

from app.core.database import db
from app.models.settings import Settings, SettingsPatch
from app.services import settings as settings_service

router = APIRouter(tags=["settings"])


@router.get("/settings")
async def read_settings() -> Settings:
    return await settings_service.get_settings(db.conn)


@router.patch("/settings")
async def patch_settings(patch: SettingsPatch) -> Settings:
    return await settings_service.update_settings(db.conn, patch)
