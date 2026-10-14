from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Incident(Base):
    """One continuous episode of suspicious activity on one source."""
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    source_id: Mapped[str] = mapped_column(String(64), index=True)
    location: Mapped[str] = mapped_column(String(128))
    started_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), index=True)
    resolved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    state: Mapped[str] = mapped_column(String(32), default="ALERT_SENT")
    people_involved: Mapped[list] = mapped_column(JSON, default=list)
    peak_movement: Mapped[float] = mapped_column(Float, default=0.0)      # px per processed frame
    min_distance: Mapped[float | None] = mapped_column(Float, nullable=True)  # px, closest pair
    description: Mapped[str] = mapped_column(String(256), default="")
    snapshot_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    telegram_status: Mapped[str] = mapped_column(String(16), default="not_sent")  # not_sent | sent | failed
    telegram_attempts: Mapped[int] = mapped_column(Integer, default=0)


class IncidentEvent(Base):
    """Timeline entries for one incident."""
    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String(32), index=True)
    ts: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), index=True)
    label: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str] = mapped_column(String(256), default="")
