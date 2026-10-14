"""
Async-side consumer for incident events produced by every source's engine
thread. Persists the Incident + its timeline, broadcasts to the dashboard,
and (only on the 'alert_sent' transition, exactly once per incident) fires
the Telegram notification and records delivery status back onto the row.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import logging
import queue

from sqlalchemy import select

from app.db.models import Incident as IncidentRow
from app.db.models import IncidentEvent as IncidentEventRow
from app.db.session import async_session_factory
from app.detection.engine import IncidentAlertEvent
from app.services.telegram_service import TelegramService
from app.services.ws_manager import WebSocketManager

logger = logging.getLogger("campus_guardian.incidents")


class IncidentConsumer:
    def __init__(
        self,
        alert_queue: "queue.Queue[IncidentAlertEvent]",
        ws_manager: WebSocketManager,
        telegram: TelegramService,
        poll_interval: float = 0.1,
    ) -> None:
        self.alert_queue = alert_queue
        self.ws_manager = ws_manager
        self.telegram = telegram
        self.poll_interval = poll_interval
        self._stop = False

    def stop(self) -> None:
        self._stop = True

    async def run(self) -> None:
        while not self._stop:
            try:
                event = self.alert_queue.get_nowait()
            except queue.Empty:
                await asyncio.sleep(self.poll_interval)
                continue
            try:
                await self._handle_event(event)
            except Exception:
                logger.exception("Failed to handle incident event for %s (continuing).", event.incident.incident_id)

    async def _handle_event(self, event: IncidentAlertEvent) -> None:
        incident = event.incident

        async with async_session_factory() as session:
            row = await session.scalar(select(IncidentRow).where(IncidentRow.incident_id == incident.incident_id))
            if row is None:
                row = IncidentRow(
                    incident_id=incident.incident_id,
                    source_id=incident.source_id,
                    location=incident.location,
                    started_at=dt.datetime.fromtimestamp(incident.started_at, tz=dt.timezone.utc),
                    state=incident.state.value,
                    people_involved=list(incident.people_involved),
                    peak_movement=incident.peak_movement,
                    min_distance=incident.min_distance,
                    description=self._describe(incident),
                )
                session.add(row)
            else:
                row.state = incident.state.value
                row.people_involved = list(incident.people_involved)
                row.peak_movement = incident.peak_movement
                row.min_distance = incident.min_distance
                row.description = self._describe(incident)
                if incident.resolved_at:
                    row.resolved_at = dt.datetime.fromtimestamp(incident.resolved_at, tz=dt.timezone.utc)
            if event.snapshot_path:
                row.snapshot_path = event.snapshot_path

            # only append the newest timeline entries we haven't stored yet
            existing_rows = await session.scalars(
                select(IncidentEventRow).where(IncidentEventRow.incident_id == incident.incident_id)
            )
            already = len(list(existing_rows))
            for te in incident.timeline[already:]:
                session.add(
                    IncidentEventRow(
                        incident_id=incident.incident_id,
                        ts=dt.datetime.fromtimestamp(te.ts, tz=dt.timezone.utc),
                        label=te.label,
                        detail=te.detail,
                    )
                )

            await session.commit()
            await session.refresh(row)

        await self.ws_manager.broadcast_incident_event(
            event.kind,
            {
                "incident_id": incident.incident_id,
                "source_id": incident.source_id,
                "location": incident.location,
                "state": incident.state.value,
                "people_involved": list(incident.people_involved),
                "peak_movement": round(incident.peak_movement, 1),
                "min_distance": round(incident.min_distance, 1) if incident.min_distance is not None else None,
                "timeline": [{"ts": te.ts, "label": te.label, "detail": te.detail} for te in incident.timeline],
            },
        )

        if event.kind == "alert_sent":
            task = asyncio.create_task(self._send_telegram(incident, event.snapshot_path))
            task.add_done_callback(self._log_task_result)

    @staticmethod
    def _describe(incident) -> str:
        n = len(incident.people_involved)
        return f"Suspicious activity: {n} tracked person(s) close together with sustained movement at {incident.location}."

    async def _send_telegram(self, incident, snapshot_path: str | None) -> None:
        result = await self.telegram.send_incident_alert(incident, snapshot_path)
        status = "sent" if result.sent else ("not_sent" if result.error == "telegram not configured (no-op)" else "failed")
        async with async_session_factory() as session:
            row = await session.scalar(select(IncidentRow).where(IncidentRow.incident_id == incident.incident_id))
            if row:
                row.telegram_status = status
                row.telegram_attempts = result.attempts
                await session.commit()
        if not result.sent and status == "failed":
            logger.error("Telegram delivery ultimately failed for %s: %s", incident.incident_id, result.error)

    @staticmethod
    def _log_task_result(task: asyncio.Task) -> None:
        try:
            task.result()
        except Exception:
            logger.exception("Telegram notification task raised.")
