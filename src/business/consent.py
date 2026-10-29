"""Consent eligibility rules.

Determines whether a contact may be contacted on a given channel at a given
timestamp. Consent history is append-only: a new record is inserted for each
change and history is never overwritten.

Effective consent at time T for a contact/channel:
  The record with status='granted', consented_at <= T,
  (withdrawn_at IS NULL OR withdrawn_at > T), and
  (expires_at IS NULL OR expires_at > T), having the greatest consented_at.
  If no such record exists, there is no valid consent.

Synthetic-demo rule: channel mapping from task type to consent channel:
  call -> phone, email -> email, meeting -> email, demo -> email, other -> email
"""

from datetime import datetime

TASK_TYPE_TO_CHANNEL = {
    "call": "phone",
    "email": "email",
    "meeting": "email",
    "demo": "email",
    "other": "email",
}


def channel_for_task_type(task_type: str) -> str:
    """Map a task type to the consent channel required for outreach."""
    return TASK_TYPE_TO_CHANNEL.get(task_type, "email")


def effective_consent_at(
    consents: list[dict],
    contact_id: str,
    channel: str,
    at: str,
) -> dict | None:
    """Return the effective consent record for a contact/channel at time T.

    Returns None if no valid consent exists. History is append-only and never
    overwritten; this function only reads.
    """
    best: dict | None = None
    for c in consents:
        if c["contact_id"] != contact_id:
            continue
        if c["channel"] != channel:
            continue
        if c["status"] != "granted":
            continue
        consented_at = c.get("consented_at")
        if not consented_at or consented_at > at:
            continue
        withdrawn_at = c.get("withdrawn_at")
        if withdrawn_at and withdrawn_at <= at:
            continue
        expires_at = c.get("expires_at")
        if expires_at and expires_at <= at:
            continue
        if best is None or consented_at > best.get("consented_at", ""):
            best = c
    return best


def is_consent_valid_at(
    consents: list[dict],
    contact_id: str,
    channel: str,
    at: str,
) -> bool:
    """Return True if a valid consent exists for the contact/channel at time T."""
    return effective_consent_at(consents, contact_id, channel, at) is not None


def explain_consent_ineligibility(
    consents: list[dict],
    contact_id: str,
    channel: str,
    at: str,
) -> str:
    """Explain why a contact does not have valid consent for channel at time T.

    Returns 'eligible' if valid consent exists, otherwise returns a structured reason:
    'no_consent_record', 'consent_withdrawn', 'consent_expired', 'consent_denied',
    or 'consent_granted_after_outreach'.
    """
    if is_consent_valid_at(consents, contact_id, channel, at):
        return "eligible"

    relevant = [c for c in consents if c.get("contact_id") == contact_id and c.get("channel") == channel]
    if not relevant:
        return "no_consent_record"

    # Sort descending by created_at or consented_at
    for c in sorted(relevant, key=lambda x: x.get("created_at") or x.get("consented_at") or "", reverse=True):
        status = c.get("status")
        if status == "denied":
            return "consent_denied"
        withdrawn_at = c.get("withdrawn_at")
        if withdrawn_at and withdrawn_at <= at:
            return "consent_withdrawn"
        expires_at = c.get("expires_at")
        if expires_at and expires_at <= at:
            return "consent_expired"
        consented_at = c.get("consented_at")
        if consented_at and consented_at > at:
            return "consent_granted_after_outreach"

    return "no_valid_consent"


def consent_status_at(
    consents: list[dict],
    contact_id: str,
    channel: str,
    at: str,
) -> str:
    """Return effective consent status for contact/channel at time T.

    Returns 'granted', 'withdrawn', 'expired', 'denied', or 'none'.
    """
    if is_consent_valid_at(consents, contact_id, channel, at):
        return "granted"

    ineligibility = explain_consent_ineligibility(consents, contact_id, channel, at)
    if ineligibility == "consent_withdrawn":
        return "withdrawn"
    if ineligibility == "consent_expired":
        return "expired"
    if ineligibility == "consent_denied":
        return "denied"
    return "none"

