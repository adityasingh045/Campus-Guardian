from __future__ import annotations

import asyncio
import datetime as dt
import logging
import queue
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import update
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_health, routes_incidents, routes_sources, ws_live
from app.config import get_settings
from app.db.init_db import init_db
from app.db.models import Incident
from app.db.session import async_session_factory
from app.detection.engine import IncidentAlertEvent
from app.services.alert_service import IncidentConsumer
from app.services.cleanup_service import CleanupService
from app.services.frame_broadcaster import FrameBroadcaster
from app.services.telegram_service import TelegramService
from app.services.ws_manager import WebSocketManager
from app.sources.loader import load_source_configs
from app.sources.manager import SourceManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("campus_guardian.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings

    await init_db()

    # Engines start with no active incident, so anything still marked open from a
    # previous run (crash / restart mid-incident) can no longer be active.
    async with async_session_factory() as session:
        await session.execute(
            update(Incident)
            .where(Incident.resolved_at.is_(None))
            .values(state="INCIDENT_RESOLVED", resolved_at=dt.datetime.now(dt.timezone.utc))
        )
        await session.commit()

    ws_manager = WebSocketManager(settings.ws_max_connections, settings.ws_client_queue_size)
    app.state.ws_manager = ws_manager

    telegram = TelegramService(
        settings.telegram_bot_token,
        settings.telegram_chat_id,
        settings.telegram_min_interval_seconds,
        settings.dashboard_base_url,
    )

    alert_q: "queue.Queue[IncidentAlertEvent]" = queue.Queue(maxsize=500)

    source_manager = SourceManager(settings, alert_q, ws_manager.has_clients)
    app.state.source_manager = source_manager

    source_configs = load_source_configs(settings)
    for cfg in source_configs:
        try:
            source_manager.add_source(cfg)
        except Exception:
            logger.exception("Failed to add source %s; other sources are unaffected.", cfg.source_id)

    incident_consumer = IncidentConsumer(alert_q, ws_manager, telegram)
    frame_broadcaster = FrameBroadcaster(lambda: source_manager.frame_queues, ws_manager)
    cleanup_service = CleanupService(settings.snapshot_retention_days, settings.cleanup_interval_seconds)

    incident_task = asyncio.create_task(incident_consumer.run())
    frame_task = asyncio.create_task(frame_broadcaster.run())
    cleanup_task = asyncio.create_task(cleanup_service.run())

    logger.info("Campus Guardian backend started with %d source(s).", len(source_configs))
    if settings.allow_no_auth and not settings.api_key:
        logger.warning("Running with ALLOW_NO_AUTH=true -- live feeds and API are unauthenticated. Local demo only.")

    try:
        yield
    finally:
        logger.info("Shutting down Campus Guardian backend...")
        source_manager.stop_all(timeout=5.0)
        incident_consumer.stop()
        frame_broadcaster.stop()
        cleanup_service.stop()
        for t in (incident_task, frame_task, cleanup_task):
            t.cancel()
        await asyncio.gather(incident_task, frame_task, cleanup_task, return_exceptions=True)
        logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Campus Guardian", version="2.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_health.router)
    app.include_router(routes_sources.router)
    app.include_router(routes_incidents.router)
    app.include_router(ws_live.router)

    return app


app = create_app()
