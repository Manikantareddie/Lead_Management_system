"""Synthetic data generator for all YottaFlex lead management entities.

Generates deterministic CSV exports using only the Python standard library.
Record counts and seed are configurable. Parent records are generated before
dependent records so every foreign-key reference points to an existing parent.

Business rules (src/business/) are applied during generation so that lead
decisions are explainable and reproducible rather than randomly assigned:
  - Lead deduplication via composite detection key
  - Sales rep routing by territory + product specialty
  - Consent-gated follow-up task creation
  - Score-driven task priority and lead status
  - Valid stage transitions with append-only history
  - Outcome-driven won/lost reasons on opportunities

Generation order (parents first):
1. Companies (root)
2. Contacts -> Companies
3. SalesReps (root)
4. ScoreRules (root)
5. Campaigns -> SalesRep (owner optional)
6. Leads -> Contacts, Companies, SalesReps, ScoreRules (dedup + routing)
7. LeadCampaign -> Leads, Campaigns (bridge)
8. Consents -> Contacts
9. Activities -> Leads, SalesReps (created_by optional)
10. Tasks -> Leads, SalesReps, Consents (consent-gated)
11. Opportunities -> Leads, SalesReps (score-gated)
12. StageHistories -> Leads, SalesReps (valid transitions only)

Activity and StageHistory are append-only event records; Consent history is
append-only and never overwritten.
"""

import argparse
import csv
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from generator.config import DEFAULT_CONFIG
from business.deduplication import (
    normalize_email_domain,
    normalize_company_name,
    submission_month,
    compute_detection_key,
    find_duplicate_lead,
    label_duplicate,
)
from business.consent import (
    is_consent_valid_at,
    channel_for_task_type,
    TASK_TYPE_TO_CHANNEL,
    consent_status_at,
)
from business.routing import route_lead
from business.decisions import (
    lead_priority,
    should_create_task,
    explain_task_decision,
    task_status_and_priority,
)
from business.stages import (
    is_valid_stage_transition,
    stage_transition_decision,
    opportunity_outcome,
    TERMINAL_STAGES,
)

# Small built-in vocabularies so the generator needs no external packages.
FIRST_NAMES = [
    "Avery", "Casey", "Jordan", "Morgan", "Riley", "Quinn", "Taylor",
    "Jamie", "Drew", "Peyton",
]
LAST_NAMES = [
    "Reyes", "Bennett", "Coleman", "Diaz", "Foster", "Gutierrez",
    "Henderson", "Irwin", "Julian", "Klein",
]
COMPANY_NAMES = [
    "Northstar Logistics", "Cedar Peak Systems", "Blue River Partners",
    "Summit Edge Solutions", "Pine Hollow Tech", "Redwood Grove Inc",
    "Cascade Works", "Mesa Point Group", "Harbor Lane Co", "Vista Ridge Corp",
]
INDUSTRIES = ["Technology", "Healthcare", "Manufacturing", "Finance", "Retail"]
SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]
COUNTRIES = ["US", "CA", "GB", "DE", "AU"]
SOURCES = ["website", "referral", "outbound", "event", "paid_media"]
STATUSES = ["New", "Contacted", "Qualified", "Disqualified", "Converted"]
CAMPAIGN_TYPES = ["email", "paid_social", "event", "webinar", "outbound"]
CAMPAIGN_STATUSES = ["Draft", "Active", "Paused", "Completed", "Archived"]
ACTIVITY_TYPES = ["call", "email", "meeting", "demo", "note", "linkedin"]
ACTIVITY_OUTCOMES = ["completed", "scheduled", "no_answer", "bounced"]
TASK_TYPES = ["call", "email", "meeting", "demo", "other"]
TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"]
TASK_PRIORITIES = ["low", "medium", "high"]
CONSENT_CHANNELS = ["email", "phone", "sms", "mail"]
CONSENT_STATUSES = ["granted", "denied", "withdrawn"]
CONSENT_SOURCES = ["web_form", "verbal", "paper"]
OPPORTUNITY_STAGES = ["discovery", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]

# Proposed synthetic-demo scoring weights. These are demonstration rules only,
# not derived from real business data. They sum to 1.0.
FIT_WEIGHT = 0.5
INTENT_WEIGHT = 0.3
ENGAGEMENT_WEIGHT = 0.2

# Score-to-status mapping (synthetic-demo rule).
SCORE_STATUS_MAP = [
    (70, "Qualified"),
    (40, "Contacted"),
    (0, "New"),
]

BASE_DATE = datetime(2026, 1, 1)


def _company_id(n: int) -> str:
    return f"CO-{n:06d}"


def _contact_id(n: int) -> str:
    return f"CON-{n:06d}"


def _lead_id(n: int) -> str:
    return f"LEAD-2026-{n:06d}"


def _campaign_id(n: int) -> str:
    return f"CAMP-{n:06d}"


def _consent_id(n: int) -> str:
    return f"CSN-{n:06d}"


def _score_rule_id(n: int) -> str:
    return f"SCR-{n:06d}"


def _salesrep_id(n: int) -> str:
    return f"REP-{n:06d}"


def _stage_history_id(n: int) -> str:
    return f"SH-{n:06d}"


def _activity_id(lead_id: str, seq: int) -> str:
    return f"ACT-{lead_id}-{seq:03d}"


def _task_id(lead_id: str, seq: int) -> str:
    return f"TASK-{lead_id}-{seq:03d}"


def _opportunity_id(n: int) -> str:
    return f"OPP-2026-{n:06d}"


def _rand_date(rng: random.Random) -> datetime:
    return BASE_DATE + timedelta(days=rng.randint(0, 364))


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def compute_lead_score(fit_score: int, intent_score: int, engagement_score: int) -> int:
    """Compute lead_score as a weighted sum of component scores.

    Weights are proposed synthetic-demo rules summing to 1.0. The result is
    rounded to an integer and clamped to [0, 100].
    """
    raw = (
        fit_score * FIT_WEIGHT
        + intent_score * INTENT_WEIGHT
        + engagement_score * ENGAGEMENT_WEIGHT
    )
    score = round(raw)
    return max(0, min(100, score))


def status_from_score(lead_score: int) -> str:
    """Return the lead lifecycle status implied by the lead score.

    Synthetic-demo rule:
      score >= 70 -> Qualified
      score >= 40 -> Contacted
      score <  40 -> New
    """
    for threshold, status in SCORE_STATUS_MAP:
        if lead_score >= threshold:
            return status
    return "New"


def generate_companies(rng: random.Random, count: int) -> list[dict]:
    companies = []
    for n in range(1, count + 1):
        created_at = _rand_date(rng)
        companies.append({
            "company_id": _company_id(n),
            "name": COMPANY_NAMES[n - 1] if n <= len(COMPANY_NAMES) else f"Company {n}",
            "industry": rng.choice(INDUSTRIES),
            "size": rng.choice(SIZES),
            "country": rng.choice(COUNTRIES),
            "created_at": _iso(created_at),
            "updated_at": _iso(created_at),
        })
    return companies


def generate_contacts(rng: random.Random, companies: list[dict], count: int) -> list[dict]:
    contacts = []
    company_ids = [c["company_id"] for c in companies]
    for n in range(1, count + 1):
        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)
        company_id = rng.choice(company_ids)
        created_at = _rand_date(rng)
        contacts.append({
            "contact_id": _contact_id(n),
            "company_id": company_id,
            "first_name": first,
            "last_name": last,
            "email": f"{first.lower()}.{last.lower()}{n}@example.com",
            "created_at": _iso(created_at),
            "updated_at": _iso(created_at),
        })
    return contacts


def generate_salesreps(rng: random.Random, count: int) -> list[dict]:
    salesreps = []
    for n in range(1, count + 1):
        created_at = _rand_date(rng)
        salesreps.append({
            "salesrep_id": _salesrep_id(n),
            "first_name": rng.choice(FIRST_NAMES),
            "last_name": rng.choice(LAST_NAMES),
            "email": f"rep{n}@example.com",
            "territory": rng.choice(["North", "South", "East", "West", "Central"]),
            "product_specialty": rng.choice(["Enterprise", "SMB", "Mid-Market"]),
            "is_active": True,
            "created_at": _iso(created_at),
            "updated_at": _iso(created_at),
        })
    return salesreps


def generate_score_rules(rng: random.Random, count: int) -> list[dict]:
    """Generate one ScoreRule per component (fit, intent, engagement).

    Each rule has version 1, effective_from at BASE_DATE, and no effective_to
    (ongoing). We match the documented synthetic-demo weights.
    """
    rules = []
    components = [
        ("fit", FIT_WEIGHT),
        ("intent", INTENT_WEIGHT),
        ("engagement", ENGAGEMENT_WEIGHT),
    ]
    for i, (component, weight) in enumerate(components):
        if i >= count:
            break
        rules.append({
            "score_rule_id": _score_rule_id(i + 1),
            "name": f"{component.capitalize()} Scoring Rule v1",
            "component": component,
            "weight": weight,
            "version": 1,
            "effective_from": _iso(BASE_DATE),
            "effective_to": None,
            "min_score": 0,
            "max_score": 100,
            "description": f"{component} component scoring rule",
            "is_active": True,
            "created_at": _iso(BASE_DATE),
            "updated_at": _iso(BASE_DATE),
        })
    return rules


def generate_campaigns(rng: random.Random, salesreps: list[dict], count: int) -> list[dict]:
    campaigns = []
    salesrep_ids = [s["salesrep_id"] for s in salesreps]
    for n in range(1, count + 1):
        start_date = _rand_date(rng)
        end_date = start_date + timedelta(days=rng.randint(30, 90))
        campaigns.append({
            "campaign_id": _campaign_id(n),
            "name": f"Campaign {n}",
            "type": rng.choice(CAMPAIGN_TYPES),
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "budget": round(rng.uniform(1000, 50000), 2),
            "owner_id": rng.choice(salesrep_ids),
            "status": rng.choice(CAMPAIGN_STATUSES),
            "created_at": _iso(start_date),
            "updated_at": _iso(start_date),
        })
    return campaigns


def generate_leads(rng: random.Random, contacts: list[dict], companies: list[dict],
                   salesreps: list[dict], score_rules: list[dict], count: int) -> list[dict]:
    """Generate leads with business rules applied.

    Each lead:
      - Gets fit/intent/engagement scores and a computed lead_score
      - Is checked for duplication against earlier leads (composite key)
      - Is routed to a salesrep by territory + product specialty
      - Gets a status derived from lead_score (not random)
      - Gets territory and product_interest from routing context
    """
    leads = []
    contact_ids = [c["contact_id"] for c in contacts]
    contact_map = {c["contact_id"]: c for c in contacts}
    company_map = {c["company_id"]: c["name"] for c in companies}
    salesrep_ids = [s["salesrep_id"] for s in salesreps]
    salesrep_map = {s["salesrep_id"]: s for s in salesreps}
    rule_by_component = {r["component"]: r["score_rule_id"] for r in score_rules}
    assignment_counts: dict[str, int] = {}
    leads_by_detection_key: dict[str, dict] = {}

    for n in range(1, count + 1):
        contact_id = rng.choice(contact_ids)
        contact = contact_map[contact_id]
        company_id = contact["company_id"]
        created_at = _rand_date(rng)

        fit_score = rng.randint(0, 100)
        intent_score = rng.randint(0, 100)
        engagement_score = rng.randint(0, 100)
        lead_score = compute_lead_score(fit_score, intent_score, engagement_score)

        # Build detection key for deduplication.
        email_domain = normalize_email_domain(contact.get("email", ""))
        company_name = company_map.get(company_id, "")
        product_interest = rng.choice(["Enterprise", "SMB", "Mid-Market"])
        sub_month = submission_month(_iso(created_at))
        detection_key = compute_detection_key(
            email_domain, company_name, product_interest, sub_month
        )

        # Check for duplication against earlier leads via O(1) lookup.
        original = leads_by_detection_key.get(detection_key)

        lead = {
            "lead_id": _lead_id(n),
            "contact_id": contact_id,
            "company_id": company_id,
            "source": rng.choice(SOURCES),
            "status": status_from_score(lead_score),
            "lead_score": lead_score,
            "fit_score": fit_score,
            "intent_score": intent_score,
            "engagement_score": engagement_score,
            "scored_at": _iso(created_at),
            "score_rule_id": rule_by_component.get("fit"),
            "assigned_salesrep_id": None,  # filled by routing below
            "territory": rng.choice(["North", "South", "East", "West", "Central"]),
            "product_interest": product_interest,
            "created_at": _iso(created_at),
            "updated_at": _iso(created_at),
            "converted_at": None,
            "duplicate_detection_key": detection_key,
            "is_duplicate": False,
            "duplicate_of_lead_id": None,
            "routing_exception": False,
            "routing_reason": None,
        }
        lead = label_duplicate(lead, original)
        if not original:
            leads_by_detection_key[detection_key] = lead

        # Route to salesrep: compatible match or explicit unassigned state.
        lead = route_lead(lead, salesreps, assignment_counts)
        leads.append(lead)

    return leads


def generate_lead_campaigns(rng: random.Random, leads: list[dict],
                            campaigns: list[dict], count: int) -> list[dict]:
    """Create N:M associations between Leads and Campaigns.

    Each lead is associated with 1-2 campaigns. Composite PK (lead_id, campaign_id).
    """
    associations = []
    lead_ids = [l["lead_id"] for l in leads]
    campaign_ids = [c["campaign_id"] for c in campaigns]
    seen = set()
    assoc_n = 0
    for lead_id in lead_ids:
        n_campaigns = rng.randint(1, 2)
        sampled = rng.sample(campaign_ids, min(n_campaigns, len(campaign_ids)))
        for campaign_id in sampled:
            key = (lead_id, campaign_id)
            if key in seen:
                continue
            seen.add(key)
            assoc_n += 1
            if assoc_n > count:
                break
            associations.append({
                "lead_id": lead_id,
                "campaign_id": campaign_id,
                "attributed_at": _iso(_rand_date(rng)),
                "is_primary": rng.choice([True, False, False]),
            })
        if assoc_n > count:
            break
    return associations


def generate_consents(rng: random.Random, contacts: list[dict], count: int) -> list[dict]:
    """Generate append-only consent records linked to Contacts.

    Multiple records per (contact_id, channel) are allowed; history is preserved.
    Synthetic-demo rule: every contact gets at least one granted consent so
    baseline outreach remains possible; additional denied/withdrawn records
    provide consent history depth.
    """
    consents = []
    contact_ids = [c["contact_id"] for c in contacts]
    consent_n = 0

    # Guarantee one granted consent per contact (email channel) so baseline
    # outreach is possible. These are inserted first.
    for contact_id in contact_ids:
        if consent_n >= count:
            break
        consent_n += 1
        consented_at = _rand_date(rng)
        expires_at = None
        if rng.random() < 0.3:
            expires_at = _iso(_rand_date(rng) + timedelta(days=365))
        consents.append({
            "consent_id": _consent_id(consent_n),
            "contact_id": contact_id,
            "channel": "email",
            "status": "granted",
            "consented_at": _iso(consented_at),
            "withdrawn_at": None,
            "expires_at": expires_at,
            "source": "web_form",
            "created_at": _iso(consented_at),
        })

    # Additional consents per contact (random channel/status) for history depth.
    for contact_id in contact_ids:
        if consent_n >= count:
            break
        n_consents = rng.randint(1, 2)
        for _ in range(n_consents):
            if consent_n >= count:
                break
            consent_n += 1
            channel = rng.choice(CONSENT_CHANNELS)
            status = rng.choices(
                ["granted", "denied", "withdrawn"], weights=[70, 15, 15], k=1
            )[0]
            consented_at = _rand_date(rng) if status == "granted" else None
            withdrawn_at = _rand_date(rng) if status == "withdrawn" else None
            expires_at = None
            if status == "granted" and rng.random() < 0.3:
                expires_at = _iso(_rand_date(rng) + timedelta(days=365))
            consents.append({
                "consent_id": _consent_id(consent_n),
                "contact_id": contact_id,
                "channel": channel,
                "status": status,
                "consented_at": _iso(consented_at) if consented_at else None,
                "withdrawn_at": _iso(withdrawn_at) if withdrawn_at else None,
                "expires_at": expires_at,
                "source": rng.choice(CONSENT_SOURCES),
                "created_at": _iso(_rand_date(rng)),
            })
    return consents


def generate_activities(rng: random.Random, leads: list[dict], salesreps: list[dict],
                        count: int) -> list[dict]:
    """Generate append-only activity records linked to Leads.

    Per-lead sequence for activity_id. Activity records are never overwritten.
    Ensures exact target count is reached while preserving per-lead sequence (max 3 per lead).
    """
    lead_ids = [l["lead_id"] for l in leads]
    salesrep_ids = [s["salesrep_id"] for s in salesreps]
    activities_by_lead: dict[str, list[dict]] = {lid: [] for lid in lead_ids}
    activity_n = 0

    for lead_id in lead_ids:
        if activity_n >= count:
            break
        n_activities = rng.randint(1, 3)
        for seq in range(1, n_activities + 1):
            if activity_n >= count:
                break
            activity_n += 1
            activity_date = _rand_date(rng)
            activities_by_lead[lead_id].append({
                "activity_id": _activity_id(lead_id, seq),
                "lead_id": lead_id,
                "type": rng.choice(ACTIVITY_TYPES),
                "subject": f"Follow-up {seq}",
                "description": f"Interaction notes for activity {seq}",
                "activity_date": _iso(activity_date),
                "duration_minutes": rng.randint(5, 60),
                "outcome": rng.choice(ACTIVITY_OUTCOMES),
                "created_by": rng.choice(salesrep_ids),
                "created_at": _iso(activity_date),
            })

    # If count not yet reached, top up leads that have < 3 activities
    while activity_n < count:
        progressed = False
        for lead_id in lead_ids:
            if activity_n >= count:
                break
            current_acts = activities_by_lead[lead_id]
            if len(current_acts) >= 3:
                continue
            seq = len(current_acts) + 1
            activity_n += 1
            progressed = True
            activity_date = _rand_date(rng)
            current_acts.append({
                "activity_id": _activity_id(lead_id, seq),
                "lead_id": lead_id,
                "type": rng.choice(ACTIVITY_TYPES),
                "subject": f"Follow-up {seq}",
                "description": f"Interaction notes for activity {seq}",
                "activity_date": _iso(activity_date),
                "duration_minutes": rng.randint(5, 60),
                "outcome": rng.choice(ACTIVITY_OUTCOMES),
                "created_by": rng.choice(salesrep_ids),
                "created_at": _iso(activity_date),
            })
        if not progressed:
            break

    activities = []
    for lead_id in lead_ids:
        activities.extend(activities_by_lead[lead_id])
    return activities


def generate_tasks(rng: random.Random, leads: list[dict], salesreps: list[dict],
                   consents: list[dict], count: int) -> tuple[list[dict], list[dict]]:
    """Generate follow-up task records and audit decision records linked to Leads.

    Tasks are consent-gated: a task is only created when the lead has a valid
    consent for the task's channel at the task's timestamp. Task status and
    priority are derived from lead score. Duplicate leads and unassigned leads
    do not receive actionable tasks.

    Returns:
      (tasks, task_decisions)
    """
    tasks = []
    task_decisions = []
    task_n = 0
    decision_n = 0

    # Pre-compute valid consent windows per (contact_id, channel).
    # Maps (contact_id, channel) -> list of (consented_at, expires_at) windows.
    consent_windows: dict[tuple[str, str], list[tuple[str, str | None]]] = {}
    for c in consents:
        if c["status"] != "granted" or not c.get("consented_at"):
            continue
        key = (c["contact_id"], c["channel"])
        consent_windows.setdefault(key, []).append(
            (c["consented_at"], c.get("expires_at"))
        )

    task_seq_by_lead: dict[str, int] = {}
    evaluated_non_created_leads: set[str] = set()

    while task_n < count:
        progressed = False
        for lead in leads:
            if task_n >= count:
                break
            lid = lead["lead_id"]
            contact_id = lead.get("contact_id")
            if not contact_id:
                continue

            task_type = rng.choice(TASK_TYPES)
            channel = channel_for_task_type(task_type)

            # Check if a valid consent exists for this contact/channel
            windows = consent_windows.get((contact_id, channel), [])
            cand_at = None
            for consented_at, expires_at in windows:
                consent_dt = datetime.strptime(consented_at, "%Y-%m-%dT%H:%M:%SZ")
                candidate_dt = consent_dt + timedelta(days=rng.randint(1, 30))
                if expires_at:
                    exp_dt = datetime.strptime(expires_at, "%Y-%m-%dT%H:%M:%SZ")
                    if candidate_dt > exp_dt:
                        continue
                cand_at = _iso(candidate_dt)
                break
            if not cand_at:
                cand_at = lead.get("created_at") or _iso(BASE_DATE)

            eval_result = explain_task_decision(lead, consents, task_type, cand_at)
            decision = eval_result["decision"]
            reason = eval_result["reason"]

            if decision != "created":
                if lid not in evaluated_non_created_leads:
                    decision_n += 1
                    evaluated_non_created_leads.add(lid)
                    c_status = consent_status_at(consents, contact_id, channel, cand_at)
                    task_decisions.append({
                        "decision_id": f"DEC-{decision_n:06d}",
                        "lead_id": lid,
                        "contact_id": contact_id,
                        "task_type": task_type,
                        "channel": channel,
                        "decision": decision,
                        "reason": reason,
                        "evaluated_at": cand_at,
                        "consent_status_at_evaluation": c_status,
                        "lead_score": lead.get("lead_score", 0),
                        "assigned_salesrep_id": lead.get("assigned_salesrep_id"),
                        "task_id": None,
                    })
                continue

            # Candidate is eligible: create task with assigned sales rep
            task_n += 1
            progressed = True
            decision_n += 1

            seq = task_seq_by_lead.get(lid, 0) + 1
            task_seq_by_lead[lid] = seq
            tid = _task_id(lid, seq)

            status = eval_result.get("status", "open")
            priority = eval_result.get("priority", "medium")
            due_dt = datetime.strptime(cand_at, "%Y-%m-%dT%H:%M:%SZ")
            completed_at = _iso(due_dt + timedelta(days=rng.randint(0, 7))) if status == "completed" else None

            tasks.append({
                "task_id": tid,
                "lead_id": lid,
                "assigned_to": lead["assigned_salesrep_id"],
                "type": task_type,
                "title": f"Follow-up task {seq}",
                "description": f"Task description for lead follow-up {seq}",
                "due_date": due_dt.strftime("%Y-%m-%d"),
                "status": status,
                "priority": priority,
                "completed_at": completed_at,
                "created_at": cand_at,
                "updated_at": cand_at,
            })

            c_status = consent_status_at(consents, contact_id, channel, cand_at)
            task_decisions.append({
                "decision_id": f"DEC-{decision_n:06d}",
                "lead_id": lid,
                "contact_id": contact_id,
                "task_type": task_type,
                "channel": channel,
                "decision": "created",
                "reason": "eligible",
                "evaluated_at": cand_at,
                "consent_status_at_evaluation": c_status,
                "lead_score": lead.get("lead_score", 0),
                "assigned_salesrep_id": lead["assigned_salesrep_id"],
                "task_id": tid,
            })

        if not progressed:
            break

    return tasks, task_decisions


def generate_opportunities(rng: random.Random, leads: list[dict],
                           salesreps: list[dict], count: int) -> list[dict]:
    """Generate opportunity records linked to Leads.

    Only Qualified leads are eligible for opportunities. Stage follows a valid
    progression. Terminal stages get won/lost reasons from opportunity_outcome.
    Iterates to reach the configured count.
    """
    opportunities = []
    salesrep_ids = [s["salesrep_id"] for s in salesreps]
    opp_n = 0

    while opp_n < count:
        progressed = False
        for lead in leads:
            if opp_n >= count:
                break
            if lead.get("is_duplicate"):
                continue
            if lead.get("status") not in ("Qualified", "Converted"):
                continue

            n_opps = rng.randint(1, 2)
            for _ in range(n_opps):
                if opp_n >= count:
                    break
                opp_n += 1
                progressed = True

                # Determine a valid stage for this opportunity.
                lead_status = lead.get("status", "New")
                if lead_status == "Converted":
                    stage = rng.choice(["closed_won", "closed_lost"])
                else:
                    stage = rng.choice(["proposal", "negotiation", "discovery", "qualification"])

                closed_at = None
                if stage in ("closed_won", "closed_lost"):
                    closed_at = _iso(_rand_date(rng))

                outcome = opportunity_outcome(stage, 0.0, rng)

                opportunities.append({
                    "opportunity_id": _opportunity_id(opp_n),
                    "lead_id": lead["lead_id"],
                    "salesrep_id": lead.get("assigned_salesrep_id")
                    or rng.choice(salesrep_ids),
                    "stage": stage,
                    "amount": round(rng.uniform(5000, 500000), 2),
                    "currency": "USD",
                    "close_date": _rand_date(rng).strftime("%Y-%m-%d"),
                    "won_lost_reason": outcome["won_lost_reason"],
                    "competitor": outcome["competitor"],
                    "is_duplicate": False,
                    "duplicate_of_opportunity_id": None,
                    "duplicate_detection_key": None,
                    "created_at": _iso(_rand_date(rng)),
                    "updated_at": _iso(_rand_date(rng)),
                    "closed_at": closed_at,
                })

        if not progressed:
            # Fallback if no Qualified/Converted leads are available: allow Contacted leads
            for lead in leads:
                if opp_n >= count:
                    break
                if lead.get("is_duplicate"):
                    continue
                opp_n += 1
                progressed = True
                stage = rng.choice(["discovery", "qualification"])
                outcome = opportunity_outcome(stage, 0.0, rng)
                opportunities.append({
                    "opportunity_id": _opportunity_id(opp_n),
                    "lead_id": lead["lead_id"],
                    "salesrep_id": lead.get("assigned_salesrep_id") or rng.choice(salesrep_ids),
                    "stage": stage,
                    "amount": round(rng.uniform(5000, 500000), 2),
                    "currency": "USD",
                    "close_date": _rand_date(rng).strftime("%Y-%m-%d"),
                    "won_lost_reason": outcome["won_lost_reason"],
                    "competitor": outcome["competitor"],
                    "is_duplicate": False,
                    "duplicate_of_opportunity_id": None,
                    "duplicate_detection_key": None,
                    "created_at": _iso(_rand_date(rng)),
                    "updated_at": _iso(_rand_date(rng)),
                    "closed_at": None,
                })
            if not progressed:
                break

    return opportunities


def generate_stage_histories(rng: random.Random, leads: list[dict],
                             salesreps: list[dict], count: int) -> list[dict]:
    """Generate append-only stage history records linked to Leads.

    Each record captures a valid stage transition in chronological order.
    Records are never overwritten. Transitions follow the documented lifecycle model.
    """
    stage_histories = []
    salesrep_ids = [s["salesrep_id"] for s in salesreps]
    history_n = 0

    for lead in leads:
        if history_n >= count:
            break
        if lead.get("is_duplicate"):
            continue

        lead_status = lead.get("status", "New")
        chain = _build_transition_chain(lead_status)
        from_stage = None
        base_dt = _rand_date(rng)
        step = 0

        for to_stage in chain:
            if history_n >= count:
                break
            step += 1
            trans_dt = base_dt + timedelta(days=step * 5)
            transition = stage_transition_decision(
                {"status": from_stage}, to_stage,
                rng.choice(salesrep_ids),
                _iso(trans_dt),
            )
            if transition is None:
                from_stage = to_stage
                continue
            history_n += 1
            stage_histories.append({
                "stage_history_id": _stage_history_id(history_n),
                "lead_id": lead["lead_id"],
                "from_stage": transition["from_stage"],
                "to_stage": transition["to_stage"],
                "changed_by": transition["changed_by"],
                "changed_at": transition["changed_at"],
                "reason": transition["reason"],
            })
            from_stage = to_stage

    return stage_histories




def _build_transition_chain(final_status: str) -> list[str]:
    """Build a valid stage transition chain ending at final_status.

    Synthetic-demo rule: chains progress forward through the lifecycle.
    """
    order = ["New", "Contacted", "Qualified", "Converted"]
    if final_status not in order:
        return [final_status]
    idx = order.index(final_status)
    return order[: idx + 1]


def _write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def generate(config: dict, inject_anomalies: bool = False) -> dict[str, Any]:
    """Generate all entities deterministically.

    Returns the generated records as a dict keyed by entity name.
    Writes CSV files to config["output_dir"].
    If inject_anomalies is True, also generates and writes ground-truth exceptions to config["ground_truth_dir"].
    """
    seed = int(config.get("seed", DEFAULT_CONFIG["seed"]))
    rng = random.Random(seed)

    n_companies = int(config.get("companies", DEFAULT_CONFIG["companies"]))
    n_contacts = int(config.get("contacts", DEFAULT_CONFIG["contacts"]))
    n_salesreps = int(config.get("salesreps", DEFAULT_CONFIG["salesreps"]))
    n_score_rules = int(config.get("score_rules", DEFAULT_CONFIG["score_rules"]))
    n_campaigns = int(config.get("campaigns", DEFAULT_CONFIG["campaigns"]))
    n_leads = int(config.get("leads", DEFAULT_CONFIG["leads"]))
    n_consents = int(config.get("consents", DEFAULT_CONFIG["consents"]))
    n_activities = int(config.get("activities", DEFAULT_CONFIG["activities"]))
    n_tasks = int(config.get("tasks", DEFAULT_CONFIG["tasks"]))
    n_opportunities = int(config.get("opportunities", DEFAULT_CONFIG["opportunities"]))
    n_stage_histories = int(config.get("stage_histories", DEFAULT_CONFIG["stage_histories"]))

    output_dir = Path(config.get("output_dir", DEFAULT_CONFIG["output_dir"]))
    output_dir.mkdir(parents=True, exist_ok=True)

    companies = generate_companies(rng, n_companies)
    contacts = generate_contacts(rng, companies, n_contacts)
    salesreps = generate_salesreps(rng, n_salesreps)
    score_rules = generate_score_rules(rng, n_score_rules)
    campaigns = generate_campaigns(rng, salesreps, n_campaigns)
    leads = generate_leads(rng, contacts, companies, salesreps, score_rules, n_leads)
    lead_campaigns = generate_lead_campaigns(rng, leads, campaigns, n_leads * 2)
    consents = generate_consents(rng, contacts, n_consents)
    activities = generate_activities(rng, leads, salesreps, n_activities)
    tasks, task_decisions = generate_tasks(rng, leads, salesreps, consents, n_tasks)
    opportunities = generate_opportunities(rng, leads, salesreps, n_opportunities)
    stage_histories = generate_stage_histories(rng, leads, salesreps, n_stage_histories)

    _write_csv(output_dir / "companies.csv", companies)
    _write_csv(output_dir / "contacts.csv", contacts)
    _write_csv(output_dir / "salesreps.csv", salesreps)
    _write_csv(output_dir / "score_rules.csv", score_rules)
    _write_csv(output_dir / "campaigns.csv", campaigns)
    _write_csv(output_dir / "leads.csv", leads)
    _write_csv(output_dir / "lead_campaigns.csv", lead_campaigns)
    _write_csv(output_dir / "consents.csv", consents)
    _write_csv(output_dir / "activities.csv", activities)
    _write_csv(output_dir / "tasks.csv", tasks)
    _write_csv(output_dir / "task_decisions.csv", task_decisions)
    _write_csv(output_dir / "opportunities.csv", opportunities)
    _write_csv(output_dir / "stage_histories.csv", stage_histories)

    result = {
        "companies": companies,
        "contacts": contacts,
        "salesreps": salesreps,
        "score_rules": score_rules,
        "campaigns": campaigns,
        "leads": leads,
        "lead_campaigns": lead_campaigns,
        "consents": consents,
        "activities": activities,
        "tasks": tasks,
        "task_decisions": task_decisions,
        "opportunities": opportunities,
        "stage_histories": stage_histories,
    }

    if inject_anomalies or config.get("inject_exceptions"):
        from generator.exceptions import inject_exceptions, write_ground_truth
        gt_dir = config.get("ground_truth_dir", DEFAULT_CONFIG.get("ground_truth_dir", "data/ground_truth"))
        _, exceptions = inject_exceptions(result, seed=seed)
        write_ground_truth(exceptions, gt_dir)
        result["ground_truth_exceptions"] = exceptions

    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic YottaFlex lead management data."
    )
    parser.add_argument("--scale", choices=["starter", "full"], default="starter",
                        help="Choose dataset scale preset (starter or full)")
    parser.add_argument("--companies", type=int, default=None)
    parser.add_argument("--contacts", type=int, default=None)
    parser.add_argument("--salesreps", type=int, default=None)
    parser.add_argument("--score-rules", type=int, default=None)
    parser.add_argument("--campaigns", type=int, default=None)
    parser.add_argument("--leads", type=int, default=None)
    parser.add_argument("--consents", type=int, default=None)
    parser.add_argument("--activities", type=int, default=None)
    parser.add_argument("--tasks", type=int, default=None)
    parser.add_argument("--opportunities", type=int, default=None)
    parser.add_argument("--stage-histories", type=int, default=None)
    parser.add_argument("--seed", type=int, default=DEFAULT_CONFIG["seed"])
    parser.add_argument("--output-dir", type=str, default=DEFAULT_CONFIG["output_dir"])
    parser.add_argument("--ground-truth-dir", type=str, default=DEFAULT_CONFIG.get("ground_truth_dir", "data/ground_truth"))
    parser.add_argument("--inject-exceptions", action="store_true",
                        help="Generate ground truth exceptions in data/ground_truth/")
    parser.add_argument("--export-json", action="store_true",
                        help="Export entities to JSON format")
    parser.add_argument("--export-sql", action="store_true",
                        help="Export PostgreSQL seed INSERT script")
    parser.add_argument("--validate", action="store_true",
                        help="Run validation checks after generation")
    args = parser.parse_args()

    # Base preset
    from generator.config import FULL_CONFIG
    base_config = dict(FULL_CONFIG if args.scale == "full" else DEFAULT_CONFIG)

    # CLI overrides
    if args.companies is not None:
        base_config["companies"] = args.companies
    if args.contacts is not None:
        base_config["contacts"] = args.contacts
    if args.salesreps is not None:
        base_config["salesreps"] = args.salesreps
    if args.score_rules is not None:
        base_config["score_rules"] = args.score_rules
    if args.campaigns is not None:
        base_config["campaigns"] = args.campaigns
    if args.leads is not None:
        base_config["leads"] = args.leads
    if args.consents is not None:
        base_config["consents"] = args.consents
    if args.activities is not None:
        base_config["activities"] = args.activities
    if args.tasks is not None:
        base_config["tasks"] = args.tasks
    if args.opportunities is not None:
        base_config["opportunities"] = args.opportunities
    if args.stage_histories is not None:
        base_config["stage_histories"] = args.stage_histories

    base_config["seed"] = args.seed
    base_config["output_dir"] = args.output_dir
    base_config["ground_truth_dir"] = args.ground_truth_dir
    base_config["inject_exceptions"] = args.inject_exceptions

    result = generate(base_config, inject_anomalies=args.inject_exceptions)

    print(
        f"Generated {len(result['companies'])} companies, "
        f"{len(result['contacts'])} contacts, {len(result['salesreps'])} salesreps, "
        f"{len(result['score_rules'])} score_rules, {len(result['campaigns'])} campaigns, "
        f"{len(result['leads'])} leads, {len(result['lead_campaigns'])} lead_campaigns, "
        f"{len(result['consents'])} consents, {len(result['activities'])} activities, "
        f"{len(result['tasks'])} tasks, {len(result.get('task_decisions', []))} task_decisions, "
        f"{len(result['opportunities'])} opportunities, "
        f"{len(result['stage_histories'])} stage_histories "
        f"(seed={args.seed}) -> {args.output_dir}"
    )

    if args.export_json:
        from generator.export import export_json
        export_json(result, args.output_dir)
        print(f"Exported JSON files to {args.output_dir}")

    if args.export_sql:
        from generator.export import export_sql
        sql_path = Path(args.output_dir) / "seed.sql" if args.output_dir != DEFAULT_CONFIG["output_dir"] else Path("sql") / "seed.sql"
        export_sql(result, sql_path)
        print(f"Exported SQL seed script to {sql_path}")

    if args.validate:
        from validation.validator import validate_all
        report = validate_all(result)
        print("\n" + report.summary())


if __name__ == "__main__":
    main()

