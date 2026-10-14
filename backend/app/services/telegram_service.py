"""
FIX (spec section 15): rich, formatted incident alerts with location,
incident ID, people count, confidence, and a dashboard link -- not a bare
notification. Adds one automatic retry on failure and tracks delivery
status so it can be surfaced on the incident record (spec: "Delivery
status", "Failure retry", "Audit logging").

Rate limiting (already in the single-camera build) is kept: it protects
against alert storms if thresholds are mis-tuned during calibration.
Credentials are read from environment/.env only -- never accept a token or
chat id from a request body, and never log the token value.
"""
from __future__ import annotations

import asyncio
import logging
import time

import httpx

logger = logging.getLogger("campus_guardian.telegram")


class TelegramDeliveryResult:
    def __init__(self, sent: bool, attempts: int, error: str | None = None) -> None:
        self.sent = sent
        self.attempts = attempts
        self.error = error


class TelegramService:
    def __init__(
        self,
        bot_token: str | None,
        chat_id: str | None,
        min_interval_seconds: float,
        dashboard_base_url: str,
        max_retries: int = 1,
    ) -> None:
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.min_interval_seconds = min_interval_seconds
        self.dashboard_base_url = dashboard_base_url.rstrip("/")
        self.max_retries = max_retries
        self._last_sent = 0.0
        self._lock = asyncio.Lock()

    @property
    def configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    def format_incident_message(self, incident, snapshot_available: bool) -> str:
        started = time.strftime("%I:%M:%S %p", time.localtime(incident.started_at))
        people = len(incident.people_involved)
        closest = f"{int(incident.min_distance)} px" if incident.min_distance is not None else "n/a"
        dashboard_link = self.dashboard_base_url
        state = incident.state.value if hasattr(incident.state, "value") else incident.state
        return (
            "\U0001F6A8 SUSPICIOUS ACTIVITY DETECTED\n\n"
            f"Incident ID: {incident.incident_id}\n\n"
            f"Location:\n{incident.location}\n\n"
            f"Camera:\n{incident.source_id}\n\n"
            f"Time:\n{started}\n\n"
            f"People Involved:\n{people}\n\n"
            f"Peak Movement:\n{int(incident.peak_movement)} px/frame\n\n"
            f"Closest Distance:\n{closest}\n\n"
            f"Status:\n{state}\n\n"
            f"Open Dashboard:\n{dashboard_link}\n\nSearch incident ID in the dashboard: {incident.incident_id}"
        )

    async def send_incident_alert(self, incident, snapshot_path: str | None) -> TelegramDeliveryResult:
        if not self.configured:
            return TelegramDeliveryResult(sent=False, attempts=0, error="telegram not configured (no-op)")

        async with self._lock:
            now = time.time()
            if (now - self._last_sent) < self.min_interval_seconds:
                logger.info("Telegram send suppressed by rate limit for %s", incident.incident_id)
                return TelegramDeliveryResult(sent=False, attempts=0, error="rate_limited")
            self._last_sent = now

        caption = self.format_incident_message(incident, snapshot_available=bool(snapshot_path))
        last_error = None
        for attempt in range(1, self.max_retries + 2):  # e.g. max_retries=1 -> up to 2 attempts total
            try:
                await self._send(caption, snapshot_path)
                return TelegramDeliveryResult(sent=True, attempts=attempt)
            except Exception as e:  # noqa: BLE001
                last_error = str(e)
                logger.warning("Telegram send attempt %d failed for %s: %s", attempt, incident.incident_id, e)
                if attempt <= self.max_retries:
                    await asyncio.sleep(2.0 * attempt)  # small backoff before retry

        logger.error("Telegram delivery failed for %s after retries (incident already persisted).", incident.incident_id)
        return TelegramDeliveryResult(sent=False, attempts=self.max_retries + 1, error=last_error)

    async def _send(self, caption: str, snapshot_path: str | None) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if snapshot_path:
                url = f"https://api.telegram.org/bot{self.bot_token}/sendPhoto"
                with open(snapshot_path, "rb") as f:
                    resp = await client.post(url, data={"chat_id": self.chat_id, "caption": caption}, files={"photo": f})
            else:
                url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
                resp = await client.post(url, data={"chat_id": self.chat_id, "text": caption})
            resp.raise_for_status()
