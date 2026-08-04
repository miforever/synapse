"""Search must survive whatever a user types into the box."""

import aiosqlite
import pytest

from app.models.nodes import NodeCreate
from app.services.nodes import build_fts_query, create_node, search_index


@pytest.fixture
async def seeded(conn: aiosqlite.Connection) -> aiosqlite.Connection:
    await create_node(
        conn,
        NodeCreate(
            type="project",
            title="SYNAPSE",
            summary="Local-first memory graph",
            content="Runs on aiosqlite with FTS5",
        ),
    )
    await create_node(
        conn,
        NodeCreate(type="person", title="Ada", summary="Writes the canvas code"),
    )
    return conn


async def test_prefix_match(seeded: aiosqlite.Connection) -> None:
    """Search-as-you-type: a partial word should still find the node."""
    results = await search_index(seeded, "syn")
    assert [r.title for r in results] == ["SYNAPSE"]


async def test_multi_term_narrows(seeded: aiosqlite.Connection) -> None:
    assert len(await search_index(seeded, "memory graph")) == 1


async def test_no_match_returns_empty(seeded: aiosqlite.Connection) -> None:
    assert await search_index(seeded, "zzzznothing") == []


@pytest.mark.parametrize(
    "raw",
    ['"', 'unbalanced "quote', "AND", "OR NOT", "*", "foo*", "a:b", "(", "-x", "^"],
)
async def test_hostile_input_does_not_raise(
    seeded: aiosqlite.Connection, raw: str
) -> None:
    """Raw FTS5 syntax in the box must not surface as a 500."""
    await search_index(seeded, raw)


async def test_blank_query_returns_empty(seeded: aiosqlite.Connection) -> None:
    assert await search_index(seeded, "   ") == []


def test_build_fts_query_quotes_and_prefixes() -> None:
    assert build_fts_query("memory graph") == '"memory"* "graph"*'


def test_build_fts_query_strips_syntax() -> None:
    assert build_fts_query('AND "quoted"') == '"AND"* "quoted"*'
