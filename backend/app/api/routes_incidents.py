from __future__ import annotations

import datetime as dt
import io
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
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
                "zone": r.zone,
                "group_id": r.group_id,
                "is_additional_angle": bool(r.group_id and r.group_id != r.incident_id),
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "escalated_at": r.escalated_at.isoformat() if r.escalated_at else None,
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
        "zone": row.zone,
        "group_id": row.group_id,
        "is_additional_angle": bool(row.group_id and row.group_id != row.incident_id),
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "escalated_at": row.escalated_at.isoformat() if row.escalated_at else None,
        # every camera angle belonging to the same physical event
        "angles": [
            {
                "incident_id": a.incident_id,
                "source_id": a.source_id,
                "location": a.location,
                "has_snapshot": bool(a.snapshot_path),
                "started_at": a.started_at.isoformat() if a.started_at else None,
            }
            for a in (
                (
                    await session.scalars(
                        select(Incident)
                        .where(Incident.group_id == row.group_id, Incident.incident_id != row.incident_id)
                        .order_by(Incident.started_at)
                    )
                ).all()
                if row.group_id
                else []
            )
        ],
        "timeline": [{"ts": e.ts.isoformat(), "label": e.label, "detail": e.detail} for e in events],
    }


@router.post("/{incident_id}/review")
async def mark_reviewed(incident_id: str, session: AsyncSession = Depends(get_session)):
    """Persist the operator's acknowledgement (stops the escalation timer)."""
    row = await session.scalar(select(Incident).where(Incident.incident_id == incident_id))
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    if row.reviewed_at is None:
        row.reviewed_at = dt.datetime.now(dt.timezone.utc)
        # reviewing the leader also reviews its other camera angles
        if row.group_id == row.incident_id:
            angles = (
                await session.scalars(select(Incident).where(Incident.group_id == row.group_id))
            ).all()
            for a in angles:
                if a.reviewed_at is None:
                    a.reviewed_at = row.reviewed_at
        await session.commit()
    return {"incident_id": incident_id, "reviewed_at": row.reviewed_at.isoformat()}


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


@router.get("/{incident_id}/report.pdf")
async def incident_report_pdf(incident_id: str, session: AsyncSession = Depends(get_session)):
    """One-page incident report: metadata, snapshot, every camera angle of
    the same event, and the full timeline. Suitable for handing to campus
    administration or police."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfgen import canvas as pdf_canvas
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="PDF reports require the 'reportlab' package: pip install reportlab",
        )

    row = await session.scalar(select(Incident).where(Incident.incident_id == incident_id))
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")

    events = (
        await session.scalars(
            select(IncidentEvent).where(IncidentEvent.incident_id == incident_id).order_by(IncidentEvent.ts)
        )
    ).all()
    angles = []
    if row.group_id:
        angles = (
            await session.scalars(
                select(Incident)
                .where(Incident.group_id == row.group_id, Incident.incident_id != row.incident_id)
                .order_by(Incident.started_at)
            )
        ).all()

    buf = io.BytesIO()
    page_w, page_h = A4
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    margin = 18 * mm
    y = page_h - margin

    def line(text: str, size: int = 10, bold: bool = False, color=(0.1, 0.12, 0.16), dy: float = 14):
        nonlocal y
        if y < margin + 30:
            c.showPage()
            y = page_h - margin
        c.setFillColorRGB(*color)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(margin, y, text[:110])
        y -= dy

    # Header band
    c.setFillColorRGB(0.05, 0.09, 0.16)
    c.rect(0, page_h - 32 * mm, page_w, 32 * mm, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, page_h - 16 * mm, "CAMPUS GUARDIAN — INCIDENT REPORT")
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.65, 0.84, 0.9)
    c.drawString(margin, page_h - 23 * mm, f"Incident {row.incident_id}  ·  generated "
                 f"{dt.datetime.now().strftime('%d %b %Y, %I:%M %p')}")
    y = page_h - 42 * mm

    line("INCIDENT SUMMARY", 12, bold=True, dy=18)
    for label, value in [
        ("Incident ID", row.incident_id),
        ("Status", row.state),
        ("Location", row.location),
        ("Camera", row.source_id),
        ("Zone", row.zone or "—"),
        ("Detected at", row.started_at.strftime("%d %b %Y, %I:%M:%S %p") if row.started_at else "—"),
        ("Resolved at", row.resolved_at.strftime("%d %b %Y, %I:%M:%S %p") if row.resolved_at else "—"),
        ("People involved", str(len(row.people_involved or []))),
        ("Peak movement", f"{round(row.peak_movement or 0)} px/frame"),
        ("Closest distance", f"{round(row.min_distance)} px" if row.min_distance is not None else "—"),
        ("Alert delivery", row.telegram_status),
        ("Reviewed", row.reviewed_at.strftime("%d %b %Y, %I:%M %p") if row.reviewed_at else "NOT YET REVIEWED"),
    ]:
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.35, 0.4, 0.47)
        c.drawString(margin, y, label.upper())
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.1, 0.12, 0.16)
        c.drawString(margin + 45 * mm, y, str(value)[:90])
        y -= 13
    y -= 6
    line(f"Description: {row.description}", 9, color=(0.3, 0.33, 0.38), dy=16)

    # Snapshot(s): the primary + every correlated angle
    def draw_snapshot(path: str | None, caption: str):
        nonlocal y
        if not path or not os.path.isfile(path):
            return
        try:
            img = ImageReader(path)
            iw, ih = img.getSize()
            w = page_w - 2 * margin
            h = w * ih / iw
            max_h = 95 * mm
            if h > max_h:
                h, w = max_h, max_h * iw / ih
            if y - h < margin + 20:
                c.showPage()
                y = page_h - margin
            c.drawImage(img, margin, y - h, width=w, height=h, preserveAspectRatio=True)
            y -= h + 4
            c.setFont("Helvetica-Oblique", 8)
            c.setFillColorRGB(0.4, 0.44, 0.5)
            c.drawString(margin, y, caption[:110])
            y -= 16
        except Exception:
            pass

    y -= 4
    line("EVIDENCE SNAPSHOTS", 12, bold=True, dy=18)
    draw_snapshot(row.snapshot_path, f"Primary angle — {row.source_id} ({row.location})")
    for a in angles:
        draw_snapshot(a.snapshot_path, f"Additional angle — {a.source_id} ({a.location}), incident {a.incident_id}")
    if angles:
        line(f"This event was confirmed by {len(angles) + 1} cameras in zone '{row.zone}'.", 9,
             color=(0.3, 0.33, 0.38), dy=16)

    line("TIMELINE", 12, bold=True, dy=18)
    if not events:
        line("No timeline entries recorded.", 9, color=(0.4, 0.44, 0.5))
    for e in events:
        ts = e.ts.strftime("%I:%M:%S %p") if e.ts else ""
        line(f"{ts}   {e.label.replace('_', ' ')}   {('— ' + e.detail) if e.detail else ''}", 9,
             color=(0.2, 0.23, 0.28), dy=12)

    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.55, 0.58, 0.63)
    c.drawString(margin, 12 * mm, "Generated by Campus Guardian — AI-assisted campus safety monitoring. "
                 "Evidence images may have privacy blurring applied.")
    c.save()

    return Response(
        buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{incident_id}_report.pdf"'},
    )
