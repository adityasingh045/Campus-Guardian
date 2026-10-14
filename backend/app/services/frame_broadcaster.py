from __future__ import annotations

import asyncio
import base64
import queue

from app.detection.engine import FrameEvent
from app.services.ws_manager import WebSocketManager


class FrameBroadcaster:
    """
    FIX (multi-source): drains a *dict* of per-source frame queues each
    tick instead of one queue, so N sources broadcast concurrently without
    N separate broadcaster tasks. `frame_queues` is looked up live from
    SourceManager each iteration, so sources added/removed at runtime are
    picked up automatically.
    """

    def __init__(self, frame_queues_provider, ws_manager: WebSocketManager, poll_interval: float = 0.02) -> None:
        self.frame_queues_provider = frame_queues_provider  # callable -> dict[str, queue.Queue]
        self.ws_manager = ws_manager
        self.poll_interval = poll_interval
        self._stop = False

    def stop(self) -> None:
        self._stop = True

    async def run(self) -> None:
        while not self._stop:
            had_any = False
            if self.ws_manager.has_clients():
                for source_id, q in list(self.frame_queues_provider().items()):
                    try:
                        event: FrameEvent = q.get_nowait()
                    except queue.Empty:
                        continue
                    had_any = True
                    b64 = base64.b64encode(event.jpeg_bytes).decode("ascii")
                    await self.ws_manager.broadcast_frame(source_id, b64, event.stats, event.ts)
            if not had_any:
                await asyncio.sleep(self.poll_interval)
