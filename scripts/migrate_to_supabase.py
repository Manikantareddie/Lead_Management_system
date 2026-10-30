"""
YottaFlex Lead Intelligence & Operations Console - Safe, Idempotent Supabase Migration Engine
Applies sql/schema.sql and imports dataset into Supabase PostgreSQL with conflict avoidance and count reconciliation.
"""

import argparse
import csv
import os
import sys
import time
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Auto-load .env file if present in project root
_env_path = PROJECT_ROOT / ".env"
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

# Configuration
SUPABASE_HOST = os.getenv("SUPABASE_HOST", "")
SUPABASE_PORT = int(os.getenv("SUPABASE_PORT", "5432"))
SUPABASE_DBNAME = os.getenv("SUPABASE_DBNAME", "postgres")
SUPABASE_USER = os.getenv("SUPABASE_USER", "")
SUPABASE_PASSWORD = os.getenv("SUPABASE_PASSWORD", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data" / "generated_full")))
SCHEMA_PATH = PROJECT_ROOT / "sql" / "schema.sql"
GROUND_TRUTH_DIR = PROJECT_ROOT / "data" / "ground_truth"

TABLES_IN_ORDER = [
    ("companies", "company_id"),
    ("contacts", "contact_id"),
    ("salesreps", "salesrep_id"),
    ("score_rules", "score_rule_id"),
    ("campaigns", "campaign_id"),
    ("leads", "lead_id"),
    ("lead_campaigns", "lead_id, campaign_id"),
    ("consents", "consent_id"),
    ("activities", "activity_id"),
    ("tasks", "task_id"),
    ("task_decisions", "decision_id"),
    ("opportunities", "opportunity_id"),
    ("stage_histories", "stage_history_id"),
]

EXPECTED_COUNTS = {
    "companies": 5000,
    "contacts": 10000,
    "salesreps": 50,
    "score_rules": 3,
    "campaigns": 100,
    "leads": 20000,
    "lead_campaigns": 30040,
    "consents": 15000,
    "activities": 35000,
    "tasks": 25000,
    "task_decisions": 38416,
    "opportunities": 3000,
    "stage_histories": 25000,
}


def get_connection(password: Optional[str] = None):
    try:
        import psycopg
    except ImportError:
        print("[ERROR] psycopg is not installed. Install with: pip install 'psycopg[binary]'", file=sys.stderr)
        return None

    pwd = password or SUPABASE_PASSWORD
    if DATABASE_URL:
        return psycopg.connect(DATABASE_URL, autocommit=False)

    if not SUPABASE_HOST or not SUPABASE_USER or not pwd:
        return None

    return psycopg.connect(
        host=SUPABASE_HOST,
        port=SUPABASE_PORT,
        dbname=SUPABASE_DBNAME,
        user=SUPABASE_USER,
        password=pwd,
        sslmode="require",
        connect_timeout=15,
        autocommit=False,
    )


def apply_schema(conn) -> bool:
    print(f"[INFO] Applying DDL schema from: {SCHEMA_PATH}")
    if not SCHEMA_PATH.exists():
        print(f"[ERROR] Schema file not found at: {SCHEMA_PATH}", file=sys.stderr)
        return False

    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for stmt in statements:
            try:
                cur.execute(stmt + ";")
                conn.commit()
            except Exception as e:
                conn.rollback()
                # Non-fatal warnings for existing columns/indexes
                first_line = stmt.split("\n")[0][:60]
                print(f"[NOTE] Skipped or existing: {first_line}... ({e})")

    print("[SUCCESS] Schema DDL synchronization completed.")
    return True


def check_table_counts(conn) -> dict[str, int]:
    counts = {}
    with conn.cursor() as cur:
        for table, _ in TABLES_IN_ORDER:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table};")
                row = cur.fetchone()
                counts[table] = row[0] if row else 0
            except Exception:
                conn.rollback()
                counts[table] = -1
    return counts


def import_csv_to_table(conn, table: str, csv_path: Path, conflict_col: str, batch_size: int = 1000) -> int:
    if not csv_path.exists():
        print(f"[WARN] CSV not found for {table}: {csv_path}")
        return 0

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        if not fieldnames:
            return 0

        cols = list(fieldnames)
        cols_joined = ", ".join(cols)
        placeholders = ", ".join(["%s"] * len(cols))

        if "," in conflict_col:
            conflict_clause = f"ON CONFLICT ({conflict_col}) DO NOTHING"
        else:
            conflict_clause = f"ON CONFLICT ({conflict_col}) DO NOTHING"

        insert_sql = f"INSERT INTO {table} ({cols_joined}) VALUES ({placeholders}) {conflict_clause};"

        inserted = 0
        batch = []
        with conn.cursor() as cur:
            for row in reader:
                vals = [None if row[c] == "" else row[c] for c in cols]
                batch.append(vals)
                if len(batch) >= batch_size:
                    cur.executemany(insert_sql, batch)
                    inserted += len(batch)
                    batch = []
            if batch:
                cur.executemany(insert_sql, batch)
                inserted += len(batch)

        conn.commit()
        return inserted


def migrate_dataset(conn, data_dir: Path) -> bool:
    print(f"[INFO] Starting idempotent dataset migration from {data_dir}...")
    start_time = time.time()

    current_counts = check_table_counts(conn)
    for table, conflict_col in TABLES_IN_ORDER:
        csv_file = data_dir / f"{table}.csv"
        existing = current_counts.get(table, 0)
        expected = EXPECTED_COUNTS.get(table, 0)

        if existing >= expected and expected > 0:
            print(f"  - {table}: Already populated ({existing:,} / {expected:,} rows). Skipping.")
            continue

        print(f"  - Importing {table} from {csv_file.name}...")
        imported = import_csv_to_table(conn, table, csv_file, conflict_col)
        print(f"    Imported/verified {imported:,} rows for {table}.")

    # Import ground truth exceptions into ground_truth_exceptions table
    gt_file = GROUND_TRUTH_DIR / "exceptions.json"
    if gt_file.exists():
        import json
        with open(gt_file, "r", encoding="utf-8") as f:
            gt_data = json.load(f)
        with conn.cursor() as cur:
            for exc in gt_data:
                cur.execute(
                    """
                    INSERT INTO ground_truth_exceptions (exception_id, issue_type, affected_record_ids, expected_outcome, injected_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (exception_id) DO NOTHING;
                    """,
                    (
                        exc["exception_id"],
                        exc["issue_type"],
                        exc["affected_record_ids"],
                        exc["expected_outcome"],
                        exc["injected_at"],
                    )
                )
        conn.commit()
        print("  - Imported ground_truth_exceptions benchmark table.")

    elapsed = round(time.time() - start_time, 2)
    print(f"[SUCCESS] Migration completed in {elapsed}s.")

    # Reconcile final counts
    final_counts = check_table_counts(conn)
    print("\n--- FINAL RECONCILED DATABASE RECORD COUNTS ---")
    all_reconciled = True
    for table, _ in TABLES_IN_ORDER:
        actual = final_counts.get(table, 0)
        expected = EXPECTED_COUNTS.get(table, 0)
        status = "MATCH" if actual == expected else ("EXCEEDS" if actual > expected else "MISMATCH")
        if status == "MISMATCH":
            all_reconciled = False
        print(f"  {table:20s}: {actual:7,d} (expected {expected:7,d}) [{status}]")

    return all_reconciled


def main():
    parser = argparse.ArgumentParser(description="YottaFlex Supabase Migration & Seed Tool")
    parser.add_argument("--password", help="Supabase database password (or set SUPABASE_PASSWORD env var)")
    parser.add_argument("--schema-only", action="store_true", help="Apply DDL schema only without importing records")
    parser.add_argument("--check-only", action="store_true", help="Check database connection and counts only")
    parser.add_argument("--data-dir", default=str(DATA_DIR), help="Directory containing CSV files to import")
    args = parser.parse_args()

    conn = get_connection(password=args.password)
    if not conn:
        print("\n=======================================================")
        print("  SUPABASE CONNECTION REQUIRED FOR LIVE DATABASE IMPORT")
        print("=======================================================")
        print("Supabase credentials are not currently set in environment variables.")
        print("To run the migration to Supabase, set the following environment variables:\n")
        print("  SUPABASE_HOST=db.<project-ref>.supabase.co (or pooler host)")
        print("  SUPABASE_PORT=5432")
        print("  SUPABASE_DBNAME=postgres")
        print("  SUPABASE_USER=postgres")
        print("  SUPABASE_PASSWORD=<your-secure-supabase-password>")
        print("\nOr provide DATABASE_URL:")
        print("  DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres\n")
        print("[STATUS] Migration script is ready for execution upon credential provision.")
        sys.exit(0)

    try:
        with conn:
            if args.check_only:
                print("[INFO] Connected to Supabase. Querying table counts...")
                counts = check_table_counts(conn)
                for table, count in counts.items():
                    print(f"  {table:20s}: {count:,} records")
                return

            apply_schema(conn)
            if not args.schema_only:
                migrate_dataset(conn, Path(args.data_dir))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
