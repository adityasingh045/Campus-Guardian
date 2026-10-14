from __future__ import annotations

import json
import logging
import os

from app.config import Settings
from app.sources.base import SourceConfig, SourceType

logger = logging.getLogger("campus_guardian.sources")


def load_source_configs(settings: Settings) -> list[SourceConfig]:
    if settings.sources_config_json:
        try:
            data = json.loads(settings.sources_config_json)
            return [SourceConfig.from_dict(d) for d in data]
        except Exception:
            logger.exception("SOURCES_CONFIG_JSON was set but could not be parsed; falling back.")

    if os.path.exists(settings.sources_config_file):
        try:
            with open(settings.sources_config_file) as f:
                data = json.load(f)
            return [SourceConfig.from_dict(d) for d in data]
        except Exception:
            logger.exception("sources.json exists but could not be parsed; falling back to single default source.")

    logger.info(
        "No multi-source config found. Starting with zero video sources; add phone cameras from the dashboard "
        "or configure RTSP/recorded-video sources explicitly."
    )
    return []
