"""
YottaFlex Lead Management - Safe Supabase Seed Importer
Imports the full generated SQL seed (data/generated_full/seed.sql) into Supabase PostgreSQL.
Preserves the existing BEGIN/COMMIT transaction boundaries without independent commits.
"""

import argparse
import getpass
import os
from pathlib import Path
import sys
import time
import psycopg
from psycopg.pq import TransactionStatus

# Connection configuration (mirrors test_supabase.py without hardcoded credentials)
HOST = os.getenv("SUPABASE_HOST", "")
PORT = int(os.getenv("SUPABASE_PORT", "5432"))
DBNAME = os.getenv("SUPABASE_DBNAME", "postgres")
USER = os.getenv("SUPABASE_USER", "")
CONNECT_TIMEOUT = 30
DEFAULT_SEED_PATH = Path("data/generated_full/seed.sql")
DEFAULT_BATCH_SIZE = 500  # Number of INSERT statements per multi-statement query chunk

# 12 Target Tables in Foreign Key Dependency Order
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


def check_tables_empty(cur) -> bool:
    """
    Check if any of the target tables contain records.
    Returns True if all tables are empty, False otherwise.
    """
    non_empty = {}
    for table in TARGET_TABLES:
        cur.execute(f"SELECT COUNT(*) FROM {table};")
        count = cur.fetchone()[0]
        if count > 0:
            non_empty[table] = count

    if non_empty:
        print("\n[ABORT] Target database is not empty. Found existing records in:")
        for table, count in non_empty.items():
            print(f"  - {table}: {count:,} records")
        print("\n[ABORT] Import aborted to prevent corrupting existing data.")
        print("[INFO] No records were deleted, truncated, or inserted.")
        return False

    return True


def import_seed(seed_path: Path, password: str, batch_size: int = DEFAULT_BATCH_SIZE) -> bool:
    """
    Stream and execute seed.sql inside a single transaction.
    Preserves SQL BEGIN; and COMMIT; boundaries and halts/rolls back on first error.
    """
    if not HOST or not USER:
        print("[ERROR] Set SUPABASE_HOST and SUPABASE_USER before importing.")
        return False

    print(f"\n[INFO] Connecting to Supabase at {HOST}:{PORT}...")
    try:
        conn = psycopg.connect(
            host=HOST,
            port=PORT,
            dbname=DBNAME,
            user=USER,
            password=password,
            sslmode="require",
            connect_timeout=CONNECT_TIMEOUT,
            autocommit=True,  # Allows SQL script BEGIN; and COMMIT; to manage transaction boundaries
        )
    except Exception as e:
        # Do not expose credentials in error output
        print(f"[ERROR] Failed to connect to Supabase: {type(e).__name__}: {e}")
        return False

    with conn:
        with conn.cursor() as cur:
            # Step 1: Pre-flight check on existing table contents
            print("[INFO] Checking target tables for existing data...")
            if not check_tables_empty(cur):
                return False

            print("[INFO] Target database is clean. All 12 tables are empty.")
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
                            # Flush any pending batch from previous table before switching
                            if batch:
                                cur.execute("\n".join(batch))
                                total_statements += len(batch)
                                batch = []
                            current_table = stripped[9:].split("(")[0].strip()
                            print(f"  -> Importing table: {current_table}...")
                            continue

                        # Skip empty lines and other comments
                        if not stripped or stripped.startswith("--"):
                            continue

                        # Explicit transaction control from SQL file
                        if stripped == "BEGIN;":
                            cur.execute("BEGIN;")
                            in_transaction = True
                            print("[INFO] Transaction started (BEGIN;).")
                            continue

                        if stripped == "COMMIT;":
                            # Flush remaining batch before verification and commit
                            if batch:
                                cur.execute("\n".join(batch))
                                total_statements += len(batch)
                                batch = []

                            # Verify row counts in all tables within the open transaction BEFORE committing
                            print("\n[INFO] Pre-commit row count verification inside open transaction:")
                            total_rows = 0
                            mismatches = {}
                            for table in TARGET_TABLES:
                                cur.execute(f"SELECT COUNT(*) FROM {table};")
                                count = cur.fetchone()[0]
                                total_rows += count
                                expected = EXPECTED_COUNTS.get(table)
                                if expected is not None and count != expected:
                                    mismatches[table] = (count, expected)
                                    print(f"  ✗ {table}: {count:,} rows (expected: {expected:,})")
                                else:
                                    print(f"  ✓ {table}: {count:,} rows")

                            if mismatches:
                                print("\n[ERROR] Row count mismatch detected before commit! Rolling back entire transaction...")
                                cur.execute("ROLLBACK;")
                                in_transaction = False
                                print("[INFO] Transaction rolled back. Zero rows committed to database.")
                                print("[ERROR] Mismatched tables:")
                                for table, (actual, exp) in mismatches.items():
                                    print(f"  - {table}: actual {actual:,} vs expected {exp:,}")
                                return False

                            # All counts match expected values; safe to commit
                            cur.execute("COMMIT;")
                            in_transaction = False
                            print("[INFO] All row counts verified against expected values.")
                            print("[INFO] Transaction committed (COMMIT;).")
                            continue

                        # Accumulate statement
                        batch.append(stripped)

                        if len(batch) >= batch_size:
                            cur.execute("\n".join(batch))
                            total_statements += len(batch)
                            batch = []
                            if total_statements % 25000 < batch_size:
                                print(f"     ... {total_statements:,} statements executed")

                # If file ended while still in transaction without COMMIT;
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

                # Rollback transaction if active or in error
                if in_transaction or conn.info.transaction_status in (
                    TransactionStatus.INTRANS,
                    TransactionStatus.INERROR,
                ):
                    print("[INFO] Rolling back transaction...")
                    try:
                        cur.execute("ROLLBACK;")
                        print("[INFO] Transaction successfully rolled back. No changes were committed.")
                    except Exception as rb_err:
                        print(f"[WARN] Rollback attempt encountered: {rb_err}")

                return False


def main():
    parser = argparse.ArgumentParser(description="Safely import YottaFlex SQL seed into Supabase.")
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
    args = parser.parse_args()

    print("=" * 70)
    print("YottaFlex Supabase Seed Importer (Single Transaction)")
    print("=" * 70)

    # 1. Verify seed file exists and non-empty BEFORE connecting
    size_bytes = check_seed_file(args.seed_file)
    print(f"[OK] Seed file found: {args.seed_file} ({size_bytes / (1024 * 1024):.2f} MB)")

    # 2. Prompt for password securely using identical method as test_supabase.py
    password = getpass.getpass("Enter your Supabase database password: ")
    if not password:
        print("[ERROR] Password cannot be empty.")
        sys.exit(1)

    # 3. Execute import in single transaction
    success = import_seed(args.seed_file, password, batch_size=args.batch_size)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
