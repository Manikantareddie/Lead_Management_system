"""
YottaFlex Lead Intelligence & Operations Console - FastAPI Backend
Provides RESTful endpoints for metrics, leads, tasks, opportunities, investigations, and validation.
"""

from pathlib import Path
import sys
import time

# Ensure src/ and project root are on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from backend.database import get_store
from backend.config import HOST, PORT

app = FastAPI(
    title="YottaFlex Operations API",
    version="1.0.0",
    description="Enterprise Lead Intelligence & Operations Console Backend"
)

# Enable CORS for local development (Vite frontend on 5173 / 5174 / 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint providing engine status, data path, and system time."""
    store = get_store()
    return {
        "status": "healthy",
        "service": "yottaflex-operations-console",
        "version": "1.0.0",
        "mode": "live_dataset_engine",
        "timestamp": time.time(),
        "record_counts": {
            "leads": len(store.leads),
            "companies": len(store.companies),
            "contacts": len(store.contacts),
            "tasks": len(store.tasks),
            "opportunities": len(store.opportunities),
            "activities": len(store.activities),
            "task_decisions": len(store.task_decisions),
        }
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
