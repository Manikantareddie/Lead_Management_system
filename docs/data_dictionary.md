# Data Dictionary

## Status
This draft covers the 11 required entities: Company, Contact, Lead, Campaign, Activity, Consent, ScoreRule, SalesRep, Task, Opportunity, StageHistory.

## Source-of-truth distinction
- **[ASSESSMENT]** = required by the assessment problem statement (workflows, entity list, and exact ID conventions below).
- **[PROPOSED]** = schema design choice made to satisfy the assessment; not mandated by the assessment and subject to confirmation.
- **[UNRESOLVED]** = deliberately left open because the assessment is silent; must be confirmed before implementation. Items that block the generator are flagged as [GENERATOR BLOCKER].

The assessment explicitly requires these workflows: lead scoring using fit/intent/engagement, deduplication, consent checks, territory/product routing, follow-up tasks, opportunities, won/lost reasons, and stage history.

## Exact ID conventions ([ASSESSMENT])
Preserved exactly as specified. `N` denotes a zero-padded numeric sequence.

| Entity | ID format | Example |
|---|---|---|
| Company | `CO-` + 6-digit zero-padded sequence | `CO-000001` |
| Contact | `CON-` + 6-digit zero-padded sequence | `CON-000001` |
| Lead | `LEAD-<year>-` + 6-digit zero-padded sequence | `LEAD-2026-000001` |
| Activity | `ACT-<lead-id>-` + 3-digit zero-padded per-lead sequence | `ACT-LEAD-2026-000001-001` |
| Opportunity | `OPP-<year>-` + 6-digit zero-padded sequence | `OPP-2026-000001` |
| Task | `TASK-<lead-id>-` + 3-digit zero-padded per-lead sequence | `TASK-LEAD-2026-000001-001` |

No exact ID convention is specified in the assessment for Campaign, Consent, ScoreRule, SalesRep, or StageHistory. Those are [PROPOSED] placeholders / [GENERATOR BLOCKER] until confirmed:
- Campaign: `CAMP-` + 6-digit ([PROPOSED])
- Consent: `CSN-` + 6-digit ([PROPOSED])
- ScoreRule: `SCR-` + 6-digit ([PROPOSED])
- SalesRep: `REP-` + 6-digit ([PROPOSED])
- StageHistory: `SH-` + 6-digit ([PROPOSED])

## Naming conventions ([PROPOSED])
- Entity/table names: PascalCase (`Company`, `Lead`)
- Column names: snake_case (`lead_id`, `created_at`)
- Primary keys: `<entity>_id`
- Foreign keys: `<referenced_entity>_id`
- Timestamps: `timestamptz`

---

## 1. Company

**Purpose ([ASSESSMENT]):** Represents a customer or prospect organization; used for territory/product routing and as the parent of Contacts and Leads.

**Primary key:** `company_id` — format `CO-000001` [ASSESSMENT].

**Actual Implemented Fields:**

| Field | Type | Required | Allowed values / notes | Status |
|---|---|---|---|---|
| company_id | text | Yes | PK; format `CO-` + 6-digit zero-padded | Implemented |
| name | text | Yes | Company legal or business name | Implemented |
| industry | text | No | Controlled industry categories (e.g., Technology, Healthcare, Finance) | Implemented |
| size | text | No | Employee size band (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+) | Implemented |
| country | text | No | ISO 3166-1 alpha-2 code (e.g., US, CA, UK, DE) | Implemented |
| created_at | timestamptz | Yes | ISO 8601 UTC timestamp | Implemented |
| updated_at | timestamptz | Yes | ISO 8601 UTC timestamp | Implemented |

**Proposed Fields Intentionally Unimplemented:**
The following speculative fields were considered during initial drafting but remain intentionally unimplemented in code, generator outputs, and PostgreSQL schema to avoid schema bloat:
- `website` (text)
- `address` (text)
- `city` (text)
- `state` (text)
- `postal_code` (text)
- `annual_revenue` (numeric)

**Uniqueness:** `company_id` unique.

**Relationships:**
- Company 1:N Contact — a contact belongs to one company
- Company 1:N Lead — a lead may be associated with one company

**Foreign keys:** None (root entity).

**Lifecycle:** Active / Inactive — [PROPOSED]. No event-history requirement specified.

---

## 2. Contact

**Purpose ([ASSESSMENT]):** An individual person associated with a Company; the basis for Leads and Consent.

**Primary key:** `contact_id` — format `CON-000001` [ASSESSMENT].

**Actual Implemented Fields:**

| Field | Type | Required | Allowed values / notes | Status |
|---|---|---|---|---|
| contact_id | text | Yes | PK; format `CON-` + 6-digit zero-padded | Implemented |
| company_id | text | No | FK → Company.company_id | Implemented |
| first_name | text | Yes | Contact first name | Implemented |
| last_name | text | Yes | Contact last name | Implemented |
| email | text | No | Synthetic business email address (`user@domain.com`) | Implemented |
| created_at | timestamptz | Yes | ISO 8601 UTC timestamp | Implemented |
| updated_at | timestamptz | Yes | ISO 8601 UTC timestamp | Implemented |

**Proposed Fields Intentionally Unimplemented:**
The following speculative fields were considered during initial drafting but remain intentionally unimplemented in code, generator outputs, and PostgreSQL schema:
- `phone` (text)
- `job_title` (text)
- `department` (text)
- `linkedin_url` (text)

**Uniqueness:** `contact_id` unique.

**Required vs optional:** `contact_id`, `first_name`, `last_name` required; `company_id` optional.

**Relationships:**
- Company 1:N Contact
- Contact 1:N Lead — resolved: one Contact can have multiple Leads; each Lead references one Contact [ASSESSMENT]
- Contact 1:N Consent

**Foreign keys:** `company_id` → Company.

**Lifecycle:** Driven by Consent records for each outreach channel.

---

## 3. Lead

**Purpose ([ASSESSMENT]):** A potential sales opportunity derived from a Contact/Company. Central to scoring, deduplication, routing, and follow-up.

**Primary key:** `lead_id` — format `LEAD-<year>-000001` [ASSESSMENT].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| lead_id | text | Yes | PK; format `LEAD-<year>-` + 6-digit zero-padded |
| contact_id | text | Yes | FK → Contact.contact_id (each Lead references one Contact) [ASSESSMENT] |
| company_id | text | No | FK → Company.company_id (denormalized for routing) |
| source | text | No | origin of lead — [PROPOSED], values not mandated |
| status | text | Yes | lead lifecycle status (New, Contacted, Qualified, Disqualified, Converted) |
| lead_score | integer | No | computed score range 0-100 |
| fit_score | integer | No | fit component range 0-100 |
| intent_score | integer | No | intent component range 0-100 |
| engagement_score | integer | No | engagement component range 0-100 |
| scored_at | timestamptz | No | timestamp when score was last computed |
| score_rule_id | text | No | FK → ScoreRule.score_rule_id |
| territory | text | No | lead territory (North, South, East, West, Central) |
| assigned_salesrep_id | text | No | FK → SalesRep.salesrep_id (nullable; NULL when unassigned) |
| product_interest | text | No | product of interest (Enterprise, Mid-Market, SMB) |
| routing_exception | boolean | No | True if lead could not be routed or has an approved exception |
| routing_reason | text | No | Reason code for routing outcome (e.g., 'no_compatible_salesrep') |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |
| converted_at | timestamptz | No | set when status becomes Converted |

**Sales Routing Workflow & Unassigned Leads:**
- Routing checks active sales representatives matching both `territory` and `product_specialty` against the lead's `territory` and `product_interest`.
- Among compatible representatives, assignments are balanced by selecting the rep with the fewest current assignments.
- If no compatible representative exists, the lead is preserved in an explicit unassigned state: `assigned_salesrep_id = NULL`, `routing_exception = TRUE`, and `routing_reason = 'no_compatible_salesrep'`.
- Leads are never assigned to incompatible representatives merely to avoid null values, and lead territory/product are never rewritten to force a match.
- Downstream task generation handles unassigned leads safely: unassigned leads are deferred from follow-up task creation (`decision = 'deferred'`, `reason = 'no_compatible_salesrep'`).

**Deduplication fields ([ASSESSMENT] requirement, [PROPOSED] mechanism):** `is_duplicate`, `duplicate_of_lead_id`, and `duplicate_detection_key` are anomaly/ground-truth labels, not input features. They are stored separately from input features and are NOT used as scoring inputs. They are not present in the current minimal generator (which does not generate anomalies).

| Field | Type | Required | Notes |
|---|---|---|---|
| is_duplicate | boolean | No | anomaly label; true when this Lead duplicates an earlier buying request |
| duplicate_of_lead_id | text | No | nullable self-reference to Lead.lead_id — the original Lead when is_duplicate = true |
| duplicate_detection_key | text | No | composite detection key used to identify the duplicate buying request |

**Required vs optional:** `lead_id`, `contact_id`, `status` required. Scoring/assignment fields optional until computed.

**Uniqueness:** `lead_id` unique.

**Deduplication ([ASSESSMENT] requirement, [PROPOSED] mechanism):** Do not assume email alone uniquely identifies a buying request.
- Input features (used to compute the detection key; kept separate from anomaly labels): normalized email domain, normalized company name, product interest, lead source, and submission month.
- Detection key = explainable composite of those input features (e.g. normalized_email_domain + normalized_company + product_interest + source + submission_month).
- A repeat submission is treated as legitimate repeat interest (a new Lead) when any input feature differs (different product, different company, or outside the submission month) — repeat interest is preserved.
- A duplicate buying request is flagged with anomaly label fields `is_duplicate = true`, `duplicate_of_lead_id` (self-FK to the original Lead), and `duplicate_detection_key`; these labels are stored separately from input features and are NOT used as scoring inputs.

**Validation rules ([PROPOSED]):**
- lead_score = f(fit_score, intent_score, engagement_score) per ScoreRule — business logic, not a DB constraint
- fit_score, intent_score, engagement_score in [0, 100] when present
- lead_score in [0, 100] when present

**Relationships:**
- Contact N:1 Lead (resolved 1:N from Contact side) [ASSESSMENT]
- Company N:1 Lead
- SalesRep N:1 Lead (assigned)
- Lead 1:N Activity
- Lead 1:N Task
- Lead 1:N Opportunity — resolved: one Lead can have multiple Opportunities [ASSESSMENT]
- Lead 1:N StageHistory (dedicated lead_id FK) [ASSESSMENT]
- Lead ↔ Campaign N:M via `LeadCampaign` bridge table

**Foreign keys:** `contact_id` → Contact, `company_id` → Company, `assigned_salesrep_id` → SalesRep, `score_rule_id` → ScoreRule, `duplicate_of_lead_id` → Lead (self).

**Lifecycle:** lead status transitions — [PROPOSED] (e.g. New → Contacted → Qualified → Converted, or → Disqualified). Effective dates: `created_at`, `converted_at`, `scored_at`.

---

## 4. Campaign

**Purpose ([ASSESSMENT]):** A marketing or outbound campaign used for lead attribution and ROI; associated with Leads via many-to-many.

**Primary key:** `campaign_id` — proposed format `CAMP-000001` [PROPOSED], [GENERATOR BLOCKER].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| campaign_id | text | Yes | PK |
| name | text | Yes | |
| type | text | No | campaign type — [PROPOSED], values not mandated |
| start_date | date | No | |
| end_date | date | No | |
| budget | numeric | No | |
| owner_id | text | No | FK → SalesRep.salesrep_id; marked optional — campaign ownership is [PROPOSED] unless the assessment requires an owner |
| status | text | No | campaign status — [PROPOSED], values not mandated |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

**Uniqueness:** `campaign_id` unique.

**Relationships:**
- SalesRep N:1 Campaign (one owner per campaign) — [PROPOSED], optional
- Lead ↔ Campaign N:M — resolved via `LeadCampaign` bridge table (leads may be associated with multiple campaigns) [ASSESSMENT]

**Foreign keys:** `owner_id` → SalesRep (optional).

**Lifecycle:** Draft → Active → Paused → Completed / Archived — [PROPOSED]. Effective dates: `start_date`, `end_date`.

---

## 5. LeadCampaign (bridge table)

**Purpose ([PROPOSED]):** Resolves the Lead ↔ Campaign many-to-many relationship so a Lead can be attributed to multiple Campaigns.

**Primary key:** composite PK (`lead_id`, `campaign_id`) [PROPOSED].

| Field | Type | Required | Notes |
|---|---|---|---|
| lead_id | text | Yes | PK part 1; FK → Lead.lead_id |
| campaign_id | text | Yes | PK part 2; FK → Campaign.campaign_id |
| attributed_at | timestamptz | Yes | when the lead-campaign association was recorded |
| is_primary | boolean | No | whether this is the primary campaign for the lead — [PROPOSED] |

**Uniqueness:** `(lead_id, campaign_id)` unique (prevents duplicate associations).

**Foreign keys:** `lead_id` → Lead, `campaign_id` → Campaign.

**Cardinality:** Lead N:M Campaign, materialized through this bridge.

---

## 6. Activity

**Purpose ([ASSESSMENT]):** Records an interaction/event related to a Lead; feeds engagement scoring and event ordering.

**Primary key:** `activity_id` — format `ACT-<lead-id>-001` [ASSESSMENT].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| activity_id | text | Yes | PK; format `ACT-<lead-id>-` + 3-digit zero-padded per-lead sequence |
| lead_id | text | Yes | FK → Lead.lead_id |
| type | text | Yes | interaction type — [PROPOSED], values not mandated |
| subject | text | No | |
| description | text | No | |
| activity_date | timestamptz | Yes | effective date/time of the interaction (event ordering) |
| duration_minutes | integer | No | |
| outcome | text | No | interaction outcome — [PROPOSED], values not mandated |
| created_by | text | No | FK → SalesRep.salesrep_id (who logged it) — [PROPOSED] |
| created_at | timestamptz | Yes | |

**Uniqueness:** `activity_id` unique.

**Required vs optional:** `activity_id`, `lead_id`, `type`, `activity_date` required.

**Relationships:**
- Lead 1:N Activity
- SalesRep N:1 Activity — [PROPOSED]

**Foreign keys:** `lead_id` → Lead, `created_by` → SalesRep.

**Event-history:** Append-only interaction records; `activity_date` is the effective event timestamp used for ordering and engagement cutoffs.

---

## 7. Consent

**Purpose ([ASSESSMENT]):** Captures a Contact's communication consent; drives consent checks before outbound Activity/Task. Linked to Contact, with communication type, consent status, and effective timestamps.

**Primary key:** `consent_id` — proposed format `CSN-000001` [PROPOSED], [GENERATOR BLOCKER].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| consent_id | text | Yes | PK |
| contact_id | text | Yes | FK → Contact.contact_id |
| channel | text | Yes | communication type — [PROPOSED], values not mandated |
| status | text | Yes | consent status — [PROPOSED], values not mandated |
| consented_at | timestamptz | No | when consent was granted (effective timestamp) |
| withdrawn_at | timestamptz | No | when consent was withdrawn (effective timestamp) |
| expires_at | timestamptz | No | optional consent expiry (effective timestamp) |
| source | text | No | how consent was captured — [PROPOSED], values not mandated |
| created_at | timestamptz | Yes | |

**Uniqueness:** `consent_id` unique. No uniqueness constraint on (contact_id, channel) — consent history is append-only and multiple records per contact/channel are preserved [ASSESSMENT-aligned].

**Required vs optional:** `consent_id`, `contact_id`, `channel`, `status` required.

**Relationships:**
- Contact 1:N Consent

**Foreign keys:** `contact_id` → Contact.

**Effective consent determination ([PROPOSED]):** For a contact and channel at time T, the effective consent is the record with status = 'granted', consented_at <= T, (withdrawn_at IS NULL OR withdrawn_at > T), and (expires_at IS NULL OR expires_at > T), having the greatest consented_at (most recent grant). If no such record exists, there is no valid consent. History is never overwritten or deleted; a new record is inserted for each change.

**Lifecycle:** granted → withdrawn / denied. Effective dates: `consented_at`, `withdrawn_at`, `expires_at`.

**Consent check workflow ([ASSESSMENT]):** Before any outbound Activity/Task, validate that a valid effective consent exists for the contact's channel at the activity/task timestamp.

---

## 8. ScoreRule

**Purpose ([ASSESSMENT]):** Defines how lead_score is computed from fit, intent, and engagement components; supports configurable scoring and scoring cutoffs with historical reproducibility.

**Primary key:** `score_rule_id` — proposed format `SCR-000001` [PROPOSED], [GENERATOR BLOCKER].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| score_rule_id | text | Yes | PK |
| name | text | Yes | |
| component | text | Yes | fit / intent / engagement — [PROPOSED], values not mandated |
| weight | numeric | Yes | 0.0–1.0 — [PROPOSED]. Current synthetic-demo assumption: fit 0.5 / intent 0.3 / engagement 0.2 (sum = 1.0). These weights are demonstration assumptions, not values derived from real business data. |
| version | integer | Yes | rule version number — [PROPOSED] |
| effective_from | timestamptz | Yes | rule becomes applicable at this timestamp — [PROPOSED] |
| effective_to | timestamptz | No | rule stops being applicable at this timestamp; NULL = ongoing — [PROPOSED] |
| min_score | integer | No | 0–100 — [PROPOSED] |
| max_score | integer | No | 0–100 — [PROPOSED] |
| description | text | No | |
| is_active | boolean | Yes | default true |
| created_at | timestamptz | Yes | |

**Uniqueness:** `score_rule_id` unique. One active version per component effective at a given timestamp — [PROPOSED].

**Validation ([PROPOSED]):** weight in [0, 1]; for a given component and timestamp T, at most one active rule version where effective_from <= T < effective_to (or effective_to IS NULL).

**Rule applicability ([PROPOSED], preserves historical reproducibility):** The rule applicable to a scoring timestamp T for a component is the active rule version for that component where effective_from <= T and (effective_to IS NULL OR T < effective_to). Lead stores `score_rule_id` and `scored_at` so a score can be reproduced against the rule version that produced it.

**Relationships:** Referenced by Lead scoring business logic; scores stored as denormalized integers on Lead.

**Lifecycle:** Active / Inactive via `is_active` and effective-date window.

---

## 9. SalesRep

**Purpose ([ASSESSMENT]):** A sales representative who owns Leads, Tasks, and Opportunities; assigned a territory and product for territory/product routing.

**Primary key:** `salesrep_id` — proposed format `REP-000001` [PROPOSED], [GENERATOR BLOCKER].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| salesrep_id | text | Yes | PK |
| first_name | text | Yes | |
| last_name | text | Yes | |
| email | text | No | unique — [PROPOSED] |
| territory | text | No | routing territory — [PROPOSED], values not mandated |
| product_specialty | text | No | routing product specialty — [PROPOSED]; controlled values only if a documented product list exists, otherwise [PROPOSED] free text requiring confirmation |
| is_active | boolean | Yes | default true |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

**Uniqueness:** `salesrep_id` unique. `email` unique [PROPOSED], [UNRESOLVED].

**Relationships:**
- SalesRep 1:N Lead (assigned leads)
- SalesRep 1:N Task (owned tasks)
- SalesRep 1:N Opportunity (owned opportunities)
- SalesRep N:1 Campaign (campaign owner) — [PROPOSED], optional

**Foreign keys:** None (root entity).

**Lifecycle:** Active / Inactive — [PROPOSED]. Territory and product_specialty drive routing (fit/territory/product routing workflow).

---

## 10. Task

**Purpose ([ASSESSMENT]):** A follow-up action tied to a Lead; supports the follow-up tasks workflow.

**Primary key:** `task_id` — format `TASK-<lead-id>-001` [ASSESSMENT].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| task_id | text | Yes | PK; format `TASK-<lead-id>-` + 3-digit zero-padded per-lead sequence |
| lead_id | text | Yes | FK → Lead.lead_id |
| assigned_to | text | Yes | FK → SalesRep.salesrep_id |
| type | text | Yes | task type — [PROPOSED], values not mandated |
| title | text | Yes | |
| description | text | No | |
| due_date | date | No | |
| status | text | Yes | task status — [PROPOSED], values not mandated |
| priority | text | No | priority — [PROPOSED], values not mandated |
| completed_at | timestamptz | No | |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

**Uniqueness:** `task_id` unique.

**Required vs optional:** `task_id`, `lead_id`, `assigned_to`, `type`, `title`, `status` required.

**Relationships:**
- Lead 1:N Task
- SalesRep 1:N Task

**Foreign keys:** `lead_id` → Lead, `assigned_to` → SalesRep.

**Lifecycle:** open → in_progress → completed / cancelled; `overdue` derived from due_date + status — [PROPOSED]. Effective dates: `due_date`, `completed_at`.

---

## 11. Opportunity

**Purpose ([ASSESSMENT]):** A qualified sales opportunity created from a Lead; tracks value, stage, won/lost outcome and reason.

**Primary key:** `opportunity_id` — format `OPP-<year>-000001` [ASSESSMENT].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| opportunity_id | text | Yes | PK; format `OPP-<year>-` + 6-digit zero-padded |
| lead_id | text | Yes | FK → Lead.lead_id |
| salesrep_id | text | Yes | FK → SalesRep.salesrep_id |
| stage | text | Yes | opportunity stage — [PROPOSED], values not mandated |
| amount | numeric | No | |
| currency | text | No | ISO 4217 — [PROPOSED], default USD |
| close_date | date | No | expected or actual close date |
| won_lost_reason | text | No | reason when stage is terminal (won/lost) — [PROPOSED], values not mandated |
| competitor | text | No | when lost — [PROPOSED], values not mandated |
| is_duplicate | boolean | No | flags a duplicate opportunity for the same buying request — [PROPOSED] |
| duplicate_of_opportunity_id | text | No | self-referential FK → Opportunity.opportunity_id when is_duplicate = true — [PROPOSED] |
| duplicate_detection_key | text | No | key used to detect duplicate buying requests — [PROPOSED] |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |
| closed_at | timestamptz | No | when stage becomes terminal |

**Uniqueness:** `opportunity_id` unique.

**Required vs optional:** `opportunity_id`, `lead_id`, `salesrep_id`, `stage` required.

**Relationships:**
- Lead 1:N Opportunity — resolved: one Lead can have multiple Opportunities [ASSESSMENT]
- SalesRep 1:N Opportunity
- Opportunity 1:1 Opportunity (self, duplicate_of_opportunity_id) — [PROPOSED]

**Foreign keys:** `lead_id` → Lead, `salesrep_id` → SalesRep, `duplicate_of_opportunity_id` → Opportunity.

**Duplicate-opportunity handling ([ASSESSMENT] requirement, [PROPOSED] mechanism):** Duplicate opportunities for the same underlying buying request are detected via `duplicate_detection_key` and labelled with `is_duplicate = true` plus `duplicate_of_opportunity_id` pointing to the original opportunity. Duplicate labels are stored separately from input features.

**Lifecycle:** opportunity stage transitions — [PROPOSED] (e.g. discovery → qualification → proposal → negotiation → closed_won / closed_lost). `won_lost_reason` required at terminal stage — [PROPOSED] validation. Effective dates: `close_date`, `closed_at`.

---

## 12. StageHistory

**Purpose ([ASSESSMENT]):** Append-only audit trail of stage transitions. Uses a dedicated `lead_id` foreign key for lead-stage transitions. Opportunity-stage history is NOT required by the assessment, so `opportunity_id` and the associated CHECK constraint are removed to avoid unnecessary scope.

**Primary key:** `stage_history_id` — proposed format `SH-000001` [PROPOSED], [GENERATOR BLOCKER].

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| stage_history_id | text | Yes | PK |
| lead_id | text | Yes | FK → Lead.lead_id (dedicated; lead-stage transitions only) |
| from_stage | text | No | previous stage — [PROPOSED], values not mandated |
| to_stage | text | Yes | new stage — [PROPOSED], values not mandated |
| changed_by | text | No | FK → SalesRep.salesrep_id — [PROPOSED] |
| changed_at | timestamptz | Yes | effective event timestamp (stage transition ordering) |
| reason | text | No | reason for stage change — [PROPOSED], values not mandated |

**Uniqueness:** `stage_history_id` unique.

**Required vs optional:** `stage_history_id`, `lead_id`, `to_stage`, `changed_at` required.

**Relationships:**
- Lead 1:N StageHistory [ASSESSMENT]

**Foreign keys:** `lead_id` → Lead, `changed_by` → SalesRep.

**Event-history:** Append-only; never updated or deleted. `changed_at` is the effective event timestamp used for ordering stage transitions.

---

## Bridge tables

| Relationship | Cardinality | Bridge table |
|---|---|---|
| Lead ↔ Campaign | N:M | `LeadCampaign(lead_id, campaign_id, attributed_at, is_primary)` |

No standalone Product entity is added ([PROPOSED] per decision 3). Product routing is represented by `Lead.product_interest` and `SalesRep.product_specialty`. Controlled product values are used only if a documented product list can be defined; otherwise these remain [PROPOSED] free text requiring confirmation — not an assessment requirement.

---

## Timestamps summary ([PROPOSED] per decision 7)

| Purpose | Fields / entities |
|---|---|
| Row lifecycle | `created_at`, `updated_at` on all entities |
| Event ordering (interactions) | `Activity.activity_date` |
| Scoring cutoffs | `Lead.scored_at` |
| Consent changes & validity | `Consent.consented_at`, `Consent.withdrawn_at`, `Consent.expires_at` |
| Stage transitions | `StageHistory.changed_at` |
| Lead conversion | `Lead.converted_at` |
| Opportunity close | `Opportunity.close_date`, `Opportunity.closed_at` |
| Follow-up scheduling | `Task.due_date`, `Task.completed_at` |
| Campaign period | `Campaign.start_date`, `Campaign.end_date` |
| Rule applicability | `ScoreRule.effective_from`, `ScoreRule.effective_to` |

---

---

## 13. TaskDecision (Audit Dataset)

**Purpose ([ASSESSMENT]):** An append-only audit trail explaining every candidate follow-up task evaluation. Provides complete decision traceability for created, rejected, and deferred follow-up tasks without manufacturing illegal outreach tasks.

**Output files:** `data/generated/task_decisions.csv`, `data/generated/task_decisions.json`

**Primary key:** `decision_id` — format `DEC-000001` (deterministic sequential format).

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| decision_id | text | Yes | PK; format `DEC-` + 6-digit zero-padded sequence |
| lead_id | text | Yes | FK → Lead.lead_id |
| contact_id | text | Yes | FK → Contact.contact_id |
| task_type | text | Yes | Candidate task type (`call`, `email`, `meeting`, `demo`, `other`) |
| channel | text | Yes | Outreach consent channel (`email`, `phone`) |
| decision | text | Yes | Decision value: `created`, `rejected`, `deferred` |
| reason | text | Yes | Structured reason code: `eligible`, `duplicate_lead_prohibited`, `low_score`, `no_compatible_salesrep`, `no_valid_consent` |
| evaluated_at | timestamptz | Yes | ISO 8601 UTC timestamp when decision was evaluated |
| consent_status_at_evaluation | text | Yes | Contact consent status at evaluation time (`granted`, `denied`, `withdrawn`, `expired`, `none`) |
| lead_score | integer | Yes | Lead score at evaluation time (0-100) |
| assigned_salesrep_id | text | No | FK → SalesRep.salesrep_id; assigned rep ID if lead is routed, NULL if unassigned |
| task_id | text | No | FK → Task.task_id; populated ONLY when decision is `created`, NULL for `rejected` or `deferred` |

**Decision Values and Reason Codes:**
- `created`:
  - `eligible`: Lead meets all eligibility criteria (valid consent for channel, lead_score >= 40, active compatible sales rep assigned, not a duplicate). Real Task record created.
- `rejected`:
  - `duplicate_lead_prohibited`: Duplicate lead is prohibited from inappropriate follow-up.
  - `low_score`: Lead score below threshold (< 40); not eligible for sales outreach.
  - `no_valid_consent`: Contact does not have active, valid consent for the outreach channel at outreach time.
- `deferred`:
  - `no_compatible_salesrep`: Lead has no compatible active sales representative matching territory and product interest. Actionable task creation deferred until assignment.

**Relationship to Real Tasks:**
- A `created` decision record always links to an actual generated task in `tasks.csv` (`task_id` matches).
- A `rejected` or `deferred` decision never links to a task (`task_id` is NULL / empty), preserving full traceability without violating business rules.

---

## 14. Ground Truth and Exception Injection

The project maintains strict separation between clean baseline data and ground-truth anomaly data:
- **Baseline dataset:** Generated under `data/generated/`. Contains zero artificial anomalies and passes 100% of validation checks.
- **Ground-truth dataset:** Generated under `data/ground_truth/exceptions.csv` and `data/ground_truth/exceptions.json`. Tracks all deliberately injected exceptions for benchmark verification.

**Five Injected Exception Scenarios:**
1. `opted_out_lead_contacted` (EXC-000001): Outbound task generated for a contact whose consent was withdrawn or denied.
2. `score_influenced_post_conversion` (EXC-000002): Lead activity dated after lead conversion that altered lead score post-conversion.
3. `lead_assigned_outside_territory` (EXC-000003): Lead assigned to a sales representative whose territory does not match the lead's territory without a routing exception flag.
4. `duplicate_opportunity` (EXC-000004): Duplicate opportunity created for a duplicate lead representing the same underlying buying request.
5. `stage_history_gap` (EXC-000005): A lead stage transition that skipped an intermediate required lifecycle stage or introduced an invalid chronological order.

---

## 15. Database Status

- **SQL Artifacts:**
  - `sql/schema.sql`: Full PostgreSQL DDL defining all tables, primary keys, foreign keys, constraints, and indices.
  - `sql/seed.sql`: Deterministic PostgreSQL INSERT statements exported in dependency order.
- **Live Database Status:** SQL artifacts exist and are syntactically validated. However, live PostgreSQL server execution is a separate deployment step and is not executed in this environment.

---

## 16. Relationship Summary

```
Company 1:N Contact
Company 1:N Lead
Contact 1:N Lead          (resolved: one Contact → many Leads; each Lead → one Contact) [ASSESSMENT]
Contact 1:N Consent
SalesRep 1:N Lead         (assigned; nullable for unassigned leads)
SalesRep 1:N Task
SalesRep 1:N Opportunity
SalesRep N:1 Campaign     (owner — optional)
Lead N:M Campaign         (via LeadCampaign bridge table) [ASSESSMENT]
Lead 1:N Activity
Lead 1:N Consent          (Contact-owned, append-only history)
Lead 1:N Task
Lead 1:N Opportunity      (resolved: one Lead → many Opportunities) [ASSESSMENT]
Lead 1:N StageHistory     (dedicated lead_id FK) [ASSESSMENT]
Lead 1:N TaskDecision     (audit trail: created, rejected, deferred decisions)
Opportunity 1:1 Opportunity (duplicate_of_opportunity_id)
ScoreRule → Lead scoring  (business logic; fit/intent/engagement weights)
```

## 17. Finalized Implementation Status

1. **ID conventions:** Company `CO-000001`, Contact `CON-000001`, Lead `LEAD-2026-000001`, Activity `ACT-<lead-id>-001`, Opportunity `OPP-2026-000001`, Task `TASK-<lead-id>-001`, Campaign `CAMP-000001`, Consent `CSN-000001`, ScoreRule `SCR-000001`, SalesRep `REP-000001`, StageHistory `SH-000001`, TaskDecision `DEC-000001`.
2. **Sales Routing:** Leads routed by territory and product specialty match. Unassigned leads explicitly preserved (`assigned_salesrep_id = NULL`, `routing_exception = TRUE`, `routing_reason = 'no_compatible_salesrep'`).
3. **Deduplication:** Composite detection key (`normalized_email_domain + normalized_company + product_interest + submission_month`). Anomaly labels (`is_duplicate`, `duplicate_of_lead_id`, `duplicate_detection_key`) stored separately.
4. **Consent Gating:** Outreach tasks gated on effective granted consent at outreach timestamp. Opted-out contacts receive no outreach tasks.
5. **Task Decision Audit:** All candidate evaluations logged deterministically to `task_decisions.csv` and `task_decisions.json`.
7. Whether Campaign owner attribution is actually required (currently optional).
8. Territory value list for routing.

No application code, synthetic data, packages, SQL tables, or other files were created or modified. Only `docs/data_dictionary.md` was updated.
