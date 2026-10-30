# YottaFlex Lead Intelligence & Operations Console — Data Dictionary

This document specifies the complete data dictionary, relational architecture, and integrity constraints for all 11 core entities, bridge tables, and audit logs within the YottaFlex synthetic CRM operations ecosystem.

---

## 1. Architectural Overview & Entity Cardinalities

| Entity / Table | Primary Key | Foreign Keys / Relationships | Cardinality | Nature |
| :--- | :--- | :--- | :--- | :--- |
| **`companies`** | `company_id` | *None* (Root Master) | `1 : N` with `contacts`, `leads` | Master Entity |
| **`contacts`** | `contact_id` | `company_id` -> `companies` | `N : 1` with `companies`; `1 : N` with `leads`, `consents` | Master Entity |
| **`salesreps`** | `salesrep_id` | *None* (Root Master) | `1 : N` with `leads`, `tasks`, `opportunities`, `campaigns` | Master Entity |
| **`score_rules`** | `score_rule_id`| *None* (Root Configuration) | `1 : N` with `leads` | Configuration |
| **`campaigns`** | `campaign_id` | `owner_id` -> `salesreps` | `N : 1` with `salesreps`; `N : M` with `leads` | Master Entity |
| **`leads`** | `lead_id` | `contact_id` -> `contacts`<br>`company_id` -> `companies`<br>`assigned_salesrep_id` -> `salesreps`<br>`score_rule_id` -> `score_rules`<br>`duplicate_of_lead_id` -> `leads` | `N : 1` with `contacts`, `companies`, `salesreps`; `1 : N` with `activities`, `tasks`, `opportunities` | Transaction / Pipeline |
| **`lead_campaigns`** | `(lead_id, campaign_id)` | `lead_id` -> `leads`<br>`campaign_id` -> `campaigns` | `N : M` Bridge Table | Attribution Bridge |
| **`consents`** | `consent_id` | `contact_id` -> `contacts` | `N : 1` with `contacts` | Append-Only Compliance |
| **`activities`** | `activity_id` | `lead_id` -> `leads`<br>`created_by` -> `salesreps` | `N : 1` with `leads` | Append-Only Event Log |
| **`tasks`** | `task_id` | `lead_id` -> `leads`<br>`assigned_to` -> `salesreps` | `N : 1` with `leads`, `salesreps` | Operations Outreach |
| **`task_decisions`** | `decision_id` | `lead_id` -> `leads`<br>`contact_id` -> `contacts`<br>`assigned_salesrep_id` -> `salesreps`<br>`task_id` -> `tasks` | `N : 1` with `leads`, `tasks` | Append-Only Decision Audit |
| **`opportunities`** | `opportunity_id` | `lead_id` -> `leads`<br>`salesrep_id` -> `salesreps`<br>`duplicate_of_opportunity_id` -> `opportunities` | `N : 1` with `leads`, `salesreps` | Revenue Pipeline |
| **`stage_histories`**| `stage_history_id`| `lead_id` -> `leads`<br>`changed_by` -> `salesreps` | `N : 1` with `leads` | Append-Only Lifecycle Audit |
| **`ground_truth_exceptions`** | `exception_id` | *None* (Referenced in `affected_record_ids`) | Separate Evaluation Set | Benchmark Ground Truth |

---

## 2. ID & Nomenclature Standards

All identifiers are deterministic, immutable, and strictly zero-padded:
- **Companies**: `CO-######` (e.g., `CO-000001`)
- **Contacts**: `CON-######` (e.g., `CON-000001`)
- **Sales Representatives**: `REP-######` (e.g., `REP-000001`)
- **Score Rules**: `SCR-######` (e.g., `SCR-000001`)
- **Campaigns**: `CAMP-######` (e.g., `CAMP-000001`)
- **Leads**: `LEAD-YYYY-######` (e.g., `LEAD-2026-000001`)
- **Consents**: `CSN-######` (e.g., `CSN-000001`)
- **Activities**: `ACT-<lead_id>-###` (e.g., `ACT-LEAD-2026-000001-001`)
- **Tasks**: `TASK-<lead_id>-###` (e.g., `TASK-LEAD-2026-000001-001`)
- **Task Decisions**: `DEC-######` (e.g., `DEC-000001`)
- **Opportunities**: `OPP-YYYY-######` (e.g., `OPP-2026-000001`)
- **Stage Histories**: `SH-######` (e.g., `SH-000001`)
- **Benchmark Exceptions**: `EXC-######` (e.g., `EXC-000001`)

---

## 3. Entity Data Dictionaries

### 3.1 Company (`companies`)
Represents an enterprise business customer or account.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `company_id` | `VARCHAR(32)` | Required | Format: `^CO-\d{6}$` | String | **Primary Key** | Must match regex `CO-\d{6}` |
| `name` | `VARCHAR(255)` | Required | Text | String | Non-Unique | Non-empty string; trimmed |
| `industry` | `VARCHAR(100)` | Optional | `Technology`, `Healthcare`, `Manufacturing`, `Finance`, `Retail` | Enum | Non-Unique | Must be one of the 5 controlled industry sectors |
| `size` | `VARCHAR(50)` | Optional | `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+` | Enum | Non-Unique | Controlled employee headcount tier |
| `country` | `VARCHAR(10)` | Optional | `US`, `CA`, `GB`, `DE`, `AU` | ISO 3166-1 | Non-Unique | 2-letter uppercase country code |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp <= `updated_at` |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |

---

### 3.2 Contact (`contacts`)
Represents an individual prospect or decision-maker at a company.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `contact_id` | `VARCHAR(32)` | Required | Format: `^CON-\d{6}$` | String | **Primary Key** | Must match regex `CON-\d{6}` |
| `company_id` | `VARCHAR(32)` | Optional | Valid `companies.company_id` | Foreign Key | Non-Unique | Must exist in `companies` table if populated |
| `first_name` | `VARCHAR(100)` | Required | Text | String | Non-Unique | Non-empty string |
| `last_name` | `VARCHAR(100)` | Required | Text | String | Non-Unique | Non-empty string |
| `email` | `VARCHAR(255)` | Optional | Valid email format `.*@.*` | String | Non-Unique | Valid email format; normalized for domain extraction |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp <= `updated_at` |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |

---

### 3.3 Sales Representative (`salesreps`)
Represents an internal account representative responsible for territories and product lines.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `salesrep_id` | `VARCHAR(32)` | Required | Format: `^REP-\d{6}$` | String | **Primary Key** | Must match regex `REP-\d{6}` |
| `first_name` | `VARCHAR(100)` | Required | Text | String | Non-Unique | Non-empty string |
| `last_name` | `VARCHAR(100)` | Required | Text | String | Non-Unique | Non-empty string |
| `email` | `VARCHAR(255)` | Required | Valid email format | String | **Unique** | Unique internal representative email |
| `territory` | `VARCHAR(50)` | Required | `North`, `South`, `East`, `West`, `Central` | Enum | Non-Unique | Must be one of the 5 active sales territories |
| `product_specialty` | `VARCHAR(50)` | Required | `Enterprise`, `SMB`, `Mid-Market` | Enum | Non-Unique | Must be one of the 3 product tiers |
| `is_active` | `BOOLEAN` | Required | `true`, `false` | Boolean | Non-Unique | Default `true`; inactive reps cannot receive routing |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp <= `updated_at` |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |

---

### 3.4 Score Rule (`score_rules`)
Configuration definitions for transparent arithmetic scoring features and weights.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `score_rule_id` | `VARCHAR(32)` | Required | Format: `^SCR-\d{6}$` | String | **Primary Key** | Must match regex `SCR-\d{6}` |
| `name` | `VARCHAR(100)` | Required | Text (e.g. `Fit Scoring Rule v1`) | String | Non-Unique | Rule title |
| `component` | `VARCHAR(50)` | Required | `fit`, `intent`, `engagement` | Enum | Non-Unique | One of the 3 scoring components |
| `weight` | `NUMERIC(4, 2)`| Required | `0.00` to `1.00` | Decimal Ratio | Non-Unique | Active weights across components must sum to `1.00` |
| `version` | `INTEGER` | Required | Integer >= 1 | Version | Non-Unique | Monotonically increasing revision |
| `effective_from`| `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Start boundary of rule validity |
| `effective_to` | `TIMESTAMPTZ` | Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Null if rule is currently ongoing |
| `min_score` | `INTEGER` | Required | `0` | Score Points | Non-Unique | Component minimum score |
| `max_score` | `INTEGER` | Required | `100` | Score Points | Non-Unique | Component maximum score |
| `description` | `TEXT` | Optional | Text | String | Non-Unique | Explanatory description |
| `is_active` | `BOOLEAN` | Required | `true`, `false` | Boolean | Non-Unique | Must be `true` for live engine evaluation |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp <= `updated_at` |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |

---

### 3.5 Campaign (`campaigns`)
Inbound and outbound marketing initiatives driving lead attribution.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `campaign_id` | `VARCHAR(32)` | Required | Format: `^CAMP-\d{6}$` | String | **Primary Key** | Must match regex `CAMP-\d{6}` |
| `name` | `VARCHAR(255)` | Required | Text | String | Non-Unique | Non-empty campaign name |
| `type` | `VARCHAR(50)` | Required | `email`, `paid_social`, `event`, `webinar`, `outbound` | Enum | Non-Unique | Controlled marketing channel |
| `start_date` | `DATE` | Required | Format: `YYYY-MM-DD` | Date | Non-Unique | Must be <= `end_date` |
| `end_date` | `DATE` | Required | Format: `YYYY-MM-DD` | Date | Non-Unique | Must be >= `start_date` |
| `budget` | `NUMERIC(12, 2)`| Optional| Decimal >= `0.00` | USD | Non-Unique | Total monetary allocation |
| `owner_id` | `VARCHAR(32)` | Optional | Valid `salesreps.salesrep_id` | Foreign Key | Non-Unique | Must reference valid `salesreps` row if present |
| `status` | `VARCHAR(50)` | Required | `Draft`, `Active`, `Paused`, `Completed`, `Archived` | Enum | Non-Unique | Controlled campaign operational state |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp <= `updated_at` |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |

---

### 3.6 Lead (`leads`)
Core operational entity tracking sales interest, transparent scoring, territory routing, and progression.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `lead_id` | `VARCHAR(32)` | Required | Format: `^LEAD-2026-\d{6}$` | String | **Primary Key** | Must match regex `LEAD-2026-\d{6}` |
| `contact_id` | `VARCHAR(32)` | Required | Valid `contacts.contact_id` | Foreign Key | Non-Unique | Referential integrity enforced |
| `company_id` | `VARCHAR(32)` | Optional | Valid `companies.company_id` | Foreign Key | Non-Unique | Referential integrity enforced |
| `source` | `VARCHAR(50)` | Optional | `website`, `referral`, `outbound`, `event`, `paid_media` | Enum | Non-Unique | Channel source of acquisition |
| `status` | `VARCHAR(50)` | Required | `New`, `Contacted`, `Qualified`, `Converted`, `Disqualified` | Enum | Non-Unique | Sequential lifecycle stage governed by rules |
| `lead_score` | `INTEGER` | Optional | `0` to `100` | Score Points | Non-Unique | Reconciles to `round(0.50*fit + 0.30*intent + 0.20*eng)` |
| `fit_score` | `INTEGER` | Optional | `0` to `100` | Score Points | Non-Unique | Fit component score |
| `intent_score`| `INTEGER` | Optional | `0` to `100` | Score Points | Non-Unique | Intent component score |
| `engagement_score`| `INTEGER`| Optional | `0` to `100` | Score Points | Non-Unique | Engagement component score |
| `scored_at` | `TIMESTAMPTZ` | Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Must be <= `converted_at` (post-conversion freeze) |
| `score_rule_id`| `VARCHAR(32)`| Optional | Valid `score_rules.score_rule_id` | Foreign Key | Non-Unique | Active rule set evaluated |
| `assigned_salesrep_id`| `VARCHAR(32)`| Optional | Valid `salesreps.salesrep_id` | Foreign Key | Non-Unique | Territory & product match required or null |
| `territory` | `VARCHAR(50)` | Optional | `North`, `South`, `East`, `West`, `Central` | Enum | Non-Unique | Operational geography |
| `product_interest`| `VARCHAR(50)`| Optional | `Enterprise`, `SMB`, `Mid-Market` | Enum | Non-Unique | Product capability requested |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Lead submission timestamp |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |
| `converted_at`| `TIMESTAMPTZ` | Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Set only if status is `Converted`; >= `created_at` |
| `duplicate_detection_key`| `TEXT` | Optional | Composite string `domain:company:product:month` | Hash/Key | Non-Unique | Deterministic deduplication evaluation token |
| `is_duplicate`| `BOOLEAN` | Required | `true`, `false` | Boolean | Non-Unique | True if earlier matching canonical lead exists |
| `duplicate_of_lead_id`| `VARCHAR(32)`| Optional | Valid `leads.lead_id` | Foreign Key | Non-Unique | References canonical parent lead |
| `routing_exception`| `BOOLEAN` | Required | `true`, `false` | Boolean | Non-Unique | True if no compatible active rep exists |
| `routing_reason`| `TEXT` | Optional | `no_compatible_salesrep`, etc. | String | Non-Unique | Explicit explanation when rep is unassigned |

---

### 3.7 LeadCampaign (`lead_campaigns`)
Attribution bridge table connecting leads with marketing campaigns (N:M).

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `lead_id` | `VARCHAR(32)` | Required | Valid `leads.lead_id` | Foreign Key | **Composite PK** | Must exist in `leads` table |
| `campaign_id` | `VARCHAR(32)` | Required | Valid `campaigns.campaign_id` | Foreign Key | **Composite PK** | Must exist in `campaigns` table |
| `attributed_at`| `TIMESTAMPTZ`| Required | ISO 8601 UTC timestamp | Time | Non-Unique | Timestamp of campaign touchpoint |
| `is_primary` | `BOOLEAN` | Required | `true`, `false` | Boolean | Non-Unique | Designates primary conversion attribution touch |

---

### 3.8 Consent (`consents`)
Append-only log of channel consent, withdrawal, and expiration for GDPR/TCPA compliance.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `consent_id` | `VARCHAR(32)` | Required | Format: `^CSN-\d{6}$` | String | **Primary Key** | Must match regex `CSN-\d{6}` |
| `contact_id` | `VARCHAR(32)` | Required | Valid `contacts.contact_id` | Foreign Key | Non-Unique | Must exist in `contacts` table |
| `channel` | `VARCHAR(50)` | Required | `email`, `phone`, `sms`, `mail` | Enum | Non-Unique | Communication medium governed |
| `status` | `VARCHAR(50)` | Required | `granted`, `denied`, `withdrawn` | Enum | Non-Unique | Append-only status; records never overwritten |
| `consented_at`| `TIMESTAMPTZ`| Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Timestamp when opt-in was recorded |
| `withdrawn_at`| `TIMESTAMPTZ`| Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Timestamp when opt-out was recorded; >= `consented_at` |
| `expires_at` | `TIMESTAMPTZ`| Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Expiration boundary; > `consented_at` |
| `source` | `VARCHAR(50)` | Optional | `web_form`, `verbal`, `paper` | Enum | Non-Unique | Medium through which consent was acquired |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Record append timestamp |

---

### 3.9 Activity (`activities`)
Append-only history of interactions (calls, emails, meetings, demos) logged for a lead.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `activity_id` | `VARCHAR(64)` | Required | Format: `^ACT-LEAD-2026-\d{6}-\d{3}$` | String | **Primary Key** | Per-lead zero-padded sequential ID |
| `lead_id` | `VARCHAR(32)` | Required | Valid `leads.lead_id` | Foreign Key | Non-Unique | Must exist in `leads` table |
| `type` | `VARCHAR(50)` | Required | `call`, `email`, `meeting`, `demo`, `note`, `linkedin` | Enum | Non-Unique | Controlled interaction type |
| `subject` | `VARCHAR(255)` | Optional | Text | String | Non-Unique | Interaction title |
| `description` | `TEXT` | Optional | Text | String | Non-Unique | Free-form notes |
| `activity_date`| `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Date interaction took place; <= conversion if baseline |
| `duration_minutes`| `INTEGER` | Optional | `5` to `60` | Minutes | Non-Unique | Duration of interaction |
| `outcome` | `VARCHAR(50)` | Optional | `completed`, `scheduled`, `no_answer`, `bounced` | Enum | Non-Unique | Execution outcome |
| `created_by` | `VARCHAR(32)` | Optional | Valid `salesreps.salesrep_id` | Foreign Key | Non-Unique | Sales representative who logged the event |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Append timestamp |

---

### 3.10 Task (`tasks`)
Operational follow-up actions assigned to sales representatives for eligible leads.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `task_id` | `VARCHAR(64)` | Required | Format: `^TASK-LEAD-2026-\d{6}-\d{3}$` | String | **Primary Key** | Per-lead zero-padded sequential ID |
| `lead_id` | `VARCHAR(32)` | Required | Valid `leads.lead_id` | Foreign Key | Non-Unique | Must exist in `leads` table |
| `assigned_to` | `VARCHAR(32)` | Required | Valid `salesreps.salesrep_id` | Foreign Key | Non-Unique | Actionable tasks must have an assigned rep |
| `type` | `VARCHAR(50)` | Required | `call`, `email`, `meeting`, `demo`, `other` | Enum | Non-Unique | Mapped to consent channel (`call`->`phone`, else `email`) |
| `title` | `VARCHAR(255)` | Required | Text | String | Non-Unique | Task objective |
| `description` | `TEXT` | Optional | Text | String | Non-Unique | Operational instructions |
| `due_date` | `DATE` | Required | Format: `YYYY-MM-DD` | Date | Non-Unique | Follow-up deadline |
| `status` | `VARCHAR(50)` | Required | `open`, `in_progress`, `completed`, `cancelled` | Enum | Non-Unique | Controlled task lifecycle |
| `priority` | `VARCHAR(50)` | Required | `low`, `medium`, `high` | Enum | Non-Unique | Derived from `lead_score` (>=70 high, >=40 med, else low) |
| `completed_at`| `TIMESTAMPTZ`| Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Set only if status is `completed`; >= `created_at` |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Consent check evaluated at this timestamp |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |

---

### 3.11 TaskDecision (`task_decisions`)
Immutable audit record explaining whether an outreach candidate was created, rejected, or deferred.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `decision_id` | `VARCHAR(32)` | Required | Format: `^DEC-\d{6}$` | String | **Primary Key** | Monotonic audit sequence |
| `lead_id` | `VARCHAR(32)` | Required | Valid `leads.lead_id` | Foreign Key | Non-Unique | Target lead evaluated |
| `contact_id` | `VARCHAR(32)` | Optional | Valid `contacts.contact_id` | Foreign Key | Non-Unique | Target contact |
| `task_type` | `VARCHAR(50)` | Required | `call`, `email`, `meeting`, `demo`, `other` | Enum | Non-Unique | Requested outreach type |
| `channel` | `VARCHAR(50)` | Required | `email`, `phone` | Enum | Non-Unique | Required consent channel evaluated |
| `decision` | `VARCHAR(50)` | Required | `created`, `rejected`, `deferred` | Enum | Non-Unique | Governance decision outcome |
| `reason` | `TEXT` | Required | `eligible`, `duplicate_lead_prohibited`, `low_score`, `no_compatible_salesrep`, `no_valid_consent` | Enum/Text | Non-Unique | Traceable business rule explanation |
| `evaluated_at`| `TIMESTAMPTZ`| Required | ISO 8601 UTC timestamp | Time | Non-Unique | Timestamp of governance gate evaluation |
| `consent_status_at_evaluation`| `VARCHAR(50)`| Optional| `granted`, `withdrawn`, `expired`, `denied`, `none` | Enum | Non-Unique | Snapshot of contact consent state at evaluation time |
| `lead_score` | `INTEGER` | Optional | `0` to `100` | Score Points | Non-Unique | Lead score snapshot at evaluation time |
| `assigned_salesrep_id`| `VARCHAR(32)`| Optional| Valid `salesreps.salesrep_id`| Foreign Key | Non-Unique | Rep assignment state at evaluation time |
| `task_id` | `VARCHAR(64)` | Optional | Valid `tasks.task_id` | Foreign Key | Non-Unique | Linked task if decision was `created`, null otherwise |

---

### 3.12 Opportunity (`opportunities`)
Pipeline deals tracking contract value, revenue forecast, and sales stage progression.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `opportunity_id`| `VARCHAR(32)` | Required | Format: `^OPP-2026-\d{6}$` | String | **Primary Key** | Must match regex `OPP-2026-\d{6}` |
| `lead_id` | `VARCHAR(32)` | Required | Valid `leads.lead_id` | Foreign Key | Non-Unique | Must originate from a qualified or converted lead |
| `salesrep_id` | `VARCHAR(32)` | Required | Valid `salesreps.salesrep_id` | Foreign Key | Non-Unique | Assigned deal executive |
| `stage` | `VARCHAR(50)` | Required | `discovery`, `qualification`, `proposal`, `negotiation`, `closed_won`, `closed_lost` | Enum | Non-Unique | Deal progression state |
| `amount` | `NUMERIC(14, 2)`| Optional| `$5,000.00` to `$500,000.00` | USD | Non-Unique | Deal value |
| `currency` | `VARCHAR(10)` | Required | `USD` | ISO 4217 | Non-Unique | Contract currency denomination |
| `close_date` | `DATE` | Optional | Format: `YYYY-MM-DD` | Date | Non-Unique | Forecast or actual close date |
| `won_lost_reason`| `VARCHAR(100)`| Optional| `budget_approved`, `decision_maker_aligned`, `competitive_win`, `competitor`, `budget`, `timing`, `no_decision` | Enum/Text | Non-Unique | Populated only for terminal stages (`closed_won`/`closed_lost`) |
| `competitor` | `VARCHAR(100)`| Optional| Text / null | String | Non-Unique | Competitor name if lost or contested |
| `is_duplicate`| `BOOLEAN` | Required | `true`, `false` | Boolean | Non-Unique | Flagged if originating from a duplicate lead |
| `duplicate_of_opportunity_id`| `VARCHAR(32)`| Optional| Valid `opportunities.opportunity_id` | Foreign Key | Non-Unique | References canonical parent opportunity |
| `duplicate_detection_key`| `TEXT` | Optional | Text | String | Non-Unique | Inherited duplicate detection token |
| `created_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Opportunity creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Valid UTC timestamp >= `created_at` |
| `closed_at` | `TIMESTAMPTZ` | Optional | ISO 8601 UTC timestamp | Time | Non-Unique | Populated only if stage is `closed_won` or `closed_lost` |

---

### 3.13 StageHistory (`stage_histories`)
Append-only log capturing every lifecycle stage transition for auditing and progression velocity.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `stage_history_id`| `VARCHAR(32)`| Required | Format: `^SH-\d{6}$` | String | **Primary Key** | Monotonic sequential ID |
| `lead_id` | `VARCHAR(32)` | Required | Valid `leads.lead_id` | Foreign Key | Non-Unique | Target lead |
| `from_stage` | `VARCHAR(50)` | Optional | `New`, `Contacted`, `Qualified`, null | Enum | Non-Unique | Null for initial lead creation; never terminal |
| `to_stage` | `VARCHAR(50)` | Required | `New`, `Contacted`, `Qualified`, `Converted`, `Disqualified` | Enum | Non-Unique | Sequential next stage governed by transition matrix |
| `changed_by` | `VARCHAR(32)` | Optional | Valid `salesreps.salesrep_id` | Foreign Key | Non-Unique | Actor who executed the transition |
| `changed_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Monotonically increasing transition timestamp |
| `reason` | `TEXT` | Optional | Text | String | Non-Unique | Transition rationale or rule explanation |

---

### 3.14 Ground Truth Exceptions (`ground_truth_exceptions`)
Controlled benchmark exceptions kept strictly separate from the clean baseline for evaluator auditing.

| Field Name | Type | Req/Opt | Allowed Values / Enums | Units | Uniqueness | Validation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `exception_id`| `VARCHAR(32)`| Required | Format: `^EXC-\d{6}$` | String | **Primary Key** | Identifier (`EXC-000001` through `EXC-000005`) |
| `issue_type` | `VARCHAR(100)`| Required | `opted_out_lead_contacted`, `score_influenced_post_conversion`, `lead_assigned_outside_territory`, `duplicate_opportunity`, `stage_history_gap` | Enum | Non-Unique | One of the 5 required assessment anomaly scenarios |
| `affected_record_ids`| `TEXT`| Required | Comma-delimited list of IDs | String | Non-Unique | Specific records injected with the exception |
| `expected_outcome`| `TEXT` | Required | Explanatory text | String | Non-Unique | Specification of expected validator detection |
| `injected_at` | `TIMESTAMPTZ` | Required | ISO 8601 UTC timestamp | Time | Non-Unique | Effective timestamp of injected edge case |

---

## 4. Referential Integrity & Validation Rules Matrix

1. **Foreign Key Integrity**: Every foreign key is either `NULL` (when optional) or matches an existing primary key in the parent table.
2. **Deterministic Composite Scoring**: `lead_score` is strictly bounded between `0` and `100` and calculated via `round(0.50 * fit + 0.30 * intent + 0.20 * engagement)`.
3. **Score Freeze on Conversion**: A lead's score is immutable once status reaches `Converted`. Any activities logged after `converted_at` are rejected from score recalculation.
4. **Consent-Gated Outreach**: An outreach task is prohibited (`decision = 'rejected'`, `reason = 'no_valid_consent'`) if the contact lacks an active `granted` consent record on the required channel at the scheduled task timestamp.
5. **Territory Routing Governance**: A lead is routed to a sales representative only if both `territory` and `product_specialty` match. When no match exists, the lead is held in an unassigned state (`routing_exception = true`, `routing_reason = 'no_compatible_salesrep'`).
6. **Deduplication Quarantine**: Leads flagged as duplicate (`is_duplicate = true`) cannot receive actionable follow-up tasks (`reason = 'duplicate_lead_prohibited'`) and cannot spawn opportunities.
7. **Append-Only History**: `consents`, `activities`, `stage_histories`, and `task_decisions` are append-only. History records are never deleted or modified in place.

