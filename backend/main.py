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

from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

logger = logging.getLogger("api")

from backend.database import get_store
from backend.config import HOST, PORT, CORS_ORIGINS
from backend.auth import (
    authenticate,
    create_access_token,
    decode_access_token,
    public_user,
    require_roles,
)
from business.stages import BUYING_DECISION_STAGE

app = FastAPI(
    title="YottaFlex Operations API",
    version="1.0.0",
    description="Enterprise Lead Intelligence & Operations Console Backend"
)

# Enable CORS for the deployed frontend and local development only.
# Additional origins can be supplied via the CORS_ORIGINS env var (comma-separated).
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
    "https://smartleadhub.netlify.app",
]
_env_origins = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
ALLOWED_ORIGINS = sorted(set(_DEFAULT_ORIGINS + _env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths reachable without authentication (health checks and the login endpoint).
_PUBLIC_PATHS = {"/", "/health", "/api/health", "/api/auth/login", "/docs", "/redoc", "/openapi.json"}


@app.middleware("http")
async def authentication_middleware(request: Request, call_next):
    """Require a valid bearer token for all /api/* routes except the public allow-list."""
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if path.startswith("/api") and path not in _PUBLIC_PATHS:
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required. Please sign in."},
            )
        claims = decode_access_token(header[len("Bearer "):].strip())
        if not claims:
            return JSONResponse(
                status_code=401,
                content={"detail": "Your session has expired. Please sign in again."},
            )
        request.state.user = claims
    return await call_next(request)


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(req: LoginRequest):
    """Exchange valid credentials for a signed bearer token."""
    user = authenticate(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token, expires_at = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at,
        "user": public_user(user),
    }


@app.get("/api/auth/me")
def get_me(request: Request):
    """Return the profile of the currently authenticated user."""
    claims = getattr(request.state, "user", None)
    if not claims:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in.")
    return {
        "username": claims.get("sub"),
        "display_name": claims.get("display_name"),
        "role": claims.get("role"),
        "salesrep_id": claims.get("salesrep_id"),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again."},
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


class ActivityCreateRequest(BaseModel):
    lead_id: str
    type: str = "call"
    subject: Optional[str] = ""
    description: Optional[str] = ""
    activity_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    outcome: Optional[str] = None
    created_by: Optional[str] = None


class OpportunityDecisionRequest(BaseModel):
    # One of: "bought", "decision_pending", "lost".
    decision: str
    reason: Optional[str] = None
    # Required when the decision is "decision_pending": the deal stays active
    # until the customer decides, so the next follow-up must be scheduled.
    next_follow_up_title: Optional[str] = None
    next_follow_up_type: Optional[str] = "call"
    next_follow_up_due_date: Optional[str] = None
    next_follow_up_priority: Optional[str] = "medium"


class StageTransitionRequest(BaseModel):
    to_stage: str
    changed_by: Optional[str] = None
    reason: Optional[str] = None


class LeadCreateRequest(BaseModel):
    first_name: str
    last_name: Optional[str] = ""
    email: Optional[str] = ""
    company_name: str
    source: Optional[str] = "Manual"
    product_interest: Optional[str] = "SMB"
    territory: Optional[str] = "North"
    assigned_salesrep_id: Optional[str] = None


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
    assigned_salesrep_id: Optional[str] = None,
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
        assigned_salesrep_id=assigned_salesrep_id,
    )


@app.post("/api/leads")
def create_lead(req: LeadCreateRequest):
    """Creates a lead from a manual entry, reusing an existing company/contact when possible."""
    store = get_store()
    try:
        return store.create_lead(req.model_dump())
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error("Lead creation failed for %s: %s", req.company_name, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to create the lead. Please try again.")


@app.get("/api/salesreps")
def get_salesreps():
    """Returns the sales representatives available for lead ownership."""
    store = get_store()
    return store.get_salesreps()


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
        logger.error("Lead transition failed for %s: %s", lead_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to complete the stage transition. Please try again.")


@app.get("/api/tasks")
def get_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    due: Optional[str] = None,
):
    """Paginated follow-up listing with status, priority, due-window, and text search."""
    store = get_store()
    return store.get_tasks(
        page=page,
        page_size=page_size,
        status=status,
        task_type=task_type,
        priority=priority,
        search=search,
        due=due,
    )


@app.post("/api/tasks")
def create_task(req: TaskCreateRequest):
    """Creates a new follow-up task associated with a lead and logs audit telemetry."""
    store = get_store()
    try:
        new_task = store.create_task(req.model_dump())
        return new_task
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error("Task creation failed for lead %s: %s", req.lead_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to create the follow-up task. Please try again.")


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


@app.post("/api/activities")
def create_activity(req: ActivityCreateRequest):
    """Record a sales activity. Activities are informational and never advance the lead's sales stage."""
    store = get_store()
    try:
        return store.create_activity(req.model_dump())
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error("Activity creation failed for lead %s: %s", req.lead_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to record the activity. Please try again.")


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


@app.post("/api/opportunities/{opportunity_id}/decision")
def decide_opportunity(opportunity_id: str, req: OpportunityDecisionRequest):
    """Record a buying decision: Bought, Lost, or Decision Pending.

    Decision Pending keeps the deal active and requires a scheduled follow-up so
    the representative does not lose the thread while the customer decides.
    """
    if req.decision not in BUYING_DECISION_STAGE:
        raise HTTPException(status_code=400, detail="Choose a buying decision: bought, decision pending, or lost.")

    next_follow_up = None
    if req.decision == "decision_pending":
        if not (req.next_follow_up_title and req.next_follow_up_title.strip()):
            raise HTTPException(
                status_code=400,
                detail="A deal awaiting the customer's decision needs a scheduled follow-up.",
            )
        next_follow_up = {
            "type": req.next_follow_up_type or "call",
            "title": req.next_follow_up_title.strip(),
            "due_date": req.next_follow_up_due_date,
            "priority": req.next_follow_up_priority or "medium",
            "status": "open",
        }

    store = get_store()
    try:
        result = store.decide_opportunity(
            opportunity_id,
            req.decision,
            reason=req.reason,
            next_follow_up=next_follow_up,
        )
    except Exception as e:
        logger.error("Buying decision failed for opportunity %s: %s", opportunity_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to record the buying decision. Please try again.")
    if not result:
        raise HTTPException(status_code=404, detail="That deal could not be found.")
    return result


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


@app.get("/api/analytics/pipeline")
def get_pipeline_analytics():
    """Returns per-stage deal counts and values that power the visual pipeline board."""
    store = get_store()
    return {"stages": store.get_pipeline_analytics()}


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


@app.post("/api/validation/run", dependencies=[Depends(require_roles("admin", "manager"))])
def run_validation():
    """Executes on-demand verification against current active dataset (admin/manager only)."""
    store = get_store()
    return store.get_validation_status(force_reload=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)
