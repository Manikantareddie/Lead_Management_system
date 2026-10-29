"""Comprehensive automated tests for YottaFlex business logic rules.

Covers:
- Deduplication (composite detection key, canonical vs duplicate, repeat interest)
- Consent eligibility (time-effective validity, expiration, revocation, explanation)
- Sales routing (territory & product specialty compatibility, workload balancing, unassigned handling)
- Follow-up task decisions (score-driven priority/status, consent gating, duplicate exclusion)
- Lead lifecycle stages (valid transitions, terminal stages, opportunity won/lost reasons)
"""

import pytest

from business.deduplication import (
    compute_detection_key,
    find_duplicate_lead,
    label_duplicate,
    normalize_email_domain,
    normalize_company_name,
    submission_month,
)
from business.consent import (

    is_consent_valid_at,
    explain_consent_ineligibility,
    channel_for_task_type,
)
from business.routing import (
    compatible_salesrep,
    route_lead,
)
from business.decisions import (
    lead_priority,
    should_create_task,
    task_status_and_priority,
    explain_task_decision,
)
from business.stages import (
    VALID_TRANSITIONS,
    TERMINAL_STAGES,
    is_valid_stage_transition,
    stage_transition_decision,
    opportunity_outcome,
    explain_stage_transition,
)


# =============================================================================
# A. Deduplication Tests
# =============================================================================

def test_normalization():
    assert normalize_email_domain("Alice.Smith@ACME.COM") == "acme.com"
    assert normalize_email_domain("invalid-email") == ""
    assert normalize_email_domain(None) == ""
    assert normalize_company_name("  Acme   Corporation,  Inc.  ") == "acme corporation, inc."
    assert normalize_company_name(None) == ""
    assert submission_month("2026-05-18T14:30:00Z") == "2026-05"


def test_composite_detection_key():
    key1 = compute_detection_key("acme.com", "acme corp", "Enterprise", "2026-05")
    key2 = compute_detection_key("acme.com", "acme corp", "enterprise", "2026-05")
    assert key1 == key2 == "acme.com|acme corp|enterprise|2026-05"

    # Legitimate repeat interest (different product or different month) produces distinct keys
    key_diff_prod = compute_detection_key("acme.com", "acme corp", "SMB", "2026-05")
    key_diff_month = compute_detection_key("acme.com", "acme corp", "Enterprise", "2026-06")
    assert key1 != key_diff_prod
    assert key1 != key_diff_month


def test_find_duplicate_and_label():
    key = "example.com|cedar peak|enterprise|2026-04"
    orig = {
        "lead_id": "LEAD-2026-000001",
        "duplicate_detection_key": key,
        "created_at": "2026-04-01T00:00:00Z",
    }
    dup_candidate = {
        "lead_id": "LEAD-2026-000002",
        "duplicate_detection_key": key,
        "created_at": "2026-04-15T00:00:00Z",
    }
    unique_candidate = {
        "lead_id": "LEAD-2026-000003",
        "duplicate_detection_key": "other.com|other|smb|2026-04",
        "created_at": "2026-04-16T00:00:00Z",
    }

    leads = [orig]
    assert find_duplicate_lead(dup_candidate, leads) == orig
    assert find_duplicate_lead(unique_candidate, leads) is None

    labelled_dup = label_duplicate(dup_candidate, orig)
    assert labelled_dup["is_duplicate"] is True
    assert labelled_dup["duplicate_of_lead_id"] == "LEAD-2026-000001"

    labelled_unique = label_duplicate(unique_candidate, None)
    assert labelled_unique["is_duplicate"] is False
    assert labelled_unique["duplicate_of_lead_id"] is None


# =============================================================================
# B. Consent Tests
# =============================================================================

def test_consent_validity_and_expiration():
    consents = [
        {
            "consent_id": "CSN-000001",
            "contact_id": "CON-000001",
            "channel": "email",
            "status": "granted",
            "consented_at": "2026-01-01T00:00:00Z",
            "withdrawn_at": None,
            "expires_at": "2026-06-01T00:00:00Z",
        }
    ]

    # Valid before expiry
    assert is_consent_valid_at(consents, "CON-000001", "email", "2026-03-01T00:00:00Z") is True
    # Ineligible before consent was granted
    assert is_consent_valid_at(consents, "CON-000001", "email", "2025-12-01T00:00:00Z") is False
    # Ineligible after expiry
    assert is_consent_valid_at(consents, "CON-000001", "email", "2026-07-01T00:00:00Z") is False
    assert explain_consent_ineligibility(consents, "CON-000001", "email", "2026-07-01T00:00:00Z") == "consent_expired"


def test_consent_revocation_and_append_only():
    consents = [
        {
            "consent_id": "CSN-000001",
            "contact_id": "CON-000002",
            "channel": "phone",
            "status": "granted",
            "consented_at": "2026-01-01T00:00:00Z",
            "withdrawn_at": "2026-04-01T00:00:00Z",
            "expires_at": None,
        }
    ]
    # Valid before withdrawal
    assert is_consent_valid_at(consents, "CON-000002", "phone", "2026-03-15T00:00:00Z") is True
    # Ineligible after withdrawal
    assert is_consent_valid_at(consents, "CON-000002", "phone", "2026-04-15T00:00:00Z") is False
    assert explain_consent_ineligibility(consents, "CON-000002", "phone", "2026-04-15T00:00:00Z") == "consent_withdrawn"


# =============================================================================
# C. Sales Routing Tests
# =============================================================================

def test_compatible_salesrep_routing():
    salesreps = [
        {
            "salesrep_id": "REP-000001",
            "territory": "North",
            "product_specialty": "Enterprise",
            "is_active": True,
        },
        {
            "salesrep_id": "REP-000002",
            "territory": "North",
            "product_specialty": "Enterprise",
            "is_active": True,
        },
        {
            "salesrep_id": "REP-000003",
            "territory": "South",
            "product_specialty": "SMB",
            "is_active": True,
        },
    ]

    lead_north_ent = {"lead_id": "LEAD-1", "territory": "North", "product_interest": "Enterprise"}
    lead_unmatched = {"lead_id": "LEAD-2", "territory": "West", "product_interest": "Enterprise"}

    # Workload balancing: REP-1 has 2 leads, REP-2 has 0 leads
    counts = {"REP-000001": 2, "REP-000002": 0}
    routed = route_lead(lead_north_ent, salesreps, counts)
    assert routed["assigned_salesrep_id"] == "REP-000002"
    assert routed["routing_exception"] is False
    assert counts["REP-000002"] == 1

    # Unmatched case: explicit routing exception
    routed_unmatched = route_lead(lead_unmatched, salesreps, counts)
    assert routed_unmatched["assigned_salesrep_id"] is None
    assert routed_unmatched["routing_exception"] is True
    assert routed_unmatched["routing_reason"] == "no_compatible_salesrep"


# =============================================================================
# D. Follow-up Task Decision Tests
# =============================================================================

def test_task_decisions_and_consent_gating():
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

    normal_lead = {"lead_id": "L1", "contact_id": "CON-000001", "lead_score": 85, "is_duplicate": False}
    dup_lead = {"lead_id": "L2", "contact_id": "CON-000001", "lead_score": 85, "is_duplicate": True}
    unconsented_lead = {"lead_id": "L3", "contact_id": "CON-000099", "lead_score": 85, "is_duplicate": False}

    ts = "2026-03-01T00:00:00Z"

    # Eligible
    assert should_create_task(normal_lead, consents, "email", ts) is True
    explanation = explain_task_decision(normal_lead, consents, "email", ts)
    assert explanation["eligible"] is True
    assert explanation["priority"] == "high"

    # Duplicate lead prohibited
    assert should_create_task(dup_lead, consents, "email", ts) is False
    assert explain_task_decision(dup_lead, consents, "email", ts)["reason"] == "duplicate_lead_prohibited"

    # Unconsented lead prohibited
    assert should_create_task(unconsented_lead, consents, "email", ts) is False
    assert explain_task_decision(unconsented_lead, consents, "email", ts)["reason"] == "no_valid_consent"


def test_task_priority_and_status():
    assert task_status_and_priority(80, routing_exception=False) == ("open", "high")
    assert task_status_and_priority(55, routing_exception=False) == ("open", "medium")
    assert task_status_and_priority(20, routing_exception=False) == ("open", "low")

    # Routing exception lowers priority by one band
    assert task_status_and_priority(80, routing_exception=True) == ("open", "medium")
    assert task_status_and_priority(55, routing_exception=True) == ("open", "low")
    assert task_status_and_priority(20, routing_exception=True) == ("open", "low")


# =============================================================================
# E. Lifecycle Stage Transition & Opportunity Outcome Tests
# =============================================================================

def test_stage_transitions():
    # Valid forward moves
    assert is_valid_stage_transition(None, "New") is True
    assert is_valid_stage_transition("New", "Contacted") is True
    assert is_valid_stage_transition("Contacted", "Qualified") is True
    assert is_valid_stage_transition("Qualified", "Converted") is True
    assert is_valid_stage_transition("Contacted", "Disqualified") is True

    # Invalid moves
    assert is_valid_stage_transition("New", "Converted") is False  # Skipping stages
    assert is_valid_stage_transition("Converted", "Contacted") is False  # Moving out of terminal
    assert is_valid_stage_transition("Disqualified", "Qualified") is False

    decision = stage_transition_decision({"status": "New"}, "Contacted", "REP-1", "2026-02-01T00:00:00Z")
    assert decision is not None
    assert decision["from_stage"] == "New"
    assert decision["to_stage"] == "Contacted"


def test_opportunity_won_lost_outcomes():
    import random
    rng = random.Random(2026)

    won = opportunity_outcome("closed_won", 50000.0, rng)
    assert won["won_lost_reason"] in ["budget_approved", "decision_maker_aligned", "competitive_win"]
    assert won["competitor"] is None

    lost = opportunity_outcome("closed_lost", 50000.0, rng)
    assert lost["won_lost_reason"] in ["competitor", "budget", "timing", "no_decision"]

    open_opp = opportunity_outcome("proposal", 50000.0, rng)
    assert open_opp["won_lost_reason"] is None
    assert open_opp["competitor"] is None
