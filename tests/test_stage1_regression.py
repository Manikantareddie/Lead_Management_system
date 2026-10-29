"""Stage 1 Regression Tests for Sales Routing Fix and Task Decision Explanations.

Validates:
Priority A:
1. Compatible representative is selected.
2. No compatible representative exists.
3. Lead is explicitly unassigned with an explanation.
4. Routing exception is correctly recorded.
5. Unassigned lead cannot receive an invalidly assigned actionable task.
6. Existing foreign-key integrity remains valid with nullable salesrep references.

Priority B:
1. Eligible lead has a 'created' decision linked to its real task.
2. Opted-out contact receives no prohibited outreach task and has an explanatory decision record.
3. Duplicate lead is rejected from inappropriate follow-up and the reason is logged.
4. Lead without a compatible representative is handled safely and deferred with reason logged.
5. Deferred decisions have a meaningful reason.
6. Decision records use valid lead/contact/task references.
7. Repeated generation with the same seed produces equivalent decision records.
8. CSV and JSON decision exports agree.
"""

import copy
import csv
import json
import random
from pathlib import Path

import pytest

from business.routing import compatible_salesrep, route_lead
from business.decisions import explain_task_decision, should_create_task
from business.consent import is_consent_valid_at, consent_status_at
from generator.generate import generate, generate_tasks, DEFAULT_CONFIG
from generator.export import export_csv, export_json
from validation.validator import validate_all, validate_sales_routing, validate_task_assignment, validate_task_decisions


# =============================================================================
# Priority A — Sales-Routing Fallback Regression Tests
# =============================================================================

def test_routing_compatible_representative_selected():
    """1. A compatible active representative matching territory and product is selected."""
    salesreps = [
        {"salesrep_id": "REP-000001", "territory": "North", "product_specialty": "Enterprise", "is_active": True},
        {"salesrep_id": "REP-000002", "territory": "South", "product_specialty": "SMB", "is_active": True},
    ]
    lead = {
        "lead_id": "LEAD-2026-000001",
        "territory": "North",
        "product_interest": "Enterprise",
    }
    routed = route_lead(lead, salesreps)
    assert routed["assigned_salesrep_id"] == "REP-000001"
    assert routed["routing_exception"] is False
    assert routed["routing_reason"] is None


def test_routing_no_compatible_representative_exists():
    """2. When no compatible representative exists, lead is not assigned to an incompatible rep."""
    salesreps = [
        {"salesrep_id": "REP-000001", "territory": "North", "product_specialty": "Enterprise", "is_active": True},
        {"salesrep_id": "REP-000002", "territory": "South", "product_specialty": "SMB", "is_active": True},
    ]
    lead = {
        "lead_id": "LEAD-2026-000002",
        "territory": "East",
        "product_interest": "Mid-Market",
    }
    routed = route_lead(lead, salesreps)
    assert routed["assigned_salesrep_id"] is None
    assert routed["routing_exception"] is True
    assert routed["routing_reason"] == "no_compatible_salesrep"


def test_lead_explicitly_unassigned_with_explanation():
    """3. Lead is explicitly unassigned with clear explanation and preserved territory/product."""
    salesreps = [
        {"salesrep_id": "REP-000001", "territory": "North", "product_specialty": "Enterprise", "is_active": True},
    ]
    lead = {
        "lead_id": "LEAD-2026-000003",
        "territory": "West",
        "product_interest": "Mid-Market",
    }
    routed = route_lead(lead, salesreps)
    assert routed["assigned_salesrep_id"] is None
    assert routed["territory"] == "West"
    assert routed["product_interest"] == "Mid-Market"
    assert routed["routing_exception"] is True
    assert routed["routing_reason"] == "no_compatible_salesrep"


def test_routing_exception_correctly_recorded():
    """4. Routing exception flag and reason are consistent with assignment state."""
    salesreps = [
        {"salesrep_id": "REP-000001", "territory": "North", "product_specialty": "Enterprise", "is_active": True},
    ]
    unmatched_lead = {"lead_id": "L1", "territory": "South", "product_interest": "Enterprise"}
    routed_unmatched = route_lead(unmatched_lead, salesreps)
    assert routed_unmatched["routing_exception"] is True
    assert routed_unmatched["routing_reason"] == "no_compatible_salesrep"
    assert routed_unmatched["assigned_salesrep_id"] is None

    matched_lead = {"lead_id": "L2", "territory": "North", "product_interest": "Enterprise"}
    routed_matched = route_lead(matched_lead, salesreps)
    assert routed_matched["routing_exception"] is False
    assert routed_matched["routing_reason"] is None
    assert routed_matched["assigned_salesrep_id"] == "REP-000001"


def test_unassigned_lead_cannot_receive_invalid_actionable_task():
    """5. An unassigned lead cannot receive an actionable task."""
    consents = [
        {
            "consent_id": "CSN-000001",
            "contact_id": "CON-000001",
            "channel": "email",
            "status": "granted",
            "consented_at": "2026-01-01T00:00:00Z",
            "withdrawn_at": None,
            "expires_at": None,
        }
    ]
    unassigned_lead = {
        "lead_id": "LEAD-2026-000099",
        "contact_id": "CON-000001",
        "lead_score": 85,
        "is_duplicate": False,
        "assigned_salesrep_id": None,
        "routing_exception": True,
        "routing_reason": "no_compatible_salesrep",
        "created_at": "2026-01-15T00:00:00Z",
    }
    assert should_create_task(unassigned_lead, consents, "email", "2026-02-01T00:00:00Z") is False
    decision = explain_task_decision(unassigned_lead, consents, "email", "2026-02-01T00:00:00Z")
    assert decision["eligible"] is False
    assert decision["decision"] == "deferred"
    assert decision["reason"] == "no_compatible_salesrep"


def test_foreign_key_integrity_with_unassigned_leads():
    """6. Foreign key integrity holds: non-null salesreps are valid; unassigned leads remain null."""
    dataset = generate(DEFAULT_CONFIG)
    salesrep_ids = {r["salesrep_id"] for r in dataset["salesreps"]}
    unassigned_count = 0
    assigned_count = 0

    for lead in dataset["leads"]:
        rep_id = lead.get("assigned_salesrep_id")
        if rep_id:
            assert rep_id in salesrep_ids
            assigned_count += 1
        else:
            assert lead["routing_exception"] is True
            assert lead["routing_reason"] == "no_compatible_salesrep"
            unassigned_count += 1

    assert assigned_count > 0, "Expected at least one assigned lead"
    assert unassigned_count > 0, "Expected at least one explicitly unassigned lead"


# =============================================================================
# Priority B — Task-Decision Explanations & Audit Log Regression Tests
# =============================================================================

@pytest.fixture(scope="module")
def starter_dataset():
    """Generate default starter dataset for audit log tests."""
    return generate(DEFAULT_CONFIG)


def test_eligible_lead_has_created_decision_linked_to_real_task(starter_dataset):
    """1. An eligible lead has a 'created' decision linked to its real task."""
    created_decisions = [d for d in starter_dataset["task_decisions"] if d["decision"] == "created"]
    assert len(created_decisions) > 0

    tasks_by_id = {t["task_id"]: t for t in starter_dataset["tasks"]}
    for dec in created_decisions:
        assert dec["task_id"] in tasks_by_id
        assert dec["reason"] == "eligible"
        matching_task = tasks_by_id[dec["task_id"]]
        assert matching_task["lead_id"] == dec["lead_id"]
        assert matching_task["assigned_to"] == dec["assigned_salesrep_id"]


def test_opted_out_contact_receives_no_outreach_and_has_decision_record():
    """2. An opted-out contact receives no outreach task and has an explanatory decision record."""
    consents = [
        {
            "consent_id": "CSN-000001",
            "contact_id": "CON-000099",
            "channel": "email",
            "status": "withdrawn",
            "consented_at": "2026-01-01T00:00:00Z",
            "withdrawn_at": "2026-01-10T00:00:00Z",
            "expires_at": None,
        }
    ]
    lead = {
        "lead_id": "LEAD-2026-000099",
        "contact_id": "CON-000099",
        "lead_score": 80,
        "is_duplicate": False,
        "assigned_salesrep_id": "REP-000001",
        "created_at": "2026-01-15T00:00:00Z",
    }
    decision = explain_task_decision(lead, consents, "email", "2026-02-01T00:00:00Z")
    assert decision["eligible"] is False
    assert decision["decision"] == "rejected"
    assert decision["reason"] == "no_valid_consent"


def test_duplicate_lead_rejected_from_followup_and_logged(starter_dataset):
    """3. Duplicate leads are rejected from follow-up and logged with duplicate_lead_prohibited."""
    dup_decisions = [d for d in starter_dataset["task_decisions"] if d["reason"] == "duplicate_lead_prohibited"]
    assert len(dup_decisions) > 0
    for dec in dup_decisions:
        assert dec["decision"] == "rejected"
        assert dec["task_id"] is None


def test_lead_without_compatible_representative_deferred_and_logged(starter_dataset):
    """4. Lead without compatible representative is deferred and logged with no_compatible_salesrep."""
    unassigned_decisions = [d for d in starter_dataset["task_decisions"] if d["reason"] == "no_compatible_salesrep"]
    assert len(unassigned_decisions) > 0
    for dec in unassigned_decisions:
        assert dec["decision"] == "deferred"
        assert dec["assigned_salesrep_id"] is None
        assert dec["task_id"] is None


def test_deferred_decisions_have_meaningful_reason(starter_dataset):
    """5. All deferred decisions have a meaningful documented reason code."""
    deferred = [d for d in starter_dataset["task_decisions"] if d["decision"] == "deferred"]
    assert len(deferred) > 0
    valid_reasons = {"no_compatible_salesrep"}
    for dec in deferred:
        assert dec["reason"] in valid_reasons
        assert dec["task_id"] is None


def test_decision_records_use_valid_references(starter_dataset):
    """6. Decision records use valid lead/contact/task references."""
    lead_ids = {l["lead_id"] for l in starter_dataset["leads"]}
    contact_ids = {c["contact_id"] for c in starter_dataset["contacts"]}
    task_ids = {t["task_id"] for t in starter_dataset["tasks"]}
    salesrep_ids = {s["salesrep_id"] for s in starter_dataset["salesreps"]}

    for dec in starter_dataset["task_decisions"]:
        assert dec["lead_id"] in lead_ids
        assert dec["contact_id"] in contact_ids
        if dec["decision"] == "created":
            assert dec["task_id"] in task_ids
            assert dec["assigned_salesrep_id"] in salesrep_ids
        else:
            assert dec["task_id"] is None


def test_repeated_generation_reproducible_decisions():
    """7. Repeated generation with identical seed produces equivalent decision records."""
    run1 = generate(DEFAULT_CONFIG)
    run2 = generate(DEFAULT_CONFIG)
    assert run1["task_decisions"] == run2["task_decisions"]


def test_csv_and_json_decision_exports_agree(local_tmp_path):
    """8. CSV and JSON decision exports agree across all records and fields."""
    dataset = generate(DEFAULT_CONFIG)
    out_dir = local_tmp_path / "export_test"
    export_csv(dataset, out_dir)
    export_json(dataset, out_dir)

    csv_path = out_dir / "task_decisions.csv"
    json_path = out_dir / "task_decisions.json"
    assert csv_path.exists()
    assert json_path.exists()

    with open(csv_path, newline="", encoding="utf-8") as f:
        csv_rows = list(csv.DictReader(f))

    with open(json_path, encoding="utf-8") as f:
        json_rows = json.load(f)

    assert len(csv_rows) == len(json_rows)
    for c_row, j_row in zip(csv_rows, json_rows):
        assert c_row["decision_id"] == j_row["decision_id"]
        assert c_row["lead_id"] == j_row["lead_id"]
        assert c_row["contact_id"] == j_row["contact_id"]
        assert c_row["task_type"] == j_row["task_type"]
        assert c_row["channel"] == j_row["channel"]
        assert c_row["decision"] == j_row["decision"]
        assert c_row["reason"] == j_row["reason"]
        assert c_row["evaluated_at"] == j_row["evaluated_at"]
        assert c_row["consent_status_at_evaluation"] == j_row["consent_status_at_evaluation"]
        assert int(c_row["lead_score"]) == j_row["lead_score"]
        # In CSV, None is serialized as empty string
        expected_task_id = j_row["task_id"] or ""
        assert c_row["task_id"] == expected_task_id
        expected_rep_id = j_row["assigned_salesrep_id"] or ""
        assert c_row["assigned_salesrep_id"] == expected_rep_id
