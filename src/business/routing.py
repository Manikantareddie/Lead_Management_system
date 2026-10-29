"""Sales representative routing rules.

Routes a lead to a sales representative based on compatible territory and
product specialty. If no representative matches, produces an explicit
unassigned/exception decision rather than silently assigning at random.

Synthetic-demo routing rule:
  A salesrep is compatible when territory and product_specialty both match
  the lead's territory and product_interest. Among compatible reps, the one
  with the fewest existing lead assignments is chosen (ties broken by ID).
  If none match, the lead is unassigned with routing_exception=True.
"""

from collections import defaultdict


def compatible_salesrep(
    lead: dict,
    salesreps: list[dict],
    assignment_counts: dict[str, int] | None = None,
) -> dict | None:
    """Return the best-matched salesrep for a lead, or None if no match.

    Compatibility requires territory and product_specialty equality.
    Among matches, the rep with the fewest current assignments wins.
    """
    lead_territory = lead.get("territory")
    lead_product = lead.get("product_interest")
    if not lead_territory or not lead_product:
        return None

    counts = assignment_counts or defaultdict(int)
    candidates = [
        s for s in salesreps
        if s.get("is_active", True)
        and s.get("territory") == lead_territory
        and s.get("product_specialty") == lead_product
    ]
    if not candidates:
        return None

    candidates.sort(key=lambda s: (counts.get(s["salesrep_id"], 0), s["salesrep_id"]))
    return candidates[0]


def route_lead(
    lead: dict,
    salesreps: list[dict],
    assignment_counts: dict[str, int] | None = None,
) -> dict:
    """Return a copy of lead with routing decision applied.

    Adds:
      - assigned_salesrep_id: matched rep ID, or None if no match
      - routing_exception: True when no compatible rep exists
      - routing_reason: explanation of the routing outcome
    """
    result = dict(lead)
    rep = compatible_salesrep(lead, salesreps, assignment_counts)
    if rep is None:
        result["assigned_salesrep_id"] = None
        result["routing_exception"] = True
        result["routing_reason"] = "no_compatible_salesrep"
    else:
        result["assigned_salesrep_id"] = rep["salesrep_id"]
        result["routing_exception"] = False
        result["routing_reason"] = None
        if assignment_counts is not None:
            assignment_counts[rep["salesrep_id"]] = (
                assignment_counts.get(rep["salesrep_id"], 0) + 1
            )
    return result
