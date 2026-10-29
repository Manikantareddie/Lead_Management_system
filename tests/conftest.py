"""Pytest configuration, path setup, and local tmpdir fixture."""

import shutil
import sys
from pathlib import Path
import pytest

# Ensure src/ is on sys.path for test discovery and imports
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


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
