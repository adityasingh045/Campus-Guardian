import time
import numpy as np
from app.detection.camera import PhoneFrameRegistry, PhoneFrameFeed


def test_phone_frame_feed_receives_latest_frame():
    source_id = "PHONE-TEST"
    PhoneFrameRegistry.remove(source_id)
    feed = PhoneFrameFeed(source_id)
    ok, frame = feed.read()
    assert not ok and frame is None

    expected = np.full((8, 10, 3), 127, dtype=np.uint8)
    PhoneFrameRegistry.publish(source_id, expected)
    ok, frame = feed.read()
    assert ok
    assert frame.shape == expected.shape
    assert np.array_equal(frame, expected)
    PhoneFrameRegistry.remove(source_id)


def test_phone_frame_goes_stale():
    source_id = "PHONE-STALE"
    PhoneFrameRegistry.remove(source_id)
    PhoneFrameRegistry.publish(source_id, np.zeros((2, 2, 3), dtype=np.uint8))
    with PhoneFrameRegistry._lock:
        timestamp, frame = PhoneFrameRegistry._frames[source_id]
        PhoneFrameRegistry._frames[source_id] = (time.time() - 10, frame)
    ok, result = PhoneFrameRegistry.read(source_id, max_age_seconds=1)
    assert not ok and result is None
    PhoneFrameRegistry.remove(source_id)
