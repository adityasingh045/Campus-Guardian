"""
FIX/CORE REQUIREMENT (spec sections 12, 13, 26): the backend must run N
sources simultaneously, each independent, where one camera's failure can't
take down the others. This is where that isolation actually lives: each
source gets its own CameraEngine (own thread, own tracker/incident state,
own frame_queue), so a crash in one thread's try/except watchdog has zero
effect on any other source's thread. There is exactly one shared
alert_queue (all incident events are tagged with source_id already) and
one dict of per-source frame_queues that the frame broadcaster drains.
"""
from __future__ import annotations

import logging
import queue

from app.config import Settings
from app.detection.config import DetectionConfig
from app.detection.engine import CameraEngine, FrameEvent, IncidentAlertEvent
from app.sources.base import SourceConfig, SourceRuntimeStatus, SourceStatus

logger = logging.getLogger("campus_guardian.source_manager")


class SourceManager:
    def __init__(self, settings: Settings, alert_queue: "queue.Queue[IncidentAlertEvent]", has_clients_fn) -> None:
        self.settings = settings
        self.alert_queue = alert_queue
        self.has_clients_fn = has_clients_fn
        self._engines: dict[str, CameraEngine] = {}
        self._configs: dict[str, SourceConfig] = {}
        self.frame_queues: dict[str, "queue.Queue[FrameEvent]"] = {}

    def add_source(self, source_config: SourceConfig) -> None:
        if source_config.source_id in self._engines:
            raise ValueError(f"Source {source_config.source_id} already registered")

        detection_config = DetectionConfig.from_settings(self.settings, camera_source=source_config.uri)
        frame_q: "queue.Queue[FrameEvent]" = queue.Queue(maxsize=1)
        self.frame_queues[source_config.source_id] = frame_q

        engine = CameraEngine(
            source_id=source_config.source_id,
            location=source_config.location,
            config=detection_config,
            snapshot_dir=self.settings.snapshot_dir,
            frame_queue=frame_q,
            alert_queue=self.alert_queue,
            has_clients_fn=self.has_clients_fn,
        )
        self._engines[source_config.source_id] = engine
        self._configs[source_config.source_id] = source_config

        if source_config.enabled:
            engine.start()
            logger.info("Started engine for %s (%s)", source_config.source_id, source_config.location)
        else:
            logger.info("Source %s registered but disabled; not starting.", source_config.source_id)

    def remove_source(self, source_id: str) -> None:
        engine = self._engines.pop(source_id, None)
        self._configs.pop(source_id, None)
        self.frame_queues.pop(source_id, None)
        if engine:
            engine.stop()
            logger.info("Stopped and removed source %s", source_id)

    def get_engine(self, source_id: str) -> CameraEngine | None:
        return self._engines.get(source_id)

    def status_for(self, source_id: str) -> SourceRuntimeStatus | None:
        engine = self._engines.get(source_id)
        cfg = self._configs.get(source_id)
        if engine is None or cfg is None:
            return None

        import time

        frame_age = time.time() - engine.last_frame_time if engine.last_frame_time else None
        status = SourceStatus.OFFLINE
        if not cfg.enabled:
            status = SourceStatus.OFFLINE
        elif engine.status == "error":
            status = SourceStatus.ERROR
        elif cfg.uri.startswith("phone://") and frame_age is None:
            status = SourceStatus.STARTING
        elif cfg.uri.startswith("phone://") and frame_age is not None and frame_age > 3.0:
            status = SourceStatus.OFFLINE
        elif engine.status == "starting":
            status = SourceStatus.STARTING
        elif engine.is_alive_flag:
            status = SourceStatus.ONLINE

        return SourceRuntimeStatus(
            source_id=source_id,
            source_type=cfg.source_type.value,
            location=cfg.location,
            status=status,
            using_synthetic_feed=engine.using_synthetic_feed,
            person_count=engine.last_person_count,
            max_movement=engine.last_max_movement,
            closest_distance=engine.last_closest_distance,
            activity_status=engine.last_activity_status,
            active_incident_id=engine.active_incident_id,
            last_frame_age_seconds=frame_age,
        )

    def all_statuses(self) -> list[SourceRuntimeStatus]:
        return [s for s in (self.status_for(sid) for sid in self._configs) if s is not None]

    def list_configs(self) -> list[SourceConfig]:
        return list(self._configs.values())

    def stop_all(self, timeout: float = 5.0) -> None:
        for source_id, engine in self._engines.items():
            engine.stop(timeout=timeout)
        logger.info("All %d source engines stopped.", len(self._engines))
