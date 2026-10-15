"""
Rolling pre-event buffer + post-event capture, written to disk as one evidence
package per incident: snapshots, a best-effort mp4 clip, and metadata.json.

Frames are held as JPEG bytes (not raw arrays) so keeping ~10 s of history for
several cameras costs tens of MB instead of hundreds.
"""
from __future__ import annotations

import json
import logging
import os
import time
from collections import deque

import cv2
import numpy as np

logger = logging.getLogger("campus_guardian.evidence")


def _encode(frame: np.ndarray) -> bytes | None:
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes() if ok else None


def _decode(data: bytes) -> np.ndarray:
    return cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)


class EvidenceRingBuffer:
    def __init__(self, fps: float, pre_seconds: float = 10.0) -> None:
        self._buffer: deque[tuple[float, bytes]] = deque(maxlen=max(1, int(fps * pre_seconds)))

    def push(self, frame: np.ndarray) -> None:
        data = _encode(frame)
        if data is not None:
            self._buffer.append((time.time(), data))

    def snapshot(self) -> list[tuple[float, bytes]]:
        return list(self._buffer)


class EvidenceCollector:
    def __init__(self, evidence_dir: str, post_seconds: float = 10.0, fps: float = 15.0) -> None:
        self.evidence_dir = evidence_dir
        self.post_seconds = post_seconds
        self._pending: dict[str, dict] = {}

    def start(self, incident_id: str, pre_frames: list[tuple[float, bytes]], metadata: dict) -> None:
        if incident_id in self._pending:
            return
        os.makedirs(os.path.join(self.evidence_dir, incident_id), exist_ok=True)
        self._pending[incident_id] = {
            "pre_frames": pre_frames,
            "post_frames": [],
            "metadata": metadata,
            "started": time.time(),
        }
        logger.info("Evidence collection started for %s (%d pre-event frames)", incident_id, len(pre_frames))

    def is_collecting(self, incident_id: str) -> bool:
        return incident_id in self._pending

    def pending_ids(self) -> list[str]:
        return list(self._pending.keys())

    def add_post_frame(self, incident_id: str, frame: np.ndarray) -> bool:
        """Returns True once the post-event window has elapsed and the package was written."""
        entry = self._pending.get(incident_id)
        if entry is None:
            return False
        data = _encode(frame)
        if data is not None:
            entry["post_frames"].append((time.time(), data))
        if (time.time() - entry["started"]) >= self.post_seconds:
            try:
                self._write_package(incident_id, entry)
            finally:
                del self._pending[incident_id]
            return True
        return False

    def _write_package(self, incident_id: str, entry: dict) -> None:
        out_dir = os.path.join(self.evidence_dir, incident_id)
        pre, post = entry["pre_frames"], entry["post_frames"]
        all_frames = pre + post
        if not all_frames:
            return

        first = _decode(all_frames[0][1])
        confirmed = _decode(all_frames[max(len(pre) - 1, 0)][1])
        last = _decode(all_frames[-1][1])
        cv2.imwrite(os.path.join(out_dir, "snapshot_first.jpg"), first)
        cv2.imwrite(os.path.join(out_dir, "snapshot_confirmed.jpg"), confirmed)
        cv2.imwrite(os.path.join(out_dir, "snapshot_last.jpg"), last)

        # Best-effort mp4: codec availability varies by OpenCV build. Failure must
        # not lose the snapshots or crash the pipeline.
        try:
            h, w = first.shape[:2]
            duration = max(all_frames[-1][0] - all_frames[0][0], 1.0)
            fps = max(1.0, len(all_frames) / duration)
            clip_path = os.path.join(out_dir, "clip.mp4")
            writer = None
            # Prefer H.264 ('avc1') so the clip plays inline in browser <video> tags;
            # 'mp4v' (MPEG-4 Part 2) is a fallback that downloads fine but won't play in Chrome.
            for fourcc in ("avc1", "mp4v"):
                writer = cv2.VideoWriter(clip_path, cv2.VideoWriter_fourcc(*fourcc), fps, (w, h))
                if writer.isOpened():
                    break
                writer.release()
                writer = None
            if writer is not None:
                for _, data in all_frames:
                    writer.write(_decode(data))
                writer.release()
        except Exception:
            logger.exception("Could not write evidence clip for %s (snapshots were saved).", incident_id)

        meta = dict(entry["metadata"])
        meta.update(frame_count=len(all_frames), pre_event_frames=len(pre), post_event_frames=len(post))
        with open(os.path.join(out_dir, "metadata.json"), "w") as f:
            json.dump(meta, f, indent=2, default=str)
        logger.info("Evidence package written for %s (%d frames)", incident_id, len(all_frames))