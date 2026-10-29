"""Comprehensive validator for YottaFlex lead management dataset.

Validates:
- Primary keys (uniqueness, formats)
- Foreign keys (referential integrity)
- Required fields (non-null / non-empty)
- Enums (controlled vocabularies)
- Date ordering (chronology, post-conversion freeze)
- Score arithmetic (weighted formula, bounds)
- Lifecycle transitions and history consistency
- Deduplication and duplicate opportunities
- Consent compliance for outreach
- Territory and sales representative routing
"""

import csv
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import sys
from typing import Any

# Ensure src/ is on sys.path for direct module execution and imports
_SRC_DIR = Path(__file__).resolve().parents[1]
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from business.stages import VALID_TRANSITIONS, TERMINAL_STAGES
from business.consent import is_consent_valid_at, channel_for_task_type
from generator.generate import compute_lead_score


@dataclass
class ValidationIssue:
    issue_type: str
    record_type: str
    record_id: str
    description: str
    severity: str = "ERROR"  # "ERROR" or "WARNING"

    def to_dict(self) -> dict[str, Any]:
        return {
            "issue_type": self.issue_type,
            "record_type": self.record_type,
            "record_id": self.record_id,
            "description": self.description,
            "severity": self.severity,
        }


@dataclass
class ValidationReport:
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len([i for i in self.issues if i.severity == "ERROR"]) == 0

    @property
    def error_count(self) -> int:
        return len([i for i in self.issues if i.severity == "ERROR"])

    @property
    def warning_count(self) -> int:
        return len([i for i in self.issues if i.severity == "WARNING"])

    def add_issue(self, issue_type: str, record_type: str, record_id: str,
                  description: str, severity: str = "ERROR") -> None:
        self.issues.append(ValidationIssue(
            issue_type=issue_type,
            record_type=record_type,
            record_id=record_id,
            description=description,
            severity=severity,
        ))

    def issues_by_type(self, issue_type: str) -> list[ValidationIssue]:
        return [i for i in self.issues if i.issue_type == issue_type]

    def summary(self) -> str:
        lines = [
            f"Validation Report: {'PASSED' if self.is_valid else 'FAILED'}",
            f"Total issues: {len(self.issues)} ({self.error_count} errors, {self.warning_count} warnings)",
        ]
        type_counts: dict[str, int] = {}
        for issue in self.issues:
            type_counts[issue.issue_type] = type_counts.get(issue.issue_type, 0) + 1
        for itype, count in sorted(type_counts.items()):
            lines.append(f"  - {itype}: {count}")
        return "\n".join(lines)


# Regex patterns for ID formats
ID_PATTERNS = {
    "companies": (r"^CO-\d{6}$", "company_id"),
    "contacts": (r"^CON-\d{6}$", "contact_id"),
    "salesreps": (r"^REP-\d{6}$", "salesrep_id"),
    "score_rules": (r"^SCR-\d{6}$", "score_rule_id"),
    "campaigns": (r"^CAMP-\d{6}$", "campaign_id"),
    "leads": (r"^LEAD-2026-\d{6}$", "lead_id"),
    "consents": (r"^CSN-(?:ANOM-)?\d{6}$", "consent_id"),
    "activities": (r"^ACT-LEAD-2026-\d{6}-\d{3}$", "activity_id"),
    "tasks": (r"^TASK-LEAD-2026-\d{6}-\d{3}$", "task_id"),
    "opportunities": (r"^OPP-2026-\d{6}$", "opportunity_id"),
    "stage_histories": (r"^SH-\d{6}$", "stage_history_id"),
    "task_decisions": (r"^DEC-\d{6}$", "decision_id"),
}

REQUIRED_FIELDS = {
    "companies": ["company_id", "name", "created_at", "updated_at"],
    "contacts": ["contact_id", "first_name", "last_name", "created_at", "updated_at"],
    "salesreps": ["salesrep_id", "first_name", "last_name", "territory", "product_specialty"],
    "score_rules": ["score_rule_id", "name", "component", "weight"],
    "campaigns": ["campaign_id", "name", "type", "start_date", "end_date", "status"],
    "leads": ["lead_id", "contact_id", "status", "created_at"],
    "consents": ["consent_id", "contact_id", "channel", "status", "created_at"],
    "activities": ["activity_id", "lead_id", "type", "activity_date"],
    "tasks": ["task_id", "lead_id", "assigned_to", "type", "due_date", "status", "priority"],
    "opportunities": ["opportunity_id", "lead_id", "salesrep_id", "stage", "currency"],
    "stage_histories": ["stage_history_id", "lead_id", "to_stage", "changed_at"],
    "task_decisions": ["decision_id", "lead_id", "contact_id", "task_type", "channel", "decision", "reason", "evaluated_at"],
}

ENUM_ALLOWED_VALUES = {
    "lead_status": {"New", "Contacted", "Qualified", "Disqualified", "Converted"},
    "consent_channel": {"email", "phone", "sms", "mail"},
    "consent_status": {"granted", "denied", "withdrawn"},
    "task_type": {"call", "email", "meeting", "demo", "other"},
    "task_status": {"open", "in_progress", "completed", "cancelled"},
    "task_priority": {"low", "medium", "high"},
    "activity_type": {"call", "email", "meeting", "demo", "note", "linkedin"},
    "opportunity_stage": {"discovery", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"},
}


def _parse_dt(dt_str: str | None) -> datetime | None:
    if not dt_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return None


def validate_primary_keys(data: dict[str, list[dict]], report: ValidationReport) -> None:
    for entity_name, (pattern, pk_field) in ID_PATTERNS.items():
        rows = data.get(entity_name, [])
        seen_ids = set()
        for row in rows:
            pk_val = row.get(pk_field)
            if not pk_val:
                report.add_issue("missing_primary_key", entity_name, "UNKNOWN",
                                 f"Row in {entity_name} missing {pk_field}")
                continue
            if pk_val in seen_ids:
                report.add_issue("duplicate_primary_key", entity_name, pk_val,
                                 f"Duplicate {pk_field}='{pk_val}' in {entity_name}")
            seen_ids.add(pk_val)

            if not re.match(pattern, pk_val):
                report.add_issue("invalid_id_format", entity_name, pk_val,
                                 f"{pk_field}='{pk_val}' does not match pattern {pattern}")


def validate_foreign_keys(data: dict[str, list[dict]], report: ValidationReport) -> None:
    company_ids = {r["company_id"] for r in data.get("companies", [])}
    contact_ids = {r["contact_id"] for r in data.get("contacts", [])}
    salesrep_ids = {r["salesrep_id"] for r in data.get("salesreps", [])}
    score_rule_ids = {r["score_rule_id"] for r in data.get("score_rules", [])}
    campaign_ids = {r["campaign_id"] for r in data.get("campaigns", [])}
    lead_ids = {r["lead_id"] for r in data.get("leads", [])}
    opp_ids = {r["opportunity_id"] for r in data.get("opportunities", [])}

    # Contacts -> Companies
    for c in data.get("contacts", []):
        comp_id = c.get("company_id")
        if comp_id and comp_id not in company_ids:
            report.add_issue("foreign_key_violation", "contacts", c["contact_id"],
                             f"References missing company_id='{comp_id}'")

    # Leads -> Contacts, Companies, SalesReps, ScoreRules
    for l in data.get("leads", []):
        lid = l["lead_id"]
        cid = l.get("contact_id")
        if cid and cid not in contact_ids:
            report.add_issue("foreign_key_violation", "leads", lid,
                             f"References missing contact_id='{cid}'")
        comp_id = l.get("company_id")
        if comp_id and comp_id not in company_ids:
            report.add_issue("foreign_key_violation", "leads", lid,
                             f"References missing company_id='{comp_id}'")
        rep_id = l.get("assigned_salesrep_id")
        if rep_id and rep_id not in salesrep_ids:
            report.add_issue("foreign_key_violation", "leads", lid,
                             f"References missing salesrep_id='{rep_id}'")
        rule_id = l.get("score_rule_id")
        if rule_id and rule_id not in score_rule_ids:
            report.add_issue("foreign_key_violation", "leads", lid,
                             f"References missing score_rule_id='{rule_id}'")

    # LeadCampaign bridge -> Leads, Campaigns
    for lc in data.get("lead_campaigns", []):
        lid = lc.get("lead_id")
        cid = lc.get("campaign_id")
        if lid and lid not in lead_ids:
            report.add_issue("foreign_key_violation", "lead_campaigns", f"{lid}:{cid}",
                             f"References missing lead_id='{lid}'")
        if cid and cid not in campaign_ids:
            report.add_issue("foreign_key_violation", "lead_campaigns", f"{lid}:{cid}",
                             f"References missing campaign_id='{cid}'")

    # Consents -> Contacts
    for csn in data.get("consents", []):
        cid = csn.get("contact_id")
        if cid and cid not in contact_ids:
            report.add_issue("foreign_key_violation", "consents", csn["consent_id"],
                             f"References missing contact_id='{cid}'")

    # Activities -> Leads, SalesReps
    for act in data.get("activities", []):
        lid = act.get("lead_id")
        if lid and lid not in lead_ids:
            report.add_issue("foreign_key_violation", "activities", act["activity_id"],
                             f"References missing lead_id='{lid}'")
        rep_id = act.get("created_by")
        if rep_id and rep_id not in salesrep_ids:
            report.add_issue("foreign_key_violation", "activities", act["activity_id"],
                             f"References missing salesrep_id='{rep_id}'")

    # Tasks -> Leads, SalesReps
    for task in data.get("tasks", []):
        lid = task.get("lead_id")
        if lid and lid not in lead_ids:
            report.add_issue("foreign_key_violation", "tasks", task["task_id"],
                             f"References missing lead_id='{lid}'")
        rep_id = task.get("assigned_to")
        if rep_id and rep_id not in salesrep_ids:
            report.add_issue("foreign_key_violation", "tasks", task["task_id"],
                             f"References missing salesrep_id='{rep_id}'")

    # Opportunities -> Leads, SalesReps, duplicate_of
    for opp in data.get("opportunities", []):
        lid = opp.get("lead_id")
        if lid and lid not in lead_ids:
            report.add_issue("foreign_key_violation", "opportunities", opp["opportunity_id"],
                             f"References missing lead_id='{lid}'")
        rep_id = opp.get("salesrep_id")
        if rep_id and rep_id not in salesrep_ids:
            report.add_issue("foreign_key_violation", "opportunities", opp["opportunity_id"],
                             f"References missing salesrep_id='{rep_id}'")
        dup_id = opp.get("duplicate_of_opportunity_id")
        if dup_id and dup_id not in opp_ids:
            report.add_issue("foreign_key_violation", "opportunities", opp["opportunity_id"],
                             f"References missing duplicate_of_opportunity_id='{dup_id}'")

    # StageHistories -> Leads, SalesReps
    for sh in data.get("stage_histories", []):
        lid = sh.get("lead_id")
        if lid and lid not in lead_ids:
            report.add_issue("foreign_key_violation", "stage_histories", sh["stage_history_id"],
                             f"References missing lead_id='{lid}'")
        rep_id = sh.get("changed_by")
        if rep_id and rep_id not in salesrep_ids:
            report.add_issue("foreign_key_violation", "stage_histories", sh["stage_history_id"],
                             f"References missing salesrep_id='{rep_id}'")


def validate_required_values(data: dict[str, list[dict]], report: ValidationReport) -> None:
    for entity_name, req_fields in REQUIRED_FIELDS.items():
        for row in data.get(entity_name, []):
            pk_val = row.get(ID_PATTERNS.get(entity_name, (None, "id"))[1], "UNKNOWN")
            for f in req_fields:
                val = row.get(f)
                if val is None or (isinstance(val, str) and not val.strip()):
                    report.add_issue("missing_required_field", entity_name, pk_val,
                                     f"Required field '{f}' is empty or missing")


def validate_enums(data: dict[str, list[dict]], report: ValidationReport) -> None:
    for lead in data.get("leads", []):
        status = lead.get("status")
        if status and status not in ENUM_ALLOWED_VALUES["lead_status"]:
            report.add_issue("invalid_enum", "leads", lead["lead_id"],
                             f"Invalid lead status: '{status}'")

    for csn in data.get("consents", []):
        chan = csn.get("channel")
        if chan and chan not in ENUM_ALLOWED_VALUES["consent_channel"]:
            report.add_issue("invalid_enum", "consents", csn["consent_id"],
                             f"Invalid consent channel: '{chan}'")
        st = csn.get("status")
        if st and st not in ENUM_ALLOWED_VALUES["consent_status"]:
            report.add_issue("invalid_enum", "consents", csn["consent_id"],
                             f"Invalid consent status: '{st}'")

    for task in data.get("tasks", []):
        ttype = task.get("type")
        if ttype and ttype not in ENUM_ALLOWED_VALUES["task_type"]:
            report.add_issue("invalid_enum", "tasks", task["task_id"],
                             f"Invalid task type: '{ttype}'")
        st = task.get("status")
        if st and st not in ENUM_ALLOWED_VALUES["task_status"]:
            report.add_issue("invalid_enum", "tasks", task["task_id"],
                             f"Invalid task status: '{st}'")
        prio = task.get("priority")
        if prio and prio not in ENUM_ALLOWED_VALUES["task_priority"]:
            report.add_issue("invalid_enum", "tasks", task["task_id"],
                             f"Invalid task priority: '{prio}'")

    for opp in data.get("opportunities", []):
        stage = opp.get("stage")
        if stage and stage not in ENUM_ALLOWED_VALUES["opportunity_stage"]:
            report.add_issue("invalid_enum", "opportunities", opp["opportunity_id"],
                             f"Invalid opportunity stage: '{stage}'")


def validate_date_ordering(data: dict[str, list[dict]], report: ValidationReport) -> None:
    # Campaign dates
    for c in data.get("campaigns", []):
        s = _parse_dt(c.get("start_date"))
        e = _parse_dt(c.get("end_date"))
        if s and e and e < s:
            report.add_issue("invalid_date_ordering", "campaigns", c["campaign_id"],
                             f"Campaign end_date {c.get('end_date')} precedes start_date {c.get('start_date')}")

    # Lead conversion vs scoring timestamp (Exception Scenario 2 detection)
    for lead in data.get("leads", []):
        conv_str = lead.get("converted_at")
        score_str = lead.get("scored_at")
        if conv_str and score_str:
            conv_dt = _parse_dt(conv_str)
            score_dt = _parse_dt(score_str)
            if conv_dt and score_dt and score_dt > conv_dt:
                report.add_issue(
                    "score_influenced_post_conversion",
                    "leads",
                    lead["lead_id"],
                    f"Lead scored_at ({score_str}) occurred after converted_at ({conv_str})",
                )


def validate_score_arithmetic(data: dict[str, list[dict]], report: ValidationReport) -> None:
    for lead in data.get("leads", []):
        fit = lead.get("fit_score")
        intent = lead.get("intent_score")
        eng = lead.get("engagement_score")
        score = lead.get("lead_score")
        if fit is not None and intent is not None and eng is not None and score is not None:
            expected = compute_lead_score(int(fit), int(intent), int(eng))
            if int(score) != expected:
                report.add_issue(
                    "score_arithmetic_mismatch",
                    "leads",
                    lead["lead_id"],
                    f"Lead score {score} != expected {expected} from component scores ({fit}, {intent}, {eng})",
                )


def validate_lifecycle_transitions(data: dict[str, list[dict]], report: ValidationReport) -> None:
    transitions_by_lead: dict[str, list[dict]] = {}
    for sh in data.get("stage_histories", []):
        transitions_by_lead.setdefault(sh["lead_id"], []).append(sh)

    for lid, history in transitions_by_lead.items():
        sorted_hist = sorted(history, key=lambda x: x.get("changed_at", ""))
        prev_to = None
        for idx, sh in enumerate(sorted_hist):
            from_st = sh.get("from_stage")
            to_st = sh.get("to_stage")
            # If from_stage is specified, verify transition
            if from_st:
                allowed = VALID_TRANSITIONS.get(from_st, set())
                if to_st not in allowed:
                    report.add_issue(
                        "invalid_stage_transition",
                        "stage_histories",
                        sh["stage_history_id"],
                        f"Transition from '{from_st}' to '{to_st}' is not permitted",
                    )
            # Continuity & gap check
            if idx == 0 and from_st and from_st not in (None, "", "New"):
                report.add_issue(
                    "stage_history_gap",
                    "stage_histories",
                    sh["stage_history_id"],
                    f"Stage history gap for lead {lid}: first recorded transition starts at '{from_st}' without prior initial progression",
                )
            elif prev_to is not None and from_st and from_st != prev_to:
                report.add_issue(
                    "stage_history_gap",
                    "stage_histories",
                    sh["stage_history_id"],
                    f"Stage history gap for lead {lid}: previous transition ended at '{prev_to}', next transition starts at '{from_st}'",
                )
            prev_to = to_st



def validate_duplicates(data: dict[str, list[dict]], report: ValidationReport) -> None:
    lead_map = {l["lead_id"]: l for l in data.get("leads", [])}

    # Duplicate lead validation
    for lead in data.get("leads", []):
        is_dup = lead.get("is_duplicate")
        if is_dup in (True, "True", "true"):
            orig_id = lead.get("duplicate_of_lead_id")
            if not orig_id or orig_id not in lead_map:
                report.add_issue("unlinked_duplicate_lead", "leads", lead["lead_id"],
                                 f"Duplicate lead {lead['lead_id']} has no valid duplicate_of_lead_id")

    # Opportunity duplicate validation (Exception Scenario 4 detection)
    for opp in data.get("opportunities", []):
        lid = opp.get("lead_id")
        lead = lead_map.get(lid)
        is_dup_opp = opp.get("is_duplicate") in (True, "True", "true")
        if lead and lead.get("is_duplicate") in (True, "True", "true") and is_dup_opp:
            report.add_issue(
                "duplicate_opportunity",
                "opportunities",
                opp["opportunity_id"],
                f"Opportunity {opp['opportunity_id']} created for duplicate lead {lid}",
            )


def validate_consent_compliance(data: dict[str, list[dict]], report: ValidationReport) -> None:
    # Exception Scenario 1 detection: Opted-out lead contacted
    consents = data.get("consents", [])
    lead_map = {l["lead_id"]: l for l in data.get("leads", [])}

    for task in data.get("tasks", []):
        lid = task.get("lead_id")
        lead = lead_map.get(lid)
        if not lead:
            continue
        cid = lead.get("contact_id")
        if not cid:
            continue
        ttype = task.get("type", "email")
        channel = channel_for_task_type(ttype)
        task_time = task.get("created_at")
        if not task_time:
            continue

        if not is_consent_valid_at(consents, cid, channel, task_time):
            report.add_issue(
                "opted_out_lead_contacted",
                "tasks",
                task["task_id"],
                f"Task {task['task_id']} ({ttype}/{channel}) created at {task_time} for contact {cid} without valid consent",
            )


def validate_sales_routing(data: dict[str, list[dict]], report: ValidationReport) -> None:
    # Exception Scenario 3 detection: Lead assigned outside representative's territory
    # Also validates explicit unassigned state documentation
    rep_map = {r["salesrep_id"]: r for r in data.get("salesreps", [])}

    for lead in data.get("leads", []):
        rep_id = lead.get("assigned_salesrep_id")
        routing_exception = lead.get("routing_exception") in (True, "True", "true")
        routing_reason = lead.get("routing_reason")

        if not rep_id or str(rep_id).strip() == "":
            # Legitimate unassigned lead requires routing_exception=True and non-empty routing_reason
            if not routing_exception or not routing_reason:
                report.add_issue(
                    "undocumented_unassigned_lead",
                    "leads",
                    lead["lead_id"],
                    f"Lead {lead['lead_id']} is unassigned but routing_exception is {routing_exception} and routing_reason is {routing_reason}",
                )
            continue

        if rep_id not in rep_map:
            continue

        rep = rep_map[rep_id]
        lead_terr = lead.get("territory")
        rep_terr = rep.get("territory")

        if lead_terr and rep_terr and lead_terr != rep_terr:
            if not routing_exception:
                report.add_issue(
                    "lead_assigned_outside_territory",
                    "leads",
                    lead["lead_id"],
                    f"Lead territory '{lead_terr}' != SalesRep territory '{rep_terr}' for {rep_id} without routing exception flag",
                )


def validate_task_assignment(data: dict[str, list[dict]], report: ValidationReport) -> None:
    """Ensure actionable tasks are never assigned to unassigned leads."""
    lead_map = {l["lead_id"]: l for l in data.get("leads", [])}
    for task in data.get("tasks", []):
        lid = task.get("lead_id")
        lead = lead_map.get(lid)
        if lead and (not lead.get("assigned_salesrep_id") or str(lead.get("assigned_salesrep_id")).strip() == ""):
            report.add_issue(
                "unassigned_lead_task_created",
                "tasks",
                task["task_id"],
                f"Task {task['task_id']} was created for unassigned lead {lid}",
            )


def validate_task_decisions(data: dict[str, list[dict]], report: ValidationReport) -> None:
    """Validate task-decision audit records integrity and consistency with tasks."""
    decisions = data.get("task_decisions", [])
    if not decisions:
        return

    lead_ids = {l["lead_id"] for l in data.get("leads", [])}
    contact_ids = {c["contact_id"] for c in data.get("contacts", [])}
    task_ids = {t["task_id"] for t in data.get("tasks", [])}
    seen_ids = set()

    for dec in decisions:
        dec_id = dec.get("decision_id")
        if not dec_id or dec_id in seen_ids:
            report.add_issue("duplicate_primary_key", "task_decisions", dec_id or "UNKNOWN",
                             f"Invalid or duplicate decision_id '{dec_id}'")
        seen_ids.add(dec_id)

        lid = dec.get("lead_id")
        if lid and lid not in lead_ids:
            report.add_issue("foreign_key_violation", "task_decisions", dec_id,
                             f"References unknown lead_id='{lid}'")

        cid = dec.get("contact_id")
        if cid and cid not in contact_ids:
            report.add_issue("foreign_key_violation", "task_decisions", dec_id,
                             f"References unknown contact_id='{cid}'")

        decision_val = dec.get("decision")
        if decision_val not in {"created", "rejected", "deferred"}:
            report.add_issue("invalid_enum", "task_decisions", dec_id,
                             f"Invalid decision value '{decision_val}'")

        tid = dec.get("task_id")
        if decision_val == "created":
            if not tid or tid not in task_ids:
                report.add_issue("decision_task_mismatch", "task_decisions", dec_id,
                                 f"Created decision references missing task_id='{tid}'")
        else:
            if tid:
                report.add_issue("decision_task_mismatch", "task_decisions", dec_id,
                                 f"Non-created decision ({decision_val}) must not reference task_id='{tid}'")


def validate_all(data: dict[str, list[dict]]) -> ValidationReport:
    """Run all validation checks and return a unified ValidationReport."""
    report = ValidationReport()
    validate_primary_keys(data, report)
    validate_foreign_keys(data, report)
    validate_required_values(data, report)
    validate_enums(data, report)
    validate_date_ordering(data, report)
    validate_score_arithmetic(data, report)
    validate_lifecycle_transitions(data, report)
    validate_duplicates(data, report)
    validate_consent_compliance(data, report)
    validate_sales_routing(data, report)
    validate_task_assignment(data, report)
    validate_task_decisions(data, report)
    return report


def load_dataset_from_csv(dir_path: Path | str) -> dict[str, list[dict]]:
    """Load all entity CSV files from a directory into memory."""
    path = Path(dir_path)
    dataset = {}
    csv_files = [
        "companies.csv", "contacts.csv", "salesreps.csv", "score_rules.csv",
        "campaigns.csv", "leads.csv", "lead_campaigns.csv", "consents.csv",
        "activities.csv", "tasks.csv", "task_decisions.csv", "opportunities.csv",
        "stage_histories.csv",
    ]
    for filename in csv_files:
        filepath = path / filename
        entity = filename.replace(".csv", "")
        if filepath.exists():
            with open(filepath, newline="", encoding="utf-8") as f:
                dataset[entity] = list(csv.DictReader(f))
        else:
            dataset[entity] = []
    return dataset


def validate_csv_directory(dir_path: Path | str) -> ValidationReport:
    """Validate all CSV files in a given directory."""
    dataset = load_dataset_from_csv(dir_path)
    return validate_all(dataset)


def main() -> None:
    """CLI entry point for dataset validation."""
    import argparse

    parser = argparse.ArgumentParser(description="Validate YottaFlex CSV dataset directory.")
    parser.add_argument(
        "dir_path",
        nargs="?",
        default="data/generated_full",
        help="Path to dataset directory containing CSV files (default: data/generated_full)",
    )
    args = parser.parse_args()

    target_dir = Path(args.dir_path)
    if not target_dir.exists():
        print(f"Error: Target directory does not exist: {target_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Validating dataset in: {target_dir}...")
    report = validate_csv_directory(target_dir)
    print("\n" + report.summary())
    sys.exit(0 if report.is_valid else 1)


if __name__ == "__main__":
    main()
