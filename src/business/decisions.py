"""Follow-up task and lead priority decisions.

Task eligibility depends on lead score, consent, deduplication status, and
sales representative assignment. Task status and priority are derived from
lead score rather than assigned at random.

Synthetic-demo thresholds:
  - Lead score >= 70: high priority, task eligible
  - Lead score 40-69: medium priority, task eligible
  - Lead score < 40: low priority, task not eligible (no outreach)
  - Duplicate leads: not eligible for new outreach tasks
  - No valid consent for task channel at task time: not eligible
  - Unassigned lead (routing exception): task eligible but priority lowered
"""

from .consent import TASK_TYPE_TO_CHANNEL, is_consent_valid_at

HIGH_SCORE_THRESHOLD = 70
MEDIUM_SCORE_THRESHOLD = 40


def lead_priority(lead_score: int) -> str:
    """Return priority band for a lead score."""
    if lead_score >= HIGH_SCORE_THRESHOLD:
        return "high"
    if lead_score >= MEDIUM_SCORE_THRESHOLD:
        return "medium"
    return "low"


def should_create_task(
    lead: dict,
    consents: list[dict],
    task_type: str,
    at: str,
) -> bool:
    """Return True if a follow-up task should be created for this lead.

    A task is created only when:
      - lead is not a duplicate
      - lead score meets minimum threshold (>= 40)
      - lead is assigned to a compatible sales representative
      - lead has a valid consent for the task's channel at time `at`
    """
    return explain_task_decision(lead, consents, task_type, at)["eligible"]


def consent_channel_for_task_type(task_type: str) -> str:
    """Map task type to consent channel (delegates to consent module)."""
    return TASK_TYPE_TO_CHANNEL.get(task_type, "email")


def task_status_and_priority(
    lead_score: int,
    routing_exception: bool = False,
) -> tuple[str, str]:
    """Return (status, priority) for a new follow-up task.

    High-scoring leads get open/high-priority tasks. Low-scoring eligible
    leads get open/low-priority. Routing exceptions lower priority by one
    band but do not block task creation.
    """
    priority = lead_priority(lead_score)
    if routing_exception:
        if priority == "high":
            priority = "medium"
        elif priority == "medium":
            priority = "low"
    status = "open"
    return status, priority


def explain_task_decision(
    lead: dict,
    consents: list[dict],
    task_type: str,
    at: str,
) -> dict:
    """Return structured explanation of task creation decision.

    Evaluates candidate tasks against business rules:
      - Duplicate leads are prohibited from outreach (decision='rejected', reason='duplicate_lead_prohibited')
      - Low score leads (<40) are not eligible for outreach (decision='rejected', reason='low_score')
      - Leads without a compatible assigned salesrep are deferred (decision='deferred', reason='no_compatible_salesrep')
      - Missing or expired consent blocks outreach (decision='rejected', reason='no_valid_consent')
      - Eligible candidates result in task creation (decision='created', reason='eligible')
    """
    channel = TASK_TYPE_TO_CHANNEL.get(task_type, "email")
    if lead.get("is_duplicate"):
        return {
            "eligible": False,
            "decision": "rejected",
            "reason": "duplicate_lead_prohibited",
            "channel": channel,
        }
    if "lead_score" in lead and lead.get("lead_score", 0) < MEDIUM_SCORE_THRESHOLD:
        return {
            "eligible": False,
            "decision": "rejected",
            "reason": "low_score",
            "channel": channel,
        }
    if "assigned_salesrep_id" in lead and not lead.get("assigned_salesrep_id"):
        return {
            "eligible": False,
            "decision": "deferred",
            "reason": "no_compatible_salesrep",
            "channel": channel,
        }
    contact_id = lead.get("contact_id")
    if not contact_id:
        return {
            "eligible": False,
            "decision": "rejected",
            "reason": "missing_contact_id",
            "channel": channel,
        }
    if not is_consent_valid_at(consents, contact_id, channel, at):
        return {
            "eligible": False,
            "decision": "rejected",
            "reason": "no_valid_consent",
            "channel": channel,
        }
    status, priority = task_status_and_priority(
        lead.get("lead_score", 0),
        lead.get("routing_exception", False),
    )
    return {
        "eligible": True,
        "decision": "created",
        "reason": "eligible",
        "channel": channel,
        "priority": priority,
        "status": status,
    }

