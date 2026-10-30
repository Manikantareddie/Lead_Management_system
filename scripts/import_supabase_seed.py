"""
YottaFlex Lead Management - Safe Supabase Seed Importer
Imports the full generated SQL seed (data/generated_full/seed.sql) into Supabase PostgreSQL.
Preserves SQL transaction boundaries (BEGIN; / COMMIT;) and verifies row counts before committing.
"""

import argparse
import getpass
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional
import psycopg
from psycopg.pq import TransactionStatus

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Auto-load .env
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

DEFAULT_SEED_PATH = PROJECT_ROOT / "data" / "generated_full" / "seed.sql"
DEFAULT_BATCH_SIZE = 500  # Number of INSERT statements per multi-statement query chunk

# 13 Target Tables in Foreign Key Dependency Order
TARGET_TABLES = [
    "companies",
    "contacts",
    "salesreps",
    "score_rules",
    "campaigns",
    "leads",
    "lead_campaigns",
    "consents",
    "activities",
    "tasks",
    "task_decisions",
    "opportunities",
    "stage_histories",
]

# Expected record counts for the full-scale dataset
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


def check_seed_file(seed_path: Path) -> int:
    """Verify seed file exists and is non-empty before connecting."""
    if not seed_path.exists():
        print(f"[ERROR] Seed file not found at: {seed_path}")
        sys.exit(1)
    size_bytes = seed_path.stat().st_size
    if size_bytes == 0:
        print(f"[ERROR] Seed file at {seed_path} is empty.")
        sys.exit(1)
    return size_bytes


def get_connection(password_override: Optional[str] = None) -> Any:
    """Establish connection to Supabase PostgreSQL using env or overrides."""
    host = os.getenv("SUPABASE_HOST", "")
    port = int(os.getenv("SUPABASE_PORT", "5432"))
    dbname = os.getenv("SUPABASE_DBNAME", "postgres")
    user = os.getenv("SUPABASE_USER", "")
    password = password_override or os.getenv("SUPABASE_PASSWORD", "")

    if host and user and password:
        return psycopg.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            sslmode="require",
            connect_timeout=30,
            autocommit=True,  # Allows SQL script BEGIN; and COMMIT; to manage transaction boundaries
        )

    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg.connect(db_url, autocommit=True)

    print("[ERROR] Supabase credentials not found in environment or .env file.")
    print("Please set SUPABASE_HOST, SUPABASE_USER, and SUPABASE_PASSWORD in .env.")
    sys.exit(1)


def check_table_counts(cur) -> dict:
    """Query counts for all target tables."""
    counts = {}
    for table in TARGET_TABLES:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table};")
            row = cur.fetchone()
            counts[table] = row[0] if row else 0
        except Exception:
            counts[table] = None
    return counts


def clear_tables(cur):
    """Truncate tables in reverse foreign key order."""
    print("[INFO] Clearing existing tables before import...")
    for table in reversed(TARGET_TABLES):
        try:
            cur.execute(f"TRUNCATE TABLE {table} CASCADE;")
        except Exception as e:
            print(f"  [WARN] Truncate {table}: {e}")
    print("[OK] Tables cleared successfully.")


def import_seed(
    seed_path: Path,
    password: Optional[str] = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
    force: bool = False,
) -> bool:
    """
    Stream and execute seed.sql inside a single transaction.
    Preserves SQL BEGIN; and COMMIT; boundaries and halts/rolls back on first error.
    """
    print(f"\n[INFO] Connecting to Supabase...")
    try:
        conn = get_connection(password_override=password)
    except Exception as e:
        print(f"[ERROR] Failed to connect to Supabase: {type(e).__name__}: {e}")
        return False

    with conn:
        with conn.cursor() as cur:
            # Check existing data
            counts = check_table_counts(cur)
            non_empty = {k: v for k, v in counts.items() if v and v > 0}

            if non_empty:
                if not force:
                    print("\n[NOTICE] Supabase target tables already contain records:")
                    for tbl, c in non_empty.items():
                        print(f"  - {tbl:<16}: {c:>6,d} records")
                    print("\nTo safely check counts without changing data, run:")
                    print("    python scripts/import_supabase_seed.py --check-only")
                    print("\nTo overwrite and re-seed, run with the --force flag:")
                    print("    python scripts/import_supabase_seed.py --force")
                    return False
                else:
                    clear_tables(cur)

            print(f"[INFO] Streaming seed from {seed_path} (batch size: {batch_size})...")

            start_time = time.time()
            total_statements = 0
            total_rows = 0
            batch = []
            current_table = None
            in_transaction = False
            last_line_num = 0

            try:
                with open(seed_path, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        last_line_num = line_num
                        stripped = line.strip()

                        # Detect table section header comment
                        if stripped.startswith("-- Table:"):
                            if batch:
                                cur.execute("\n".join(batch))
                                total_statements += len(batch)
                                batch = []
                            current_table = stripped[9:].split("(")[0].strip()
                            print(f"  -> Importing table: {current_table}...")
                            continue

                        # Skip comments and empty lines
                        if not stripped or stripped.startswith("--"):
                            continue

                        # Explicit transaction control from SQL file
                        if stripped == "BEGIN;":
                            cur.execute("BEGIN;")
                            in_transaction = True
                            print("[INFO] Transaction started (BEGIN;).")
                            continue

                        if stripped == "COMMIT;":
                            if batch:
                                cur.execute("\n".join(batch))
                                total_statements += len(batch)
                                batch = []

                            # Pre-commit verification
                            print("\n[INFO] Pre-commit row count verification inside open transaction:")
                            total_rows = 0
                            mismatches = {}
                            for table in TARGET_TABLES:
                                cur.execute(f"SELECT COUNT(*) FROM {table};")
                                count_row = cur.fetchone()
                                count = count_row[0] if count_row else 0
                                total_rows += count
                                expected = EXPECTED_COUNTS.get(table)
                                if expected is not None and count != expected:
                                    mismatches[table] = (count, expected)
                                    print(f"  [MISMATCH] {table}: {count:,} rows (expected: {expected:,})")
                                else:
                                    print(f"  [OK] {table}: {count:,} rows")

                            if mismatches:
                                print("\n[ERROR] Row count mismatch detected before commit! Rolling back...")
                                cur.execute("ROLLBACK;")
                                in_transaction = False
                                print("[INFO] Transaction rolled back. Zero rows committed.")
                                for table, (actual, exp) in mismatches.items():
                                    print(f"  - {table}: actual {actual:,} vs expected {exp:,}")
                                return False

                            cur.execute("COMMIT;")
                            in_transaction = False
                            print("[INFO] All row counts verified against expected values.")
                            print("[INFO] Transaction committed (COMMIT;).")
                            continue

                        batch.append(stripped)

                        if len(batch) >= batch_size:
                            cur.execute("\n".join(batch))
                            total_statements += len(batch)
                            batch = []
                            if total_statements % 25000 < batch_size:
                                print(f"     ... {total_statements:,} statements executed")

                if in_transaction:
                    print("\n[ERROR] File ended without COMMIT;. Rolling back transaction...")
                    cur.execute("ROLLBACK;")
                    in_transaction = False
                    return False

                elapsed = time.time() - start_time
                print("\n[SUCCESS] Seed import and pre-commit verification completed successfully!")
                print(f"[INFO] Total INSERT statements executed: {total_statements:,}")
                print(f"[INFO] Total verified rows committed to Supabase: {total_rows:,}")
                print(f"[INFO] Total elapsed time: {elapsed:.1f} seconds")
                return True

            except Exception as e:
                print(f"\n[ERROR] SQL execution failed at line {last_line_num}:")
                print(f"  {type(e).__name__}: {e}")

                if in_transaction or conn.info.transaction_status in (
                    TransactionStatus.INTRANS,
                    TransactionStatus.INERROR,
                ):
                    print("[INFO] Rolling back transaction...")
                    try:
                        cur.execute("ROLLBACK;")
                        print("[INFO] Transaction successfully rolled back.")
                    except Exception as rb_err:
                        print(f"[WARN] Rollback attempt encountered: {rb_err}")

                return False


def main():
    parser = argparse.ArgumentParser(description="Safely import YottaFlex SQL seed into Supabase.")
    parser.add_argument(
        "--check-only",
        "-c",
        action="store_true",
        help="Check table row counts in Supabase without modifying any data",
    )
    parser.add_argument(
        "--seed-file",
        type=Path,
        default=DEFAULT_SEED_PATH,
        help=f"Path to SQL seed file (default: {DEFAULT_SEED_PATH})",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Number of INSERT statements per multi-statement query chunk (default: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--password",
        type=str,
        default=None,
        help="Supabase database password (defaults to SUPABASE_PASSWORD from .env)",
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Force re-import and clear existing records",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("YottaFlex Supabase Seed Importer (Single Transaction)")
    print("=" * 70)

    # 1. Check-only mode
    if args.check_only:
        password = args.password or os.getenv("SUPABASE_PASSWORD")
        if not password:
            password = getpass.getpass("Enter your Supabase database password: ")
        try:
            conn = get_connection(password_override=password)
            with conn.cursor() as cur:
                counts = check_table_counts(cur)
                print("\nCurrent Supabase Table Counts:")
                total = 0
                for table, count in counts.items():
                    if count is not None:
                        expected = EXPECTED_COUNTS.get(table, 0)
                        status = "[OK]" if count == expected else f"[expected {expected:,}]"
                        print(f"  {table:<16}: {count:>8,d}  {status}")
                        total += count
                    else:
                        print(f"  {table:<16}: [TABLE NOT FOUND]")
                print(f"  {'TOTAL':<16}: {total:>8,d}")
            conn.close()
            return
        except Exception as e:
            print(f"[ERROR] Failed to query Supabase: {e}")
            sys.exit(1)

    # 2. Verify seed file exists and non-empty
    size_bytes = check_seed_file(args.seed_file)
    print(f"[OK] Seed file found: {args.seed_file} ({size_bytes / (1024 * 1024):.2f} MB)")

    # 3. Retrieve password (env, arg, or fallback prompt)
    password = args.password or os.getenv("SUPABASE_PASSWORD")
    if not password:
        password = getpass.getpass("Enter your Supabase database password: ")
    if not password:
        print("[ERROR] Password cannot be empty.")
        sys.exit(1)

    # 4. Execute import
    success = import_seed(
        args.seed_file,
        password=password,
        batch_size=args.batch_size,
        force=args.force,
    )
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
