from sqlalchemy import text

from app.db.session import Base, engine

# Nullable columns added after the first release. On startup we add any that
# are missing with ALTER TABLE (additive + idempotent, safe for SQLite), so
# existing databases upgrade themselves without a manual migration step.
_ADDITIVE_COLUMNS: dict[str, dict[str, str]] = {
    "incidents": {
        "zone": "VARCHAR(64)",
        "group_id": "VARCHAR(32)",
        "reviewed_at": "DATETIME",
        "escalated_at": "DATETIME",
    },
}


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        for table, columns in _ADDITIVE_COLUMNS.items():
            result = await conn.execute(text(f"PRAGMA table_info({table})"))
            existing = {row[1] for row in result.fetchall()}
            for column, ddl_type in columns.items():
                if column not in existing:
                    await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
