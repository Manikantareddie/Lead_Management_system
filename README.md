# YottaFlex Lead Intelligence & Operations Console

Enterprise lead scoring, routing governance, consent compliance, and sales operations console built to generate, validate, audit, and operate synthetic CRM datasets at enterprise scale (206,609 records across 13 relational tables), backed by Supabase PostgreSQL and an indexed local fallback engine.

---

## 🚀 How to Run the Project

### Terminal 1: Start the Backend (FastAPI)
Run this command from the project root:
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Backend API URL:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### Terminal 2: Start the Frontend Console (React + Vite)
In a **second terminal**, run:
```powershell
cd frontend
npm run dev
```
*(Or from the project root: `npm.cmd --prefix frontend run dev`)*
- **Web App Console:** [http://localhost:5173](http://localhost:5173)

### Verification Commands
```powershell
# Check live Supabase table counts & database status
.\.venv\Scripts\python.exe scripts/migrate_and_seed_supabase.py --check-only

# Run backend automated test suite (87 tests)
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
3. `salesreps` (100 rows)
4. `score_rules` (3 rows)
5. `campaigns` (20 rows)
6. `leads` (20,000 rows)
7. `lead_campaigns` (29,974 rows)
8. `consents` (12,190 rows)
9. `activities` (60,000 rows)
10. `tasks` (25,000 rows)
11. `task_decisions` (38,416 rows)
12. `opportunities` (3,000 rows)
13. `stage_histories` (2,906 rows)

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

Run the full automated test suite (87 tests, 100% passing):
```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Test breakdown:
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
3. **Data Quality & Isolation:** Benchmark test anomalies are segregated from production baseline data.
4. **CORS Hardening:** Configured with specific allowable origins and HTTP methods.

---

## 7. Data Provenance & Lawful Synthetic Generation Statement

In strict adherence to synthetic data governance and lawful use guidelines:
- **100% Synthetic Generation:** All 206,609 records across all 13 relational tables are generated deterministically using the Python standard library with a fixed random seed (`20261022`).
- **Zero Real-World PII / No Scraping:** No web scraping, proprietary customer lists, or confidential personal identifiable information (PII) were harvested or utilized. All contact emails are mapped to the RFC 2606 reserved documentation domain (`@example.com`).
- **Public Reference Inspiration:** Standard public B2B CRM domain concepts (e.g., Lead-to-Opportunity lifecycle models, Fit/Intent/Engagement scoring conventions, and territory routing matrices) were cited solely for structural schema inspiration without replicating copyrighted datasets.
- **Held-Out Anomaly Separation:** The 5 controlled benchmark anomaly scenarios are explicitly isolated in `data/ground_truth/exceptions.json` and never leaked into input features or clean production records.
