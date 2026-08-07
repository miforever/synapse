"""Files attached to memories — the store the daemon keeps for itself."""

import json
from pathlib import Path

import aiosqlite
import pytest

from app.core.config import Settings, _from_file
from app.models.nodes import NodeCreate
from app.services.files import (
    FileTooLarge,
    attach_bytes,
    attach_path,
    delete_file,
    display_name,
    get_file,
    list_for_node,
    purge_for_node,
    resolve_path,
)
from app.services.nodes import create_node, delete_node, get_node


@pytest.fixture(autouse=True)
def store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Keep every test's bytes in its own directory, not the real store."""
    from app.core import config

    monkeypatch.setattr(config.settings, "files_path", str(tmp_path / "files"))
    return tmp_path / "files"


async def _memory(conn: aiosqlite.Connection) -> str:
    node = await create_node(conn, NodeCreate(type="idea", title="Holder", summary="s"))
    return node.id


async def test_attach_stores_the_bytes(conn: aiosqlite.Connection, store: Path) -> None:
    node_id = await _memory(conn)
    attached = await attach_bytes(conn, node_id, "notes.txt", b"hello")

    assert attached.name == "notes.txt"
    assert attached.size == 5
    assert attached.media_type == "text/plain"
    assert attached.url == f"/files/{attached.id}"

    path = await resolve_path(conn, attached.id)
    assert path is not None
    assert path.read_bytes() == b"hello"
    assert path.parent == store


async def test_stored_name_never_follows_the_original(
    conn: aiosqlite.Connection, store: Path
) -> None:
    """A name is data, not a path — the whole point of storing by id."""
    node_id = await _memory(conn)
    attached = await attach_bytes(conn, node_id, "../../etc/passwd", b"x")

    assert attached.name == "passwd"
    path = await resolve_path(conn, attached.id)
    assert path is not None
    assert path.parent == store
    assert attached.id in path.name


def test_display_name_strips_directories_and_control_characters() -> None:
    assert display_name("/tmp/report.pdf") == "report.pdf"
    assert display_name("we\x00ird\x1f.txt") == "weird.txt"
    assert display_name("   ") == "untitled"


async def test_memory_carries_its_attachments(conn: aiosqlite.Connection) -> None:
    node_id = await _memory(conn)
    await attach_bytes(conn, node_id, "a.txt", b"a")
    await attach_bytes(conn, node_id, "b.txt", b"b")

    node = await get_node(conn, node_id)
    assert node is not None
    assert [item.name for item in node.files] == ["a.txt", "b.txt"]


async def test_attach_path_copies_from_disk(
    conn: aiosqlite.Connection, tmp_path: Path
) -> None:
    node_id = await _memory(conn)
    origin = tmp_path / "origin.md"
    origin.write_text("# from disk")

    attached = await attach_path(conn, node_id, str(origin))
    assert attached.name == "origin.md"

    # The copy is the daemon's own: losing the original must not lose the file.
    origin.unlink()
    path = await resolve_path(conn, attached.id)
    assert path is not None
    assert path.read_text() == "# from disk"


async def test_attach_path_rejects_what_is_not_there(
    conn: aiosqlite.Connection, tmp_path: Path
) -> None:
    node_id = await _memory(conn)
    with pytest.raises(FileNotFoundError):
        await attach_path(conn, node_id, str(tmp_path / "missing.txt"))


async def test_oversized_attachment_is_refused(
    conn: aiosqlite.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core import config

    monkeypatch.setattr(config.settings, "max_file_bytes", 4)
    node_id = await _memory(conn)

    with pytest.raises(FileTooLarge):
        await attach_bytes(conn, node_id, "big.bin", b"12345")


async def test_delete_removes_row_and_bytes(conn: aiosqlite.Connection) -> None:
    node_id = await _memory(conn)
    attached = await attach_bytes(conn, node_id, "gone.txt", b"x")
    path = await resolve_path(conn, attached.id)
    assert path is not None

    assert await delete_file(conn, attached.id) is True
    assert await get_file(conn, attached.id) is None
    assert not path.exists()
    assert await delete_file(conn, attached.id) is False


async def test_deleting_a_memory_takes_its_files_with_it(
    conn: aiosqlite.Connection,
) -> None:
    """Rows cascade, bytes do not — without the purge the store only grows."""
    node_id = await _memory(conn)
    attached = await attach_bytes(conn, node_id, "orphan.txt", b"x")
    path = await resolve_path(conn, attached.id)
    assert path is not None

    assert await delete_node(conn, node_id) is True
    assert not path.exists()
    assert await list_for_node(conn, node_id) == []


async def test_purge_tolerates_missing_bytes(conn: aiosqlite.Connection) -> None:
    """Someone clearing the store by hand must not break deleting a memory."""
    node_id = await _memory(conn)
    attached = await attach_bytes(conn, node_id, "vanished.txt", b"x")
    path = await resolve_path(conn, attached.id)
    assert path is not None
    path.unlink()

    await purge_for_node(conn, node_id)
    assert await delete_node(conn, node_id) is True


def test_config_file_loses_to_the_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """config.json is for what you keep; the environment is for this run."""
    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"port": 9999, "files_path": "from_file", "unknown": 1})
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("SYNAPSE_FILES_PATH", "from_env")

    assert _from_file(config_file) == {"port": 9999, "files_path": "from_file"}
    settings = Settings()
    assert settings.port == 9999
    assert settings.files_path == "from_env"


def test_unreadable_config_is_ignored(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A daemon that will not start over a stray comma is worse than defaults."""
    (tmp_path / "config.json").write_text("{ not json")
    monkeypatch.chdir(tmp_path)

    assert Settings().port == 8000
