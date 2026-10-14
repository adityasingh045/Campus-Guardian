from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    return {"service": "campus-guardian", "status": "ok", "version": "2.0.0"}


@router.get("/api/health")
async def health(request: Request):
    """
    FIX (multi-source): aggregates liveness across every registered source
    instead of one engine, so a monitoring system can tell "process up" from
    "N of M sources are actually producing frames".
    """
    source_manager = getattr(request.app.state, "source_manager", None)
    if source_manager is None:
        return {"status": "starting"}

    statuses = source_manager.all_statuses()
    settings = request.app.state.settings

    online = sum(1 for s in statuses if s.status.value == "online")
    errored = [s.source_id for s in statuses if s.status.value == "error"]
    stalled = [
        s.source_id
        for s in statuses
        if s.last_frame_age_seconds is not None and s.last_frame_age_seconds > settings.engine_stale_frame_seconds
    ]

    overall = "ok"
    if errored:
        overall = "degraded"
    if online == 0 and statuses:
        overall = "down"

    return {
        "status": overall,
        "sources_total": len(statuses),
        "sources_online": online,
        "sources_errored": errored,
        "sources_stalled": stalled,
        "ws_connected_clients": request.app.state.ws_manager.connected_count,
        "sources": [s.to_dict() for s in statuses],
    }
