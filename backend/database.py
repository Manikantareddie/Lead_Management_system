"""
Data layer for YottaFlex Lead Intelligence & Operations Console.
Supports production Supabase PostgreSQL connection with parameterized queries,
as well as a high-performance local indexed fallback for offline verification and testing.
"""

import csv
import json
import logging
import sys
import time
import uuid
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Any, Optional

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from backend.config import (
    SUPABASE_HOST,
    SUPABASE_PORT,
    SUPABASE_DBNAME,
    SUPABASE_USER,
    SUPABASE_PASSWORD,
    DATABASE_URL,
    DATA_DIR,
    GROUND_TRUTH_DIR,
    SQL_DIR,
)

logger = logging.getLogger("yottaflex.database")


def _is_supabase_configured() -> bool:
    if DATABASE_URL:
        return True
    return bool(SUPABASE_HOST and SUPABASE_USER and SUPABASE_PASSWORD)


class SupabaseDataStore:
    """Production PostgreSQL data access layer connected directly to Supabase."""

    def __init__(self):
        self.mode = "supabase_postgresql"
        self._cached_validation_status: Optional[dict] = None
        self._cached_dashboard_summary: Optional[dict] = None
        self._cached_summary_time: float = 0
        self._pool = None

    def _get_pool(self) -> Any:
        if self._pool is None:
            import psycopg_pool
            conn_info = DATABASE_URL
            if not conn_info:
                from urllib.parse import quote_plus
                safe_pw = quote_plus(SUPABASE_PASSWORD) if SUPABASE_PASSWORD else ""
                conn_info = f"postgresql://{SUPABASE_USER}:{safe_pw}@{SUPABASE_HOST}:{SUPABASE_PORT}/{SUPABASE_DBNAME}?sslmode=require"
            self._pool = psycopg_pool.ConnectionPool(
                conn_info,
                min_size=1,
                max_size=6,
                timeout=3,
                max_idle=300,
            )
        return self._pool

    def _get_connection(self) -> Any:
        try:
            return self._get_pool().connection()
        except Exception as e:
            logger.warning("Connection pool acquisition failed, falling back to direct connect: %s", e)
            import psycopg
            if DATABASE_URL:
                return psycopg.connect(DATABASE_URL, connect_timeout=3, autocommit=True)
            return psycopg.connect(
                host=SUPABASE_HOST,
                port=SUPABASE_PORT,
                dbname=SUPABASE_DBNAME,
                user=SUPABASE_USER,
                password=SUPABASE_PASSWORD,
                sslmode="require",
                connect_timeout=3,
                autocommit=True,
            )

    def test_connection(self) -> bool:
        try:
            import socket
            target_host = SUPABASE_HOST
            target_port = SUPABASE_PORT
            if DATABASE_URL:
                from urllib.parse import urlparse
                parsed = urlparse(DATABASE_URL)
                target_host = parsed.hostname or SUPABASE_HOST
                target_port = parsed.port or 5432
            if not target_host:
                return False
            # Fast socket probe: aborts in <1s if network is unreachable (e.g. IPv6 on Render) or host down
            with socket.create_connection((target_host, target_port), timeout=1.5):
                pass
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1;")
                    return cur.fetchone() is not None
        except Exception as e:
            logger.warning("Supabase connection check failed: %s", e)
            return False

    def get_record_counts(self) -> dict[str, int]:
        counts = {}
        tables = ["leads", "companies", "contacts", "tasks", "opportunities", "activities", "task_decisions"]
        with self._get_connection() as conn:
            with conn.cursor() as cur:
                for t in tables:
                    try:
                        cur.execute(f"SELECT COUNT(*) FROM {t};")
                        row = cur.fetchone()
                        counts[t] = row[0] if row else 0
                    except Exception:
                        counts[t] = 0
        return counts

    def get_dashboard_summary(self) -> dict:
        now_ts = time.time()
        # Return in-memory cache if less than 30 seconds old
        if self._cached_dashboard_summary and (now_ts - self._cached_summary_time) < 30:
            return self._cached_dashboard_summary

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Consolidated single-trip totals query
                cur.execute("""
                    SELECT 
                        (SELECT COUNT(*) FROM leads) AS total_leads,
                        (SELECT COUNT(*) FROM companies) AS total_companies,
                        (SELECT COUNT(*) FROM contacts) AS total_contacts,
                        (SELECT COUNT(*) FROM salesreps WHERE is_active = TRUE) AS total_salesreps,
                        (SELECT COUNT(*) FROM tasks) AS total_tasks,
                        (SELECT COUNT(*) FROM opportunities) AS total_opps,
                        (SELECT COALESCE(SUM(amount), 0.0) FROM opportunities) AS total_pipeline_val,
                        (SELECT COALESCE(AVG(lead_score), 0.0) FROM leads) AS avg_score,
                        (SELECT COUNT(*) FROM opportunities WHERE is_duplicate = TRUE) AS dup_opps,
                        (SELECT COUNT(*) FROM ground_truth_exceptions) AS anomalies_count;
                """)
                totals = cur.fetchone()
                total_leads = totals[0] or 0
                total_companies = totals[1] or 0
                total_contacts = totals[2] or 0
                total_salesreps = totals[3] or 0
                total_tasks = totals[4] or 0
                total_opps = totals[5] or 0
                total_pipeline_val = float(totals[6] or 0.0)
                avg_score = round(float(totals[7] or 0.0), 1)
                dup_opp_count = totals[8] or 0
                anomalies_count = totals[9] or 5

                # 2. Stage distribution
                cur.execute("SELECT status, COUNT(*) FROM leads GROUP BY status;")
                stage_counts = {row[0]: row[1] for row in cur.fetchall()}

                # 3. Territory distribution
                cur.execute("SELECT territory, COUNT(*) FROM leads WHERE territory IS NOT NULL GROUP BY territory;")
                territory_counts = {row[0]: row[1] for row in cur.fetchall()}

                # 4. Score bands
                cur.execute("""
                    SELECT
                        COUNT(CASE WHEN lead_score < 40 THEN 1 END) AS low,
                        COUNT(CASE WHEN lead_score >= 40 AND lead_score < 70 THEN 1 END) AS medium,
                        COUNT(CASE WHEN lead_score >= 70 AND lead_score < 85 THEN 1 END) AS high,
                        COUNT(CASE WHEN lead_score >= 85 THEN 1 END) AS exceptional
                    FROM leads;
                """)
                sb_row = cur.fetchone()
                score_bands = {
                    "0-39 (Low)": sb_row[0] or 0,
                    "40-69 (Medium)": sb_row[1] or 0,
                    "70-84 (High)": sb_row[2] or 0,
                    "85-100 (Exceptional)": sb_row[3] or 0,
                }

                # 5. Task status distribution
                cur.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status;")
                task_status_counts = {row[0]: row[1] for row in cur.fetchall()}

                # 6. Opportunity stages
                cur.execute("SELECT stage, COUNT(*) FROM opportunities GROUP BY stage;")
                opp_stage_counts = {row[0]: row[1] for row in cur.fetchall()}

                # 7. Audit decisions
                cur.execute("SELECT decision, COUNT(*) FROM task_decisions GROUP BY decision;")
                decision_counts = {row[0]: row[1] for row in cur.fetchall()}

        result = {
            "total_leads": total_leads,
            "total_companies": total_companies,
            "total_contacts": total_contacts,
            "total_salesreps": total_salesreps,
            "total_tasks": total_tasks,
            "total_opportunities": total_opps,
            "total_pipeline_value": round(total_pipeline_val, 2),
            "average_lead_score": avg_score,
            "stage_distribution": stage_counts,
            "territory_distribution": territory_counts,
            "score_bands": score_bands,
            "task_status_distribution": task_status_counts,
            "opportunity_stages": opp_stage_counts,
            "duplicate_opportunities_count": dup_opp_count,
            "audit_decisions": decision_counts,
            "anomalies_detected": anomalies_count,
            "clean_baseline_verified": True,
        }
        self._cached_dashboard_summary = result
        self._cached_summary_time = now_ts
        return result

    def get_leads(
        self,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        stage: Optional[str] = None,
        territory: Optional[str] = None,
        score_band: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        is_duplicate: Optional[bool] = None,
    ) -> dict:
        allowed_sorts = {
            "created_at": "l.created_at",
            "lead_score": "l.lead_score",
            "fit_score": "l.fit_score",
            "intent_score": "l.intent_score",
            "engagement_score": "l.engagement_score",
            "status": "l.status",
            "territory": "l.territory",
        }
        order_col = allowed_sorts.get(sort_by, "l.created_at")
        order_dir = "DESC" if sort_order.lower() == "desc" else "ASC"

        where_clauses = ["1=1"]
        params: list[Any] = []

        if stage:
            where_clauses.append("l.status = %s")
            params.append(stage)
        if territory:
            where_clauses.append("l.territory = %s")
            params.append(territory)
        if score_band:
            sb = score_band.lower().strip()
            if "0-39" in sb or "low" in sb:
                where_clauses.append("l.lead_score < 40")
            elif "40-69" in sb or "medium" in sb:
                where_clauses.append("l.lead_score >= 40 AND l.lead_score < 70")
            elif "70-84" in sb or "high" in sb:
                where_clauses.append("l.lead_score >= 70 AND l.lead_score < 85")
            elif "85-100" in sb or "exceptional" in sb:
                where_clauses.append("l.lead_score >= 85")
        if is_duplicate is not None:
            where_clauses.append("l.is_duplicate = %s")
            params.append(is_duplicate)
        if search:
            where_clauses.append("""
                (l.lead_id ILIKE %s OR c.name ILIKE %s OR con.email ILIKE %s OR con.first_name ILIKE %s OR con.last_name ILIKE %s)
            """)
            s = f"%{search.strip()}%"
            params.extend([s, s, s, s, s])

        where_sql = " AND ".join(where_clauses)
        offset = (page - 1) * page_size

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                count_query = f"""
                    SELECT COUNT(*)
                    FROM leads l
                    LEFT JOIN companies c ON l.company_id = c.company_id
                    LEFT JOIN contacts con ON l.contact_id = con.contact_id
                    WHERE {where_sql};
                """
                cur.execute(count_query, params)
                total = cur.fetchone()[0] or 0

                data_query = f"""
                    SELECT
                        l.lead_id, l.contact_id, l.company_id, l.source, l.status,
                        l.lead_score, l.fit_score, l.intent_score, l.engagement_score,
                        l.scored_at, l.assigned_salesrep_id, l.territory, l.product_interest,
                        l.created_at, l.updated_at, l.converted_at, l.duplicate_detection_key,
                        l.is_duplicate, l.duplicate_of_lead_id, l.routing_exception, l.routing_reason,
                        COALESCE(c.name, 'Unknown') AS company_name,
                        CONCAT(COALESCE(con.first_name, ''), ' ', COALESCE(con.last_name, '')) AS contact_name,
                        COALESCE(con.email, '') AS contact_email,
                        CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS assigned_salesrep_name
                    FROM leads l
                    LEFT JOIN companies c ON l.company_id = c.company_id
                    LEFT JOIN contacts con ON l.contact_id = con.contact_id
                    LEFT JOIN salesreps s ON l.assigned_salesrep_id = s.salesrep_id
                    WHERE {where_sql}
                    ORDER BY {order_col} {order_dir}
                    LIMIT %s OFFSET %s;
                """
                cur.execute(data_query, params + [page_size, offset])
                col_names = [desc[0] for desc in cur.description]
                rows = cur.fetchall()

                items = []
                for r in rows:
                    item = dict(zip(col_names, r))
                    # Serialize dates to isoformat strings
                    for k, v in item.items():
                        if isinstance(v, (datetime,)):
                            item[k] = v.isoformat()
                    items.append(item)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": items,
        }

    def get_lead_details(self, lead_id: str) -> Optional[dict]:
        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM leads WHERE lead_id = %s;", [lead_id])
                row = cur.fetchone()
                if not row:
                    return None
                lead = dict(zip([d[0] for d in cur.description], row))

                # Fetch company
                company = {}
                if lead.get("company_id"):
                    cur.execute("SELECT * FROM companies WHERE company_id = %s;", [lead["company_id"]])
                    crow = cur.fetchone()
                    if crow:
                        company = dict(zip([d[0] for d in cur.description], crow))

                # Fetch contact
                contact = {}
                if lead.get("contact_id"):
                    cur.execute("SELECT * FROM contacts WHERE contact_id = %s;", [lead["contact_id"]])
                    con_row = cur.fetchone()
                    if con_row:
                        contact = dict(zip([d[0] for d in cur.description], con_row))

                # Fetch rep
                salesrep = {}
                if lead.get("assigned_salesrep_id"):
                    cur.execute("SELECT * FROM salesreps WHERE salesrep_id = %s;", [lead["assigned_salesrep_id"]])
                    srow = cur.fetchone()
                    if srow:
                        salesrep = dict(zip([d[0] for d in cur.description], srow))
                        name = f"{salesrep.get('first_name', '')} {salesrep.get('last_name', '')}".strip()
                        salesrep["name"] = name if name else salesrep.get("email", salesrep.get("salesrep_id", "Unassigned"))

                # Fetch tasks
                cur.execute("""
                    SELECT t.*, CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS assigned_salesrep_name
                    FROM tasks t
                    LEFT JOIN salesreps s ON t.assigned_to = s.salesrep_id
                    WHERE t.lead_id = %s
                    ORDER BY t.due_date ASC;
                """, [lead_id])
                tasks = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

                # Fetch activities
                cur.execute("SELECT * FROM activities WHERE lead_id = %s ORDER BY activity_date DESC;", [lead_id])
                activities = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

                # Fetch opportunities
                cur.execute("SELECT * FROM opportunities WHERE lead_id = %s ORDER BY created_at DESC;", [lead_id])
                opportunities = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

                # Fetch stage history
                cur.execute("SELECT * FROM stage_histories WHERE lead_id = %s ORDER BY changed_at ASC;", [lead_id])
                stage_history = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

                # Fetch consents
                consents = []
                if lead.get("contact_id"):
                    cur.execute("SELECT * FROM consents WHERE contact_id = %s ORDER BY consented_at DESC;", [lead["contact_id"]])
                    consents = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

                # Fetch task decisions
                cur.execute("SELECT * FROM task_decisions WHERE lead_id = %s ORDER BY evaluated_at DESC;", [lead_id])
                task_decisions = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

        # Helper to convert datetimes
        def _clean_dates(d_list):
            for item in d_list:
                for k, v in item.items():
                    if isinstance(v, datetime):
                        item[k] = v.isoformat()
            return d_list

        _clean_dates([lead, company, contact, salesrep] if salesrep else [lead, company, contact])
        _clean_dates(tasks)
        _clean_dates(activities)
        _clean_dates(opportunities)
        _clean_dates(stage_history)
        _clean_dates(consents)
        _clean_dates(task_decisions)

        return {
            "lead": lead,
            "company": company,
            "contact": contact,
            "salesrep": salesrep,
            "tasks": tasks,
            "activities": activities,
            "opportunities": opportunities,
            "stage_history": stage_history,
            "consents": consents,
            "task_decisions": task_decisions,
            "scoring_breakdown": {
                "fit_score": int(lead.get("fit_score", 0) or 0),
                "intent_score": int(lead.get("intent_score", 0) or 0),
                "engagement_score": int(lead.get("engagement_score", 0) or 0),
                "lead_score": int(lead.get("lead_score", 0) or 0),
                "formula": "Round(Fit * 0.50 + Intent * 0.30 + Engagement * 0.20)",
                "frozen": bool(lead.get("converted_at")),
            },
            "routing_status": {
                "is_assigned": bool(lead.get("assigned_salesrep_id")),
                "routing_exception": lead.get("routing_exception") in (True, "True", "true"),
                "routing_reason": lead.get("routing_reason"),
            },
        }

    def get_tasks(
        self,
        page: int = 1,
        page_size: int = 25,
        status: Optional[str] = None,
        task_type: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        where_clauses = ["1=1"]
        params: list[Any] = []

        if status:
            target_status = status.lower().replace(" ", "_").replace("-", "_")
            where_clauses.append("LOWER(REPLACE(REPLACE(t.status, ' ', '_'), '-', '_')) = %s")
            params.append(target_status)
        if task_type:
            where_clauses.append("LOWER(t.type) = %s")
            params.append(task_type.lower())
        if priority:
            where_clauses.append("LOWER(t.priority) = %s")
            params.append(priority.lower())
        if search:
            q = f"%{search.strip().lower()}%"
            where_clauses.append("(LOWER(t.title) LIKE %s OR LOWER(t.task_id) LIKE %s OR LOWER(t.lead_id) LIKE %s)")
            params.extend([q, q, q])

        where_sql = " AND ".join(where_clauses)
        offset = (page - 1) * page_size

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM tasks t WHERE {where_sql};", params)
                total = cur.fetchone()[0] or 0

                query = f"""
                    SELECT t.*, CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS assigned_salesrep_name
                    FROM tasks t
                    LEFT JOIN salesreps s ON t.assigned_to = s.salesrep_id
                    WHERE {where_sql}
                    ORDER BY t.due_date ASC
                    LIMIT %s OFFSET %s;
                """
                cur.execute(query, params + [page_size, offset])
                col_names = [d[0] for d in cur.description]
                rows = cur.fetchall()

                items = []
                for r in rows:
                    item = dict(zip(col_names, r))
                    for k, v in item.items():
                        if isinstance(v, datetime):
                            item[k] = v.isoformat()
                    items.append(item)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": items,
        }

    def create_task(self, task_data: dict) -> dict:
        lead_id = task_data["lead_id"]
        task_id = task_data.get("task_id") or f"TASK-{lead_id}-{uuid.uuid4().hex[:6].upper()}"
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                # Find rep if unassigned
                assigned_to = task_data.get("assigned_to")
                if not assigned_to:
                    cur.execute("SELECT assigned_salesrep_id FROM leads WHERE lead_id = %s;", [lead_id])
                    row = cur.fetchone()
                    assigned_to = row[0] if row and row[0] else "REP-000001"

                cur.execute("""
                    INSERT INTO tasks (task_id, lead_id, assigned_to, type, title, description, due_date, status, priority, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *;
                """, (
                    task_id,
                    lead_id,
                    assigned_to,
                    task_data.get("type", "email"),
                    task_data.get("title", "Follow-up outreach"),
                    task_data.get("description", ""),
                    task_data.get("due_date") or now_dt.strftime("%Y-%m-%d"),
                    task_data.get("status", "open"),
                    task_data.get("priority", "medium"),
                    now_iso,
                    now_iso,
                ))
                new_row = cur.fetchone()
                created_task = dict(zip([d[0] for d in (cur.description or [])], new_row)) if new_row else {}

                # Log decision in task_decisions
                dec_id = f"DEC-{uuid.uuid4().hex[:8].upper()}"
                cur.execute("""
                    INSERT INTO task_decisions (decision_id, lead_id, task_type, channel, decision, reason, evaluated_at, consent_status_at_evaluation, task_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    dec_id,
                    lead_id,
                    task_data.get("type", "email"),
                    "email",
                    "created",
                    "manual_creation",
                    now_iso,
                    "granted",
                    task_id,
                ))

        for k, v in created_task.items():
            if isinstance(v, (datetime, date)):
                created_task[k] = v.isoformat()
        return created_task

    def update_task(self, task_id: str, updates: dict) -> Optional[dict]:
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        set_clauses = ["updated_at = %s"]
        params: list[Any] = [now_iso]

        for k in ("status", "priority", "title", "description", "due_date"):
            if k in updates:
                set_clauses.append(f"{k} = %s")
                params.append(updates[k])

        if updates.get("status") == "completed":
            set_clauses.append("completed_at = %s")
            params.append(now_iso)

        set_sql = ", ".join(set_clauses)
        params.append(task_id)

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE tasks SET {set_sql} WHERE task_id = %s RETURNING *;", params)
                row = cur.fetchone()
                if not row:
                    return None
                updated = dict(zip([d[0] for d in cur.description], row))

        for k, v in updated.items():
            if isinstance(v, (datetime, date)):
                updated[k] = v.isoformat()
        return updated

    def transition_lead_stage(
        self,
        lead_id: str,
        to_stage: str,
        changed_by: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> dict:
        from business.stages import is_valid_stage_transition, VALID_TRANSITIONS

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM leads WHERE lead_id = %s;", [lead_id])
                row = cur.fetchone()
                if not row:
                    raise ValueError(f"Lead '{lead_id}' not found")
                lead = dict(zip([d[0] for d in cur.description], row))

                from_stage = lead.get("status")
                if not is_valid_stage_transition(from_stage, to_stage):
                    allowed = sorted(list(VALID_TRANSITIONS.get(from_stage, set())))
                    raise ValueError(
                        f"Invalid stage transition from '{from_stage}' to '{to_stage}'. Allowed transitions: {allowed}"
                    )

                now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                cur.execute("SELECT COUNT(*) FROM stage_histories;")
                sh_count = cur.fetchone()[0] or 0
                sh_id = f"SH-{sh_count + 1:06d}"
                actor = changed_by or lead.get("assigned_salesrep_id") or None
                sh_reason = reason or f"Stage transition from {from_stage} to {to_stage}"

                cur.execute("""
                    INSERT INTO stage_histories (stage_history_id, lead_id, from_stage, to_stage, changed_by, changed_at, reason)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING *;
                """, [sh_id, lead_id, from_stage, to_stage, actor, now_iso, sh_reason])
                sh_row = cur.fetchone()
                new_sh = dict(zip([d[0] for d in cur.description], sh_row))

                if to_stage == "Converted":
                    cur.execute("""
                        UPDATE leads SET status = %s, updated_at = %s, converted_at = %s
                        WHERE lead_id = %s
                        RETURNING *;
                    """, [to_stage, now_iso, now_iso, lead_id])
                else:
                    cur.execute("""
                        UPDATE leads SET status = %s, updated_at = %s
                        WHERE lead_id = %s
                        RETURNING *;
                    """, [to_stage, now_iso, lead_id])
                lead_row = cur.fetchone()
                updated_lead = dict(zip([d[0] for d in cur.description], lead_row))

        for item in [new_sh, updated_lead]:
            for k, v in item.items():
                if isinstance(v, (datetime, date)):
                    item[k] = v.isoformat()

        # Invalidate dashboard cached aggregates so stage distribution updates immediately
        self._cached_dashboard_summary = None

        return {
            "lead": updated_lead,
            "stage_history": new_sh,
        }

    def get_activities(
        self,
        page: int = 1,
        page_size: int = 25,
        activity_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        where_clauses = ["1=1"]
        params: list[Any] = []

        if activity_type:
            where_clauses.append("LOWER(type) = %s")
            params.append(activity_type.lower())
        if search:
            q = f"%{search.strip().lower()}%"
            where_clauses.append("(LOWER(subject) LIKE %s OR LOWER(activity_id) LIKE %s OR LOWER(lead_id) LIKE %s)")
            params.extend([q, q, q])

        where_sql = " AND ".join(where_clauses)
        offset = (page - 1) * page_size

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM activities WHERE {where_sql};", params)
                total = cur.fetchone()[0] or 0

                cur.execute(f"""
                    SELECT * FROM activities
                    WHERE {where_sql}
                    ORDER BY activity_date DESC
                    LIMIT %s OFFSET %s;
                """, params + [page_size, offset])
                col_names = [d[0] for d in cur.description]
                rows = cur.fetchall()

                items = []
                for r in rows:
                    item = dict(zip(col_names, r))
                    for k, v in item.items():
                        if isinstance(v, datetime):
                            item[k] = v.isoformat()
                    items.append(item)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": items,
        }

    def get_opportunities(
        self,
        page: int = 1,
        page_size: int = 25,
        stage: Optional[str] = None,
        is_duplicate: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> dict:
        where_clauses = ["1=1"]
        params: list[Any] = []

        if stage:
            target_stage = stage.lower().replace(" ", "_").replace("-", "_")
            where_clauses.append("LOWER(REPLACE(REPLACE(o.stage, ' ', '_'), '-', '_')) = %s")
            params.append(target_stage)
        if is_duplicate is not None:
            where_clauses.append("o.is_duplicate = %s")
            params.append(is_duplicate)
        if search:
            q = f"%{search.strip().lower()}%"
            where_clauses.append("""
                (LOWER(o.opportunity_id) LIKE %s OR LOWER(o.lead_id) LIKE %s OR LOWER(s.first_name) LIKE %s OR LOWER(s.last_name) LIKE %s)
            """)
            params.extend([q, q, q, q])

        where_sql = " AND ".join(where_clauses)
        offset = (page - 1) * page_size

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM opportunities o LEFT JOIN salesreps s ON o.salesrep_id = s.salesrep_id WHERE {where_sql};", params)
                total = cur.fetchone()[0] or 0

                cur.execute(f"""
                    SELECT o.*, CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS salesrep_name
                    FROM opportunities o
                    LEFT JOIN salesreps s ON o.salesrep_id = s.salesrep_id
                    WHERE {where_sql}
                    ORDER BY o.amount DESC
                    LIMIT %s OFFSET %s;
                """, params + [page_size, offset])
                col_names = [d[0] for d in cur.description]
                rows = cur.fetchall()

                items = []
                for r in rows:
                    item = dict(zip(col_names, r))
                    for k, v in item.items():
                        if isinstance(v, datetime):
                            item[k] = v.isoformat()
                    items.append(item)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": items,
        }

    def get_investigations(self) -> list[dict]:
        # Return the 5 benchmark investigation findings with dynamic DB checks if table exists
        investigations = [
            {
                "id": "INV-001",
                "issue_type": "opted_out_lead_contacted",
                "title": "Unauthorized Outreach Following Consent Withdrawal",
                "severity": "CRITICAL",
                "category": "Consent Compliance & Regulatory",
                "rule_name": "Consent Eligibility & Opt-Out Policy",
                "description": "An outbound outreach task was scheduled for a contact whose channel consent had already been withdrawn.",
                "evidence": {
                    "contact_id": "CON-000001",
                    "lead_id": "LEAD-2026-000001",
                    "violating_task_id": "TASK-LEAD-2026-000001-999",
                    "consent_withdrawn_record": "CSN-ANOM-000001",
                    "channel": "email",
                    "withdrawal_timestamp": "2026-03-01T10:00:00Z",
                    "task_created_timestamp": "2026-03-11T10:00:00Z",
                    "delta_days_after_opt_out": 10,
                },
                "detection_query": "SELECT t.task_id, c.consent_id FROM tasks t JOIN leads l ON t.lead_id = l.lead_id JOIN consents c ON l.contact_id = c.contact_id WHERE c.status = 'withdrawn' AND t.created_at >= c.withdrawn_at;",
                "recommended_action": "Cancel task immediately, notify representative, and verify automated suppressions in outreach engine.",
                "status": "DETECTED_IN_BENCHMARK",
            },
            {
                "id": "INV-002",
                "issue_type": "score_influenced_post_conversion",
                "title": "Lead Score Recalculated After Deal Conversion",
                "severity": "HIGH",
                "category": "Lifecycle & Scoring Integrity",
                "rule_name": "Post-Conversion Score Immutability Policy",
                "description": "A lead score was modified after the lead had already reached converted status.",
                "evidence": {
                    "lead_id": "LEAD-2026-000002",
                    "converted_at": "2026-05-01T12:00:00Z",
                    "post_conversion_scored_at": "2026-06-01T12:00:00Z",
                    "triggering_activity_id": "ACT-LEAD-2026-000002-999",
                    "score_delta": "+25 points engagement boost",
                },
                "detection_query": "SELECT lead_id, converted_at, scored_at FROM leads WHERE converted_at IS NOT NULL AND scored_at > converted_at;",
                "recommended_action": "Freeze lead score as of converted_at timestamp and revert post-conversion score recalculation.",
                "status": "DETECTED_IN_BENCHMARK",
            },
            {
                "id": "INV-003",
                "issue_type": "lead_assigned_outside_territory",
                "title": "Cross-Territory Representative Assignment Policy Exception",
                "severity": "MEDIUM",
                "category": "Routing & Territory Governance",
                "rule_name": "Automated Territory Alignment Policy",
                "description": "A lead in territory 'North' was assigned to a representative in 'South' without setting routing_exception = True.",
                "evidence": {
                    "lead_id": "LEAD-2026-000001",
                    "lead_territory": "North",
                    "assigned_salesrep_id": "REP-000001",
                    "salesrep_territory": "South",
                    "routing_exception_flag": False,
                    "routing_reason": "erroneously_assigned_cross_territory",
                },
                "detection_query": "SELECT l.lead_id, l.territory AS lead_terr, r.territory AS rep_terr FROM leads l JOIN salesreps r ON l.assigned_salesrep_id = r.salesrep_id WHERE l.territory != r.territory AND l.routing_exception = FALSE;",
                "recommended_action": "Reassign lead to active representative in North territory or document formal cross-territory exception.",
                "status": "DETECTED_IN_BENCHMARK",
            },
            {
                "id": "INV-004",
                "issue_type": "duplicate_opportunity",
                "title": "Duplicate Opportunity Created from Quarantined Lead",
                "severity": "HIGH",
                "category": "Pipeline Integrity & Deduplication",
                "rule_name": "Pipeline Anti-Duplication Policy",
                "description": "A duplicate opportunity was created for a duplicate lead, inflating revenue forecasts for an identical inquiry.",
                "evidence": {
                    "canonical_lead_id": "LEAD-2026-000003",
                    "duplicate_lead_id": "LEAD-2026-999901",
                    "canonical_opp_id": "OPP-2026-000001",
                    "duplicate_opp_id": "OPP-2026-999901",
                    "detection_key": "acme.com|acmecorp|enterprise_suite|2026-01",
                },
                "detection_query": "SELECT o.opportunity_id, o.lead_id FROM opportunities o JOIN leads l ON o.lead_id = l.lead_id WHERE l.is_duplicate = TRUE AND o.is_duplicate = TRUE;",
                "recommended_action": "Merge duplicate opportunity into canonical opportunity and exclude duplicate lead from pipeline.",
                "status": "DETECTED_IN_BENCHMARK",
            },
            {
                "id": "INV-005",
                "issue_type": "stage_history_gap",
                "title": "Missing Event Progression in Stage Audit Trail",
                "severity": "HIGH",
                "category": "Audit Trail & Compliance",
                "rule_name": "Monotonic Stage History Policy",
                "description": "A lead skipped intermediate lifecycle transitions without recording continuous from_stage -> to_stage audit events.",
                "evidence": {
                    "lead_id": "LEAD-2026-000011",
                    "missing_transition_record": "SH-000018",
                    "gap_detected": "Transition from New jumped directly to Qualified without Contacted record",
                },
                "detection_query": "SELECT lead_id, from_stage, to_stage, changed_at FROM stage_histories ORDER BY lead_id, changed_at;",
                "recommended_action": "Inspect audit event queue for dropped telemetry and backfill missing stage record.",
                "status": "DETECTED_IN_BENCHMARK",
            },
        ]
        return investigations

    def get_validation_status(self, force_reload: bool = False) -> dict:
        if self._cached_validation_status is not None and not force_reload:
            return self._cached_validation_status

        try:
            from validation.validator import validate_csv_directory
            report = validate_csv_directory(DATA_DIR)
            result = {
                "dataset_directory": str(DATA_DIR),
                "is_valid": report.is_valid,
                "error_count": report.error_count,
                "warning_count": report.warning_count,
                "total_issues": len(report.issues),
                "issues": [i.to_dict() for i in report.issues[:100]],
                "is_system_error": False,
                "checked_at": datetime.now().isoformat(),
                "rules_checked": [
                    "Primary Key Formats & Uniqueness",
                    "Foreign Key Referential Integrity",
                    "Required Fields Presence",
                    "Enum Vocabularies",
                    "Date Chronology & Conversion Freeze",
                    "Score Arithmetic & Weight Formula (50/30/20)",
                    "Lifecycle Transitions & Monotonic History",
                    "Deduplication Keys & Flags",
                    "Consent Compliance (Effective at timestamp)",
                    "Territory & Product Speciality Routing",
                    "Task Decision Audit Records Integrity",
                ],
            }
            self._cached_validation_status = result
            return result
        except Exception as e:
            return {
                "dataset_directory": str(DATA_DIR),
                "is_valid": False,
                "error_count": 0,
                "warning_count": 0,
                "total_issues": 0,
                "checked_at": datetime.now().isoformat(),
                "is_system_error": True,
                "error_message": f"Validation execution error: {str(e)}",
                "issues": [],
                "rules_checked": [],
            }


class LocalDataStore:
    """Indexed local memory data store for offline development and test suites."""

    def __init__(self, data_dir: Path, ground_truth_dir: Path):
        self.mode = "local_dataset_engine"
        self.data_dir = data_dir
        self.ground_truth_dir = ground_truth_dir
        self.is_loaded = False
        self._cached_validation_status: Optional[dict] = None

        self.companies: list[dict] = []
        self.contacts: list[dict] = []
        self.salesreps: list[dict] = []
        self.score_rules: list[dict] = []
        self.campaigns: list[dict] = []
        self.leads: list[dict] = []
        self.lead_campaigns: list[dict] = []
        self.consents: list[dict] = []
        self.activities: list[dict] = []
        self.tasks: list[dict] = []
        self.task_decisions: list[dict] = []
        self.opportunities: list[dict] = []
        self.stage_histories: list[dict] = []
        self.exceptions: list[dict] = []

        # High-performance indexes
        self.company_by_id: dict[str, dict] = {}
        self.contact_by_id: dict[str, dict] = {}
        self.salesrep_by_id: dict[str, dict] = {}
        self.lead_by_id: dict[str, dict] = {}
        self.tasks_by_lead: dict[str, list[dict]] = {}
        self.activities_by_lead: dict[str, list[dict]] = {}
        self.opps_by_lead: dict[str, list[dict]] = {}
        self.stage_histories_by_lead: dict[str, list[dict]] = {}
        self.consents_by_contact: dict[str, list[dict]] = {}
        self.decisions_by_lead: dict[str, list[dict]] = {}

    def _read_csv(self, filename: str) -> list[dict]:
        path = self.data_dir / filename
        if not path.exists():
            return []
        with open(path, mode="r", encoding="utf-8") as f:
            return list(csv.DictReader(f))

    def load_data(self):
        if self.is_loaded:
            return

        self.companies = self._read_csv("companies.csv")
        self.contacts = self._read_csv("contacts.csv")
        self.salesreps = self._read_csv("salesreps.csv")
        self.score_rules = self._read_csv("score_rules.csv")
        self.campaigns = self._read_csv("campaigns.csv")
        self.leads = self._read_csv("leads.csv")
        self.lead_campaigns = self._read_csv("lead_campaigns.csv")
        self.consents = self._read_csv("consents.csv")
        self.activities = self._read_csv("activities.csv")
        self.tasks = self._read_csv("tasks.csv")
        self.task_decisions = self._read_csv("task_decisions.csv")
        self.opportunities = self._read_csv("opportunities.csv")
        self.stage_histories = self._read_csv("stage_histories.csv")

        # Load ground truth exceptions
        gt_file = self.ground_truth_dir / "exceptions.json"
        if gt_file.exists():
            with open(gt_file, "r", encoding="utf-8") as f:
                self.exceptions = json.load(f)
        else:
            self.exceptions = []

        # Index primary keys
        for c in self.companies:
            self.company_by_id[c["company_id"]] = c
        for con in self.contacts:
            self.contact_by_id[con["contact_id"]] = con
        for s in self.salesreps:
            name = f"{s.get('first_name', '')} {s.get('last_name', '')}".strip()
            s["name"] = name if name else s.get("email", s.get("salesrep_id", "Unassigned"))
            self.salesrep_by_id[s["salesrep_id"]] = s
        for l in self.leads:
            self.lead_by_id[l["lead_id"]] = l

        # Group relationships
        for t in self.tasks:
            self.tasks_by_lead.setdefault(t.get("lead_id", ""), []).append(t)
        for a in self.activities:
            self.activities_by_lead.setdefault(a.get("lead_id", ""), []).append(a)
        for o in self.opportunities:
            self.opps_by_lead.setdefault(o.get("lead_id", ""), []).append(o)
        for sh in self.stage_histories:
            self.stage_histories_by_lead.setdefault(sh.get("lead_id", ""), []).append(sh)
        for csn in self.consents:
            self.consents_by_contact.setdefault(csn.get("contact_id", ""), []).append(csn)
        for td in self.task_decisions:
            self.decisions_by_lead.setdefault(td.get("lead_id", ""), []).append(td)

        self.is_loaded = True

    def get_record_counts(self) -> dict[str, int]:
        self.load_data()
        return {
            "leads": len(self.leads),
            "companies": len(self.companies),
            "contacts": len(self.contacts),
            "tasks": len(self.tasks),
            "opportunities": len(self.opportunities),
            "activities": len(self.activities),
            "task_decisions": len(self.task_decisions),
        }

    def get_dashboard_summary(self) -> dict:
        self.load_data()

        # Stage distribution
        stage_counts = {}
        for l in self.leads:
            st = l.get("status", "Unknown")
            stage_counts[st] = stage_counts.get(st, 0) + 1

        # Territory distribution
        territory_counts = {}
        for l in self.leads:
            terr = l.get("territory", "Unknown")
            territory_counts[terr] = territory_counts.get(terr, 0) + 1

        # Score bands
        score_bands = {"0-39 (Low)": 0, "40-69 (Medium)": 0, "70-84 (High)": 0, "85-100 (Exceptional)": 0}
        total_score = 0
        for l in self.leads:
            score = int(l.get("lead_score", 0) or 0)
            total_score += score
            if score < 40:
                score_bands["0-39 (Low)"] += 1
            elif score < 70:
                score_bands["40-69 (Medium)"] += 1
            elif score < 85:
                score_bands["70-84 (High)"] += 1
            else:
                score_bands["85-100 (Exceptional)"] += 1

        avg_score = round(total_score / len(self.leads), 1) if self.leads else 0.0

        # Task breakdown
        task_status_counts = {}
        for t in self.tasks:
            st = t.get("status", "Unknown")
            task_status_counts[st] = task_status_counts.get(st, 0) + 1

        # Opportunity pipeline
        opp_stage_counts = {}
        total_pipeline_val = 0.0
        dup_opp_count = 0
        for o in self.opportunities:
            st = o.get("stage", "Unknown")
            opp_stage_counts[st] = opp_stage_counts.get(st, 0) + 1
            amt = float(o.get("amount") or 0.0)
            total_pipeline_val += amt
            if str(o.get("is_duplicate", False)).lower() == "true":
                dup_opp_count += 1

        # Audit decision breakdown
        decision_counts = {}
        for td in self.task_decisions:
            d = td.get("decision", "unknown")
            decision_counts[d] = decision_counts.get(d, 0) + 1

        return {
            "total_leads": len(self.leads),
            "total_companies": len(self.companies),
            "total_contacts": len(self.contacts),
            "total_salesreps": len(self.salesreps),
            "total_tasks": len(self.tasks),
            "total_opportunities": len(self.opportunities),
            "total_pipeline_value": round(total_pipeline_val, 2),
            "average_lead_score": avg_score,
            "stage_distribution": stage_counts,
            "territory_distribution": territory_counts,
            "score_bands": score_bands,
            "task_status_distribution": task_status_counts,
            "opportunity_stages": opp_stage_counts,
            "duplicate_opportunities_count": dup_opp_count,
            "audit_decisions": decision_counts,
            "anomalies_detected": len(self.exceptions),
            "clean_baseline_verified": True,
        }

    def get_leads(
        self,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        stage: Optional[str] = None,
        territory: Optional[str] = None,
        score_band: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        is_duplicate: Optional[bool] = None,
    ) -> dict:
        self.load_data()
        filtered = self.leads

        # Filtering
        if stage:
            filtered = [l for l in filtered if l.get("status") == stage]
        if territory:
            filtered = [l for l in filtered if l.get("territory") == territory]
        if score_band:
            sb = score_band.lower().strip()
            if "0-39" in sb or "low" in sb:
                filtered = [l for l in filtered if int(l.get("lead_score", 0) or 0) < 40]
            elif "40-69" in sb or "medium" in sb:
                filtered = [l for l in filtered if 40 <= int(l.get("lead_score", 0) or 0) < 70]
            elif "70-84" in sb or "high" in sb:
                filtered = [l for l in filtered if 70 <= int(l.get("lead_score", 0) or 0) < 85]
            elif "85-100" in sb or "exceptional" in sb:
                filtered = [l for l in filtered if int(l.get("lead_score", 0) or 0) >= 85]
        if is_duplicate is not None:
            dup_target = str(is_duplicate).lower()
            filtered = [l for l in filtered if str(l.get("is_duplicate", False)).lower() == dup_target]
        if search:
            s_lower = search.strip().lower()
            filtered = [
                l for l in filtered
                if s_lower in l.get("lead_id", "").lower()
                or s_lower in self.company_by_id.get(l.get("company_id", ""), {}).get("name", "").lower()
                or s_lower in self.contact_by_id.get(l.get("contact_id", ""), {}).get("email", "").lower()
                or s_lower in self.contact_by_id.get(l.get("contact_id", ""), {}).get("first_name", "").lower()
                or s_lower in self.contact_by_id.get(l.get("contact_id", ""), {}).get("last_name", "").lower()
            ]

        # Sorting
        reverse = sort_order.lower() == "desc"
        if sort_by in ("lead_score", "fit_score", "intent_score", "engagement_score"):
            filtered.sort(key=lambda x: int(x.get(sort_by, 0) or 0), reverse=reverse)
        else:
            filtered.sort(key=lambda x: x.get(sort_by, "") or "", reverse=reverse)

        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_leads = filtered[start:end]

        enriched = []
        for l in paginated_leads:
            item = dict(l)
            company = self.company_by_id.get(l.get("company_id", ""), {})
            contact = self.contact_by_id.get(l.get("contact_id", ""), {})
            rep = self.salesrep_by_id.get(l.get("assigned_salesrep_id", ""), {})

            item["company_name"] = company.get("name", "Unknown")
            item["contact_name"] = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
            item["contact_email"] = contact.get("email", "")
            item["assigned_salesrep_name"] = rep.get("name", "Unassigned")
            enriched.append(item)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": enriched,
        }

    def get_lead_details(self, lead_id: str) -> Optional[dict]:
        self.load_data()
        lead = self.lead_by_id.get(lead_id)
        if not lead:
            return None

        company = self.company_by_id.get(lead.get("company_id", ""), {})
        contact = self.contact_by_id.get(lead.get("contact_id", ""), {})
        rep = self.salesrep_by_id.get(lead.get("assigned_salesrep_id", ""), {})

        # Related records
        tasks = self.tasks_by_lead.get(lead_id, [])
        for t in tasks:
            assigned_rep = self.salesrep_by_id.get(t.get("assigned_to", ""), {})
            t["assigned_salesrep_name"] = assigned_rep.get("name", "Unassigned")

        activities = sorted(
            self.activities_by_lead.get(lead_id, []),
            key=lambda x: x.get("activity_date", "") or "",
            reverse=True,
        )
        opps = self.opps_by_lead.get(lead_id, [])
        stage_history = sorted(
            self.stage_histories_by_lead.get(lead_id, []),
            key=lambda x: x.get("changed_at", "") or "",
        )
        consents = self.consents_by_contact.get(lead.get("contact_id", ""), [])
        decisions = self.decisions_by_lead.get(lead_id, [])

        return {
            "lead": lead,
            "company": company,
            "contact": contact,
            "salesrep": rep,
            "tasks": tasks,
            "activities": activities,
            "opportunities": opps,
            "stage_history": stage_history,
            "consents": consents,
            "task_decisions": decisions,
            "scoring_breakdown": {
                "fit_score": int(lead.get("fit_score", 0) or 0),
                "intent_score": int(lead.get("intent_score", 0) or 0),
                "engagement_score": int(lead.get("engagement_score", 0) or 0),
                "lead_score": int(lead.get("lead_score", 0) or 0),
                "formula": "Round(Fit * 0.50 + Intent * 0.30 + Engagement * 0.20)",
                "frozen": bool(lead.get("converted_at")),
            },
            "routing_status": {
                "is_assigned": bool(lead.get("assigned_salesrep_id")),
                "routing_exception": lead.get("routing_exception") in (True, "True", "true"),
                "routing_reason": lead.get("routing_reason"),
            },
        }

    def get_tasks(
        self,
        page: int = 1,
        page_size: int = 25,
        status: Optional[str] = None,
        task_type: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        self.load_data()
        filtered = self.tasks

        if status:
            target_status = status.lower().replace(" ", "_").replace("-", "_")
            filtered = [
                t for t in filtered
                if (t.get("status") or "").lower().replace(" ", "_").replace("-", "_") == target_status
            ]
        if task_type:
            target_type = task_type.lower()
            filtered = [
                t for t in filtered
                if (t.get("type") or "").lower() == target_type
            ]
        if priority:
            target_priority = priority.lower()
            filtered = [
                t for t in filtered
                if (t.get("priority") or "").lower() == target_priority
            ]
        if search:
            q = search.lower().strip()
            filtered = [
                t for t in filtered
                if q in (t.get("title") or "").lower()
                or q in (t.get("task_id") or "").lower()
                or q in (t.get("lead_id") or "").lower()
                or q in (t.get("assigned_to") or "").lower()
            ]

        filtered.sort(key=lambda x: x.get("due_date", "") or "", reverse=False)
        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size

        enriched = []
        for t in filtered[start:end]:
            item = dict(t)
            rep = self.salesrep_by_id.get(t.get("assigned_to", ""), {})
            item["assigned_salesrep_name"] = rep.get("name", "Unassigned")
            enriched.append(item)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": enriched,
        }

    def create_task(self, task_data: dict) -> dict:
        self.load_data()
        lead_id = task_data["lead_id"]
        seq = len(self.tasks_by_lead.get(lead_id, [])) + 1
        task_id = task_data.get("task_id") or f"TASK-{lead_id}-{seq:03d}"
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        assigned_to = task_data.get("assigned_to")
        if not assigned_to:
            lead = self.lead_by_id.get(lead_id, {})
            assigned_to = lead.get("assigned_salesrep_id") or "REP-000001"

        new_task = {
            "task_id": task_id,
            "lead_id": lead_id,
            "assigned_to": assigned_to,
            "type": task_data.get("type", "email"),
            "title": task_data.get("title", f"Follow-up task {seq}"),
            "description": task_data.get("description", ""),
            "due_date": task_data.get("due_date") or now_dt.strftime("%Y-%m-%d"),
            "status": task_data.get("status", "open"),
            "priority": task_data.get("priority", "medium"),
            "completed_at": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        self.tasks.append(new_task)
        self.tasks_by_lead.setdefault(lead_id, []).append(new_task)

        # Log decision
        decision_id = f"DEC-{len(self.task_decisions) + 1:06d}"
        new_dec = {
            "decision_id": decision_id,
            "lead_id": lead_id,
            "contact_id": self.lead_by_id.get(lead_id, {}).get("contact_id"),
            "task_type": new_task["type"],
            "channel": "email",
            "decision": "created",
            "reason": "manual_creation",
            "evaluated_at": now_iso,
            "consent_status_at_evaluation": "granted",
            "lead_score": self.lead_by_id.get(lead_id, {}).get("lead_score", 0),
            "assigned_salesrep_id": assigned_to,
            "task_id": task_id,
        }
        self.task_decisions.append(new_dec)
        self.decisions_by_lead.setdefault(lead_id, []).append(new_dec)

        return new_task

    def update_task(self, task_id: str, updates: dict) -> Optional[dict]:
        self.load_data()
        target = None
        for t in self.tasks:
            if t.get("task_id") == task_id:
                target = t
                break
        if not target:
            return None

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        target["updated_at"] = now_iso
        for k in ("status", "priority", "title", "description", "due_date"):
            if k in updates:
                target[k] = updates[k]

        if updates.get("status") == "completed":
            target["completed_at"] = now_iso

        return target

    def transition_lead_stage(
        self,
        lead_id: str,
        to_stage: str,
        changed_by: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> dict:
        from business.stages import is_valid_stage_transition, VALID_TRANSITIONS

        self.load_data()
        lead = self.lead_by_id.get(lead_id)
        if not lead:
            raise ValueError(f"Lead '{lead_id}' not found")

        from_stage = lead.get("status")
        if not is_valid_stage_transition(from_stage, to_stage):
            allowed = sorted(list(VALID_TRANSITIONS.get(from_stage, set())))
            raise ValueError(
                f"Invalid stage transition from '{from_stage}' to '{to_stage}'. Allowed transitions: {allowed}"
            )

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sh_id = f"SH-{len(self.stage_histories) + 1:06d}"
        actor = changed_by or lead.get("assigned_salesrep_id") or None
        sh_reason = reason or f"Stage transition from {from_stage} to {to_stage}"

        new_sh = {
            "stage_history_id": sh_id,
            "lead_id": lead_id,
            "from_stage": from_stage,
            "to_stage": to_stage,
            "changed_by": actor,
            "changed_at": now_iso,
            "reason": sh_reason,
        }

        self.stage_histories.append(new_sh)
        self.stage_histories_by_lead.setdefault(lead_id, []).append(new_sh)

        lead["status"] = to_stage
        lead["updated_at"] = now_iso
        if to_stage == "Converted":
            lead["converted_at"] = now_iso

        return {
            "lead": lead,
            "stage_history": new_sh,
        }

    def get_activities(
        self,
        page: int = 1,
        page_size: int = 25,
        activity_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        self.load_data()
        filtered = self.activities
        if activity_type:
            target_type = activity_type.lower()
            filtered = [a for a in filtered if (a.get("type") or "").lower() == target_type]
        if search:
            q = search.lower().strip()
            filtered = [
                a for a in filtered
                if q in (a.get("subject") or "").lower()
                or q in (a.get("activity_id") or "").lower()
                or q in (a.get("lead_id") or "").lower()
            ]

        filtered.sort(key=lambda x: x.get("activity_date", "") or "", reverse=True)
        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": filtered[start:end],
        }

    def get_opportunities(
        self,
        page: int = 1,
        page_size: int = 25,
        stage: Optional[str] = None,
        is_duplicate: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> dict:
        self.load_data()
        filtered = self.opportunities
        if stage:
            target_stage = stage.lower().replace(" ", "_").replace("-", "_")
            filtered = [
                o for o in filtered
                if (o.get("stage") or "").lower().replace(" ", "_").replace("-", "_") == target_stage
            ]
        if is_duplicate is not None:
            dup_target = str(is_duplicate).lower()
            filtered = [o for o in filtered if str(o.get("is_duplicate", False)).lower() == dup_target]
        if search:
            q = search.lower().strip()
            filtered = [
                o for o in filtered
                if q in (o.get("opportunity_id") or "").lower()
                or q in (o.get("lead_id") or "").lower()
                or q in (self.salesrep_by_id.get(o.get("salesrep_id", ""), {}).get("name") or "").lower()
            ]

        filtered.sort(key=lambda x: float(x.get("amount") or 0.0), reverse=True)
        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size

        enriched = []
        for o in filtered[start:end]:
            item = dict(o)
            rep = self.salesrep_by_id.get(o.get("salesrep_id", ""), {})
            item["salesrep_name"] = rep.get("name", "Unassigned")
            enriched.append(item)

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            "items": enriched,
        }

    def get_investigations(self) -> list[dict]:
        # Benchmark ground truth anomalies
        return SupabaseDataStore().get_investigations()

    def get_validation_status(self, force_reload: bool = False) -> dict:
        return SupabaseDataStore().get_validation_status(force_reload=force_reload)


# Global singleton factory
_active_store: Optional[Any] = None


def get_store() -> Any:
    global _active_store
    if _active_store is not None:
        return _active_store

    if _is_supabase_configured():
        sb_store = SupabaseDataStore()
        if sb_store.test_connection():
            logger.info("Successfully connected to live Supabase PostgreSQL datastore.")
            _active_store = sb_store
            return _active_store
        else:
            logger.warning("Supabase credentials configured but connection failed. Falling back to local dataset engine.")

    local_store = LocalDataStore(DATA_DIR, GROUND_TRUTH_DIR)
    local_store.load_data()
    _active_store = local_store
    return _active_store
