import aiosqlite
import pytest

from app.core.slug import slugify
from app.models.nodes import NodeCreate
from app.services.nodes import create_node, get_node
from app.services.tags import find_nodes_by_tag, list_tags, set_tags
from app.services.types import list_types


def test_slugify_normalizes_variants() -> None:
    assert slugify("Task") == "task"
    assert slugify("  TASK  ") == "task"
    assert slugify("Follow Up") == "follow_up"
    assert slugify("bug--report") == "bug_report"


def test_slugify_rejects_empty() -> None:
    with pytest.raises(ValueError):
        slugify("!!!")


async def test_default_types_are_seeded(conn: aiosqlite.Connection) -> None:
    names = set(await list_types(conn))
    assert {"person", "project", "idea", "fact", "object", "place"} <= names


async def test_unknown_type_is_auto_registered(conn: aiosqlite.Connection) -> None:
    node = await create_node(
        conn, NodeCreate(type="Retrospective", title="R", summary="s")
    )
    assert node.type == "retrospective"
    assert "retrospective" in await list_types(conn)


async def test_type_variants_collapse_to_one_class(conn: aiosqlite.Connection) -> None:
    before = len(await list_types(conn))
    for variant in ("Task", "task", " TASK "):
        await create_node(conn, NodeCreate(type=variant, title="T", summary="s"))
    assert len(await list_types(conn)) == before + 1


async def test_tags_round_trip(conn: aiosqlite.Connection) -> None:
    node = await create_node(
        conn,
        NodeCreate(type="idea", title="Tagged", summary="s", tags=["Q3", "roadmap"]),
    )
    assert node.tags == ["q3", "roadmap"]

    fetched = await get_node(conn, node.id)
    assert fetched is not None
    assert fetched.tags == ["q3", "roadmap"]


async def test_find_nodes_by_tag(conn: aiosqlite.Connection) -> None:
    node = await create_node(
        conn, NodeCreate(type="plan", title="P", summary="s", tags=["roadmap"])
    )
    await create_node(conn, NodeCreate(type="fact", title="F", summary="s"))

    assert await find_nodes_by_tag(conn, "roadmap") == [node.id]


async def test_list_tags_reports_usage_counts(conn: aiosqlite.Connection) -> None:
    await create_node(
        conn, NodeCreate(type="idea", title="A", summary="s", tags=["shared", "solo"])
    )
    await create_node(
        conn, NodeCreate(type="idea", title="B", summary="s", tags=["shared"])
    )

    counts = {tag.name: tag.count for tag in await list_tags(conn)}
    assert counts["shared"] == 2
    assert counts["solo"] == 1


async def test_set_tags_replaces_existing(conn: aiosqlite.Connection) -> None:
    node = await create_node(
        conn, NodeCreate(type="idea", title="A", summary="s", tags=["old"])
    )
    await set_tags(conn, node.id, ["new"])
    await conn.commit()

    fetched = await get_node(conn, node.id)
    assert fetched is not None
    assert fetched.tags == ["new"]


async def test_node_tags_cascade_on_node_delete(conn: aiosqlite.Connection) -> None:
    node = await create_node(
        conn, NodeCreate(type="idea", title="A", summary="s", tags=["doomed"])
    )
    await conn.execute("DELETE FROM nodes WHERE id = ?", (node.id,))
    await conn.commit()

    assert await find_nodes_by_tag(conn, "doomed") == []
