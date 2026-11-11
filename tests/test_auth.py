"""Tests for authentication and role-based access control."""

from fastapi.testclient import TestClient
from backend.main import app

from conftest import authenticated_client

client = TestClient(app)


def test_login_success_returns_token_and_user():
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["role"] == "admin"
    assert "password" not in data["user"]


def test_login_invalid_credentials_rejected():
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid username or password."


def test_health_is_public():
    assert client.get("/api/health").status_code == 200


def test_protected_endpoint_requires_token():
    resp = client.get("/api/leads")
    assert resp.status_code == 401
    assert "Authentication required" in resp.json()["detail"]


def test_invalid_token_rejected():
    resp = client.get("/api/leads", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_me_returns_current_user():
    resp = authenticated_client().get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == "admin"


def test_role_restricted_endpoint_blocks_sales_rep():
    rep = TestClient(app)
    login = rep.post("/api/auth/login", json={"username": "rep", "password": "rep123"})
    token = login.json()["access_token"]
    resp = rep.post("/api/validation/run", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    assert "permission" in resp.json()["detail"].lower()
