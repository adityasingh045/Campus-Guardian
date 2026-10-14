"""
The detection calculation from the working standalone script, unchanged in
behavior:

  * ignore boxes smaller than MIN_PERSON_WIDTH x MIN_PERSON_HEIGHT
  * per-track movement = distance between this frame's box center and the
    previous frame's center for the same track id
  * for every pair of people: center-to-center distance; the frame is
    "suspicious" if any pair is closer than DISTANCE_THRESHOLD AND either
    person moved more than MOVEMENT_THRESHOLD
  * suspicious_frame_count goes up by 1 on a suspicious frame and down by 1
    (floor 0) otherwise; status is SUSPICIOUS once it reaches
    SUSPICIOUS_FRAMES_REQUIRED

All distances are in image pixels and movement is pixels per *processed*
frame, so results depend on camera resolution and processing frame rate.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class Person:
    id: int
    center: tuple[int, int]
    movement: float
    box: tuple[int, int, int, int]


@dataclass
class AnalysisResult:
    people: list[Person] = field(default_factory=list)
    people_count: int = 0
    max_movement: float = 0.0
    closest_distance: float | None = None
    suspicious_condition: bool = False
    suspicious_frame_count: int = 0
    status: str = "NORMAL"
    pair_lines: list[tuple[tuple[int, int], tuple[int, int]]] = field(default_factory=list)

    @property
    def suspicious(self) -> bool:
        return self.status == "SUSPICIOUS"


class MovementAnalyzer:
    # forget tracks not seen for this many frames so the dict can't grow forever
    _PRUNE_AFTER_FRAMES = 300

    def __init__(
        self,
        distance_threshold: float,
        movement_threshold: float,
        frames_required: int,
        min_width: float,
        min_height: float,
    ) -> None:
        self.distance_threshold = distance_threshold
        self.movement_threshold = movement_threshold
        self.frames_required = frames_required
        self.min_width = min_width
        self.min_height = min_height

        self._previous_positions: dict[int, tuple[int, int]] = {}
        self._last_seen: dict[int, int] = {}
        self._frame_index = 0
        self._suspicious_frame_count = 0

    def update(self, detections) -> AnalysisResult:
        self._frame_index += 1
        people: list[Person] = []

        for track_id, (x1, y1, x2, y2) in detections:
            if (x2 - x1) < self.min_width or (y2 - y1) < self.min_height:
                continue  # ignore very small / partial detections

            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            movement = 0.0
            if track_id in self._previous_positions:
                old_x, old_y = self._previous_positions[track_id]
                movement = math.sqrt((cx - old_x) ** 2 + (cy - old_y) ** 2)

            self._previous_positions[track_id] = (cx, cy)
            self._last_seen[track_id] = self._frame_index
            people.append(Person(track_id, (cx, cy), movement, (int(x1), int(y1), int(x2), int(y2))))

        result = AnalysisResult(people=people, people_count=len(people))
        result.max_movement = max((p.movement for p in people), default=0.0)

        if len(people) >= 2:
            for i in range(len(people)):
                for j in range(i + 1, len(people)):
                    p1, p2 = people[i], people[j]
                    distance = math.sqrt(
                        (p2.center[0] - p1.center[0]) ** 2 + (p2.center[1] - p1.center[1]) ** 2
                    )
                    if result.closest_distance is None:
                        result.closest_distance = distance
                    else:
                        result.closest_distance = min(result.closest_distance, distance)

                    result.pair_lines.append((p1.center, p2.center))

                    close_enough = distance < self.distance_threshold
                    significant_movement = (
                        p1.movement > self.movement_threshold or p2.movement > self.movement_threshold
                    )
                    if close_enough and significant_movement:
                        result.suspicious_condition = True

        if result.suspicious_condition:
            self._suspicious_frame_count += 1
        else:
            self._suspicious_frame_count = max(0, self._suspicious_frame_count - 1)

        result.suspicious_frame_count = self._suspicious_frame_count
        if self._suspicious_frame_count >= self.frames_required:
            result.status = "SUSPICIOUS"

        if self._frame_index % 100 == 0:
            cutoff = self._frame_index - self._PRUNE_AFTER_FRAMES
            for tid in [t for t, seen in self._last_seen.items() if seen < cutoff]:
                self._previous_positions.pop(tid, None)
                self._last_seen.pop(tid, None)

        return result
