"""Lead deduplication rules.

Deterministic, explainable matching that identifies repeat buying requests
without assuming email alone uniquely identifies a buyer. Original records are
preserved; duplicates are labelled, not deleted.

Synthetic-demo matching rule (not derived from real business data):
  A lead is a duplicate of an earlier lead when all of the following match:
    - normalized email domain
    - normalized company name
    - product interest
    - submission month (UTC)

The first occurrence of a matching key is the original; subsequent
occurrences are labelled as duplicates.
"""

from datetime import datetime

DEDUP_WINDOW_DAYS = 30


def normalize_email_domain(email: str | None) -> str:
    """Return the lowercased domain part of an email, or empty string."""
    if not email or "@" not in email:
        return ""
    return email.rsplit("@", 1)[-1].strip().lower()


def normalize_company_name(name: str | None) -> str:
    """Return a lowercased, whitespace-collapsed company name."""
    if not name:
        return ""
    return " ".join(name.strip().split()).lower()


def submission_month(created_at: str) -> str:
    """Return the YYYY-MM submission month from an ISO timestamp."""
    if not created_at:
        return ""
    return created_at[:7]  # "YYYY-MM"


def compute_detection_key(
    email_domain: str,
    company_name: str,
    product_interest: str | None,
    submission_month_str: str,
) -> str:
    """Build an explainable composite detection key from input features.

    The key is a pipe-delimited string of normalized features. It is stored
    separately from anomaly labels and is not used as a scoring input.
    """
    product = (product_interest or "").strip().lower()
    return "|".join([email_domain, company_name, product, submission_month_str])


def find_duplicate_lead(
    new_lead: dict,
    existing_leads: list[dict],
) -> dict | None:
    """Return the original lead if new_lead is a duplicate, else None.

    Matching uses the documented composite key: email domain + company name
    + product interest + submission month. The first lead with a matching key
    (earliest created_at) is considered the original.
    """
    new_key = new_lead.get("duplicate_detection_key")
    if not new_key:
        return None

    for existing in existing_leads:
        if existing.get("duplicate_detection_key") == new_key:
            return existing

    return None


def label_duplicate(
    lead: dict,
    original_lead: dict | None,
) -> dict:
    """Return a copy of lead with duplicate anomaly labels applied.

    If original_lead is None, the lead is not a duplicate and labels are
    cleared. Otherwise is_duplicate=True, duplicate_of_lead_id points to the
    original, and duplicate_detection_key is preserved.
    """
    result = dict(lead)
    if original_lead is None:
        result["is_duplicate"] = False
        result["duplicate_of_lead_id"] = None
        result["duplicate_detection_key"] = None
    else:
        result["is_duplicate"] = True
        result["duplicate_of_lead_id"] = original_lead["lead_id"]
    return result


def find_duplicate_opportunity(
    new_opp: dict,
    existing_opps: list[dict],
) -> dict | None:
    """Return the original opportunity if new_opp duplicates an existing buying request.

    Matching uses lead_id or duplicate_detection_key.
    """
    new_key = new_opp.get("duplicate_detection_key")
    new_lead_id = new_opp.get("lead_id")
    for existing in existing_opps:
        if new_key and existing.get("duplicate_detection_key") == new_key:
            return existing
        if new_lead_id and existing.get("lead_id") == new_lead_id:
            return existing
    return None


def label_duplicate_opportunity(
    opp: dict,
    original_opp: dict | None,
) -> dict:
    """Return a copy of opportunity with duplicate anomaly labels applied."""
    result = dict(opp)
    if original_opp is None:
        result["is_duplicate"] = False
        result["duplicate_of_opportunity_id"] = None
    else:
        result["is_duplicate"] = True
        result["duplicate_of_opportunity_id"] = original_opp["opportunity_id"]
    return result

