import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import pool

from app.config import get_settings
from app.database import Base
from app import models  # noqa: F401 — registers all models on Base.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
# Built directly from settings, NOT via config.set_main_option(): the DB URL
# contains a URL-encoded password (e.g. "%40"), and ConfigParser — which
# backs alembic.ini — treats "%" as its own interpolation syntax and raises
# on it. Routing the URL through set_main_option()/get_main_option() hits
# that interpolation path; building the engine directly here avoids it.
DATABASE_URL = settings.database_url

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    # statement_cache_size=0: Supabase's transaction-mode pooler (pgbouncer)
    # doesn't support asyncpg's prepared-statement caching — each "connection"
    # can be a different backend session per request, so a cached prepared
    # statement from one may not exist on the next. Same setting needed in
    # app/database.py's engine for the app's own runtime connections.
    connectable = create_async_engine(
        DATABASE_URL, poolclass=pool.NullPool, connect_args={"statement_cache_size": 0}
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
