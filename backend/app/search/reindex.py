"""Backfill embeddings for memories written before the semantic index existed.

Run with:  uv run python -m app.cli.reindex

Downloads the model on first use, then works offline. Existing vectors are
replaced, so re-running after changing the model is the way to migrate.
"""

import asyncio

from app.core.database import init_db
from app.core.queries import fetch_all
from app.memories.nodes import embedding_text
from app.search import vectors
from app.search.embeddings import embed_document

_ALL_NODES = "SELECT id, title, summary, content FROM nodes ORDER BY created_at"


async def reindex() -> None:
    conn = await init_db()
    try:
        if not vectors.available(conn):
            print("sqlite-vec is unavailable; nothing to index.")
            return

        rows = await fetch_all(conn, _ALL_NODES)
        if not rows:
            print("No memories to index.")
            return

        print(f"Embedding {len(rows)} memories…")
        for index, row in enumerate(rows, start=1):
            vector = await embed_document(
                embedding_text(row["title"], row["summary"], row["content"])
            )
            await vectors.upsert(conn, row["id"], vector)
            if index % 25 == 0 or index == len(rows):
                await conn.commit()
                print(f"  {index}/{len(rows)}")

        await conn.commit()
        print(f"Done. {await vectors.count(conn)} vectors stored.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(reindex())
