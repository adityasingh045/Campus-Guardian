from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_api_key
from app.config import get_settings
from app.db.models import Incident, IncidentEvent
from app.db.session import get_session

router = APIRouter(prefix="/api/incidents", tags=["incidents"], dependencies=[Depends(require_api_key)])


@router.get("")
async def list_incidents(
    limit: int = Query(default=None, ge=1),
    offset: int = Query(default=0, ge=0),
    source_id: str | None = None,
    state: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    settings = get_settings()
    effective_limit = min(limit or settings.alerts_default_page_size, settings.alerts_max_page_size)

    stmt = select(Incident).order_by(Incident.started_at.desc()).offset(offset).limit(effective_limit)
    count_stmt = select(func.count()).select_from(Incident)
    if source_id:
        stmt = stmt.where(Incident.source_id == source_id)
        count_stmt = count_stmt.where(Incident.source_id == source_id)
    if state:
        stmt = stmt.where(Incident.state == state)
        count_stmt = count_stmt.where(Incident.state == state)

    rows = (await session.scalars(stmt)).all()
    total = (await session.execute(count_stmt)).scalar_one()

    active_count = (
        await session.execute(
            select(func.count()).select_from(Incident).where(Incident.resolved_at.is_(None))
        )
    ).scalar_one()

    return {
        "total": total,
        "active_incidents": active_count,
        "limit": effective_limit,
        "offset": offset,
        "items": [
            {
                "incident_id": r.incident_id,
                "source_id": r.source_id,
                "location": r.location,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "state": r.state,
                "people_involved": r.people_involved,
                "peak_movement": r.peak_movement,
                "min_distance": r.min_distance,
                "description": r.description,
                "has_snapshot": bool(r.snapshot_path),
                "telegram_status": r.telegram_status,
            }
            for r in rows
        ],
    }


@router.get("/{incident_id}")
async def get_incident(incident_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.scalar(select(Incident).where(Incident.incident_id == incident_id))
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    events = (
        await session.scalars(
            select(IncidentEvent).where(IncidentEvent.incident_id == incident_id).order_by(IncidentEvent.ts)
        )
    ).all()
    return {
        "incident_id": row.incident_id,
        "source_id": row.source_id,
        "location": row.location,
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
        "state": row.state,
        "people_involved": row.people_involved,
        "peak_movement": row.peak_movement,
        "min_distance": row.min_distance,
        "description": row.description,
        "has_snapshot": bool(row.snapshot_path),
        "telegram_status": row.telegram_status,
        "telegram_attempts": row.telegram_attempts,
        "timeline": [{"ts": e.ts.isoformat(), "label": e.label, "detail": e.detail} for e in events],
    }


@router.get("/{incident_id}/snapshot")
async def get_incident_snapshot(incident_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.scalar(select(Incident).where(Incident.incident_id == incident_id))
    if not row or not row.snapshot_path:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(row.snapshot_path, media_type="image/jpeg")


@router.get("/{incident_id}/clip")
async def get_incident_clip(
    incident_id: str,
    download: bool = False,
    session: AsyncSession = Depends(get_session),
):
    """Serve the annotated evidence clip (pre+post event) written by
    EvidenceCollector. 404 until the post-event window (~10 s) completes."""
    row = await session.scalar(select(Incident).where(Incident.incident_id == incident_id))
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    settings = get_settings()
    clip_path = os.path.join(settings.snapshot_dir, incident_id, "clip.mp4")
    if not os.path.isfile(clip_path):
        raise HTTPException(status_code=404, detail="Evidence clip not ready yet")
    return FileResponse(
        clip_path,
        media_type="video/mp4",
        filename=f"{incident_id}_evidence.mp4" if download else None,
    )