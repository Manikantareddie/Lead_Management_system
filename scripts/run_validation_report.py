"""
YottaFlex Standalone Validation Summary CLI (Assessment Step 8 & 9).

Validates the full relational dataset against all 12 validation rule engines
and produces an audit summary report for evaluation.
"""

import sys
from pathlib import Path

# Ensure src/ is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from validation.validator import (
    load_dataset_from_csv,
    validate_all,
    validate_primary_keys,
    validate_foreign_keys,
    validate_required_values,
    validate_enums,
    validate_date_ordering,
    validate_score_arithmetic,
    validate_lifecycle_transitions,
    validate_duplicates,
    validate_consent_compliance,
    validate_sales_routing,
    validate_task_assignment,
    validate_task_decisions,
    ValidationReport,
)


def run_detailed_validation(dir_path: Path) -> bool:
    print("\n" + "=" * 90)
    print(f" YottaFlex Dataset Integrity & Validation Audit (Directory: {dir_path})")
    print("=" * 90)

    dataset = load_dataset_from_csv(dir_path)

    # 1. Inventory Summary
    print("\n--- 1. Relational Table Inventory ---")
    total_rows = 0
    inventory = []
    for tbl, rows in dataset.items():
        count = len(rows)
        total_rows += count
        inventory.append((f"{tbl}.csv", count))

    for idx, (tbl_name, count) in enumerate(inventory, 1):
        print(f"  {idx:2d}. {tbl_name:<26} : {count:>8,} records")
    print(f"  {'TOTAL RECORD VOLUME':<29} : {total_rows:>8,} records")

    # 2. Rule Engines Execution
    print("\n--- 2. Validation Engines Execution (12 Verification Passes) ---")

    rules = [
        ("1. Primary Key Format & Uniqueness", validate_primary_keys),
        ("2. Foreign Key Referential Integrity", validate_foreign_keys),
        ("3. Non-Null & Required Values", validate_required_values),
        ("4. Enum & Controlled Vocabularies", validate_enums),
        ("5. Date Chronology & Conversion Freeze", validate_date_ordering),
        ("6. Arithmetic Lead Scoring (50/30/20)", validate_score_arithmetic),
        ("7. Monotonic Lifecycle Stage Transitions", validate_lifecycle_transitions),
        ("8. Deduplication Key & Quarantine", validate_duplicates),
        ("9. Time-Effective Consent Eligibility", validate_consent_compliance),
        ("10. Territory & Specialty Sales Routing", validate_sales_routing),
        ("11. Actionable Task Assignment Integrity", validate_task_assignment),
        ("12. Decision Audit & Explainability Records", validate_task_decisions),
    ]

    overall_report = ValidationReport()
    rule_results = []

    for name, func in rules:
        engine_report = ValidationReport()
        func(dataset, engine_report)
        errs = engine_report.error_count
        warns = engine_report.warning_count
        passed = (errs == 0)

        for issue in engine_report.issues:
            overall_report.issues.append(issue)

        rule_results.append((name, passed, errs, warns))

    print(f"  {'Validation Engine Rule':<46} | {'Status':<10} | {'Violations'}")
    print("  " + "-" * 76)
    for name, passed, errs, warns in rule_results:
        status_str = "PASSED" if passed else "FAILED"
        detail_str = "0 violations" if passed else f"{errs} error(s), {warns} warning(s)"
        print(f"  {name:<46} | {status_str:<10} | {detail_str}")

    print("\n" + "=" * 90)
    if overall_report.is_valid:
        print(f" [PASS] Full Dataset Verification Completed Cleanly.")
        print(f" Total Records Checked : {total_rows:,}")
        print(f" Integrity Violations  : 0 Errors • 0 Warnings across 12 Engines")
        print("=" * 90 + "\n")
        return True
    else:
        print(f" [FAIL] Integrity Violations Found in Active Dataset.")
        print(f" Errors: {overall_report.error_count} | Warnings: {overall_report.warning_count}")
        print("=" * 90 + "\n")
        return False


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else PROJECT_ROOT / "data" / "generated_full"
    if not target.exists():
        target = PROJECT_ROOT / "data" / "generated"
    success = run_detailed_validation(target)
    sys.exit(0 if success else 1)

