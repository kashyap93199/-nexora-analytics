"""Database engine, session factory and base declarative class.

Supports both PostgreSQL (production / docker-compose) and SQLite
(local development and tests) through the DATABASE_URL setting.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def _build_engine():
    url = settings.DATABASE_URL
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(url, **kwargs)

    if url.startswith("sqlite"):
        # Enable foreign keys in SQLite for referential integrity.
        @event.listens_for(engine, "connect")
        def _fk_pragma(dbapi_connection, connection_record):  # noqa: ANN001
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Import models first so metadata is populated."""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)