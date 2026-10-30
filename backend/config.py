import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

# Auto-load .env file if present in project root
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    try:
        with open(_env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and k not in os.environ:
                        os.environ[k] = v
    except Exception:
        pass

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Supabase database configuration
SUPABASE_HOST = os.getenv("SUPABASE_HOST", "")
SUPABASE_PORT = int(os.getenv("SUPABASE_PORT", "5432"))
SUPABASE_DBNAME = os.getenv("SUPABASE_DBNAME", "postgres")
SUPABASE_USER = os.getenv("SUPABASE_USER", "")
SUPABASE_PASSWORD = os.getenv("SUPABASE_PASSWORD", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data" / "generated_full")))
GROUND_TRUTH_DIR = Path(os.getenv("GROUND_TRUTH_DIR", str(BASE_DIR / "data" / "ground_truth")))
SQL_DIR = Path(os.getenv("SQL_DIR", str(BASE_DIR / "sql")))
