"""
YottaFlex Lead Management - Supabase Schema Migration & Full Seed Importer
Applies the canonical sql/schema.sql and imports all 13 core tables plus benchmark anomalies into Supabase.
"""

import argparse
import csv
import os
import sys
import time
from pathlib import Path
from typing import Any
import psycopg

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "sql" / "schema.sql"
DATA_DIR = PROJECT_ROOT / "data" / "generated_full"
GROUND_TRUTH_DIR = PROJECT_ROOT / "data" / "ground_truth"

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

TABLES_IN_ORDER = [
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
    "ground_truth_exceptions": 5,
}


def get_connection() -> Any:
    """Establish robust connection to Supabase PostgreSQL."""
    host = os.getenv("SUPABASE_HOST")
    user = os.getenv("SUPABASE_USER")
    password = os.getenv("SUPABASE_PASSWORD")
    port = int(os.getenv("SUPABASE_PORT", "5432"))
    dbname = os.getenv("SUPABASE_DBNAME", "postgres")

    if host and user and password:
        return psycopg.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            sslmode="require",
            connect_timeout=20,
            autocommit=False,
        )

    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg.connect(db_url, autocommit=False)

    print("[ERROR] Supabase credentials not found in environment or .env file.")
    print("Please set SUPABASE_HOST, SUPABASE_USER, and SUPABASE_PASSWORD in your .env file.")
    sys.exit(1)


def check_database_status(conn):
    """Query and display live row counts for all tables."""
    print("\n" + "=" * 65)
    print("  SUPABASE DATABASE STATUS & TABLE RECONCILIATION")
    print("=" * 65)
    with conn.cursor() as cur:
        total_records = 0
        all_tables = TABLES_IN_ORDER + ["ground_truth_exceptions"]
        for tbl in all_tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {tbl};")
                row = cur.fetchone()
                count = row[0] if row else 0
                expected = EXPECTED_COUNTS.get(tbl, 0)
                status = "[OK]" if count == expected else f"[PARTIAL - expected {expected:,}]"
                print(f"  {tbl:<24}: {count:>8,d} records  {status}")
                total_records += count
            except Exception:
                conn.rollback()
                print(f"  {tbl:<24}: [TABLE NOT FOUND / NOT CREATED]")
        print("-" * 65)
        print(f"  Total Database Records : {total_records:>8,d}")
        print("=" * 65)
        return total_records


def recreate_canonical_schema(conn):
    """Apply clean schema DDL from sql/schema.sql."""
    print("\n[1/3] Aligning database schema with canonical YottaFlex DDL...")
    tables_to_drop = [
        "task_decisions",
        "stage_histories",
        "lead_campaigns",
        "opportunities",
        "tasks",
        "activities",
        "consents",
        "leads",
        "campaigns",
        "score_rules",
        "salesreps",
        "contacts",
        "companies",
        "ground_truth_exceptions",
    ]
    with conn.cursor() as cur:
        for tbl in tables_to_drop:
            cur.execute(f"DROP TABLE IF EXISTS {tbl} CASCADE;")
        conn.commit()

        ddl = SCHEMA_PATH.read_text(encoding="utf-8")
        cur.execute(ddl)
        conn.commit()
    print("[SUCCESS] Canonical schema created successfully with all primary & foreign keys.")


def import_table(conn, table_name: str, csv_file: Path, batch_size: int = 2000):
    """Import CSV data into Supabase using parameterized multi-row execution."""
    if not csv_file.exists():
        print(f"  [WARN] File not found: {csv_file}")
        return 0

    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames
        if not cols:
            return 0

        col_str = ", ".join(cols)
        placeholder_str = ", ".join(["%s"] * len(cols))
        query = f"INSERT INTO {table_name} ({col_str}) VALUES ({placeholder_str}) ON CONFLICT DO NOTHING;"

        batch = []
        total = 0
        with conn.cursor() as cur:
            for row in reader:
                vals = [None if row[c] == "" else row[c] for c in cols]
                batch.append(vals)
                if len(batch) >= batch_size:
                    cur.executemany(query, batch)
                    conn.commit()
                    total += len(batch)
                    batch = []
            if batch:
                cur.executemany(query, batch)
                conn.commit()
                total += len(batch)
    return total


def run_full_migration(conn, batch_size: int = 2000):
    """Execute complete migration and data seeding."""
    recreate_canonical_schema(conn)

    print("\n[2/3] Importing full dataset (206,609 records) into Supabase PostgreSQL...")
    import_sequence = [
        ("companies", DATA_DIR / "companies.csv"),
        ("contacts", DATA_DIR / "contacts.csv"),
        ("salesreps", DATA_DIR / "salesreps.csv"),
        ("score_rules", DATA_DIR / "score_rules.csv"),
        ("campaigns", DATA_DIR / "campaigns.csv"),
        ("leads", DATA_DIR / "leads.csv"),
        ("lead_campaigns", DATA_DIR / "lead_campaigns.csv"),
        ("consents", DATA_DIR / "consents.csv"),
        ("activities", DATA_DIR / "activities.csv"),
        ("tasks", DATA_DIR / "tasks.csv"),
        ("task_decisions", DATA_DIR / "task_decisions.csv"),
        ("opportunities", DATA_DIR / "opportunities.csv"),
        ("stage_histories", DATA_DIR / "stage_histories.csv"),
    ]

    total_imported = 0
    total_start = time.time()
    for tbl, path in import_sequence:
        start_t = time.time()
        count = import_table(conn, tbl, path, batch_size=batch_size)
        total_imported += count
        elapsed = time.time() - start_t
        print(f"  [OK] {tbl:<16}: {count:>6,d} records imported ({elapsed:.1f}s)")

    # Import ground truth exceptions
    gt_csv = GROUND_TRUTH_DIR / "exceptions.csv"
    if gt_csv.exists():
        gt_count = import_table(conn, "ground_truth_exceptions", gt_csv)
        total_imported += gt_count
        print(f"  [OK] ground_truth_exceptions: {gt_count} benchmark anomalies imported")

    total_elapsed = time.time() - total_start
    print(f"\n[3/3] Seed import finished in {total_elapsed:.1f}s. Reconciling live counts...")
    check_database_status(conn)
    print("\n[COMPLETE] Supabase database migration and seeding successfully finished!")


def main():
    parser = argparse.ArgumentParser(
        description="YottaFlex Supabase Schema Migration & Full Seed Importer"
    )
    parser.add_argument(
        "--check-only",
        "-c",
        action="store_true",
        help="Check database connection and table row counts without modifying any data",
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Force schema re-creation and full seed import",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=2000,
        help="Batch size for INSERT execution (default: 2000)",
    )
    args = parser.parse_args()

    conn = get_connection()

    if args.check_only:
        check_database_status(conn)
        conn.close()
        return

    # Check existing data before executing destructive import
    existing_count = 0
    with conn.cursor() as cur:
        try:
            cur.execute("SELECT COUNT(*) FROM leads;")
            row = cur.fetchone()
            existing_count = row[0] if row else 0
        except Exception:
            conn.rollback()

    if existing_count > 0 and not args.force:
        print(f"\n[NOTICE] Supabase already contains {existing_count:,} leads.")
        print("To safely check live database counts without changes, run:")
        print("    python scripts/migrate_and_seed_supabase.py --check-only")
        print("\nTo overwrite and re-seed from scratch, run with the --force flag:")
        print("    python scripts/migrate_and_seed_supabase.py --force")
        conn.close()
        return

    try:
        run_full_migration(conn, batch_size=args.batch_size)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
