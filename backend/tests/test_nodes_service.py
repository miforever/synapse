import aiosqlite

from app.models.edges import EdgeCreate
from app.models.nodes import NodeCreate
from app.services.edges import create_edge, list_edges_for_node, traverse_graph
from app.services.nodes import create_node, get_node, search_index


async def test_create_and_get_node(conn: aiosqlite.Connection) -> None:
    node = await create_node(
        conn,
        NodeCreate(type="idea", title="Test Idea", summary="A short summary"),
    )
    fetched = await get_node(conn, node.id)
    assert fetched is not None
    assert fetched.title == "Test Idea"
    assert fetched.type == "idea"


async def test_search_index_finds_node(conn: aiosqlite.Connection) -> None:
    await create_node(
        conn,
        NodeCreate(
            type="project",
            title="Synapse Daemon",
            summary="Local-first memory graph",
            content="Runs on aiosqlite with FTS5 search",
        ),
    )
    results = await search_index(conn, "aiosqlite")
    assert len(results) == 1
    assert results[0].title == "Synapse Daemon"


async def test_create_edge_and_traverse(conn: aiosqlite.Connection) -> None:
    a = await create_node(conn, NodeCreate(type="idea", title="A", summary="Node A"))
    b = await create_node(conn, NodeCreate(type="idea", title="B", summary="Node B"))
    await create_edge(
        conn, EdgeCreate(source_id=a.id, target_id=b.id, relation_type="relates_to")
    )

    a_edges = await list_edges_for_node(conn, a.id)
    assert len(a_edges) == 1

    reachable = await traverse_graph(conn, a.id, depth=1)
    assert reachable[a.id] == [b.id]


async def test_edge_cascade_delete_on_node_removal(conn: aiosqlite.Connection) -> None:
    a = await create_node(conn, NodeCreate(type="idea", title="A", summary="Node A"))
    b = await create_node(conn, NodeCreate(type="idea", title="B", summary="Node B"))
    await create_edge(
        conn, EdgeCreate(source_id=a.id, target_id=b.id, relation_type="relates_to")
    )

    await conn.execute("DELETE FROM nodes WHERE id = ?", (a.id,))
    await conn.commit()

    remaining = await list_edges_for_node(conn, b.id)
    assert remaining == []
