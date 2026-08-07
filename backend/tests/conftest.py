from collections.abc import AsyncIterator, Iterator

import aiosqlite
import pytest
import pytest_asyncio

from app.core.database import init_db
from app.search.embeddings import set_embedder


@pytest_asyncio.fixture
async def conn() -> AsyncIterator[aiosqlite.Connection]:
    connection = await init_db(":memory:")
    try:
        yield connection
    finally:
        await connection.close()


class StubEmbedder:
    """Deterministic stand-in for the real model.

    Tests must never download a 2.24GB model, and CI must not either. Vectors
    are derived from character counts, which is meaningless semantically but
    stable and — importantly — makes texts sharing vocabulary land near each
    other, so fusion and ranking can still be exercised.
    """

    dim = 1024

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * self.dim
        for token in text.lower().split():
            vector[hash(token) % self.dim] += 1.0
        norm = sum(value * value for value in vector) ** 0.5
        return [value / norm for value in vector] if norm else vector

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


@pytest.fixture(autouse=True)
def stub_embedder() -> Iterator[None]:
    set_embedder(StubEmbedder())
    yield
    set_embedder(None)
