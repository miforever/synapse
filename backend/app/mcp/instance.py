"""The FastMCP instance, isolated so tool modules can import it without a cycle."""

from fastmcp import FastMCP

mcp: FastMCP = FastMCP("synapse")
