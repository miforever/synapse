"""Persistence for user preferences.

Stored as one JSON blob per key so adding a preference never needs a
migration — unknown keys simply fall back to the model defaults.
"""

import json

import aiosqlite

from app.core.identifiers import utcnow_iso
from app.core.queries import fetch_one
from app.models.settings import Settings, SettingsPatch

# The `key` column doubles as a scope. Today there is exactly one scope; if
# this ever grows per-workspace settings, that becomes the tenant id without
# a schema change.
DEFAULT_SCOPE = "app"

_GET = "SELECT value FROM settings WHERE key = ?"
_UPSERT = """
INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                               updated_at = excluded.updated_at
"""


async def get_settings(
    conn: aiosqlite.Connection, scope: str = DEFAULT_SCOPE
) -> Settings:
    row = await fetch_one(conn, _GET, (scope,))
    if row is None:
        return Settings()
    return Settings.model_validate(json.loads(row["value"]))


async def update_settings(
    conn: aiosqlite.Connection,
    patch: SettingsPatch,
    scope: str = DEFAULT_SCOPE,
) -> Settings:
    current = await get_settings(conn, scope)
    merged = current.model_copy(
        update=patch.model_dump(exclude_none=True, exclude_unset=True)
    )
    await conn.execute(_UPSERT, (scope, merged.model_dump_json(), utcnow_iso()))
    await conn.commit()
    return merged
