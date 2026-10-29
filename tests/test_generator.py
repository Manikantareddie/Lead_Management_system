"""Tests for the synthetic data generator.

Covers ID formats, primary-key uniqueness, foreign-key integrity, and
reproducibility with a fixed seed for all 11 entities plus the bridge table.
"""

import csv
import importlib.util
import os
import shutil
import subprocess
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIR = PROJECT_ROOT / "data" / "generated"
GENERATOR_MODULE = PROJECT_ROOT / "src" / "generator" / "generate.py"


def _load_generator_module():
    spec = importlib.util.spec_from_file_location("generator.generate", GENERATOR_MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_generator(seed: int = 20261022) -> None:
    """Run the generator as a subprocess using the project's Python."""
    python = os.environ.get(
        "KILO_PYTHON",
        str(PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"),
    )
    subprocess.run(
        [
            python,
            str(GENERATOR_MODULE),
            "--companies", "10",
            "--contacts", "20",
            "--salesreps", "5",
            "--score-rules", "3",
            "--campaigns", "4",
            "--leads", "30",
            "--consents", "25",
            "--activities", "60",
            "--tasks", "45",
            "--opportunities", "12",
            "--stage-histories", "40",
            "--seed", str(seed),
            "--output-dir", str(GENERATED_DIR),
        ],
        check=True,
        cwd=str(PROJECT_ROOT),
    )


def _read_csv(name: str) -> list[dict]:
    path = GENERATED_DIR / name
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


@pytest.fixture(scope="module")
def generated():
    _run_generator(20261022)
    return {
        "companies": _read_csv("companies.csv"),
        "contacts": _read_csv("contacts.csv"),
        "salesreps": _read_csv("salesreps.csv"),
        "score_rules": _read_csv("score_rules.csv"),
        "campaigns": _read_csv("campaigns.csv"),
        "leads": _read_csv("leads.csv"),
        "lead_campaigns": _read_csv("lead_campaigns.csv"),
        "consents": _read_csv("consents.csv"),
        "activities": _read_csv("activities.csv"),
        "tasks": _read_csv("tasks.csv"),
        "task_decisions": _read_csv("task_decisions.csv"),
        "opportunities": _read_csv("opportunities.csv"),
        "stage_histories": _read_csv("stage_histories.csv"),
    }


# --- Record counts ---

def test_record_counts(generated):
    assert len(generated["companies"]) == 10
    assert len(generated["contacts"]) == 20
    assert len(generated["salesreps"]) == 5
    assert len(generated["score_rules"]) == 3
    assert len(generated["campaigns"]) == 4
    assert len(generated["leads"]) == 30
    assert len(generated["consents"]) == 25
    assert len(generated["activities"]) == 60
    assert len(generated["tasks"]) == 45
    assert len(generated["opportunities"]) == 12
    assert len(generated["stage_histories"]) == 40


# --- ID formats ---

def test_company_id_format(generated):
    for row in generated["companies"]:
        cid = row["company_id"]
        assert cid.startswith("CO-")
        assert len(cid) == 9  # "CO-" + 6 digits
        assert cid[3:].isdigit()


def test_contact_id_format(generated):
    for row in generated["contacts"]:
        cid = row["contact_id"]
        assert cid.startswith("CON-")
        assert len(cid) == 10  # "CON-" + 6 digits
        assert cid[4:].isdigit()


def test_lead_id_format(generated):
    for row in generated["leads"]:
        lid = row["lead_id"]
        assert lid.startswith("LEAD-2026-")
        assert len(lid) == 16  # "LEAD-2026-" + 6 digits
        assert lid[10:].isdigit()


def test_salesrep_id_format(generated):
    for row in generated["salesreps"]:
        sid = row["salesrep_id"]
        assert sid.startswith("REP-")
        assert len(sid) == 10  # "REP-" + 6 digits
        assert sid[4:].isdigit()


def test_score_rule_id_format(generated):
    for row in generated["score_rules"]:
        sid = row["score_rule_id"]
        assert sid.startswith("SCR-")
        assert len(sid) == 10  # "SCR-" + 6 digits
        assert sid[4:].isdigit()


def test_campaign_id_format(generated):
    for row in generated["campaigns"]:
        cid = row["campaign_id"]
        assert cid.startswith("CAMP-")
        assert len(cid) == 11  # "CAMP-" + 6 digits
        assert cid[5:].isdigit()


def test_consent_id_format(generated):
    for row in generated["consents"]:
        cid = row["consent_id"]
        assert cid.startswith("CSN-")
        assert len(cid) == 10  # "CSN-" + 6 digits
        assert cid[4:].isdigit()


def test_activity_id_format(generated):
    for row in generated["activities"]:
        aid = row["activity_id"]
        assert aid.startswith("ACT-")
        assert aid.endswith("-001") or aid.endswith("-002") or aid.endswith("-003")
        # Format: ACT-<lead-id>-<seq>
        parts = aid.split("-")
        assert parts[0] == "ACT"
        assert parts[1] == "LEAD"
        assert parts[2] == "2026"
        assert len(parts[3]) == 6
        assert parts[3].isdigit()
        assert len(parts[4]) == 3
        assert parts[4].isdigit()


def test_task_id_format(generated):
    for row in generated["tasks"]:
        tid = row["task_id"]
        assert tid.startswith("TASK-")
        parts = tid.split("-")
        assert parts[0] == "TASK"
        assert parts[1] == "LEAD"
        assert parts[2] == "2026"
        assert len(parts[3]) == 6
        assert parts[3].isdigit()
        assert len(parts[4]) == 3
        assert parts[4].isdigit()


def test_opportunity_id_format(generated):
    for row in generated["opportunities"]:
        oid = row["opportunity_id"]
        assert oid.startswith("OPP-2026-")
        assert len(oid) == 15  # "OPP-2026-" + 6 digits
        assert oid[10:].isdigit()


def test_stage_history_id_format(generated):
    for row in generated["stage_histories"]:
        sid = row["stage_history_id"]
        assert sid.startswith("SH-")
        assert len(sid) == 9  # "SH-" + 6 digits
        assert sid[3:].isdigit()


# --- Primary key uniqueness ---

def test_primary_key_uniqueness(generated):
    company_ids = [r["company_id"] for r in generated["companies"]]
    contact_ids = [r["contact_id"] for r in generated["contacts"]]
    lead_ids = [r["lead_id"] for r in generated["leads"]]
    assert len(company_ids) == len(set(company_ids))
    assert len(contact_ids) == len(set(contact_ids))
    assert len(lead_ids) == len(set(lead_ids))


def test_salesrep_primary_key_uniqueness(generated):
    ids = [r["salesrep_id"] for r in generated["salesreps"]]
    assert len(ids) == len(set(ids))


def test_score_rule_primary_key_uniqueness(generated):
    ids = [r["score_rule_id"] for r in generated["score_rules"]]
    assert len(ids) == len(set(ids))


def test_campaign_primary_key_uniqueness(generated):
    ids = [r["campaign_id"] for r in generated["campaigns"]]
    assert len(ids) == len(set(ids))


def test_consent_primary_key_uniqueness(generated):
    ids = [r["consent_id"] for r in generated["consents"]]
    assert len(ids) == len(set(ids))


def test_activity_primary_key_uniqueness(generated):
    ids = [r["activity_id"] for r in generated["activities"]]
    assert len(ids) == len(set(ids))


def test_task_primary_key_uniqueness(generated):
    ids = [r["task_id"] for r in generated["tasks"]]
    assert len(ids) == len(set(ids))


def test_opportunity_primary_key_uniqueness(generated):
    ids = [r["opportunity_id"] for r in generated["opportunities"]]
    assert len(ids) == len(set(ids))


def test_stage_history_primary_key_uniqueness(generated):
    ids = [r["stage_history_id"] for r in generated["stage_histories"]]
    assert len(ids) == len(set(ids))


def test_lead_campaign_uniqueness(generated):
    keys = [(r["lead_id"], r["campaign_id"]) for r in generated["lead_campaigns"]]
    assert len(keys) == len(set(keys))


# --- Foreign key integrity ---

def test_contact_foreign_key_integrity(generated):
    company_ids = {r["company_id"] for r in generated["companies"]}
    for row in generated["contacts"]:
        assert row["company_id"] in company_ids, (
            f"Contact {row['contact_id']} references unknown company {row['company_id']}"
        )


def test_lead_foreign_key_integrity(generated):
    contact_ids = {r["contact_id"] for r in generated["contacts"]}
    company_ids = {r["company_id"] for r in generated["companies"]}
    salesrep_ids = {r["salesrep_id"] for r in generated["salesreps"]}
    score_rule_ids = {r["score_rule_id"] for r in generated["score_rules"]}
    for row in generated["leads"]:
        assert row["contact_id"] in contact_ids, (
            f"Lead {row['lead_id']} references unknown contact {row['contact_id']}"
        )
        assert row["company_id"] in company_ids, (
            f"Lead {row['lead_id']} references unknown company {row['company_id']}"
        )
        if row["assigned_salesrep_id"]:
            assert row["assigned_salesrep_id"] in salesrep_ids, (
                f"Lead {row['lead_id']} references unknown salesrep {row['assigned_salesrep_id']}"
            )
        assert row["score_rule_id"] in score_rule_ids, (
            f"Lead {row['lead_id']} references unknown score_rule {row['score_rule_id']}"
        )


def test_lead_company_matches_contact_company(generated):
    contact_company = {r["contact_id"]: r["company_id"] for r in generated["contacts"]}
    for row in generated["leads"]:
        assert row["company_id"] == contact_company[row["contact_id"]], (
            f"Lead {row['lead_id']} company_id denormalization mismatch"
        )


def test_lead_campaign_foreign_key_integrity(generated):
    lead_ids = {r["lead_id"] for r in generated["leads"]}
    campaign_ids = {r["campaign_id"] for r in generated["campaigns"]}
    for row in generated["lead_campaigns"]:
        assert row["lead_id"] in lead_ids, (
            f"LeadCampaign references unknown lead {row['lead_id']}"
        )
        assert row["campaign_id"] in campaign_ids, (
            f"LeadCampaign references unknown campaign {row['campaign_id']}"
        )


def test_consent_foreign_key_integrity(generated):
    contact_ids = {r["contact_id"] for r in generated["contacts"]}
    for row in generated["consents"]:
        assert row["contact_id"] in contact_ids, (
            f"Consent {row['consent_id']} references unknown contact {row['contact_id']}"
        )


def test_activity_foreign_key_integrity(generated):
    lead_ids = {r["lead_id"] for r in generated["leads"]}
    salesrep_ids = {r["salesrep_id"] for r in generated["salesreps"]}
    for row in generated["activities"]:
        assert row["lead_id"] in lead_ids, (
            f"Activity {row['activity_id']} references unknown lead {row['lead_id']}"
        )
        assert row["created_by"] in salesrep_ids, (
            f"Activity {row['activity_id']} references unknown salesrep {row['created_by']}"
        )


def test_task_foreign_key_integrity(generated):
    lead_ids = {r["lead_id"] for r in generated["leads"]}
    salesrep_ids = {r["salesrep_id"] for r in generated["salesreps"]}
    for row in generated["tasks"]:
        assert row["lead_id"] in lead_ids, (
            f"Task {row['task_id']} references unknown lead {row['lead_id']}"
        )
        assert row["assigned_to"] in salesrep_ids, (
            f"Task {row['task_id']} references unknown salesrep {row['assigned_to']}"
        )


def test_opportunity_foreign_key_integrity(generated):
    lead_ids = {r["lead_id"] for r in generated["leads"]}
    salesrep_ids = {r["salesrep_id"] for r in generated["salesreps"]}
    opp_ids = {r["opportunity_id"] for r in generated["opportunities"]}
    for row in generated["opportunities"]:
        assert row["lead_id"] in lead_ids, (
            f"Opportunity {row['opportunity_id']} references unknown lead {row['lead_id']}"
        )
        assert row["salesrep_id"] in salesrep_ids, (
            f"Opportunity {row['opportunity_id']} references unknown salesrep {row['salesrep_id']}"
        )
        if row["duplicate_of_opportunity_id"]:
            assert row["duplicate_of_opportunity_id"] in opp_ids, (
                f"Opportunity {row['opportunity_id']} references unknown duplicate_of {row['duplicate_of_opportunity_id']}"
            )


def test_stage_history_foreign_key_integrity(generated):
    lead_ids = {r["lead_id"] for r in generated["leads"]}
    salesrep_ids = {r["salesrep_id"] for r in generated["salesreps"]}
    for row in generated["stage_histories"]:
        assert row["lead_id"] in lead_ids, (
            f"StageHistory {row['stage_history_id']} references unknown lead {row['lead_id']}"
        )
        if row["changed_by"]:
            assert row["changed_by"] in salesrep_ids, (
                f"StageHistory {row['stage_history_id']} references unknown salesrep {row['changed_by']}"
            )


# --- Relationship integrity ---

def test_activity_per_lead_sequence(generated):
    """Activity IDs use per-lead sequence starting at 001."""
    by_lead = {}
    for row in generated["activities"]:
        by_lead.setdefault(row["lead_id"], []).append(row["activity_id"])
    for lead_id, ids in by_lead.items():
        seqs = sorted(int(aid.split("-")[-1]) for aid in ids)
        assert seqs == list(range(1, len(seqs) + 1)), (
            f"Lead {lead_id} activity sequences are not sequential from 1: {seqs}"
        )


def test_task_per_lead_sequence(generated):
    """Task IDs use per-lead sequence starting at 001."""
    by_lead = {}
    for row in generated["tasks"]:
        by_lead.setdefault(row["lead_id"], []).append(row["task_id"])
    for lead_id, ids in by_lead.items():
        seqs = sorted(int(tid.split("-")[-1]) for tid in ids)
        assert seqs == list(range(1, len(seqs) + 1)), (
            f"Lead {lead_id} task sequences are not sequential from 1: {seqs}"
        )


def test_score_rule_components(generated):
    """Score rules cover fit, intent, engagement with weights summing to 1.0."""
    components = {r["component"]: float(r["weight"]) for r in generated["score_rules"]}
    assert set(components.keys()) == {"fit", "intent", "engagement"}
    assert abs(sum(components.values()) - 1.0) < 1e-9


def test_consent_append_only(generated):
    """Consent records are append-only: no duplicate consent_id, history preserved."""
    contact_channels = {}
    for row in generated["consents"]:
        key = (row["contact_id"], row["channel"])
        contact_channels.setdefault(key, []).append(row)
    # Multiple consent records per (contact, channel) are allowed (append-only history).
    for key, records in contact_channels.items():
        ids = [r["consent_id"] for r in records]
        assert len(ids) == len(set(ids)), f"Duplicate consent_id for {key}"


# --- Reproducibility ---

def test_reproducibility():
    """Two runs with the same seed and config produce identical CSV bytes."""
    base = PROJECT_ROOT / "tests" / ".pytest_repro_tmp"
    run_a = base / "a"
    run_b = base / "b"
    if base.exists():
        shutil.rmtree(base, ignore_errors=True)
    base.mkdir(parents=True, exist_ok=True)
    try:
        python = os.environ.get(
            "KILO_PYTHON",
            str(PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"),
        )
        for out in (run_a, run_b):
            subprocess.run(
                [
                    python,
                    str(GENERATOR_MODULE),
                    "--companies", "10",
                    "--contacts", "20",
                    "--salesreps", "5",
                    "--score-rules", "3",
                    "--campaigns", "4",
                    "--leads", "30",
                    "--consents", "25",
                    "--activities", "60",
                    "--tasks", "45",
                    "--opportunities", "12",
                    "--stage-histories", "40",
                    "--seed", "20261022",
                    "--output-dir", str(out),
                ],
                check=True,
                cwd=str(PROJECT_ROOT),
            )
        csv_names = [
            "companies.csv", "contacts.csv", "salesreps.csv", "score_rules.csv",
            "campaigns.csv", "leads.csv", "lead_campaigns.csv", "consents.csv",
            "activities.csv", "tasks.csv", "opportunities.csv", "stage_histories.csv",
        ]
        for name in csv_names:
            a = (run_a / name).read_bytes()
            b = (run_b / name).read_bytes()
            assert a == b, f"{name} differs between identical seed runs"
    finally:
        shutil.rmtree(base, ignore_errors=True)


# --- Scoring (existing tests preserved) ---

def _load_generator_module():
    """Load the generator module to access scoring constants and functions."""
    spec = importlib.util.spec_from_file_location("generator.generate", GENERATOR_MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_score_weights_sum_to_one():
    """Scoring weights are proposed synthetic-demo rules summing to 1.0."""
    mod = _load_generator_module()
    total = mod.FIT_WEIGHT + mod.INTENT_WEIGHT + mod.ENGAGEMENT_WEIGHT
    assert abs(total - 1.0) < 1e-9


def test_compute_lead_score_known_values():
    """Weighted formula produces expected scores for known inputs."""
    mod = _load_generator_module()
    fn = mod.compute_lead_score
    assert fn(100, 100, 100) == 100
    assert fn(0, 0, 0) == 0
    assert fn(100, 0, 0) == 50  # 100 * 0.5
    assert fn(0, 100, 0) == 30  # 100 * 0.3
    assert fn(0, 0, 100) == 20  # 100 * 0.2


def test_compute_lead_score_rounding():
    """Result is rounded to an integer."""
    mod = _load_generator_module()
    fn = mod.compute_lead_score
    # 50*0.5 + 50*0.3 + 50*0.2 = 25 + 15 + 10 = 50
    assert fn(50, 50, 50) == 50


def test_compute_lead_score_clamping():
    """Result is clamped to [0, 100]."""
    mod = _load_generator_module()
    fn = mod.compute_lead_score
    assert fn(200, 200, 200) == 100
    assert fn(-10, -10, -10) == 0


def test_compute_lead_score_reproducible():
    """Same inputs always produce the same score (pure function)."""
    mod = _load_generator_module()
    fn = mod.compute_lead_score
    assert fn(70, 30, 90) == fn(70, 30, 90)


def test_generated_lead_score_matches_formula(generated):
    """Every generated lead's lead_score equals compute_lead_score(fit, intent, engagement)."""
    mod = _load_generator_module()
    fn = mod.compute_lead_score
    for row in generated["leads"]:
        expected = fn(
            int(row["fit_score"]),
            int(row["intent_score"]),
            int(row["engagement_score"]),
        )
        assert int(row["lead_score"]) == expected, (
            f"Lead {row['lead_id']}: lead_score {row['lead_score']} != "
            f"expected {expected}"
        )
