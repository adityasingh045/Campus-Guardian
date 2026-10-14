"""
FIX (security): everything except /api/health now requires an API key.

REST: header `X-API-Key: <key>`.
WebSocket: browsers can't set custom headers on the WS handshake, so the
client passes it as a query param `?key=...`; we validate it before
`accept()`-ing the connection and close with code 4401 if it's wrong.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, WebSocket, status

from app.config import get_settings


def _valid_key(candidate: str | None) -> bool:
    settings = get_settings()
    if settings.allow_no_auth and not settings.api_key:
        return True
    if not candidate or not settings.api_key:
        return False
    # constant-time compare to avoid timing side-channels on the key check
    return hmac.compare_digest(candidate, settings.api_key)


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not _valid_key(x_api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")


async def require_ws_api_key(websocket: WebSocket) -> bool:
    """Returns True if authorized. Caller is responsible for closing the socket if False."""
    candidate = websocket.query_params.get("key")
    return _valid_key(candidate)
