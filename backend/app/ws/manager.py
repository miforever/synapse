from fastapi import WebSocket


class ConnectionManager:
    """Tracks active /ws/graph clients and broadcasts graph events to them.

    Phase 2 wires broadcast() into add_memory so EVENT_NEW_NODE reaches the
    Next.js canvas in real time; for now this only manages connect/disconnect.
    """

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, event: str, payload: dict[str, object]) -> None:
        message = {"event": event, "payload": payload}
        for connection in list(self._connections):
            await connection.send_json(message)


manager = ConnectionManager()
