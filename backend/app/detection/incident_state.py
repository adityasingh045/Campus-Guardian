"""
Incident lifecycle driven by the movement analyzer's status.

    NORMAL -> (status becomes SUSPICIOUS) -> ALERT_SENT -> INCIDENT_ACTIVE
           -> (calm for ALERT_COOLDOWN seconds) -> INCIDENT_RESOLVED

The analyzer already does the frame-count confirmation (suspicious_frame_count
>= SUSPICIOUS_FRAMES_REQUIRED), so an incident is only opened once that has
happened -- no extra delay is added on top of the standalone script's
behavior. One continuous episode is ONE incident / ONE notification, instead of
a new alert every cooldown interval; after the activity has been calm for
`resolve_cooldown_seconds` a later episode starts a new incident.
"""
from __future__ import annotations

import datetime as dt
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum


class IncidentState(str, Enum):
    NORMAL = "NORMAL"
    ALERT_SENT = "ALERT_SENT"
    INCIDENT_ACTIVE = "INCIDENT_ACTIVE"
    INCIDENT_RESOLVED = "INCIDENT_RESOLVED"


@dataclass
class TimelineEvent:
    ts: float
    label: str
    detail: str


@dataclass
class Incident:
    incident_id: str
    source_id: str
    location: str
    started_at: float
    state: IncidentState = IncidentState.ALERT_SENT
    people_involved: set[int] = field(default_factory=set)
    peak_movement: float = 0.0
    min_distance: float | None = None
    timeline: list[TimelineEvent] = field(default_factory=list)
    resolved_at: float | None = None

    def log(self, label: str, detail: str = "") -> None:
        self.timeline.append(TimelineEvent(ts=time.time(), label=label, detail=detail))


class IncidentStateMachine:
    def __init__(self, source_id: str, location: str, resolve_cooldown_seconds: float) -> None:
        self.source_id = source_id
        self.location = location
        self.resolve_cooldown_seconds = resolve_cooldown_seconds
        self._active: Incident | None = None
        self._calm_since: float | None = None

    @property
    def active_incident(self) -> Incident | None:
        return self._active

    def update(self, result) -> tuple[Incident | None, bool]:
        """`result` is a movement_analyzer.AnalysisResult. Returns
        (incident_or_None, just_alerted). When an incident resolves it is
        returned once (state INCIDENT_RESOLVED) so the caller can persist it."""
        involved = {p.id for p in result.people}

        if self._active is None:
            if not result.suspicious:
                return None, False
            inc = Incident(
                incident_id=self._new_id(),
                source_id=self.source_id,
                location=self.location,
                started_at=time.time(),
                people_involved=set(involved),
                peak_movement=result.max_movement,
                min_distance=result.closest_distance,
            )
            dist = f"{int(result.closest_distance)}px" if result.closest_distance is not None else "n/a"
            inc.log(
                "SUSPICIOUS_ACTIVITY",
                f"{result.people_count} people, max movement {int(result.max_movement)}px, closest {dist}",
            )
            inc.log("ALERT_SENT", "Notification dispatched")
            self._active = inc
            self._calm_since = None
            return inc, True

        inc = self._active
        if result.suspicious:
            self._calm_since = None
            inc.people_involved |= involved
            inc.peak_movement = max(inc.peak_movement, result.max_movement)
            if result.closest_distance is not None:
                inc.min_distance = (
                    result.closest_distance if inc.min_distance is None else min(inc.min_distance, result.closest_distance)
                )
            if inc.state == IncidentState.ALERT_SENT:
                inc.state = IncidentState.INCIDENT_ACTIVE
            return inc, False

        if self._calm_since is None:
            self._calm_since = time.time()
        elif (time.time() - self._calm_since) >= self.resolve_cooldown_seconds:
            inc.state = IncidentState.INCIDENT_RESOLVED
            inc.resolved_at = time.time()
            inc.log("INCIDENT_RESOLVED", f"No suspicious activity for {self.resolve_cooldown_seconds:g}s")
            self._active = None
            self._calm_since = None
            return inc, False
        return inc, False

    @staticmethod
    def _new_id() -> str:
        return f"INC-{dt.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
