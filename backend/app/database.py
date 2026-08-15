from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# statement_cache_size=0: required for Supabase's transaction-mode pooler
# (pgbouncer) — see alembic/env.py for the full explanation.
engine = create_async_engine(
    settings.database_url, pool_pre_ping=True, connect_args={"statement_cache_size": 0}
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
