# LMS – Lead Management System
### Lead Intelligence & Operations Console

> **Enterprise Lead Scoring, Routing Governance, Consent Compliance, and Pipeline Analytics**  
> Built to generate, validate, audit, and operate CRM datasets at enterprise scale (**206,609 records across 13 relational tables**), backed by live **Supabase PostgreSQL** and an indexed fallback engine.

---

## 🌐 Live Production Deployments

| Resource | URL | Status |
| :--- | :--- | :--- |
| **Live Web Application** | **[https://smartleadhub.netlify.app](https://smartleadhub.netlify.app)** | ![Netlify Status](https://img.shields.io/badge/Netlify-Live%20Production-success?style=flat&logo=netlify) |
| **Backend API (Render)** | **[https://lead-management-system-qdmd.onrender.com](https://lead-management-system-qdmd.onrender.com)** | ![Render Status](https://img.shields.io/badge/Render-Active-success?style=flat&logo=render) |
| **Interactive API Docs (Swagger)** | **[https://lead-management-system-qdmd.onrender.com/docs](https://lead-management-system-qdmd.onrender.com/docs)** | ![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-blue?style=flat&logo=swagger) |
| **API Health Check** | **[https://lead-management-system-qdmd.onrender.com/health](https://lead-management-system-qdmd.onrender.com/health)** | ![Health](https://img.shields.io/badge/Health-200%20OK-brightgreen?style=flat) |
| **GitHub Repository** | **[https://github.com/Manikantareddie/Lead_Management_system](https://github.com/Manikantareddie/Lead_Management_system)** | ![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=flat&logo=github) |

---

## 🚀 How to Run the Project

Use **Windows PowerShell** and open two terminals in VS Code. In **both** terminals, go to the project folder:
```powershell
cd "C:\Users\pasha\OneDrive\Desktop\yottalexai_project\Lead_Management_system"
```

### Terminal 1: Start the Backend (FastAPI)
Run this in the first terminal and leave it running:
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: Start the Frontend Console (React + Vite)
In the second terminal (also in the project folder), run this and leave it running:
```powershell
npm.cmd --prefix frontend run dev
```

Open the web app at [http://127.0.0.1:5173](http://127.0.0.1:5173). Sign in with a demo account below. To stop either service, press **Ctrl+C** in its terminal.

**Backend links:** [API](http://127.0.0.1:8000) · [Swagger docs](http://127.0.0.1:8000/docs) · [Health check](http://127.0.0.1:8000/api/health)

### Sign-In (Role-Based Access)
All `/api/*` routes (except `/api/health` and `/api/auth/login`) require a bearer token. The console prompts for credentials on load. Default demo accounts:

| Username | Password | Role | Scope |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | `admin` | Full access, including validation runs and investigations |
| `manager` | `manager123` | `manager` | Pipeline, tasks, validation, and investigations |
| `rep` | `rep123` | `sales_rep` | Read + own task updates (no validation/investigations) |

Override the built-in accounts in production via the `AUTH_USERS` environment variable (JSON array of `{"username","password","role","name","salesrep_id"}` objects).

### Verification Commands
```powershell
# Check live Supabase table counts & database status
.\.venv\Scripts\python.exe scripts/migrate_and_seed_supabase.py --check-only

# Run backend automated test suite (98 tests)
.\.venv\Scripts\python.exe -m pytest -q

# Step 10: Verify 100% bitwise reproducibility across runs
.\.venv\Scripts\python.exe scripts/verify_reproducibility.py

# Step 8 & 9: Run 12-engine dataset validation report
.\.venv\Scripts\python.exe scripts/run_validation_report.py

# Production build of frontend
npm.cmd --prefix frontend run build
```

---

## 1. Project Prerequisites & First-Time Setup

### Prerequisites
- Python 3.11+ or 3.12+ with virtual environment (`.venv`)
- Node.js v18+ and npm (tested with Node v22+ / npm 10+)

### First-Time Installation
```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd --prefix frontend ci
```

---

## 2. Supabase PostgreSQL Integration & Migration

YottaFlex integrates with Supabase PostgreSQL as its primary production database while maintaining an offline-capable indexed fallback engine.

### Connecting to Supabase
Set the `DATABASE_URL` environment variable (in Render, local `.env`, or command environment):
```powershell
$env:DATABASE_URL="postgresql://postgres.your_project:your_password@aws-0-region.pooler.supabase.com:6543/postgres"
```
Or specify discrete connection parameters (`SUPABASE_HOST`, `SUPABASE_PORT`, `SUPABASE_DBNAME`, `SUPABASE_USER`, `SUPABASE_PASSWORD`).

### Safe, Idempotent Database Migration & Seed
Run the migration CLI to initialize the PostgreSQL schema and import records:
```powershell
# Verify connection and test schema/data idempotency
python scripts/migrate_to_supabase.py --check-only

# Apply DDL schema and create indexes
python scripts/migrate_to_supabase.py --schema-only

# Complete import of all 13 tables (idempotent ON CONFLICT DO NOTHING)
python scripts/migrate_to_supabase.py --data-dir data/generated_full
```

The migration engine safely imports all 13 tables in strict foreign-key dependency order:
1. `companies` (5,000 rows)
2. `contacts` (10,000 rows)
3. `salesreps` (50 rows)
4. `score_rules` (3 rows)
5. `campaigns` (100 rows)
6. `leads` (20,000 rows)
7. `lead_campaigns` (30,040 rows)
8. `consents` (15,000 rows)
9. `activities` (35,000 rows)
10. `tasks` (25,000 rows)
11. `task_decisions` (38,416 rows)
12. `opportunities` (3,000 rows)
13. `stage_histories` (25,000 rows)

*Total: 206,609 rows.*

> 📘 **Full Data Dictionary & Schema Specification**: See [DATA_DICTIONARY.md](DATA_DICTIONARY.md) for field-by-field definitions, enums, units, uniqueness constraints, and validation rules across all entities.

---

## 3. Production Deployment Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │ Netlify (Vite React 19 Frontend)             │
                  │ - Mobile & Desktop Responsive Design         │
                  │ - SPA Fallback Routing (/* -> /index.html)   │
                  │ - VITE_API_BASE_URL -> Render Backend URL    │
                  └───────────────────────┬──────────────────────┘
                                          │ HTTPS REST API
                                          ▼
                  ┌──────────────────────────────────────────────┐
                  │ Render Web Service (FastAPI Backend)         │
                  │ - High-performance async uvicorn             │
                  │ - Connection Pooling via psycopg 3           │
                  │ - Zero in-memory footprint when on Supabase  │
                  └───────────────────────┬──────────────────────┘
                                          │ Parameterized SQL
                                          ▼
                  ┌──────────────────────────────────────────────┐
                  │ Supabase PostgreSQL (Primary DB)             │
                  │ - 13 Relational Tables & B-Tree Indexes      │
                  │ - Isolated 5 Benchmark Anomaly Tables        │
                  │ - Referential Integrity & Foreign Keys       │
                  └──────────────────────────────────────────────┘
```

### Render Deployment Configuration
- Configured in `render.yaml`.
- Set `DATABASE_URL` in the Render Environment Variables tab to your Supabase Transaction Pooler connection string (`port 6543`).
- Set `AUTH_SECRET` to a long random string (used to HMAC-sign bearer tokens; a dev default is used locally if unset).
- Set `AUTH_USERS` to the production account list (JSON array) if the built-in demo accounts should not be used.
- Set `CORS_ORIGINS` to a comma-separated list of allowed browser origins (e.g. `https://smartleadhub.netlify.app`).
- Service uses `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.

### Netlify Deployment Configuration
- Configured in `netlify.toml`.
- Build command: `npm run build` from base directory `frontend`.
- Set `VITE_API_BASE_URL` in Netlify Site Settings to your Render service URL (e.g. `https://yottaflex-api.onrender.com`).

---

## 4. Key Fixes & Functional Improvements

1. **Supabase as Primary Runtime Database:**
   - Parameterized SQL query execution for search, filters, pagination, score bands, funnel aggregations, and detail 360° joins.
   - Clean connection pooling and error recovery.
   - Offline fallback provider active when database credentials are not present.

2. **Lead Lifecycle Progression & Opportunity Stages:**
   - Valid leads progress through `New` → `Contacted` → `Qualified` → `Converted`.
   - Converted leads generate realistic `closed_won` and `closed_lost` deals without fabricating KPIs.
   - Removed the hardcoded `512` fallback and duplicate opp fallback; both calculate from live records.

3. **Central Territory Filter:**
   - Restored `Central` in the territory filter options alongside `North`, `South`, `East`, and `West`, matching all 3,998 central leads.

4. **Meaningful Task Statuses & End-to-End Task Actions:**
   - Tasks feature a realistic status distribution: `open`, `in_progress`, `completed`, and `cancelled`.
   - Users can update task statuses directly from the Tasks table and from the 360° Lead Detail Drawer.
   - Users can create new follow-up tasks associated with leads via `POST /api/tasks`, persisting to Supabase and recording an audit trail in `task_decisions`.

5. **Lead Scoring Governance:**
   - Raw formula string is hidden from the UI in favor of clean component scorecard cards (Fit 50%, Intent 30%, Engagement 20%), while backend calculation logic is preserved.

6. **Responsive Layout:**
   - Clean responsive navigation with mobile drawer, hamburger toggle on screens ≤1024px, and adaptive stat cards on tablet/mobile.

7. **Artifact Cleanup:**
   - Removed unreferenced Vite placeholder assets (`hero.png`, `react.svg`, `vite.svg`, `App.css`, `icons.svg`).
   - Removed duplicate `data/generated/ground_truth_exceptions.json`, preserving canonical `data/ground_truth/exceptions.json`.

---

## 5. Automated Test Suite

Run the full automated test suite (98 tests, 100% passing):
```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Test breakdown:
- `tests/test_auth.py`: Login success/failure, bearer-token verification, protected-route enforcement, and role-based access control (403 for under-privileged roles).
- `tests/test_backend_api.py`: FastAPI endpoints, health checks, pagination, filters, 360° drawer relationships, investigations, task create/update mutations.
- `tests/test_stage1_regression.py`: Routing governance, consent gating, and decision audit logs.
- `tests/test_business_rules.py`: Score bounds, deduplication, stage transitions, and consent revocation.
- `tests/test_exceptions_and_validation.py`: Clean baseline verification and detection of all 5 benchmark anomaly scenarios.
- `tests/test_generator.py`: Synthetic generator determinism, primary/foreign key integrity, and enum compliance.
- `tests/test_deliverables.py`: Full-scale configurations, JSON deliverables, schema DDL (including `task_decisions`), and SQL seeds.

---

## 6. Security and Compliance Safeguards

1. **Zero Credential Exposure:** Database credentials, passwords, and service-role keys are strictly loaded from environment variables and never exposed in Git, browser code, or API responses.
2. **Least Privilege & Role Safety:** The frontend interacts exclusively through the authenticated backend API; Supabase service-role keys are never sent to the browser.
3. **Authentication & RBAC:** Every `/api/*` route (except health and login) requires an HMAC-SHA256 signed bearer token. Admin-only operations (validation runs, investigations) are enforced server-side via role dependencies and return `403` for under-privileged roles.
4. **Data Quality & Isolation:** Benchmark test anomalies are segregated from production baseline data.
5. **CORS Hardening:** Configured with an explicit allow-list of origins (via `CORS_ORIGINS`) and specific HTTP methods — no wildcard origin reflection.
6. **No Internal Error Leakage:** All unhandled exceptions return a generic message; raw exception text/stack traces are logged server-side only and never returned to clients.

---

## 7. Data Provenance & Lawful Synthetic Generation Statement

In strict adherence to synthetic data governance and lawful use guidelines:
- **100% Synthetic Generation:** All 206,609 records across all 13 relational tables are generated deterministically using the Python standard library with a fixed random seed (`20261022`).
- **Zero Real-World PII / No Scraping:** No web scraping, proprietary customer lists, or confidential personal identifiable information (PII) were harvested or utilized. All contact emails are mapped to the RFC 2606 reserved documentation domain (`@example.com`).
- **Public Reference Inspiration:** Standard public B2B CRM domain concepts (e.g., Lead-to-Opportunity lifecycle models, Fit/Intent/Engagement scoring conventions, and territory routing matrices) were cited solely for structural schema inspiration without replicating copyrighted datasets.
- **Held-Out Anomaly Separation:** The 5 controlled benchmark anomaly scenarios are explicitly isolated in `data/ground_truth/exceptions.json` and never leaked into input features or clean production records.
