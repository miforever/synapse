"""Shared bases for the models the API returns.

Every stored record carries when it was written and when it last changed, and
declaring that pair on each model separately is how two of them end up
disagreeing about the type or the name. One base, inherited.
"""

from datetime import datetime

from pydantic import BaseModel


class TimestampedModel(BaseModel):
    """A record with creation and modification times.

    Both are set by the database — the column defaults and the update path own
    them — so nothing constructing one of these is expected to supply them.
    """

    created_at: datetime
    updated_at: datetime


class CreatedModel(BaseModel):
    """A record that is written once and never edited in place.

    An attachment is replaced rather than modified: its bytes are what they
    were when they were stored. Carrying an `updated_at` that could only ever
    equal `created_at` would be a field that means nothing.
    """

    created_at: datetime
