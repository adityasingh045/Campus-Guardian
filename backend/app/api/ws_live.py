from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.auth import require_ws_api_key

logger = logging.getLogger("campus_guardian.ws_route")

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """
    FIX (security): the original spec had no auth on this route at all --
    it streams a live camera feed of real people, so an unauthenticated
    /ws/live is the most serious gap in the original design. The client
    must now pass ?key=<API_KEY> in the connection URL; we validate it
    before accepting the handshake and close with 4401 if it's wrong,
    rather than accepting first and checking later.
    """
    authorized = await require_ws_api_key(websocket)
    if not authorized:
        await websocket.close(code=4401)
        return

    ws_manager = websocket.app.state.ws_manager
    accepted = await ws_manager.connect(websocket)
    if not accepted:
        await websocket.close(code=4408, reason="Too many connections")
        return

    try:
        while True:
            # We don't expect meaningful client->server messages other than
            # keepalive/pings, but we still need to await *something* so
            # FastAPI notices a disconnect promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error")
    finally:
        await ws_manager.disconnect(websocket)
