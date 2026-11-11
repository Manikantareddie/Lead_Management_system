"""Pytest configuration, path setup, and local tmpdir fixture."""

import shutil
import sys
from pathlib import Path
import pytest

# Ensure src/ and project root are on sys.path for test discovery and imports
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


DEMO_ADMIN = {"username": "admin", "password": "admin123"}


def authenticated_client():
    """Return a TestClient with a valid admin bearer token pre-attached."""
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)
    resp = client.post("/api/auth/login", json=DEMO_ADMIN)
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
def local_tmp_path():
    """Provides a local temp directory under tests/.test_tmp to avoid Windows temp permission issues."""
    tmp_dir = PROJECT_ROOT / "tests" / ".test_tmp"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    yield tmp_dir
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)
