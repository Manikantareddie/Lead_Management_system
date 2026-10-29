import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Supabase database configuration
SUPABASE_HOST = os.getenv("SUPABASE_HOST", "")
SUPABASE_PORT = int(os.getenv("SUPABASE_PORT", "5432"))
SUPABASE_DBNAME = os.getenv("SUPABASE_DBNAME", "postgres")
SUPABASE_USER = os.getenv("SUPABASE_USER", "")
SUPABASE_PASSWORD = os.getenv("SUPABASE_PASSWORD", "")

DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data" / "generated_full")))
STARTER_DATA_DIR = Path(os.getenv("STARTER_DATA_DIR", str(BASE_DIR / "data" / "generated")))
GROUND_TRUTH_DIR = Path(os.getenv("GROUND_TRUTH_DIR", str(BASE_DIR / "data" / "ground_truth")))
SQL_DIR = Path(os.getenv("SQL_DIR", str(BASE_DIR / "sql")))
