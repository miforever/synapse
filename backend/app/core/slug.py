import re

_INVALID = re.compile(r"[^a-z0-9_-]+")
_DASHES = re.compile(r"[-_]{2,}")


def slugify(value: str) -> str:
    """Normalize a type/tag name so vocabulary stays consistent.

    'Task', ' task ', and 'TASK' all collapse to 'task', which keeps agents
    from minting near-duplicate classes for the same concept.
    """
    slug = _INVALID.sub("_", value.strip().lower())
    slug = _DASHES.sub("_", slug).strip("_-")
    if not slug:
        raise ValueError(f"{value!r} does not contain any usable characters")
    return slug
