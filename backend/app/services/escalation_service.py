"""
Escalation chain: if an alert is not marked reviewed within
ESCALATION_MINUTES, send one follow-up Telegram message (to
TELEGRAM_ESCALATION_CHAT_ID if set, otherwise the main chat).

Only incident-group leaders escalate (additional angles never do), each
incident escalates at most once (escalated_at is persisted), and the loop
survives any single failure. Disabled when ESCALATION_MINUTES is 0.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import logging

from sqlalchemy import select

from app.db.models import Incident as IncidentRow
from app.db.session import async_session_factory
from app.services.telegram_service import TelegramService

logger = logging.getLogger("campus_guardian.escalation")


class EscalationService:
    def __init__(
        self,
        telegram: TelegramService,
        escalation_minutes: float,
        escalation_chat_id: str | None,
        check_interval_seconds: float = 30.0,
    ) -> None:
        self.telegram = telegram
        self.escalation_minutes = escalation_minutes
        self.escalation_chat_id = escalation_chat_id
        self.check_interval_seconds = check_interval_seconds
        self._stop = False

    def stop(self) -> None:
        self._stop = True

    async def run(self) -> None:
        if self.escalation_minutes <= 0:
            logger.info("Escalation disabled (ESCALATION_MINUTES=0).")
            return
        logger.info(
            "Escalation armed: unreviewed alerts escalate after %.1f minute(s).",
            self.escalation_minutes,
        )
        while not self._stop:
            try:
                await self._check_once()
            except Exception:
                logger.exception("Escalation check failed (continuing).")
            await asyncio.sleep(self.check_interval_seconds)

    async def _check_once(self) -> None:
        now = dt.datetime.now(dt.timezone.utc)
        cutoff = now - dt.timedelta(minutes=self.escalation_minutes)
        async with async_session_factory() as session:
            rows = (
                await session.scalars(
                    select(IncidentRow).where(
                        IncidentRow.reviewed_at.is_(None),
                        IncidentRow.escalated_at.is_(None),
                        IncidentRow.started_at <= cutoff,
                    )
                )
            ).all()

            for row in rows:
                # Additional angles never escalate on their own.
                if row.group_id and row.group_id != row.incident_id:
                    row.escalated_at = now
                    continue
                started_text = row.started_at.strftime("%I:%M:%S %p") if row.started_at else "unknown"
                sent = await self.telegram.send_escalation(
                    row.incident_id,
                    row.location,
                    started_text,
                    self.escalation_minutes,
                    chat_id=self.escalation_chat_id,
                )
                row.escalated_at = now
                logger.info(
                    "Escalated unreviewed incident %s (telegram %s).",
                    row.incident_id,
                    "sent" if sent else "not sent",
                )
            if rows:
                await session.commit()
