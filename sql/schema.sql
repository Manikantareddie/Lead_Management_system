-- ============================================================================
-- YottaFlex Lead Management Database Schema (PostgreSQL)
-- Defines all 11 required entities, the N:M bridge table, and ground-truth audit.
-- ============================================================================

-- 1. Company
CREATE TABLE IF NOT EXISTS companies (
    company_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    size VARCHAR(50),
    country VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- 2. Contact
CREATE TABLE IF NOT EXISTS contacts (
    contact_id VARCHAR(32) PRIMARY KEY,
    company_id VARCHAR(32) REFERENCES companies(company_id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- 3. Sales Representative
CREATE TABLE IF NOT EXISTS salesreps (
    salesrep_id VARCHAR(32) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    territory VARCHAR(50) NOT NULL,
    product_specialty VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salesreps_territory_product ON salesreps(territory, product_specialty);

-- 4. Score Rule
CREATE TABLE IF NOT EXISTS score_rules (
    score_rule_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    component VARCHAR(50) NOT NULL,
    weight NUMERIC(4, 2) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    min_score INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 100,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 5. Campaign
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget NUMERIC(12, 2),
    owner_id VARCHAR(32) REFERENCES salesreps(salesrep_id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_campaign_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);

-- 6. Lead
CREATE TABLE IF NOT EXISTS leads (
    lead_id VARCHAR(32) PRIMARY KEY,
    contact_id VARCHAR(32) NOT NULL REFERENCES contacts(contact_id) ON DELETE RESTRICT,
    company_id VARCHAR(32) REFERENCES companies(company_id) ON DELETE SET NULL,
    source VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
    fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
    intent_score INTEGER CHECK (intent_score >= 0 AND intent_score <= 100),
    engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
    scored_at TIMESTAMPTZ,
    score_rule_id VARCHAR(32) REFERENCES score_rules(score_rule_id) ON DELETE SET NULL,
    assigned_salesrep_id VARCHAR(32) REFERENCES salesreps(salesrep_id) ON DELETE SET NULL,
    territory VARCHAR(50),
    product_interest VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    converted_at TIMESTAMPTZ,
    duplicate_detection_key TEXT,
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    duplicate_of_lead_id VARCHAR(32) REFERENCES leads(lead_id) ON DELETE SET NULL,
    routing_exception BOOLEAN NOT NULL DEFAULT FALSE,
    routing_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_salesrep ON leads(assigned_salesrep_id);
CREATE INDEX IF NOT EXISTS idx_leads_detection_key ON leads(duplicate_detection_key);

-- 7. LeadCampaign (Bridge Table: N:M)
CREATE TABLE IF NOT EXISTS lead_campaigns (
    lead_id VARCHAR(32) NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
    campaign_id VARCHAR(32) NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    attributed_at TIMESTAMPTZ NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (lead_id, campaign_id)
);

-- 8. Consent
CREATE TABLE IF NOT EXISTS consents (
    consent_id VARCHAR(32) PRIMARY KEY,
    contact_id VARCHAR(32) NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    consented_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    source VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consents_contact_channel ON consents(contact_id, channel);

-- 9. Activity (Append-only)
CREATE TABLE IF NOT EXISTS activities (
    activity_id VARCHAR(64) PRIMARY KEY,
    lead_id VARCHAR(32) NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    description TEXT,
    activity_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    outcome VARCHAR(50),
    created_by VARCHAR(32) REFERENCES salesreps(salesrep_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);

-- 10. Task
CREATE TABLE IF NOT EXISTS tasks (
    task_id VARCHAR(64) PRIMARY KEY,
    lead_id VARCHAR(32) NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
    assigned_to VARCHAR(32) NOT NULL REFERENCES salesreps(salesrep_id) ON DELETE RESTRICT,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- 11. Opportunity
CREATE TABLE IF NOT EXISTS opportunities (
    opportunity_id VARCHAR(32) PRIMARY KEY,
    lead_id VARCHAR(32) NOT NULL REFERENCES leads(lead_id) ON DELETE RESTRICT,
    salesrep_id VARCHAR(32) NOT NULL REFERENCES salesreps(salesrep_id) ON DELETE RESTRICT,
    stage VARCHAR(50) NOT NULL,
    amount NUMERIC(14, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    close_date DATE,
    won_lost_reason VARCHAR(100),
    competitor VARCHAR(100),
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    duplicate_of_opportunity_id VARCHAR(32) REFERENCES opportunities(opportunity_id) ON DELETE SET NULL,
    duplicate_detection_key TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opportunities_lead ON opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_salesrep ON opportunities(salesrep_id);

-- 12. StageHistory (Append-only audit trail)
CREATE TABLE IF NOT EXISTS stage_histories (
    stage_history_id VARCHAR(32) PRIMARY KEY,
    lead_id VARCHAR(32) NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    changed_by VARCHAR(32) REFERENCES salesreps(salesrep_id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_stage_histories_lead ON stage_histories(lead_id);

-- 13. TaskDecisions (Audit log of evaluated outreach decisions)
CREATE TABLE IF NOT EXISTS task_decisions (
    decision_id VARCHAR(32) PRIMARY KEY,
    lead_id VARCHAR(32) NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
    contact_id VARCHAR(32) REFERENCES contacts(contact_id) ON DELETE SET NULL,
    task_type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL,
    consent_status_at_evaluation VARCHAR(50),
    lead_score INTEGER,
    assigned_salesrep_id VARCHAR(32) REFERENCES salesreps(salesrep_id) ON DELETE SET NULL,
    task_id VARCHAR(64) REFERENCES tasks(task_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_decisions_lead ON task_decisions(lead_id);
CREATE INDEX IF NOT EXISTS idx_task_decisions_task ON task_decisions(task_id);

-- 14. Ground Truth Exceptions (Separate audit/evaluation table)
CREATE TABLE IF NOT EXISTS ground_truth_exceptions (
    exception_id VARCHAR(32) PRIMARY KEY,
    issue_type VARCHAR(100) NOT NULL,
    affected_record_ids TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    injected_at TIMESTAMPTZ NOT NULL
);
