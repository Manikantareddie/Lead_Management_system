"""Export module for CSV, JSON, and SQL deliverables."""

import csv
import json
from pathlib import Path
from typing import Any


def export_csv(dataset: dict[str, list[dict]], output_dir: Path | str) -> None:
    """Export all entities to CSV files."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    for entity_name, rows in dataset.items():
        if not rows:
            continue
        file_path = out_path / f"{entity_name}.csv"
        fieldnames = list(rows[0].keys())
        with open(file_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)


def export_json(dataset: dict[str, list[dict]], output_dir: Path | str) -> None:
    """Export all entities to individual JSON files and a combined dataset.json."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    for entity_name, rows in dataset.items():
        file_path = out_path / f"{entity_name}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)

    combined_path = out_path / "dataset.json"
    with open(combined_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)


def _sql_escape(val: Any) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    # String escape
    val_str = str(val).replace("'", "''")
    return f"'{val_str}'"


def export_sql(dataset: dict[str, list[dict]], sql_file_path: Path | str) -> None:
    """Generate SQL INSERT statements in dependency order."""
    file_path = Path(sql_file_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Dependency order
    order = [
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

    with open(file_path, "w", encoding="utf-8") as f:
        f.write("-- ============================================================================\n")
        f.write("-- YottaFlex Lead Management Seed Data\n")
        f.write("-- Auto-generated PostgreSQL INSERT statements in dependency order\n")
        f.write("-- ============================================================================\n\n")
        f.write("BEGIN;\n\n")

        for entity in order:
            rows = dataset.get(entity, [])
            if not rows:
                continue
            cols = list(rows[0].keys())
            cols_str = ", ".join(cols)
            f.write(f"-- Table: {entity} ({len(rows)} records)\n")
            for row in rows:
                values_str = ", ".join(_sql_escape(row.get(c)) for c in cols)
                f.write(f"INSERT INTO {entity} ({cols_str}) VALUES ({values_str});\n")
            f.write("\n")

        f.write("COMMIT;\n")
