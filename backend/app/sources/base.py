from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class SourceType(str, Enum):
    WEBCAM = "webcam"
    FILE = "uploaded_video"
    RTSP = "rtsp"
    RUNTIME = "runtime_stream"
    CCTV = "cctv"  # alias of RTSP for now; kept distinct for future-specific handling


class SourceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    PROCESSING = "processing"
    ERROR = "error"
    STARTING = "starting"


@dataclass
class SourceConfig:
    """The declarative description of one video source. This is what gets
    persisted/loaded from config and what the API exposes -- it does not
    hold any live cv2/engine objects."""

    source_id: str
    source_type: SourceType
    location: str
    uri: str  # "0" for default webcam, a file path, or an rtsp:// url
    enabled: bool = True

    @classmethod
    def from_dict(cls, d: dict) -> "SourceConfig":
        return cls(
            source_id=d["source_id"],
            source_type=SourceType(d["source_type"]),
            location=d["location"],
            uri=d["uri"],
            enabled=d.get("enabled", True),
        )

    def to_dict(self) -> dict:
        return {
            "source_id": self.source_id,
            "source_type": self.source_type.value,
            "location": self.location,
            "uri": self.uri,
            "enabled": self.enabled,
        }


@dataclass
class SourceRuntimeStatus:
    """Live status snapshot for the dashboard (spec section 12's example
    JSON), assembled fresh on each request/broadcast from the running
    engine -- never mutated concurrently, only read."""

    source_id: str
    source_type: str
    location: str
    status: SourceStatus
    fps: float = 0.0
    resolution: tuple[int, int] | None = None
    using_synthetic_feed: bool = False
    person_count: int = 0
    max_movement: float = 0.0
    closest_distance: float | None = None
    activity_status: str = "NORMAL"
    active_incident_id: str | None = None
    last_frame_age_seconds: float | None = None

    def to_dict(self) -> dict:
        return {
            "source_id": self.source_id,
            "type": self.source_type,
            "location": self.location,
            "status": self.status.value,
            "fps": round(self.fps, 1),
            "resolution": list(self.resolution) if self.resolution else None,
            "using_synthetic_feed": self.using_synthetic_feed,
            "person_count": self.person_count,
            "max_movement": round(self.max_movement, 1),
            "closest_distance": round(self.closest_distance, 1) if self.closest_distance is not None else None,
            "activity_status": self.activity_status,
            "active_incident_id": self.active_incident_id,
            "last_frame_age_seconds": (
                round(self.last_frame_age_seconds, 2) if self.last_frame_age_seconds is not None else None
            ),
        }
