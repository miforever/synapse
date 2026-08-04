"""Assembles the MCP surface.

Importing the tool modules is what registers them against the instance.
"""

from app.mcp.instance import mcp
from app.mcp.tools import memory, vocabulary

__all__ = ["mcp", "memory", "vocabulary"]
