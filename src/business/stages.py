"""Lead stage transition and opportunity outcome rules.

Defines valid lead lifecycle transitions and timestamped, append-only stage
history. Also determines opportunity won/lost outcomes from terminal stages.

Synthetic-demo stage model:
  New -> Contacted -> Qualified -> Converted
  Any non-terminal stage -> Disqualified (terminal)
  Converted and Disqualified are terminal; no transitions out of them.

Opportunity outcomes:
  - closed_won: won_lost_reason populated (e.g. "budget_approved")
  - closed_lost: won_lost_reason populated (e.g. "competitor", "budget")
  - Non-terminal stages: won_lost_reason is None
"""

VALID_TRANSITIONS = {
    "New": {"Contacted", "Disqualified"},
    "Contacted": {"Qualified", "Disqualified"},
    "Qualified": {"Converted", "Disqualified"},
    "Converted": set(),   # terminal
    "Disqualified": set(),  # terminal
}

TERMINAL_STAGES = {"Converted", "Disqualified"}

WON_LOST_REASONS_WON = [
    "budget_approved",
    "decision_maker_aligned",
    "competitive_win",
]
WON_LOST_REASONS_LOST = [
    "competitor",
    "budget",
    "timing",
    "no_decision",
]


def is_valid_stage_transition(from_stage: str | None, to_stage: str) -> bool:
    """Return True if the stage transition is valid under the lifecycle model."""
    if from_stage is None:
        # Initial stage must be New
        return to_stage == "New"
    allowed = VALID_TRANSITIONS.get(from_stage, set())
    return to_stage in allowed


def stage_transition_decision(
    lead: dict,
    to_stage: str,
    changed_by: str | None,
    changed_at: str,
) -> dict | None:
    """Return a stage history record if the transition is valid, else None.

    Does not mutate the lead; the caller applies the new stage. Returns None
    for invalid transitions (e.g. backwards moves, transitions out of terminal
    stages).
    """
    from_stage = lead.get("status")
    if not is_valid_stage_transition(from_stage, to_stage):
        return None

    return {
        "from_stage": from_stage,
        "to_stage": to_stage,
        "changed_by": changed_by,
        "changed_at": changed_at,
        "reason": f"Stage transition from {from_stage} to {to_stage}",
    }


def opportunity_outcome(
    stage: str,
    amount: float,
    rng=None,
) -> dict:
    """Return won_lost_reason and competitor for an opportunity based on stage.

    Terminal stages get a reason; non-terminal stages get None. Uses rng if
    provided for deterministic random choice, otherwise picks first option.
    """
    import random as _random
    rng = rng or _random

    result = {
        "won_lost_reason": None,
        "competitor": None,
    }

    if stage == "closed_won":
        result["won_lost_reason"] = rng.choice(WON_LOST_REASONS_WON)
    elif stage == "closed_lost":
        result["won_lost_reason"] = rng.choice(WON_LOST_REASONS_LOST)
        result["competitor"] = rng.choice(
            ["Competitor A", "Competitor B", "Competitor C", None]
        )

    return result


def explain_stage_transition(from_stage: str | None, to_stage: str) -> dict:
    """Return a detailed explanation of whether a stage transition is valid."""
    if is_valid_stage_transition(from_stage, to_stage):
        return {
            "valid": True,
            "reason": f"Allowed transition from {from_stage or 'initial'} to {to_stage}",
        }
    if from_stage in TERMINAL_STAGES:
        return {
            "valid": False,
            "reason": f"Cannot transition from terminal stage '{from_stage}'",
        }
    return {
        "valid": False,
        "reason": f"Invalid stage transition from '{from_stage}' to '{to_stage}'",
    }

