"""Authentication and role-based access control for the YottaFlex Operations API.

Implements a small, dependency-free bearer-token scheme:
  - Users are configured via the AUTH_USERS env var (JSON array) or the built-in
    demo accounts documented in the README.
  - Tokens are HMAC-SHA256 signed payloads (stdlib only) carrying the user's
    role so endpoints can enforce role-based permissions.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Optional

from fastapi import HTTPException, Request

from backend.config import AUTH_SECRET, AUTH_TOKEN_TTL_SECONDS

# Supported roles. `admin` and `manager` may run privileged operations;
# `sales_rep` is limited to day-to-day pipeline work.
ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_SALES_REP = "sales_rep"
ALL_ROLES = (ROLE_ADMIN, ROLE_MANAGER, ROLE_SALES_REP)

# Demo accounts for local evaluation. These are intentionally non-secret.
# Override in any real deployment by setting the AUTH_USERS env var to a JSON array.
_DEMO_USERS: list[dict[str, Any]] = [
    {"username": "admin", "password": "admin123", "display_name": "Avery Stone",
     "role": ROLE_ADMIN, "salesrep_id": None},
    {"username": "manager", "password": "manager123", "display_name": "Dana Whitfield",
     "role": ROLE_MANAGER, "salesrep_id": None},
    {"username": "rep", "password": "rep123", "display_name": "Riley Chen",
     "role": ROLE_SALES_REP, "salesrep_id": "REP-000001"},
]


def _load_users() -> list[dict[str, Any]]:
    """Load users from AUTH_USERS (JSON) when provided, else the demo accounts."""
    raw = os.getenv("AUTH_USERS", "").strip()
    if not raw:
        return _DEMO_USERS
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list) and parsed:
            return parsed
    except json.JSONDecodeError:
        pass
    return _DEMO_USERS


USERS: list[dict[str, Any]] = _load_users()


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64d(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(payload: bytes) -> str:
    digest = hmac.new(AUTH_SECRET.encode("utf-8"), payload, hashlib.sha256).digest()
    return _b64e(digest)


def create_access_token(user: dict[str, Any], ttl_seconds: int = AUTH_TOKEN_TTL_SECONDS) -> tuple[str, int]:
    """Return (token, expiry_epoch_seconds) for the given user record."""
    now = int(time.time())
    expires_at = now + ttl_seconds
    claims = {
        "sub": user.get("username"),
        "role": user.get("role"),
        "display_name": user.get("display_name") or user.get("username"),
        "salesrep_id": user.get("salesrep_id"),
        "iat": now,
        "exp": expires_at,
    }
    payload = json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return f"{_b64e(payload)}.{_sign(payload)}", expires_at


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Validate a token's signature and expiry, returning its claims or None."""
    if not token or "." not in token:
        return None
    encoded, signature = token.rsplit(".", 1)
    try:
        payload = _b64d(encoded)
    except Exception:
        return None
    if not hmac.compare_digest(_sign(payload), signature):
        return None
    try:
        claims = json.loads(payload.decode("utf-8"))
    except Exception:
        return None
    if int(claims.get("exp", 0)) < int(time.time()):
        return None
    return claims


def authenticate(username: str, password: str) -> Optional[dict[str, Any]]:
    """Return the matching user record when credentials are valid, else None."""
    for user in USERS:
        if user.get("username") != username:
            continue
        if hmac.compare_digest(str(user.get("password", "")), str(password)):
            return user
    return None


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    """Strip credential fields before returning a user to clients."""
    return {
        "username": user.get("username"),
        "display_name": user.get("display_name") or user.get("username"),
        "role": user.get("role"),
        "salesrep_id": user.get("salesrep_id"),
    }


def get_current_user(request: Request) -> dict[str, Any]:
    """Dependency returning the authenticated user or raising 401."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in.")
    return user


def require_roles(*roles: str):
    """Dependency factory enforcing that the caller holds one of the given roles."""

    def _dependency(request: Request) -> dict[str, Any]:
        user = get_current_user(request)
        if roles and user.get("role") not in roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action.",
            )
        return user

    return _dependency
