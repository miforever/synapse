import aiosqlite

from app.canvas.layout import clear_layout, get_layout, save_layout
from app.canvas.models import Position
from app.memories.models import NodeCreate
from app.memories.nodes import create_node


async def test_layout_is_empty_until_something_is_placed(
    conn: aiosqlite.Connection,
) -> None:
    layout = await get_layout(conn, "3d")
    assert layout.positions == {}


async def test_saved_positions_round_trip(conn: aiosqlite.Connection) -> None:
    node = await create_node(conn, NodeCreate(type="idea", title="A", summary="s"))

    await save_layout(conn, "3d", {node.id: Position(x=1.5, y=-2.0, z=3.25)})
    layout = await get_layout(conn, "3d")

    assert layout.positions[node.id].x == 1.5
    assert layout.positions[node.id].z == 3.25


async def test_modes_keep_separate_arrangements(conn: aiosqlite.Connection) -> None:
    """2D and 3D lay out differently, so one must never overwrite the other."""
    node = await create_node(conn, NodeCreate(type="idea", title="A", summary="s"))

    await save_layout(conn, "3d", {node.id: Position(x=1, y=1, z=1)})
    await save_layout(conn, "2d", {node.id: Position(x=9, y=9)})

    assert (await get_layout(conn, "3d")).positions[node.id].x == 1
    two_d = (await get_layout(conn, "2d")).positions[node.id]
    assert two_d.x == 9
    # No depth in the 2D canvas.
    assert two_d.z is None


async def test_positions_for_deleted_memories_are_dropped(
    conn: aiosqlite.Connection,
) -> None:
    """Otherwise a long-lived graph accumulates positions for nothing."""
    node = await create_node(conn, NodeCreate(type="idea", title="A", summary="s"))

    saved = await save_layout(
        conn,
        "3d",
        {
            node.id: Position(x=1, y=1, z=1),
            "gone": Position(x=2, y=2, z=2),
        },
    )

    assert set(saved.positions) == {node.id}
    assert set((await get_layout(conn, "3d")).positions) == {node.id}


async def test_saving_replaces_rather_than_merges(conn: aiosqlite.Connection) -> None:
    """Unpinning a memory has to actually remove it, not leave the old spot."""
    a = await create_node(conn, NodeCreate(type="idea", title="A", summary="s"))
    b = await create_node(conn, NodeCreate(type="idea", title="B", summary="s"))

    await save_layout(
        conn, "3d", {a.id: Position(x=1, y=1, z=1), b.id: Position(x=2, y=2, z=2)}
    )
    await save_layout(conn, "3d", {a.id: Position(x=5, y=5, z=5)})

    layout = await get_layout(conn, "3d")
    assert set(layout.positions) == {a.id}
    assert layout.positions[a.id].x == 5


async def test_clearing_forgets_the_arrangement(conn: aiosqlite.Connection) -> None:
    node = await create_node(conn, NodeCreate(type="idea", title="A", summary="s"))
    await save_layout(conn, "3d", {node.id: Position(x=1, y=1, z=1)})

    await clear_layout(conn, "3d")

    assert (await get_layout(conn, "3d")).positions == {}
