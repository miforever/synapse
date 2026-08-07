"""Incremental graph reads — what a cached client is told changed."""

import asyncio

import aiosqlite

from app.canvas.graph import get_snapshot
from app.memories.edges import create_edge
from app.memories.models import EdgeCreate, NodeCreate, NodeUpdate
from app.memories.nodes import create_node, delete_node, update_node


async def _memory(conn: aiosqlite.Connection, title: str) -> str:
    node = await create_node(conn, NodeCreate(type="idea", title=title, summary="s"))
    return node.id


async def _tick() -> None:
    """Let the clock move.

    Timestamps are millisecond-resolution, and a delta asks for what happened
    strictly after a moment — so two writes inside the same millisecond are
    indistinguishable, in the tests as in life.
    """
    await asyncio.sleep(0.005)


async def test_a_full_read_says_so(conn: aiosqlite.Connection) -> None:
    await _memory(conn, "one")
    snapshot = await get_snapshot(conn)

    assert snapshot.complete is True
    assert snapshot.deleted == []
    assert snapshot.as_of


async def test_a_delta_carries_only_what_changed(
    conn: aiosqlite.Connection,
) -> None:
    await _memory(conn, "before")
    first = await get_snapshot(conn)
    await _tick()

    await _memory(conn, "after")
    delta = await get_snapshot(conn, since=first.as_of)

    assert delta.complete is False
    assert [node.title for node in delta.nodes] == ["after"]


async def test_an_edit_puts_a_memory_back_in_the_delta(
    conn: aiosqlite.Connection,
) -> None:
    """Edits are why the window is on updated_at rather than created_at."""
    node_id = await _memory(conn, "original")
    seen = await get_snapshot(conn)
    await _tick()

    await update_node(conn, node_id, NodeUpdate(title="corrected"))
    delta = await get_snapshot(conn, since=seen.as_of)

    assert [node.title for node in delta.nodes] == ["corrected"]


async def test_new_edges_arrive_in_the_delta(conn: aiosqlite.Connection) -> None:
    left = await _memory(conn, "left")
    right = await _memory(conn, "right")
    seen = await get_snapshot(conn)
    await _tick()

    await create_edge(
        conn,
        EdgeCreate(source_id=left, target_id=right, relation_type="relates_to"),
    )
    delta = await get_snapshot(conn, since=seen.as_of)

    assert len(delta.edges) == 1
    assert delta.edges[0].source == left


async def test_a_deleted_memory_is_named_not_merely_absent(
    conn: aiosqlite.Connection,
) -> None:
    """Without this a cached canvas keeps drawing memories that are gone."""
    node_id = await _memory(conn, "doomed")
    seen = await get_snapshot(conn)
    await _tick()

    await delete_node(conn, node_id)
    delta = await get_snapshot(conn, since=seen.as_of)

    assert delta.deleted == [node_id]
    assert delta.nodes == []


async def test_nothing_changed_means_an_empty_delta(
    conn: aiosqlite.Connection,
) -> None:
    await _memory(conn, "settled")
    seen = await get_snapshot(conn)
    await _tick()

    delta = await get_snapshot(conn, since=seen.as_of)
    assert (delta.nodes, delta.edges, delta.deleted) == ([], [], [])


async def test_deltas_chain_without_losing_a_write(
    conn: aiosqlite.Connection,
) -> None:
    """Each `as_of` has to pick up exactly where the last one left off."""
    seen = await get_snapshot(conn)
    titles = []

    for index in range(3):
        await _tick()
        await _memory(conn, f"memory {index}")
        delta = await get_snapshot(conn, since=seen.as_of)
        titles.extend(node.title for node in delta.nodes)
        seen = delta

    assert titles == ["memory 0", "memory 1", "memory 2"]


async def test_a_full_read_reports_no_tombstones(
    conn: aiosqlite.Connection,
) -> None:
    """A client with no cache has nothing to reconcile, so it is told nothing."""
    node_id = await _memory(conn, "doomed")
    await delete_node(conn, node_id)

    snapshot = await get_snapshot(conn)
    assert snapshot.deleted == []
    assert snapshot.nodes == []
