import uuid
from datetime import UTC, datetime


def new_id() -> str:
    """Primary key for nodes and edges."""
    return str(uuid.uuid4())


def utcnow_iso() -> str:
    """UTC timestamp in the same shape the SQLite column defaults produce."""
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
