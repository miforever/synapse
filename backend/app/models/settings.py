"""User-owned rendering preferences.

Memory content is agent-authored, so what the canvas is willing to load from
it is the user's decision rather than the writing agent's. These switches are
the single source of truth for every connected client.
"""

from pydantic import BaseModel, Field


class MediaSettings(BaseModel):
    images: bool = True
    # Off by default: audio and video render as a click-to-load placeholder
    # instead of pulling media the moment a node is opened.
    audio: bool = False
    video: bool = False
    # When false, only same-origin and data URLs load; remote hosts are shown
    # as plain links so opening a memory never phones out.
    remote_sources: bool = False


class Settings(BaseModel):
    media: MediaSettings = Field(default_factory=MediaSettings)


class SettingsPatch(BaseModel):
    """Partial update; omitted fields keep their stored value."""

    media: MediaSettings | None = None
