import asyncio
import json

from app.services.ws_manager import WebSocketManager


def test_video_frame_does_not_evict_pending_incident_event():
    manager = WebSocketManager(max_connections=2, client_queue_size=1)
    q = asyncio.Queue(maxsize=1)
    q.put_nowait(json.dumps({"type": "incident", "incident_id": "INC-1"}))

    manager._enqueue_dropping_oldest(q, json.dumps({"type": "frame", "source_id": "CAM-1"}))

    message = json.loads(q.get_nowait())
    assert message["type"] == "incident"
    assert message["incident_id"] == "INC-1"


def test_incident_event_replaces_stale_video_frame():
    manager = WebSocketManager(max_connections=2, client_queue_size=1)
    q = asyncio.Queue(maxsize=1)
    q.put_nowait(json.dumps({"type": "frame", "source_id": "CAM-1"}))

    manager._enqueue_dropping_oldest(q, json.dumps({"type": "incident", "incident_id": "INC-2"}), is_incident=True)

    message = json.loads(q.get_nowait())
    assert message["type"] == "incident"
    assert message["incident_id"] == "INC-2"
