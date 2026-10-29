# YottaFlex Lead Intelligence & Operations Console

Enterprise lead scoring, routing governance, consent compliance, and sales operations console built to generate, validate, audit, and operate synthetic CRM datasets at enterprise scale (168,193+ records).

---

======================================================
## 1. Quick Start: Launching the Application

### Prerequisites
- Python 3.14+ with local virtual environment (`.venv`)
- Node.js v18+ and npm (tested with Node v24.15.0 / npm 11.12.1)

### First-time setup
Run these commands from the project root:
```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install fastapi uvicorn
npm.cmd --prefix frontend ci
```

### Start the Backend API (FastAPI)
In one terminal, from the project root:
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

- **Backend API URL:** `http://127.0.0.1:8000`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`

### Start the Frontend Console (React + Vite)
In a second terminal, from the project root:
```powershell
npm.cmd --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

Open the **Local** URL printed by Vite (normally `http://127.0.0.1:5173/`). If that port is already in use, Vite automatically selects another port and prints its URL. Stop either server with `Ctrl+C` in its terminal.

---

## 2. System Architecture

```
yottaflex-lead-management/
├── backend/                  # FastAPI Application & Dual Data Store
│   ├── config.py             # Server settings & dataset path definitions
│   ├── database.py           # In-memory indexed datastore (168k rows) & Supabase connector
│   └── main.py               # REST API endpoints & CORS middleware
├── frontend/                 # React 19 + TypeScript + Vite Console
│   ├── src/
│   │   ├── components/       # Enterprise UI components (Sidebar, Header)
│   │   ├── services/api.ts   # Type-safe API client
│   │   ├── types.ts          # Complete TypeScript domain contracts
│   │   ├── views/            # Operational Console Views:
│   │   │   ├── DashboardView.tsx       # KPI metrics & distribution charts
│   │   │   ├── LeadsView.tsx           # Search, stage/territory filters, pagination
│   │   │   ├── LeadDetailDrawer.tsx    # 360° lead drawer with scoring, routing & audit tabs
│   │   │   ├── TasksView.tsx           # Cadence tasks & logged prospect activity
│   │   │   ├── PipelineView.tsx        # Opportunity stages & deduplication audit
│   │   │   ├── InvestigationsView.tsx  # Forensic audit for 5 benchmark anomalies
│   │   │   └── DataQualityView.tsx     # CSV validation status & run engine
│   │   └── index.css         # Enterprise design tokens (calm slate/navy light-first theme)
├── data/
│   ├── generated_full/       # Full-scale dataset (168,193 rows across 12 CSV tables)
│   ├── generated/            # Baseline starter dataset
│   └── ground_truth/         # Injected benchmark anomalies (exceptions.json, exceptions.csv)
├── sql/
│   ├── schema.sql            # PostgreSQL DDL with foreign keys and check constraints
│   └── seed.sql              # Dependency-ordered SQL seed dataset
├── src/                      # Core Business Logic & Data Engine
│   ├── business/             # Scoring arithmetic, deduplication, routing, consent
│   ├── generator/            # Synthetic data generation and export routines
│   └── validation/           # Referential integrity & anomaly validation engine
└── tests/                    # 86 Automated Pytest Tests (100% Passing)
    ├── test_backend_api.py   # FastAPI endpoint tests (health, pagination, filters, drawer)
    ├── test_business_rules.py
    ├── test_deliverables.py
    ├── test_exceptions_and_validation.py
    ├── test_generator.py
    └── test_stage1_regression.py
```

---

## 3. Operations Console Features

### A. Operations Overview Dashboard
- High-level KPIs: Total Leads (20,000), Active Tasks (25,000), Pipeline Value ($30.1M across 3,000 opportunities), Average Lead Score (57.1).
- Lifecycle Stage Funnel: Visualizes progression (`New` → `Contacted` → `Qualified` → `Converted` / `Disqualified`).
- Score Distribution Bands: Categorized into Enterprise Hot (80+), Warm (60-79), Moderate (40-59), and Cold (<40).
- Territory Breakdown: North, South, East, West volume and rep allocation.
- Quick navigation shortcuts into Leads Explorer and Anomaly Investigations.

### B. Leads Explorer & 360° Lead Drawer
- Search across contact names, emails, and company names.
- Filter by Lifecycle Stage (`New`, `Contacted`, `Qualified`, `Converted`, `Disqualified`), Territory (`North`, `South`, `East`, `West`), and Duplicate status.
- Sortable table columns with bounded pagination (25 records/page).
- **360° Lead Detail Drawer:**
  - **Overview Tab:** Contact profile, company firmographics, and formulaic score breakdown (`Lead Score = 0.50*Fit + 0.30*Intent + 0.20*Engagement`).
  - **Routing Tab:** Assigned sales representative, product specialty match, territory match, and routing exception explanations.
  - **Consent Tab:** Channel-specific consent status (`email`, `phone`), consent timestamps, withdrawal logs, and expiration dates.
  - **Stage History Tab:** Chronological progression audit trail with transition timestamps and reasons.
  - **Decision Audit Tab:** Telemetry from `task_decisions` logging candidate task evaluations (`created`, `rejected`, `deferred`).

### C. Tasks & Activities Management
- Operational outreach tasks with status (`Pending`, `In Progress`, `Completed`, `Overdue`, `Cancelled`) and priority filtering.
- Activity log for sales cadence interactions (`Call`, `Email`, `Meeting`, `Demo`, `Note`) with logged outcomes and call durations.
- Direct link to inspect the associated lead in the 360° drawer.

### D. Revenue Pipeline & Opportunities
- Pipeline deal tracking by stage (`Discovery`, `Proposal`, `Negotiation`, `Closed-Won`, `Closed-Lost`).
- Deduplication filter to isolate duplicate opportunities created from duplicate leads.
- Full contract values and target close dates.

### E. Data Quality & Anomaly Investigations (Assessment Benchmark)
Forensic audit view for the **5 required assessment anomaly scenarios**:
1. `opted_out_lead_contacted`: Outbound task scheduled after consent withdrawal.
2. `score_influenced_post_conversion`: Score recalculated after conversion timestamp.
3. `lead_assigned_outside_territory`: Cross-territory assignment without exception flag.
4. `duplicate_opportunity`: Inflated pipeline opportunity from duplicate lead.
5. `stage_history_gap`: Discontinuous lifecycle progression in stage audit history.

*Each investigation card provides: issue classification, severity, detailed description, triggering business rule, forensic structured payload, exact SQL detection query, recommended operational next steps, and a direct button to inspect the affected lead.*

### F. Dataset Integrity & Validation Reports
- Live report on dataset referential integrity (zero errors, zero warnings across 168k records).
- Interactive **"Trigger Full Dataset Validation"** action button.
- Comprehensive inventory of all 12 CSV deliverable tables and SQL schemas.

---

## 4. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check, mode indicator, and active record counts |
| `GET` | `/api/dashboard/summary` | Aggregate metrics, score bands, stage/territory distributions |
| `GET` | `/api/leads` | Paginated lead explorer (params: `page`, `page_size`, `search`, `stage`, `territory`, `sort_by`, `sort_order`, `is_duplicate`) |
| `GET` | `/api/leads/{lead_id}` | Full 360° lead profile with company, contact, rep, tasks, activities, opps, consent, and audit records |
| `GET` | `/api/tasks` | Paginated tasks listing with `status`, `task_type`, `priority` filters |
| `GET` | `/api/activities` | Paginated sales activity log with `activity_type` filter |
| `GET` | `/api/opportunities` | Paginated pipeline deals with `stage` and `is_duplicate` filters |
| `GET` | `/api/analytics/stages` | Lifecycle stage funnel distribution |
| `GET` | `/api/analytics/territories`| Territory lead volume and sales rep allocations |
| `GET` | `/api/investigations` | Forensic anomaly audit logs for 5 benchmark scenarios |
| `GET` | `/api/validation/status` | Dataset integrity verification status |
| `POST`| `/api/validation/run` | Execute on-demand verification against active dataset |

---

## 5. Automated Testing & Verification

Run the complete test suite (86 passing tests):
```powershell
.venv\Scripts\python.exe -m pytest -v
```

Test breakdown:
- `tests/test_backend_api.py`: 8 tests covering health, dashboard calculations, pagination, filtering, 404 handling, 360° drawer relationships, investigations, and validation endpoints.
- `tests/test_stage1_regression.py`: 14 tests for routing governance, consent gating, and decision audit logs.
- `tests/test_business_rules.py`: 10 tests for score clamping, deduplication, stage transitions, and consent revocation.
- `tests/test_exceptions_and_validation.py`: 8 tests verifying baseline dataset validity and detection of all 5 injected benchmark anomalies.
- `tests/test_generator.py`: 42 tests verifying schema formats, primary key uniqueness, foreign key integrity, and determinism.
- `tests/test_deliverables.py`: 4 tests verifying scale configurations, JSON exports, and SQL DDL.

---

## 6. Security and Compliance Safeguards

1. **Zero Database Credential Leaks:** No database passwords or private API keys are committed or exposed to the client. `.env.example` is provided with placeholders only.
2. **Dual-Mode Data Architecture:** The backend features a dual data access architecture. When Supabase environment variables are provided, it can connect via PostgreSQL; otherwise, it automatically operates on an in-memory indexed representation of the 168k full-scale CSV dataset with sub-15ms query latency and zero risk of database mutation.
3. **Read-Only Operations:** The console is designed as a read-only operational intelligence and audit system to prevent accidental data modification during assessment evaluations.
4. **Consent Safeguards:** Consent status is explicitly tracked and displayed. Outbound outreach tasks to opted-out contacts are flagged as regulatory violations (`opted_out_lead_contacted`).
5. **CORS Configuration:** Explicitly configured to allow local frontend origins (`http://localhost:5173`, `http://127.0.0.1:5173`).
