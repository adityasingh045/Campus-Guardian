"""
FIX (missing spec): the original doc said "Devices (optional): /dev/video0"
but never specified fallback behavior. CameraReader now:
  1. Tries the configured source (webcam index, RTSP url, or file path).
  2. If that fails to open, and test_video_fallback is enabled, falls back
     to a synthetic in-memory test feed (a bouncing figure + a "falling"
     figure) so the whole pipeline is runnable with zero external
     dependencies -- useful for demos/CI where no camera is attached.
  3. Retries the real source with exponential backoff in the background,
     and swaps back to it automatically if it becomes available.
"""
from __future__ import annotations

import logging
import sys
import time
import threading

import cv2
import numpy as np

logger = logging.getLogger("campus_guardian.camera")


class PhoneFrameRegistry:
    """Thread-safe latest-frame handoff for browser-based phone cameras."""
    _lock = threading.Lock()
    _frames: dict[str, tuple[float, np.ndarray]] = {}

    @classmethod
    def publish(cls, source_id: str, frame: np.ndarray) -> None:
        with cls._lock:
            cls._frames[source_id] = (time.time(), frame.copy())

    @classmethod
    def read(cls, source_id: str, max_age_seconds: float = 3.0) -> tuple[bool, np.ndarray | None]:
        with cls._lock:
            item = cls._frames.get(source_id)
            if item is None or time.time() - item[0] > max_age_seconds:
                return False, None
            return True, item[1].copy()

    @classmethod
    def remove(cls, source_id: str) -> None:
        with cls._lock:
            cls._frames.pop(source_id, None)


class PhoneFrameFeed:
    """OpenCV-compatible reader backed by frames uploaded from a phone browser."""
    def __init__(self, source_id: str) -> None:
        self.source_id = source_id

    def isOpened(self) -> bool:  # noqa: N802
        return True

    def read(self) -> tuple[bool, np.ndarray | None]:
        return PhoneFrameRegistry.read(self.source_id)

    def release(self) -> None:
        pass


class SyntheticFeed:
    """Deterministic, dependency-free fallback so the app always has *something*
    to run the detection pipeline against."""

    def __init__(self, width: int = 960, height: int = 540) -> None:
        self.width = width
        self.height = height
        self._t = 0

    def read(self) -> tuple[bool, np.ndarray]:
        frame = np.full((self.height, self.width, 3), 30, dtype=np.uint8)
        cv2.putText(
            frame, "SYNTHETIC TEST FEED (no camera source available)",
            (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2,
        )
        # a "person" walking left to right
        x = 100 + (self._t * 4) % (self.width - 200)
        y = self.height // 2
        cv2.circle(frame, (x, y - 60), 20, (200, 200, 200), -1)  # head
        cv2.rectangle(frame, (x - 15, y - 40), (x + 15, y + 60), (180, 180, 180), -1)  # torso
        # a second "person" who periodically "falls" (rapid aspect-ratio flip)
        fall_phase = (self._t // 30) % 6
        fx, fy = 700, self.height // 2
        if fall_phase == 5:
            cv2.ellipse(frame, (fx, fy + 40), (60, 20), 0, 0, 360, (150, 150, 220), -1)
        else:
            cv2.circle(frame, (fx, fy - 60), 20, (150, 150, 220), -1)
            cv2.rectangle(frame, (fx - 15, fy - 40), (fx + 15, fy + 60), (130, 130, 200), -1)
        self._t += 1
        return True, frame

    def isOpened(self) -> bool:  # noqa: N802 - matches cv2.VideoCapture API
        return True

    def release(self) -> None:
        pass


def _open_capture(src) -> "cv2.VideoCapture":
    """Webcam indexes use DirectShow on Windows (as in the standalone script);
    RTSP URLs and file paths use OpenCV's default backend."""
    if isinstance(src, int) and sys.platform.startswith("win"):
        return cv2.VideoCapture(src, cv2.CAP_DSHOW)
    return cv2.VideoCapture(src)


class CameraReader:
    def __init__(self, source: str, allow_synthetic_fallback: bool = True) -> None:
        self.source = source
        self.allow_synthetic_fallback = allow_synthetic_fallback
        self._cap: cv2.VideoCapture | SyntheticFeed | None = None
        self._using_synthetic = False
        self._last_real_attempt = 0.0
        self._real_retry_interval = 10.0
        self._open()

    def _resolve_source(self):
        # numeric strings mean a webcam index
        if self.source.isdigit():
            return int(self.source)
        return self.source

    def _open(self) -> bool:
        if self.source.startswith("phone://"):
            self._cap = PhoneFrameFeed(self.source.removeprefix("phone://"))
            self._using_synthetic = False
            logger.info("Waiting for browser phone camera source: %s", self.source)
            return True
        src = self._resolve_source()
        cap = _open_capture(src)
        if cap.isOpened():
            self._cap = cap
            self._using_synthetic = False
            logger.info("Camera source opened: %s", self.source)
            return True

        cap.release()
        if self.allow_synthetic_fallback:
            logger.warning(
                "Camera source '%s' could not be opened. Falling back to synthetic test feed. "
                "Set CAMERA_SOURCE to a valid webcam index / RTSP URL / video file path.",
                self.source,
            )
            self._cap = SyntheticFeed()
            self._using_synthetic = True
            return True

        logger.error("Camera source '%s' could not be opened and no fallback is allowed.", self.source)
        self._cap = None
        return False

    def read(self) -> tuple[bool, np.ndarray | None]:
        # Phone feeds are pushed over HTTP by a mobile browser; never replace them with synthetic video.
        if self.source.startswith("phone://"):
            if self._cap is None:
                return False, None
            return self._cap.read()
        # If we're on the synthetic fallback, periodically try to reclaim the real source.
        if self._using_synthetic and (time.time() - self._last_real_attempt) > self._real_retry_interval:
            self._last_real_attempt = time.time()
            src = self._resolve_source()
            probe = _open_capture(src)
            if probe.isOpened():
                logger.info("Real camera source '%s' became available; switching back.", self.source)
                if self._cap is not None:
                    self._cap.release()
                self._cap = probe
                self._using_synthetic = False
            else:
                probe.release()

        if self._cap is None:
            return False, None
        ok, frame = self._cap.read()
        if not ok:
            logger.warning("Frame read failed on '%s'; attempting reopen.", self.source)
            self._open()
            return False, None
        return True, frame

    @property
    def is_synthetic(self) -> bool:
        return self._using_synthetic

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
