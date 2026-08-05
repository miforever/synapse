"""Local text embeddings.

Runs ONNX on the CPU through fastembed. The model is fetched from HuggingFace
once and cached on disk; nothing leaves the machine afterwards, which keeps the
daemon usable offline and means memory content is never sent anywhere.

Loading is deferred until the first embedding is requested, so importing the
app — as tests and the CI import check do — never pulls a multi-gigabyte
download.
"""

import asyncio
from typing import Protocol

from app.core.config import settings


class Embedder(Protocol):
    """The surface the search layer needs, so tests can substitute a stub."""

    @property
    def dim(self) -> int: ...

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class FastEmbedEmbedder:
    """fastembed-backed embedder for the e5 family.

    e5 models are trained with asymmetric prefixes — stored text is a
    "passage", the thing you search with is a "query". Omitting them measurably
    degrades retrieval, so they are applied here rather than left to callers.
    """

    def __init__(self, model_name: str, dim: int) -> None:
        self._model_name = model_name
        self._dim = dim
        self._model: object | None = None

    @property
    def dim(self) -> int:
        return self._dim

    def _load(self) -> object:
        if self._model is None:
            from fastembed import TextEmbedding

            self._model = TextEmbedding(model_name=self._model_name)
        return self._model

    def _embed(self, texts: list[str]) -> list[list[float]]:
        model = self._load()
        # fastembed yields numpy arrays; SQLite wants plain floats.
        return [list(map(float, vector)) for vector in model.embed(texts)]  # type: ignore[attr-defined]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return self._embed([f"passage: {text}" for text in texts])

    def embed_query(self, text: str) -> list[float]:
        return self._embed([f"query: {text}"])[0]


_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = FastEmbedEmbedder(settings.embedding_model, settings.embedding_dim)
    return _embedder


def set_embedder(embedder: Embedder | None) -> None:
    """Swap the embedder. Tests use this to avoid downloading a real model."""
    global _embedder
    _embedder = embedder


async def embed_document(text: str) -> list[float]:
    """Embed stored text off the event loop.

    Inference takes long enough that running it inline would stall the
    WebSocket broadcasts and HTTP handlers sharing this loop.
    """
    embedder = get_embedder()
    vectors = await asyncio.to_thread(embedder.embed_documents, [text])
    return vectors[0]


async def embed_query(text: str) -> list[float]:
    embedder = get_embedder()
    return await asyncio.to_thread(embedder.embed_query, text)
