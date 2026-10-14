"""
YOLO person detection + tracking, exactly as in the standalone script:

    model.track(frame, persist=True, classes=[0], conf=0.55, verbose=False)

NOTE: `persist=True` keeps tracker state inside the model object, so every
video source gets its OWN PersonTracker (its own YOLO instance). Sharing one
model across cameras would mix track IDs between them.
"""
from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger("campus_guardian.person_tracker")


class PersonTracker:
    def __init__(self, model_path: str, conf: float, device: str = "") -> None:
        from ultralytics import YOLO  # lazy: first run downloads yolov8n.pt if missing

        self.model = YOLO(model_path)
        self.conf = conf
        self.device = device or None
        logger.info("Loaded YOLO model '%s' (conf=%.2f, device=%s)", model_path, conf, self.device or "auto")

    def track(self, frame: np.ndarray):
        """Returns (annotated_frame, detections) where detections is a list of
        (track_id, (x1, y1, x2, y2))."""
        results = self.model.track(
            frame,
            persist=True,
            classes=[0],
            conf=self.conf,
            verbose=False,
            device=self.device,
        )
        annotated = results[0].plot()
        detections: list[tuple[int, tuple[float, float, float, float]]] = []
        boxes = results[0].boxes
        if boxes is not None and boxes.id is not None:
            ids = boxes.id.int().cpu().tolist()
            xyxy = boxes.xyxy.cpu().tolist()
            for track_id, box in zip(ids, xyxy):
                detections.append((track_id, tuple(box)))
        return annotated, detections
