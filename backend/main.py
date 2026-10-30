"""
YottaFlex Lead Intelligence & Operations Console - FastAPI Backend
Provides RESTful endpoints for metrics, leads, tasks, opportunities, investigations, and validation.
"""

from pathlib import Path
import sys
import time
from typing import Optional

# Ensure src/ and project root are on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.database import get_store
from backend.config import HOST, PORT

app = FastAPI(
    title="YottaFlex Operations API",
    version="1.0.0",
    description="Enterprise Lead Intelligence & Operations Console Backend"
)

# Enable CORS for local development and deployed frontend (Netlify, Render, local Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "https://smartleadhub.netlify.app",
    ],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskCreateRequest(BaseModel):
    lead_id: str
    type: str = "email"
    title: str = "Follow-up outreach"
    description: Optional[str] = ""
    due_date: Optional[str] = None
    priority: str = "medium"
    status: str = "open"
    assigned_to: Optional[str] = None


class TaskUpdateRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None


class StageTransitionRequest(BaseModel):
    to_stage: str
    changed_by: Optional[str] = None
    reason: Optional[str] = None


@app.get("/")
@app.head("/")
@app.get("/health")
@app.head("/health")
@app.get("/api/health")
def health_check():
    """Health check endpoint providing engine status, active datastore mode, and system time."""
    store = get_store()
    counts = store.get_record_counts()
    return {
        "status": "healthy",
        "service": "yottaflex-operations-console",
        "version": "1.0.0",
        "mode": getattr(store, "mode", "live_dataset_engine"),
        "timestamp": time.time(),
        "record_counts": counts,
    }


@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    """Returns high-level KPI metrics, pipeline summaries, and stage breakdowns."""
    store = get_store()
    return store.get_dashboard_summary()


@app.get("/api/leads")
def get_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    stage: Optional[str] = None,
    territory: Optional[str] = None,
    score_band: Optional[str] = None,
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    is_duplicate: Optional[bool] = None,
):
    """Server-side paginated, filterable, and searchable leads list."""
    store = get_store()
    return store.get_leads(
        page=page,
        page_size=page_size,
        search=search,
        stage=stage,
        territory=territory,
        score_band=score_band,
        sort_by=sort_by,
        sort_order=sort_order,
        is_duplicate=is_duplicate,
    )


@app.get("/api/leads/{lead_id}")
def get_lead_details(lead_id: str):
    """Returns 360-degree comprehensive profile for an individual lead."""
    store = get_store()
    details = store.get_lead_details(lead_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Lead '{lead_id}' not found")
    return details


@app.post("/api/leads/{lead_id}/transition")
def transition_lead_stage(lead_id: str, req: StageTransitionRequest):
    """Executes a rule-governed lifecycle stage transition, updates lead status, and appends to stage_histories."""
    store = get_store()
    try:
        result = store.transition_lead_stage(
            lead_id=lead_id,
            to_stage=req.to_stage,
            changed_by=req.changed_by,
            reason=req.reason,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tasks")
def get_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
):
    """Paginated task outreach listing with status, priority, and text search."""
    store = get_store()
    return store.get_tasks(
        page=page,
        page_size=page_size,
        status=status,
        task_type=task_type,
        priority=priority,
        search=search,
    )


@app.post("/api/tasks")
def create_task(req: TaskCreateRequest):
    """Creates a new follow-up task associated with a lead and logs audit telemetry."""
    store = get_store()
    try:
        new_task = store.create_task(req.model_dump())
        return new_task
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, req: TaskUpdateRequest):
    """Updates status, priority, or details of a task and persists changes."""
    store = get_store()
    updated = store.update_task(task_id, {k: v for k, v in req.model_dump().items() if v is not None})
    if not updated:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")
    return updated


@app.get("/api/activities")
def get_activities(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    activity_type: Optional[str] = None,
    search: Optional[str] = None,
):
    """Paginated sales activity history with activity type and text search."""
    store = get_store()
    return store.get_activities(
        page=page,
        page_size=page_size,
        activity_type=activity_type,
        search=search,
    )


@app.get("/api/opportunities")
def get_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    stage: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    search: Optional[str] = None,
):
    """Paginated pipeline opportunity records with duplicate indicators and search."""
    store = get_store()
    return store.get_opportunities(
        page=page,
        page_size=page_size,
        stage=stage,
        is_duplicate=is_duplicate,
        search=search,
    )


@app.get("/api/analytics/stages")
def get_stage_analytics():
    """Returns lifecycle stage progression and conversion metrics."""
    store = get_store()
    summary = store.get_dashboard_summary()
    return {
        "stage_distribution": summary["stage_distribution"],
        "funnel_progression": [
            {"stage": "New", "count": summary["stage_distribution"].get("New", 0)},
            {"stage": "Contacted", "count": summary["stage_distribution"].get("Contacted", 0)},
            {"stage": "Qualified", "count": summary["stage_distribution"].get("Qualified", 0)},
            {"stage": "Converted", "count": summary["stage_distribution"].get("Converted", 0)},
            {"stage": "Disqualified", "count": summary["stage_distribution"].get("Disqualified", 0)},
        ]
    }


@app.get("/api/analytics/territories")
def get_territory_analytics():
    """Returns territory volume distribution and rep allocation."""
    store = get_store()
    summary = store.get_dashboard_summary()
    return {
        "territory_distribution": summary["territory_distribution"],
        "total_salesreps": summary["total_salesreps"],
    }


@app.get("/api/investigations")
def get_investigations():
    """Returns forensic audit logs for all 5 required assessment anomaly scenarios."""
    store = get_store()
    return store.get_investigations()


@app.get("/api/validation/status")
def get_validation_status():
    """Returns dataset verification status and metadata deliverables."""
    store = get_store()
    return store.get_validation_status()


@app.post("/api/validation/run")
def run_validation():
    """Executes on-demand verification against current active dataset."""
    store = get_store()
    return store.get_validation_status(force_reload=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)
