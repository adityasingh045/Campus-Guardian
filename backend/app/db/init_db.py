from __future__ import annotations

from app.db.session import Base, engine
from app.db import models  # noqa: F401  (registers models on Base.metadata)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
