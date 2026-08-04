from collections.abc import AsyncIterator

import aiosqlite
import pytest_asyncio

from app.core.database import init_db


@pytest_asyncio.fixture
async def conn() -> AsyncIterator[aiosqlite.Connection]:
    connection = await init_db(":memory:")
    try:
        yield connection
    finally:
        await connection.close()
