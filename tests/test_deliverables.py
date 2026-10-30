"""Tests for dataset exports (CSV, JSON, SQL) and configurable dataset scale."""

import json
from pathlib import Path
import pytest

from generator.config import DEFAULT_CONFIG, FULL_CONFIG
from generator.generate import generate
from generator.export import export_csv, export_json, export_sql


def test_scale_configurations():
    """Verify full-scale configuration matches the assessment targets."""
    assert FULL_CONFIG["leads"] == 20000
    assert FULL_CONFIG["contacts"] == 10000
    assert FULL_CONFIG["companies"] == 5000
    assert FULL_CONFIG["opportunities"] == 3000

    # Starter config preserved
    assert DEFAULT_CONFIG["leads"] == 30
    assert DEFAULT_CONFIG["companies"] == 10


def test_json_export(local_tmp_path):
    """Dataset exports to valid JSON files."""
    data = generate(DEFAULT_CONFIG)
    export_json(data, local_tmp_path)

    combined_file = local_tmp_path / "dataset.json"
    assert combined_file.exists()

    with open(combined_file, encoding="utf-8") as f:
        loaded = json.load(f)

    assert "leads" in loaded
    assert len(loaded["leads"]) == 30
    assert "companies" in loaded
    assert len(loaded["companies"]) == 10

    # Individual entity file
    leads_file = local_tmp_path / "leads.json"
    assert leads_file.exists()
    with open(leads_file, encoding="utf-8") as f:
        loaded_leads = json.load(f)
    assert len(loaded_leads) == 30


def test_sql_seed_export(local_tmp_path):
    """Dataset exports to valid PostgreSQL INSERT script in dependency order."""
    data = generate(DEFAULT_CONFIG)
    sql_path = local_tmp_path / "seed.sql"
    export_sql(data, sql_path)


    assert sql_path.exists()
    content = sql_path.read_text(encoding="utf-8")

    assert "BEGIN;" in content
    assert "COMMIT;" in content
    assert "INSERT INTO companies" in content
    assert "INSERT INTO contacts" in content
    assert "INSERT INTO leads" in content
    assert "INSERT INTO opportunities" in content

    # Dependency order: companies inserted before contacts, contacts before leads
    idx_comp = content.index("INSERT INTO companies")
    idx_cont = content.index("INSERT INTO contacts")
    idx_leads = content.index("INSERT INTO leads")
    idx_opps = content.index("INSERT INTO opportunities")

    assert idx_comp < idx_cont < idx_leads < idx_opps


def test_sql_schema_exists():
    """The PostgreSQL DDL schema exists and covers all required tables."""
    schema_path = Path(__file__).resolve().parents[1] / "sql" / "schema.sql"
    assert schema_path.exists()
    sql = schema_path.read_text(encoding="utf-8")

    required_tables = [
        "companies", "contacts", "salesreps", "score_rules", "campaigns",
        "leads", "lead_campaigns", "consents", "activities", "tasks",
        "task_decisions", "opportunities", "stage_histories", "ground_truth_exceptions",
    ]
    for tbl in required_tables:
        assert f"CREATE TABLE IF NOT EXISTS {tbl}" in sql, f"Missing table {tbl} in schema.sql"
