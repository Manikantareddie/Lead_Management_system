"""YottaFlex lead management business rule layer.

Contains explainable, reproducible decision functions for deduplication,
consent eligibility, sales representative routing, follow-up task decisions,
and lead stage transitions. All rules use documented synthetic-demo thresholds
and are deterministic given the same inputs.
"""

from .deduplication import (
    DEDUP_WINDOW_DAYS,
    compute_detection_key,
    find_duplicate_lead,
    label_duplicate,
    find_duplicate_opportunity,
    label_duplicate_opportunity,
    normalize_email_domain,
    normalize_company_name,
)
from .consent import (
    is_consent_valid_at,
    effective_consent_at,
    explain_consent_ineligibility,
    channel_for_task_type,
    TASK_TYPE_TO_CHANNEL,
)
from .routing import (
    route_lead,
    compatible_salesrep,
)
from .decisions import (
    lead_priority,
    should_create_task,
    task_status_and_priority,
    explain_task_decision,
)
from .stages import (
    VALID_TRANSITIONS,
    TERMINAL_STAGES,
    is_valid_stage_transition,
    stage_transition_decision,
    opportunity_outcome,
    explain_stage_transition,
)

__all__ = [
    "DEDUP_WINDOW_DAYS",
    "compute_detection_key",
    "find_duplicate_lead",
    "label_duplicate",
    "find_duplicate_opportunity",
    "label_duplicate_opportunity",
    "normalize_email_domain",
    "normalize_company_name",
    "is_consent_valid_at",
    "effective_consent_at",
    "explain_consent_ineligibility",
    "channel_for_task_type",
    "TASK_TYPE_TO_CHANNEL",
    "route_lead",
    "compatible_salesrep",
    "lead_priority",
    "should_create_task",
    "task_status_and_priority",
    "explain_task_decision",
    "VALID_TRANSITIONS",
    "TERMINAL_STAGES",
    "is_valid_stage_transition",
    "stage_transition_decision",
    "opportunity_outcome",
    "explain_stage_transition",
]

