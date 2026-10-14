"""
FIX (correctness): the original design implied a single fan-out loop that
awaits `send` on each client in turn. If one client's connection is slow
(bad wifi, backgrounded mobile tab), that `await` stalls the whole
broadcast for every other client too. Each client now gets its own bounded
asyncio.Queue and its own sender task; a full queue means we drop that
client's oldest pending frame rather than blocking the broadcaster.

Also enforces `ws_max_connections` (the original doc listed this as a
security mitigation but never wired it up), and exposes `has_clients()`
for the detection engine to check before it bothers encoding frames.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging

from fastapi import WebSocket

logger = logging.getLogger("campus_guardian.ws")


class WebSocketManager:
    def __init__(self, max_connections: int, client_queue_size: int) -> None:
        self.max_connections = max_connections
        self.client_queue_size = client_queue_size
        self._clients: dict[WebSocket, asyncio.Queue] = {}
        self._sender_tasks: dict[WebSocket, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    def has_clients(self) -> bool:
        return bool(self._clients)

    @property
    def connected_count(self) -> int:
        return len(self._clients)

    async def connect(self, websocket: WebSocket) -> bool:
        async with self._lock:
            if len(self._clients) >= self.max_connections:
                return False
            await websocket.accept()
            q: asyncio.Queue = asyncio.Queue(maxsize=self.client_queue_size)
            self._clients[websocket] = q
            self._sender_tasks[websocket] = asyncio.create_task(self._sender_loop(websocket, q))
            return True

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.pop(websocket, None)
            task = self._sender_tasks.pop(websocket, None)
            if task:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    async def _sender_loop(self, websocket: WebSocket, q: asyncio.Queue) -> None:
        try:
            while True:
                message = await q.get()
                await websocket.send_text(message)
        except Exception:
            # normal on disconnect; connection cleanup happens in the route handler
            pass

    def _enqueue_dropping_oldest(self, q: asyncio.Queue, message: str, *, is_incident: bool = False) -> None:
        if q.full():
            try:
                oldest = q.get_nowait()
            except asyncio.QueueEmpty:
                oldest = None
            # Alert/timeline events outrank video frames. A busy camera must not
            # evict an incident event before the browser has a chance to receive it.
            if oldest is not None and not is_incident:
                try:
                    oldest_type = json.loads(oldest).get("type")
                except (ValueError, AttributeError):
                    oldest_type = None
                if oldest_type == "incident":
                    with contextlib.suppress(asyncio.QueueFull):
                        q.put_nowait(oldest)
                    return
        with contextlib.suppress(asyncio.QueueFull):
            q.put_nowait(message)

    async def broadcast_frame(self, source_id: str, jpeg_b64: str, stats: dict, ts: float) -> None:
        """
        FIX (multi-source, spec section 16): every client connects once to
        /ws/live and receives frames from ALL sources, each tagged with
        source_id, so the dashboard can route each frame to the right
        camera card without opening N separate WebSocket connections.
        """
        if not self._clients:
            return
        payload = json.dumps({"type": "frame", "source_id": source_id, "frame": jpeg_b64, "stats": stats, "ts": ts})
        for q in list(self._clients.values()):
            self._enqueue_dropping_oldest(q, payload, is_incident=False)

    async def broadcast_incident_event(self, kind: str, incident_payload: dict) -> None:
        """kind: 'timeline_update' | 'alert_sent'"""
        if not self._clients:
            return
        payload = json.dumps({"type": "incident", "kind": kind, **incident_payload})
        for q in list(self._clients.values()):
            self._enqueue_dropping_oldest(q, payload, is_incident=True)
