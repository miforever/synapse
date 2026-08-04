import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Tracks active /ws/graph clients and fans graph events out to them."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    @property
    def count(self) -> int:
        return len(self._connections)

    async def broadcast(self, event: str, payload: dict[str, object]) -> None:
        """Send to every client, dropping any that have gone away.

        A write is never allowed to fail because a canvas closed its tab, so
        send errors evict the socket instead of propagating to the caller.
        """
        message = {"event": event, "payload": payload}
        for connection in list(self._connections):
            try:
                await connection.send_json(message)
            except Exception:
                logger.debug("Dropping dead websocket connection", exc_info=True)
                self.disconnect(connection)


manager = ConnectionManager()
