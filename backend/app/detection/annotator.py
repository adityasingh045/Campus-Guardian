"""Overlay drawing, same layout as the standalone script: yellow lines between
people, and a status panel in the bottom-left corner."""
from __future__ import annotations

import cv2
import numpy as np

from app.detection.movement_analyzer import AnalysisResult


def blur_person_heads(frame: np.ndarray, detections, head_fraction: float = 0.30) -> np.ndarray:
    """Privacy mode: Gaussian-blur the head region (top of each person box)
    so stored evidence does not expose identifiable faces. In-place."""
    h, w = frame.shape[:2]
    for _track_id, (x1, y1, x2, y2) in detections:
        hx1, hy1 = max(int(x1), 0), max(int(y1), 0)
        hx2 = min(int(x2), w)
        hy2 = min(int(y1 + (y2 - y1) * head_fraction), h)
        if hx2 - hx1 < 4 or hy2 - hy1 < 4:
            continue
        kernel = max(9, ((hx2 - hx1) // 3) | 1)  # odd, scales with head size
        frame[hy1:hy2, hx1:hx2] = cv2.GaussianBlur(frame[hy1:hy2, hx1:hx2], (kernel, kernel), 0)
    return frame


def draw_overlay(annotated: np.ndarray, result: AnalysisResult) -> np.ndarray:
    """Full forensic annotation: pair lines + status panel. Used for EVIDENCE
    frames (clip + evidence snapshots). The live view uses draw_status_panel
    only, so operators see a clean picture."""
    for p1, p2 in result.pair_lines:
        cv2.line(annotated, p1, p2, (0, 255, 255), 2)
    return draw_status_panel(annotated, result)


def draw_status_panel(annotated: np.ndarray, result: AnalysisResult) -> np.ndarray:
    status_color = (0, 0, 255) if result.suspicious else (0, 255, 0)

    panel_height = 145
    overlay = annotated.copy()
    cv2.rectangle(overlay, (0, annotated.shape[0] - panel_height), (440, annotated.shape[0]), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.60, annotated, 0.40, 0, annotated)

    y = annotated.shape[0] - 115
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(annotated, f"Status : {result.status}", (15, y), font, 0.65, status_color, 2)
    cv2.putText(annotated, f"People Detected : {result.people_count}", (15, y + 30), font, 0.60, (255, 255, 255), 2)
    cv2.putText(annotated, f"Movement : {int(result.max_movement)}", (15, y + 60), font, 0.60, (255, 255, 255), 2)
    closest = f"{int(result.closest_distance)}" if result.closest_distance is not None else "--"
    cv2.putText(annotated, f"Closest Distance : {closest}", (15, y + 90), font, 0.60, (255, 255, 255), 2)
    return annotated
