"""Saved canvas arrangements.

Only memories the user has deliberately placed are stored. Everything else is
re-derived by the simulation on load, which it does well — persisting a full
layout would freeze positions that were never chosen, and leave new memories
arriving into a cold graph with nothing to push them into place.
"""

from typing import Literal

from pydantic import BaseModel, Field

CanvasMode = Literal["2d", "3d"]

# A local graph will not realistically pin this many memories by hand. The cap
# is here so a malformed client cannot write an unbounded blob into the file.
MAX_PINNED = 20_000


class Position(BaseModel):
    x: float
    y: float
    # Absent in 2D, where the canvas has no depth.
    z: float | None = None


class Layout(BaseModel):
    mode: CanvasMode
    positions: dict[str, Position] = Field(default_factory=dict, max_length=MAX_PINNED)


class LayoutUpdate(BaseModel):
    positions: dict[str, Position] = Field(default_factory=dict, max_length=MAX_PINNED)
