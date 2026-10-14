"""Periodic retention: delete incidents (rows, timeline, snapshot, evidence folder) older than N days."""
from __future__ import annotations

import asyncio
import datetime as dt
import logging
import os
import shutil

from sqlalchemy import delete, select

from app.config import get_settings
from app.db.models import Incident, IncidentEvent
from app.db.session import async_session_factory

logger = logging.getLogger("campus_guardian.cleanup")


class CleanupService:
    def __init__(self, retention_days: int, interval_seconds: float) -> None:
        self.retention_days = retention_days
        self.interval_seconds = interval_seconds
        self._stop = False

    def stop(self) -> None:
        self._stop = True

    async def run(self) -> None:
        while not self._stop:
            try:
                await self._run_once()
            except Exception:
                logger.exception("Cleanup pass failed (will retry next interval).")
            await asyncio.sleep(self.interval_seconds)

    async def _run_once(self) -> None:
        snapshot_dir = get_settings().snapshot_dir
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=self.retention_days)
        async with async_session_factory() as session:
            old = (await session.scalars(select(Incident).where(Incident.started_at < cutoff))).all()
            if not old:
                return
            ids = [i.incident_id for i in old]
            for inc in old:
                if inc.snapshot_path and os.path.exists(inc.snapshot_path):
                    try:
                        os.remove(inc.snapshot_path)
                    except OSError:
                        logger.warning("Could not delete snapshot %s", inc.snapshot_path)
                shutil.rmtree(os.path.join(snapshot_dir, inc.incident_id), ignore_errors=True)
            await session.execute(delete(IncidentEvent).where(IncidentEvent.incident_id.in_(ids)))
            await session.execute(delete(Incident).where(Incident.incident_id.in_(ids)))
            await session.commit()
            logger.info("Cleanup: removed %d incidents older than %d days.", len(ids), self.retention_days)
