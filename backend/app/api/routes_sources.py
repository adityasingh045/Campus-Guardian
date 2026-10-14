from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from fastapi import Body
import cv2
import numpy as np

from app.auth import require_api_key
from app.sources.base import SourceConfig, SourceType
from app.detection.camera import PhoneFrameRegistry

router = APIRouter(prefix="/api/sources", tags=["sources"], dependencies=[Depends(require_api_key)])


class AddSourceRequest(BaseModel):
    source_id: str
    source_type: SourceType
    location: str
    uri: str
    enabled: bool = True


@router.get("")
async def list_sources(request: Request):
    source_manager = request.app.state.source_manager
    return {"sources": [s.to_dict() for s in source_manager.all_statuses()]}


@router.get("/{source_id}")
async def get_source(source_id: str, request: Request):
    source_manager = request.app.state.source_manager
    status = source_manager.status_for(source_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return status.to_dict()


@router.post("")
async def add_source(body: AddSourceRequest, request: Request):
    """
    Add a new video source at runtime (e.g. a newly uploaded video, or a
    newly wired-up RTSP camera) without restarting the whole platform --
    this is what makes the system scale from 2 sources to 10+ without
    downtime (spec section 13).
    """
    source_manager = request.app.state.source_manager
    cfg = SourceConfig(
        source_id=body.source_id,
        source_type=body.source_type,
        location=body.location,
        uri=body.uri,
        enabled=body.enabled,
    )
    try:
        source_manager.add_source(cfg)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"status": "added", "source_id": cfg.source_id}


@router.delete("/{source_id}")
async def remove_source(source_id: str, request: Request):
    source_manager = request.app.state.source_manager
    if source_manager.status_for(source_id) is None:
        raise HTTPException(status_code=404, detail="Source not found")
    source_manager.remove_source(source_id)
    PhoneFrameRegistry.remove(source_id)
    return {"status": "removed", "source_id": source_id}


class PhoneCameraRegistration(BaseModel):
    source_id: str = Field(min_length=3, max_length=48, pattern=r"^[A-Za-z0-9_-]+$")
    location: str = Field(min_length=2, max_length=120)


@router.post("/phone")
async def register_phone_camera(body: PhoneCameraRegistration, request: Request):
    """Register one phone-browser camera as an independent detection source."""
    source_manager = request.app.state.source_manager
    cfg = SourceConfig(
        source_id=body.source_id,
        source_type=SourceType.RUNTIME,
        location=body.location,
        uri=f"phone://{body.source_id}",
        enabled=True,
    )
    try:
        source_manager.add_source(cfg)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"status": "waiting_for_phone", "source_id": body.source_id, "location": body.location}


@router.post("/phone/{source_id}/frame")
async def ingest_phone_frame(source_id: str, request: Request, image_bytes: bytes = Body(..., media_type="image/jpeg")):
    """Receive one JPEG frame from an authenticated phone browser camera."""
    source_manager = request.app.state.source_manager
    cfg = next((c for c in source_manager.list_configs() if c.source_id == source_id), None)
    if cfg is None or not cfg.uri.startswith("phone://"):
        raise HTTPException(status_code=404, detail="Phone camera source not registered")
    if not image_bytes or len(image_bytes) > 2_000_000:
        raise HTTPException(status_code=413, detail="JPEG frame must be between 1 byte and 2 MB")
    frame = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None or frame.size == 0:
        raise HTTPException(status_code=400, detail="Invalid JPEG frame")
    height, width = frame.shape[:2]
    if width > 1920 or height > 1080:
        frame = cv2.resize(frame, (min(width, 1280), min(height, 720)))
    PhoneFrameRegistry.publish(source_id, frame)
    return {"status": "accepted", "source_id": source_id, "width": int(frame.shape[1]), "height": int(frame.shape[0])}
