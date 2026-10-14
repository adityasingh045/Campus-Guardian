from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings


@dataclass(frozen=True)
class DetectionConfig:
    camera_source: str
    model_path: str
    device: str
    detection_conf: float
    distance_threshold: float
    movement_threshold: float
    suspicious_frames_required: int
    min_person_width: float
    min_person_height: float
    alert_cooldown_seconds: float
    target_fps: float
    broadcast_fps: float
    evidence_pre_seconds: float
    evidence_post_seconds: float
    test_video_fallback: bool

    @classmethod
    def from_settings(cls, s: Settings, camera_source: str | None = None) -> "DetectionConfig":
        return cls(
            camera_source=camera_source if camera_source is not None else s.camera_source,
            model_path=s.model_path,
            device=s.device,
            detection_conf=s.detection_conf,
            distance_threshold=s.distance_threshold,
            movement_threshold=s.movement_threshold,
            suspicious_frames_required=s.suspicious_frames_required,
            min_person_width=s.min_person_width,
            min_person_height=s.min_person_height,
            alert_cooldown_seconds=s.alert_cooldown_seconds,
            target_fps=s.target_fps,
            broadcast_fps=min(s.broadcast_fps, s.target_fps),
            evidence_pre_seconds=s.evidence_pre_seconds,
            evidence_post_seconds=s.evidence_post_seconds,
            test_video_fallback=s.test_video_fallback,
        )
