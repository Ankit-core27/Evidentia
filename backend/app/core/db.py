"""Engine and sessions. SQLite runs with WAL and foreign keys on, and connections
can cross threads, because FastAPI runs sync routes and background tasks in a
thread pool."""

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import SQLITE_PREFIX, get_settings


def make_engine(url: str) -> Engine:
    if not url.startswith("sqlite"):
        return create_engine(url)

    path = url.removeprefix(SQLITE_PREFIX)
    if path not in ("", ":memory:"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


engine = make_engine(get_settings().resolved_database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
