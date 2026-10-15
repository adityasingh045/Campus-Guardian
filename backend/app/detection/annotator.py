"""Overlay drawing, same layout as the standalone script: yellow lines between
people, and a status panel in the bottom-left corner."""
from __future__ import annotations

import cv2
import numpy as np

from app.detection.movement_analyzer import AnalysisResult


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