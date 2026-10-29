"""Ground-truth exception injection for YottaFlex lead management dataset.

Injects deliberate, labelled anomalies into a separate ground-truth dataset
while keeping the normal baseline dataset clean.

Required assessment exception scenarios:
1. Opted-out lead contacted.
2. Score influenced by an event occurring after conversion.
3. Lead assigned outside the representative's territory.
4. Duplicate lead creates a duplicate opportunity.
5. Stage-history gaps.
"""

import copy
import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from business.deduplication import compute_detection_key, label_duplicate, label_duplicate_opportunity
from business.stages import opportunity_outcome


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _date_str(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def inject_exceptions(
    baseline_data: dict[str, list[dict]],
    seed: int = 20261022,
) -> tuple[dict[str, list[dict]], list[dict]]:
    """Inject the 5 required assessment exception scenarios into a copy of data.

    Returns:
        (anomalous_data, ground_truth_exceptions)
    """
    rng = random.Random(seed + 999)
    data = {k: [copy.deepcopy(row) for row in v] for k, v in baseline_data.items()}
    exceptions: list[dict] = []

    leads = data["leads"]
    contacts = data["contacts"]
    consents = data["consents"]
    tasks = data["tasks"]
    activities = data["activities"]
    salesreps = data["salesreps"]
    opportunities = data["opportunities"]
    stage_histories = data["stage_histories"]

    # -------------------------------------------------------------------------
    # Scenario 1: Opted-out lead contacted
    # Injected anomaly: Contact withdrew email consent at T, but an outreach task
    # was scheduled/created at T + 10 days.
    # -------------------------------------------------------------------------
    target_lead = leads[0]
    target_contact_id = target_lead["contact_id"]
    base_dt = datetime(2026, 3, 1, 10, 0, 0)
    withdraw_dt = base_dt
    outreach_dt = base_dt + timedelta(days=10)

    # Insert an explicit withdrawn consent record
    withdrawn_csn_id = f"CSN-ANOM-000001"
    consents.append({
        "consent_id": withdrawn_csn_id,
        "contact_id": target_contact_id,
        "channel": "email",
        "status": "withdrawn",
        "consented_at": _iso(base_dt - timedelta(days=30)),
        "withdrawn_at": _iso(withdraw_dt),
        "expires_at": None,
        "source": "web_form",
        "created_at": _iso(withdraw_dt),
    })

    # Create an outreach task dated after consent withdrawal
    anom_task_id = f"TASK-{target_lead['lead_id']}-999"
    tasks.append({
        "task_id": anom_task_id,
        "lead_id": target_lead["lead_id"],
        "assigned_to": target_lead.get("assigned_salesrep_id") or salesreps[0]["salesrep_id"],
        "type": "email",
        "title": "Unauthorized Follow-up Outreach",
        "description": "Outreach task scheduled after contact opted out",
        "due_date": _date_str(outreach_dt),
        "status": "open",
        "priority": "high",
        "completed_at": None,
        "created_at": _iso(outreach_dt),
        "updated_at": _iso(outreach_dt),
    })

    exceptions.append({
        "exception_id": "EXC-000001",
        "issue_type": "opted_out_lead_contacted",
        "affected_record_ids": f"{target_lead['lead_id']},{anom_task_id},{withdrawn_csn_id}",
        "expected_outcome": "Task creation must be rejected or cancelled due to lack of valid consent at outreach timestamp",
        "injected_at": _iso(outreach_dt),
    })

    # -------------------------------------------------------------------------
    # Scenario 2: Score influenced by an event occurring after conversion
    # Injected anomaly: Lead converted at T, but an activity occurred at T + 30 days
    # and lead's scored_at is updated to T + 31 days with post-conversion score recalculation.
    # -------------------------------------------------------------------------
    # Choose a qualified lead and mark as converted
    conv_lead = None
    for l in leads:
        if l["status"] in ("Qualified", "Contacted") and not l.get("is_duplicate"):
            conv_lead = l
            break
    if not conv_lead:
        conv_lead = leads[1]

    conversion_dt = datetime(2026, 5, 1, 12, 0, 0)
    post_conv_activity_dt = conversion_dt + timedelta(days=30)
    post_conv_score_dt = post_conv_activity_dt + timedelta(days=1)

    conv_lead["status"] = "Converted"
    conv_lead["converted_at"] = _iso(conversion_dt)
    conv_lead["scored_at"] = _iso(post_conv_score_dt)  # Leaked post-conversion timestamp
    conv_lead["engagement_score"] = min(100, conv_lead["engagement_score"] + 25)
    # Recalculate lead_score based on post-conversion event
    raw = (
        conv_lead["fit_score"] * 0.5
        + conv_lead["intent_score"] * 0.3
        + conv_lead["engagement_score"] * 0.2
    )
    conv_lead["lead_score"] = max(0, min(100, round(raw)))

    anom_act_id = f"ACT-{conv_lead['lead_id']}-999"
    activities.append({
        "activity_id": anom_act_id,
        "lead_id": conv_lead["lead_id"],
        "type": "meeting",
        "subject": "Post-Conversion Demo",
        "description": "Activity logged 30 days after conversion influencing lead score",
        "activity_date": _iso(post_conv_activity_dt),
        "duration_minutes": 45,
        "outcome": "completed",
        "created_by": conv_lead.get("assigned_salesrep_id") or salesreps[0]["salesrep_id"],
        "created_at": _iso(post_conv_activity_dt),
    })

    exceptions.append({
        "exception_id": "EXC-000002",
        "issue_type": "score_influenced_post_conversion",
        "affected_record_ids": f"{conv_lead['lead_id']},{anom_act_id}",
        "expected_outcome": "Lead score must freeze upon conversion; activities after converted_at must not influence score",
        "injected_at": _iso(post_conv_score_dt),
    })

    # -------------------------------------------------------------------------
    # Scenario 3: Lead assigned outside the representative's territory
    # Injected anomaly: Lead with territory 'North' explicitly assigned to a rep
    # whose territory is 'South' or 'East', with routing_exception=False.
    # -------------------------------------------------------------------------
    mismatch_lead = None
    mismatch_rep = None
    for l in leads:
        lead_terr = l.get("territory")
        for s in salesreps:
            if s.get("territory") != lead_terr and s.get("is_active", True):
                mismatch_lead = l
                mismatch_rep = s
                break
        if mismatch_lead and mismatch_rep:
            break

    if mismatch_lead and mismatch_rep:
        mismatch_lead["assigned_salesrep_id"] = mismatch_rep["salesrep_id"]
        mismatch_lead["routing_exception"] = False  # Erroneously marked as normal routing
        mismatch_lead["routing_reason"] = "erroneously_assigned_cross_territory"

        exceptions.append({
            "exception_id": "EXC-000003",
            "issue_type": "lead_assigned_outside_territory",
            "affected_record_ids": f"{mismatch_lead['lead_id']},{mismatch_rep['salesrep_id']}",
            "expected_outcome": "Lead must be flagged for territory mismatch and re-routed to a compatible sales representative",
            "injected_at": mismatch_lead["created_at"],
        })

    # -------------------------------------------------------------------------
    # Scenario 4: Duplicate lead creates a duplicate opportunity
    # Injected anomaly: A duplicate lead is created for an existing lead, and a
    # new opportunity is erroneously created from that duplicate lead.
    # -------------------------------------------------------------------------
    canonical_lead = leads[2]
    dup_lead_id = f"LEAD-2026-999901"
    dup_lead = copy.deepcopy(canonical_lead)
    dup_lead["lead_id"] = dup_lead_id
    dup_lead = label_duplicate(dup_lead, canonical_lead)
    leads.append(dup_lead)

    # Find or create original opportunity for canonical lead
    orig_opp = next((o for o in opportunities if o["lead_id"] == canonical_lead["lead_id"]), None)
    if not orig_opp:
        orig_opp = opportunities[0]

    dup_opp_id = "OPP-2026-999901"
    dup_opp = {
        "opportunity_id": dup_opp_id,
        "lead_id": dup_lead_id,
        "salesrep_id": orig_opp["salesrep_id"],
        "stage": "proposal",
        "amount": orig_opp["amount"],
        "currency": "USD",
        "close_date": orig_opp["close_date"],
        "won_lost_reason": None,
        "competitor": None,
        "is_duplicate": True,
        "duplicate_of_opportunity_id": orig_opp["opportunity_id"],
        "duplicate_detection_key": canonical_lead.get("duplicate_detection_key"),
        "created_at": dup_lead["created_at"],
        "updated_at": dup_lead["updated_at"],
        "closed_at": None,
    }
    opportunities.append(dup_opp)

    exceptions.append({
        "exception_id": "EXC-000004",
        "issue_type": "duplicate_opportunity",
        "affected_record_ids": f"{dup_lead_id},{dup_opp_id},{orig_opp['opportunity_id']}",
        "expected_outcome": "Duplicate leads must not generate duplicate opportunities; opportunity should be flagged or merged",
        "injected_at": dup_opp["created_at"],
    })

    # -------------------------------------------------------------------------
    # Scenario 5: Stage-history gaps
    # Injected anomaly: Lead progressed New -> Qualified (or Converted), but the
    # intermediate Contacted stage history transition record was deleted/omitted.
    # -------------------------------------------------------------------------
    # Find a lead with multiple stage history records (preferably 3: New, Contacted, Qualified)
    lead_hist_map: dict[str, list[dict]] = {}
    for sh in stage_histories:
        lead_hist_map.setdefault(sh["lead_id"], []).append(sh)

    gap_lead_id = None
    for lid, hists in lead_hist_map.items():
        if len(hists) >= 3:
            gap_lead_id = lid
            break
    if not gap_lead_id:
        for lid, hists in lead_hist_map.items():
            if len(hists) >= 2:
                gap_lead_id = lid
                break

    if gap_lead_id:
        # Remove an intermediate transition record (e.g. index 1)
        hists = lead_hist_map[gap_lead_id]
        removed_record = hists[1] if len(hists) >= 2 else hists[0]
        data["stage_histories"] = [
            sh for sh in stage_histories if sh["stage_history_id"] != removed_record["stage_history_id"]
        ]

        exceptions.append({
            "exception_id": "EXC-000005",
            "issue_type": "stage_history_gap",
            "affected_record_ids": f"{gap_lead_id},{removed_record['stage_history_id']}",
            "expected_outcome": "Stage transition sequence gap detected; lifecycle audit requires continuous stage history records",
            "injected_at": removed_record["changed_at"],
        })

    return data, exceptions



def write_ground_truth(
    exceptions: list[dict],
    output_dir: Path | str,
) -> None:
    """Write ground-truth exception list to CSV and JSON."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    # Write CSV
    csv_file = out_path / "exceptions.csv"
    if exceptions:
        fieldnames = ["exception_id", "issue_type", "affected_record_ids", "expected_outcome", "injected_at"]
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(exceptions)

    # Write JSON
    json_file = out_path / "exceptions.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(exceptions, f, indent=2)
