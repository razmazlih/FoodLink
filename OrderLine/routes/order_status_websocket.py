from fastapi import WebSocket, WebSocketDisconnect, APIRouter

order_status_ws_router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, order_id: int):
        await websocket.accept()
        self.active_connections.setdefault(order_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, order_id: int):
        connections = self.active_connections.get(order_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self.active_connections.pop(order_id, None)

    async def broadcast(self, order_id: int, message: str):
        for connection in list(self.active_connections.get(order_id, [])):
            try:
                await connection.send_text(message)
            except (WebSocketDisconnect, RuntimeError, OSError):
                self.disconnect(connection, order_id)


manager = ConnectionManager()


@order_status_ws_router.websocket("/ws/order-status/{order_id}")
async def websocket_endpoint(websocket: WebSocket, order_id: int):
    await manager.connect(websocket, order_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, order_id)


async def notify_order_status(order_id: int, status: str):
    await manager.broadcast(order_id, status)
