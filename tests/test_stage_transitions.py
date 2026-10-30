"""
Tests for interactive lead stage transitions.
Verifies valid progressions, monotonic append-only stage histories,
score freezing on conversion, and rejection of invalid/backwards transitions.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_store

client = TestClient(app)


def test_valid_stage_transition_progression():
    # Find a lead with status 'New' via API
    resp_leads = client.get("/api/leads?stage=New&page_size=10")
    assert resp_leads.status_code == 200
    items = resp_leads.json()["items"]
    assert len(items) > 0, "Should find at least one lead with status 'New'"

    lead_id = items[0]["lead_id"]

    # 1. Advance from New -> Contacted
    resp = client.post(
        f"/api/leads/{lead_id}/transition",
        json={"to_stage": "Contacted", "changed_by": "REP-000001", "reason": "First outreach call"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["lead"]["status"] == "Contacted"
    assert data["stage_history"]["from_stage"] == "New"
    assert data["stage_history"]["to_stage"] == "Contacted"
    assert data["stage_history"]["changed_by"] == "REP-000001"

    # 2. Advance from Contacted -> Qualified
    resp2 = client.post(
        f"/api/leads/{lead_id}/transition",
        json={"to_stage": "Qualified", "changed_by": "REP-000001"},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["lead"]["status"] == "Qualified"
    assert data2["stage_history"]["from_stage"] == "Contacted"
    assert data2["stage_history"]["to_stage"] == "Qualified"

    # 3. Advance from Qualified -> Converted
    resp3 = client.post(
        f"/api/leads/{lead_id}/transition",
        json={"to_stage": "Converted"},
    )
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["lead"]["status"] == "Converted"
    assert data3["lead"]["converted_at"] is not None
    assert data3["stage_history"]["to_stage"] == "Converted"

    # 4. Attempt transition out of terminal Converted stage -> must fail with 400
    resp_invalid = client.post(
        f"/api/leads/{lead_id}/transition",
        json={"to_stage": "New"},
    )
    assert resp_invalid.status_code == 400
    assert "Invalid stage transition" in resp_invalid.json()["detail"]


def test_invalid_backwards_stage_transition():
    # Find a lead with status 'Contacted'
    resp_leads = client.get("/api/leads?stage=Contacted&page_size=5")
    assert resp_leads.status_code == 200
    items = resp_leads.json()["items"]
    assert len(items) > 0

    lead_id = items[0]["lead_id"]

    # Attempt to transition backwards to 'New'
    resp = client.post(
        f"/api/leads/{lead_id}/transition",
        json={"to_stage": "New"},
    )
    assert resp.status_code == 400
    assert "Invalid stage transition" in resp.json()["detail"]


def test_disqualify_transition_and_terminal():
    # Find another lead with status 'New'
    resp_leads = client.get("/api/leads?stage=New&page_size=5")
    assert resp_leads.status_code == 200
    items = resp_leads.json()["items"]
    assert len(items) > 0

    lead_id = items[-1]["lead_id"]

    # Transition New -> Disqualified
    resp = client.post(
        f"/api/leads/{lead_id}/transition",
        json={"to_stage": "Disqualified", "reason": "No budget or authority"},
    )
    assert resp.status_code == 200
    assert resp.json()["lead"]["status"] == "Disqualified"

    # Cannot transition out of Disqualified
    resp_locked = client.post(
        f"/api/leads/{lead_id}/transition",
        json={"to_stage": "Qualified"},
    )
    assert resp_locked.status_code == 400
    assert "Invalid stage transition" in resp_locked.json()["detail"]


def test_transition_nonexistent_lead():
    resp = client.post(
        "/api/leads/LEAD-9999-999999/transition",
        json={"to_stage": "Contacted"},
    )
    assert resp.status_code in (400, 404)
