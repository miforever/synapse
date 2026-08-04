"""Reusable annotated field types shared across the model modules."""

from typing import Annotated, Literal

from pydantic import BeforeValidator, Field

from app.core.slug import slugify

# `type` and tags are open vocabularies backed by lookup tables rather than
# closed enums, so agents can register new terms at runtime. Slugifying on the
# way in keeps 'Task'/'task'/'TASK' from becoming three distinct entries.
NodeType = Annotated[str, BeforeValidator(slugify), Field(max_length=40)]
TagName = Annotated[str, BeforeValidator(slugify), Field(max_length=40)]

# Relations stay closed — they define graph semantics, not vocabulary.
RelationType = Literal["depends_on", "relates_to", "blocks", "part_of"]

Title = Annotated[str, Field(max_length=100)]
Summary = Annotated[str, Field(max_length=250)]
Weight = Annotated[float, Field(ge=0.0, le=1.0)]
