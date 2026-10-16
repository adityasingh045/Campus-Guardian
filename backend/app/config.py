"""Central application settings, loaded from environment variables / .env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Auth ---
    api_key: str | None = None
    allow_no_auth: bool = False

    # --- Camera ---
    camera_source: str = "0"
    test_video_fallback: bool = True

    # --- Detection (ported from the working standalone script) ---
    model_path: str = "yolov8n.pt"
    device: str = ""                      # "" = let Ultralytics choose; or "cpu" / "cuda:0"
    detection_conf: float = 0.55          # model.track(conf=...)
    distance_threshold: float = 300.0     # px between two people's centers
    movement_threshold: float = 15.0      # px a center must move between processed frames
    suspicious_frames_required: int = 2   # consecutive-ish frames (decays by 1 when calm)
    min_person_width: float = 80.0        # ignore tiny/partial boxes
    min_person_height: float = 120.0
    alert_cooldown_seconds: float = 5.0   # calm period before an incident is considered over
    target_fps: float = 30.0              # upper cap on processing rate (movement is px per processed frame)
    broadcast_fps: float = 15.0           # throttle for dashboard video frames

    # --- Evidence ---
    evidence_pre_seconds: float = 10.0
    evidence_post_seconds: float = 10.0

    # --- Privacy ---
    # Blur the head region of every detected person in stored evidence
    # (snapshots + clips). Off by default; enable for privacy-sensitive sites.
    privacy_blur_faces: bool = False

    # --- Multi-camera incident correlation ---
    # Two cameras in the same zone firing within this window = one incident
    # group (one Telegram alert, extra cameras attached as additional angles).
    incident_correlation_seconds: float = 45.0

    # --- Escalation ---
    # If an alert is not marked reviewed within this many minutes, send a
    # follow-up Telegram message (to the escalation chat if set, else the
    # main chat). 0 disables escalation.
    escalation_minutes: float = 0.0
    telegram_escalation_chat_id: str | None = None

    # --- Multi-source ---
    sources_config_json: str | None = None
    sources_config_file: str = str(BASE_DIR / "sources.json")

    # --- Storage / retention ---
    db_path: str = str(BASE_DIR / "data" / "campus_guardian.db")
    snapshot_dir: str = str(BASE_DIR / "snapshots")
    snapshot_retention_days: int = 14
    cleanup_interval_seconds: float = 3600.0
    alerts_default_page_size: int = 50
    alerts_max_page_size: int = 200

    # --- WebSocket ---
    ws_max_connections: int = 20
    ws_client_queue_size: int = 1

    # --- Telegram ---
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    telegram_min_interval_seconds: float = 3.0
    dashboard_base_url: str = "http://localhost:5173"

    # --- CORS ---
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Engine resilience ---
    engine_stale_frame_seconds: float = 5.0

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.api_key and not s.allow_no_auth:
        raise RuntimeError(
            "No API_KEY set. Set API_KEY in your .env, or explicitly set ALLOW_NO_AUTH=true "
            "(local demo only: exposes the live camera feed and incident data with no authentication)."
        )
    Path(s.snapshot_dir).mkdir(parents=True, exist_ok=True)
    Path(s.db_path).parent.mkdir(parents=True, exist_ok=True)
    return s
