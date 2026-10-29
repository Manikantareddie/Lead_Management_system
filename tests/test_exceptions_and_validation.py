"""Tests for data validation and ground-truth exception handling.

Covers:
- Validation on clean baseline dataset (asserting 0 errors)
- Detection of all 5 required assessment exception scenarios:
  1. Opted-out lead contacted
  2. Score influenced post-conversion
  3. Lead assigned outside territory
  4. Duplicate lead creates duplicate opportunity
  5. Stage-history gaps
- Ground-truth export formats (CSV and JSON)
- Reproducibility of ground truth output across identical seeds
- Comprehensive validation rule boundary checks (PK, FK, enums, dates, score math)
"""

import copy
import json
from pathlib import Path

import pytest

from generator.generate import generate, DEFAULT_CONFIG
from generator.exceptions import inject_exceptions, write_ground_truth
from validation.validator import (
    validate_all,
    validate_primary_keys,
    validate_foreign_keys,
    validate_enums,
    validate_date_ordering,
    validate_score_arithmetic,
    validate_lifecycle_transitions,
    validate_duplicates,
    validate_consent_compliance,
    validate_sales_routing,
    ValidationReport,
)


@pytest.fixture(scope="module")
def baseline_dataset():
    """Generate clean baseline dataset with default seed."""
    return generate(DEFAULT_CONFIG)


def test_baseline_dataset_passes_validation(baseline_dataset):
    """Clean baseline data must pass all validation checks with zero errors."""
    report = validate_all(baseline_dataset)
    assert report.is_valid is True, f"Baseline validation failed:\n{report.summary()}"
    assert report.error_count == 0


def test_all_five_required_exceptions_injected_and_detected(baseline_dataset):
    """All 5 assessment required exception scenarios must be injected and detected."""
    anom_data, ground_truth = inject_exceptions(baseline_dataset, seed=20261022)

    # Verify ground truth metadata
    assert len(ground_truth) == 5
    gt_types = {e["issue_type"] for e in ground_truth}
    expected_types = {
        "opted_out_lead_contacted",
        "score_influenced_post_conversion",
        "lead_assigned_outside_territory",
        "duplicate_opportunity",
        "stage_history_gap",
    }
    assert gt_types == expected_types

    # Each ground truth item must have required fields
    for exc in ground_truth:
        assert exc["exception_id"].startswith("EXC-")
        assert exc["issue_type"] in expected_types
        assert len(exc["affected_record_ids"]) > 0
        assert len(exc["expected_outcome"]) > 0
        assert "T" in exc["injected_at"]

    # Run validator on anomalous dataset
    report = validate_all(anom_data)
    assert report.is_valid is False
    assert report.error_count == 5

    detected_types = {i.issue_type for i in report.issues}
    assert detected_types == expected_types


def test_ground_truth_file_export(local_tmp_path, baseline_dataset):
    """Ground truth exceptions must export cleanly to CSV and JSON."""
    _, ground_truth = inject_exceptions(baseline_dataset, seed=20261022)
    write_ground_truth(ground_truth, local_tmp_path)

    csv_file = local_tmp_path / "exceptions.csv"
    json_file = local_tmp_path / "exceptions.json"


    assert csv_file.exists()
    assert json_file.exists()

    with open(json_file, encoding="utf-8") as f:
        loaded = json.load(f)
    assert len(loaded) == 5
    assert {x["exception_id"] for x in loaded} == {"EXC-000001", "EXC-000002", "EXC-000003", "EXC-000004", "EXC-000005"}


def test_ground_truth_reproducibility(baseline_dataset):
    """Repeated exception injection runs with identical seed produce identical exceptions."""
    _, gt1 = inject_exceptions(baseline_dataset, seed=20261022)
    _, gt2 = inject_exceptions(baseline_dataset, seed=20261022)
    assert gt1 == gt2


def test_validator_primary_key_uniqueness():
    report = ValidationReport()
    bad_data = {
        "companies": [
            {"company_id": "CO-000001", "name": "A", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"},
            {"company_id": "CO-000001", "name": "B", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"},
        ]
    }
    validate_primary_keys(bad_data, report)
    assert any(i.issue_type == "duplicate_primary_key" for i in report.issues)


def test_validator_foreign_key_detection():
    report = ValidationReport()
    bad_data = {
        "companies": [{"company_id": "CO-000001"}],
        "contacts": [
            {"contact_id": "CON-000001", "company_id": "CO-NONEXISTENT"}
        ]
    }
    validate_foreign_keys(bad_data, report)
    assert any(i.issue_type == "foreign_key_violation" for i in report.issues)


def test_validator_score_arithmetic():
    report = ValidationReport()
    bad_data = {
        "leads": [
            {
                "lead_id": "LEAD-2026-000001",
                "fit_score": 100,
                "intent_score": 0,
                "engagement_score": 0,
                "lead_score": 99,  # Should be 50
            }
        ]
    }
    validate_score_arithmetic(bad_data, report)
    assert any(i.issue_type == "score_arithmetic_mismatch" for i in report.issues)


def test_validator_invalid_enum():
    report = ValidationReport()
    bad_data = {
        "leads": [
            {"lead_id": "LEAD-2026-000001", "status": "NonexistentStatus"}
        ]
    }
    validate_enums(bad_data, report)
    assert any(i.issue_type == "invalid_enum" for i in report.issues)
