"""Test setup: a throwaway SQLite file and storage folder, recreated for every test.

The environment is set before the app is imported, so the app's engine, the
background tasks and the storage helpers all use the test database. Gemini is
off in tests; mock it where a test needs AI output.
"""

import os
import shutil
import tempfile
from pathlib import Path

TMP_DIR = Path(tempfile.mkdtemp(prefix="forensix-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{TMP_DIR / 'test.db'}"
os.environ["STORAGE_DIR"] = str(TMP_DIR / "storage")
os.environ["GEMINI_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

get_settings.cache_clear()


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    shutil.rmtree(TMP_DIR / "storage", ignore_errors=True)
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    shutil.rmtree(TMP_DIR, ignore_errors=True)
