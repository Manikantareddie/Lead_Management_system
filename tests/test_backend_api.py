"""
Automated tests for YottaFlex FastAPI Backend.
Verifies health, summary metrics, pagination, lead detail 360, investigations, and validation endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

from conftest import authenticated_client

# Authenticated client (auth is enforced on all /api/* routes).
client = authenticated_client()


def test_backend_health():
    for endpoint in ["/health", "/api/health"]:
        response = client.get(endpoint)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "record_counts" in data
        assert data["record_counts"]["leads"] == 20000


def test_dashboard_summary():
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_leads"] == 20000
    assert data["total_companies"] == 5000
    assert data["total_tasks"] >= 25000
    assert "stage_distribution" in data
    assert "score_bands" in data
    assert data["anomalies_detected"] == 5


def test_leads_pagination_and_filtering():
    # Test default page
    response = client.get("/api/leads?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 20000
    assert len(data["items"]) == 10
    assert data["total_pages"] == 2000

    # Test filtering by stage
    resp_stage = client.get("/api/leads?stage=Qualified&page_size=5")
    assert resp_stage.status_code == 200
    stage_data = resp_stage.json()
    assert all(l["status"] == "Qualified" for l in stage_data["items"])

    # Test search by lead ID
    resp_search = client.get("/api/leads?search=LEAD-2026-000001")
    assert resp_search.status_code == 200
    search_data = resp_search.json()
    assert any(l["lead_id"] == "LEAD-2026-000001" for l in search_data["items"])

    # Test score band filtering
    resp_band = client.get("/api/leads?score_band=85-100&page_size=10")
    assert resp_band.status_code == 200
    band_data = resp_band.json()
    assert band_data["total"] == 414
    assert all(l["lead_score"] >= 85 for l in band_data["items"])


def test_lead_detail_360():
    response = client.get("/api/leads/LEAD-2026-000001")
    assert response.status_code == 200
    data = response.json()
    assert data["lead"]["lead_id"] == "LEAD-2026-000001"
    assert "company" in data
    assert "scoring_breakdown" in data
    assert "formula" in data["scoring_breakdown"]
    assert "stage_history" in data
    assert len(data["stage_history"]) >= 1


def test_lead_not_found():
    response = client.get("/api/leads/NON_EXISTENT_LEAD_ID")
    assert response.status_code == 404


def test_tasks_and_opportunities():
    resp_tasks = client.get("/api/tasks?page=1&page_size=10")
    assert resp_tasks.status_code == 200
    assert len(resp_tasks.json()["items"]) == 10

    resp_opps = client.get("/api/opportunities?page=1&page_size=10")
    assert resp_opps.status_code == 200
    assert len(resp_opps.json()["items"]) == 10


def test_investigations_endpoint():
    response = client.get("/api/investigations")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 5

    types = {i["issue_type"] for i in items}
    expected_types = {
        "opted_out_lead_contacted",
        "score_influenced_post_conversion",
        "lead_assigned_outside_territory",
        "duplicate_opportunity",
        "stage_history_gap",
    }
    assert types == expected_types

    # Verify evidence structure
    for inv in items:
        assert "evidence" in inv
        assert "rule_name" in inv
        assert "severity" in inv


def test_validation_status_endpoint():
    response = client.get("/api/validation/status")
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert data["error_count"] == 0


def test_task_create_and_update_mutation():
    # Test task creation
    payload = {
        "lead_id": "LEAD-2026-000001",
        "type": "call",
        "title": "Interactive Cadence Call",
        "description": "Test outreach task created from console",
        "priority": "high",
        "status": "open",
    }
    create_resp = client.post("/api/tasks", json=payload)
    assert create_resp.status_code == 200
    task_data = create_resp.json()
    assert task_data["lead_id"] == "LEAD-2026-000001"
    assert task_data["title"] == "Interactive Cadence Call"
    task_id = task_data["task_id"]

    # Test task status update
    update_payload = {"status": "completed"}
    patch_resp = client.patch(f"/api/tasks/{task_id}", json=update_payload)
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["status"] == "completed"
    assert updated_data["completed_at"] is not None


def test_activity_create_does_not_change_stage():
    """Recording an activity must log history without advancing the lead's sales stage (requirement D)."""
    before = client.get("/api/leads/LEAD-2026-000001").json()
    stage_before = before["lead"]["status"]
    activity_count_before = len(before["activities"])

    payload = {
        "lead_id": "LEAD-2026-000001",
        "type": "call",
        "subject": "Discovery call logged from console",
        "description": "Activity recorded from the lead workspace",
        "outcome": "connected",
    }
    create_resp = client.post("/api/activities", json=payload)
    assert create_resp.status_code == 200
    created = create_resp.json()
    assert created["lead_id"] == "LEAD-2026-000001"
    assert created["subject"] == "Discovery call logged from console"
    assert created["activity_id"].startswith("ACT-LEAD-2026-000001-")

    after = client.get("/api/leads/LEAD-2026-000001").json()
    assert after["lead"]["status"] == stage_before
    assert len(after["activities"]) == activity_count_before + 1


def test_buying_decision_bought_lost_and_pending():
    """Buying decisions resolve to closed outcomes, except Decision Pending which stays active."""
    opp = client.get("/api/opportunities?page=1&page_size=1").json()["items"][0]
    opp_id = opp["opportunity_id"]
    lead_id = opp["lead_id"]

    # Only the three agreed outcomes are accepted.
    invalid = client.post(f"/api/opportunities/{opp_id}/decision", json={"decision": "maybe"})
    assert invalid.status_code == 400

    # Decision Pending must not be recorded without a scheduled follow-up.
    missing_follow_up = client.post(f"/api/opportunities/{opp_id}/decision", json={"decision": "decision_pending"})
    assert missing_follow_up.status_code == 400

    # Decision Pending keeps the deal active and schedules the next follow-up.
    pending = client.post(
        f"/api/opportunities/{opp_id}/decision",
        json={
            "decision": "decision_pending",
            "next_follow_up_title": "Call back about the pending decision",
            "next_follow_up_due_date": "2026-11-10",
        },
    )
    assert pending.status_code == 200
    pending_body = pending.json()
    assert pending_body["opportunity"]["stage"] == "decision_pending"
    assert pending_body["opportunity"]["closed_at"] is None
    assert pending_body["task"]["lead_id"] == lead_id

    # Bought closes the deal as won.
    bought = client.post(f"/api/opportunities/{opp_id}/decision", json={"decision": "bought"})
    assert bought.status_code == 200
    assert bought.json()["opportunity"]["stage"] == "closed_won"
    assert bought.json()["opportunity"]["closed_at"] is not None

    # Lost closes the deal as lost.
    lost = client.post(f"/api/opportunities/{opp_id}/decision", json={"decision": "lost"})
    assert lost.status_code == 200
    assert lost.json()["opportunity"]["stage"] == "closed_lost"


def test_buying_decision_unknown_opportunity():
    resp = client.post("/api/opportunities/OPP-DOES-NOT-EXIST/decision", json={"decision": "bought"})
    assert resp.status_code == 404
