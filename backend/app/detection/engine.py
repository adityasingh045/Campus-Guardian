"""
Per-source detection engine. One CameraEngine runs per video source, each in
its own worker thread (cv2/YOLO are blocking and must never run on the asyncio
loop), with its own YOLO instance, movement analyzer and incident state
machine -- so one camera failing cannot affect another.

Per frame:
    camera.read -> YOLO track (persons) -> MovementAnalyzer (your calculation)
        -> overlay -> IncidentStateMachine -> evidence + alert events
"""
from __future__ import annotations

import logging
import os
import queue
import threading
import time

import cv2

from app.detection.annotator import draw_overlay, draw_status_panel
from app.detection.camera import CameraReader
from app.detection.config import DetectionConfig
from app.detection.evidence import EvidenceCollector, EvidenceRingBuffer
from app.detection.incident_state import Incident, IncidentState, IncidentStateMachine
from app.detection.movement_analyzer import MovementAnalyzer
from app.detection.person_tracker import PersonTracker

logger = logging.getLogger("campus_guardian.engine")


class FrameEvent:
    __slots__ = ("source_id", "jpeg_bytes", "stats", "ts")

    def __init__(self, source_id: str, jpeg_bytes: bytes, stats: dict, ts: float) -> None:
        self.source_id = source_id
        self.jpeg_bytes = jpeg_bytes
        self.stats = stats
        self.ts = ts


class IncidentAlertEvent:
    __slots__ = ("incident", "snapshot_path", "kind")

    def __init__(self, incident: Incident, snapshot_path: str | None, kind: str) -> None:
        self.incident = incident
        self.snapshot_path = snapshot_path
        self.kind = kind  # "timeline_update" | "alert_sent"


class CameraEngine:
    def __init__(
        self,
        source_id: str,
        location: str,
        config: DetectionConfig,
        snapshot_dir: str,
        frame_queue: "queue.Queue[FrameEvent]",
        alert_queue: "queue.Queue[IncidentAlertEvent]",
        has_clients_fn,
    ) -> None:
        self.source_id = source_id
        self.location = location
        self.config = config
        self.snapshot_dir = snapshot_dir
        self.frame_queue = frame_queue
        self.alert_queue = alert_queue
        self.has_clients_fn = has_clients_fn

        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_frame_time: float = 0.0
        self.is_alive_flag = False
        self.using_synthetic_feed = False
        self.status = "starting"

        # latest analysis, read by SourceManager for the status API
        self.last_person_count = 0
        self.last_max_movement = 0.0
        self.last_closest_distance: float | None = None
        self.last_activity_status = "NORMAL"

        self._last_timeline_len: dict[str, int] = {}
        self._last_broadcast = 0.0

        self._analyzer = MovementAnalyzer(
            config.distance_threshold,
            config.movement_threshold,
            config.suspicious_frames_required,
            config.min_person_width,
            config.min_person_height,
        )
        self._incident_fsm = IncidentStateMachine(source_id, location, config.alert_cooldown_seconds)
        self._evidence_ring = EvidenceRingBuffer(config.target_fps, config.evidence_pre_seconds)
        self._evidence_collector = EvidenceCollector(snapshot_dir, config.evidence_post_seconds, config.target_fps)
        self._tracker: PersonTracker | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run_watchdog, name=f"engine-{self.source_id}", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
            if self._thread.is_alive():
                logger.warning("Engine %s did not stop within %.1fs", self.source_id, timeout)

    @property
    def active_incident_id(self) -> str | None:
        inc = self._incident_fsm.active_incident
        return inc.incident_id if inc else None

    def _run_watchdog(self) -> None:
        backoff, max_backoff = 2.0, 30.0
        try:
            camera = CameraReader(self.config.camera_source, self.config.test_video_fallback)
            self.using_synthetic_feed = camera.is_synthetic
            self._tracker = PersonTracker(self.config.model_path, self.config.detection_conf, self.config.device)
        except Exception:
            logger.exception("[%s] Fatal init failure. This source will not run.", self.source_id)
            self.status = "error"
            self.is_alive_flag = False
            return

        frame_interval = 1.0 / max(self.config.target_fps, 0.1)
        consecutive_failures = 0
        self.is_alive_flag = True
        self.status = "online"

        while not self._stop_event.is_set():
            loop_start = time.time()
            try:
                self._process_one_frame(camera)
                consecutive_failures = 0
                backoff = 2.0
                self.status = "online"
            except Exception:
                consecutive_failures += 1
                logger.exception("[%s] Detection loop error (consecutive=%d). Backing off %.1fs.",
                                 self.source_id, consecutive_failures, backoff)
                self.status = "error"
                if self._stop_event.wait(timeout=backoff):
                    break
                backoff = min(backoff * 2, max_backoff)
                if consecutive_failures >= 10:
                    logger.error("[%s] Too many failures; reopening camera.", self.source_id)
                    try:
                        camera.release()
                        camera = CameraReader(self.config.camera_source, self.config.test_video_fallback)
                        self.using_synthetic_feed = camera.is_synthetic
                        consecutive_failures = 0
                    except Exception:
                        logger.exception("[%s] Camera reopen failed.", self.source_id)
                continue

            sleep_for = max(0.0, frame_interval - (time.time() - loop_start))
            if self._stop_event.wait(timeout=sleep_for):
                break

        camera.release()
        self.is_alive_flag = False
        self.status = "offline"
        logger.info("[%s] Engine loop exited.", self.source_id)

    def _process_one_frame(self, camera: CameraReader) -> None:
        ok, frame = camera.read()
        if not ok or frame is None:
            return

        annotated, detections = self._tracker.track(frame)
        result = self._analyzer.update(detections)
        draw_overlay(annotated, result)            # evidence copy: skeletons + boxes + pair lines + panel
        display = draw_status_panel(frame, result)  # live/snapshot copy: clean picture + status panel only

        self.last_frame_time = time.time()
        self.last_person_count = result.people_count
        self.last_max_movement = result.max_movement
        self.last_closest_distance = result.closest_distance
        self.last_activity_status = result.status

        self._evidence_ring.push(annotated)
        incident, just_alerted = self._incident_fsm.update(result)

        if incident is not None:
            if just_alerted:
                snapshot_path = self._save_snapshot(display, incident)
                self._evidence_collector.start(
                    incident.incident_id,
                    self._evidence_ring.snapshot(),
                    metadata={
                        "incident_id": incident.incident_id,
                        "source_id": self.source_id,
                        "location": self.location,
                        "started_at": incident.started_at,
                        "people_involved": sorted(incident.people_involved),
                        "max_movement_px": result.max_movement,
                        "closest_distance_px": result.closest_distance,
                        "thresholds": {
                            "distance_px": self.config.distance_threshold,
                            "movement_px": self.config.movement_threshold,
                            "frames_required": self.config.suspicious_frames_required,
                        },
                    },
                )
                self._put_alert(IncidentAlertEvent(incident, snapshot_path, "alert_sent"))
                self._last_timeline_len[incident.incident_id] = len(incident.timeline)
            else:
                self._maybe_push_timeline_update(incident)

        # Feed every pending evidence package, including ones whose incident has
        # already resolved, so the post-event window always completes.
        started_now = incident.incident_id if (incident is not None and just_alerted) else None
        for pending_id in self._evidence_collector.pending_ids():
            if pending_id != started_now:
                self._evidence_collector.add_post_frame(pending_id, annotated)

        self._maybe_broadcast(display, result, incident)

    def _maybe_broadcast(self, annotated, result, incident) -> None:
        if not self.has_clients_fn():
            return
        now = time.time()
        if (now - self._last_broadcast) < (1.0 / max(self.config.broadcast_fps, 0.1)):
            return
        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if not ok:
            return
        self._last_broadcast = now
        stats = {
            "person_count": result.people_count,
            "max_movement": round(result.max_movement, 1),
            "closest_distance": round(result.closest_distance, 1) if result.closest_distance is not None else None,
            "status": result.status,
            "suspicious_frames": result.suspicious_frame_count,
            "active_incident_id": incident.incident_id if incident else None,
            "using_synthetic_feed": self.using_synthetic_feed,
        }
        event = FrameEvent(self.source_id, buf.tobytes(), stats, now)
        try:
            self.frame_queue.get_nowait()  # keep only the newest frame
        except queue.Empty:
            pass
        try:
            self.frame_queue.put_nowait(event)
        except queue.Full:
            pass

    def _put_alert(self, event: IncidentAlertEvent) -> None:
        try:
            self.alert_queue.put_nowait(event)
        except queue.Full:
            logger.error("[%s] Alert queue full; dropping %s event for %s",
                         self.source_id, event.kind, event.incident.incident_id)

    def _maybe_push_timeline_update(self, incident: Incident) -> None:
        prev_len = self._last_timeline_len.get(incident.incident_id, 0)
        if len(incident.timeline) > prev_len:
            self._last_timeline_len[incident.incident_id] = len(incident.timeline)
            self._put_alert(IncidentAlertEvent(incident, None, "timeline_update"))
        if incident.state == IncidentState.INCIDENT_RESOLVED:
            self._last_timeline_len.pop(incident.incident_id, None)

    def _save_snapshot(self, frame, incident: Incident) -> str | None:
        path = os.path.join(self.snapshot_dir, f"{incident.incident_id}_confirmed.jpg")
        try:
            cv2.imwrite(path, frame)
            return path
        except Exception:
            logger.exception("[%s] Failed to save snapshot for %s", self.source_id, incident.incident_id)
            return None