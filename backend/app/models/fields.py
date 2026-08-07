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

# Where a piece of work stands. Closed, like relations and unlike classes:
# these four are the states a roadmap can draw, and a fifth invented at runtime
# would have nowhere to appear.
#
# `dropped` rather than deleting the memory: what you decided not to do, and
# why, is worth as much later as what you did.
Status = Literal["todo", "doing", "done", "dropped"]

# A day, not a timestamp. Plans land on dates; pretending to know the hour is
# false precision that then has to be rendered away again.
TargetDate = Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]

Title = Annotated[str, Field(max_length=100)]
Summary = Annotated[str, Field(max_length=250)]
Weight = Annotated[float, Field(ge=0.0, le=1.0)]
