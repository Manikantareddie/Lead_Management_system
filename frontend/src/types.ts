export interface DashboardSummary {
  total_leads: number;
  total_companies: number;
  total_contacts: number;
  total_salesreps: number;
  total_tasks: number;
  total_opportunities: number;
  total_pipeline_value: number;
  average_lead_score: number;
  stage_distribution: Record<string, number>;
  territory_distribution: Record<string, number>;
  score_bands: Record<string, number>;
  task_status_distribution: Record<string, number>;
  opportunity_stages: Record<string, number>;
  duplicate_opportunities_count?: number;
  audit_decisions: Record<string, number>;
  anomalies_detected: number;
  clean_baseline_verified: boolean;
}

export interface LeadItem {
  lead_id: string;
  contact_id: string;
  company_id: string;
  product_interest: string;
  source: string;
  status: string;
  fit_score: string | number;
  intent_score: string | number;
  engagement_score: string | number;
  lead_score: string | number;
  scored_at: string;
  converted_at?: string;
  disqualified_at?: string;
  disqualified_reason?: string;
  assigned_salesrep_id?: string;
  territory: string;
  is_duplicate: boolean | string;
  duplicate_of_lead_id?: string;
  routing_exception?: boolean | string;
  routing_reason?: string;
  created_at: string;
  updated_at: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  assigned_salesrep_name: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: T[];
}

export interface ActivityItem {
  activity_id: string;
  lead_id: string;
  type: string;
  subject: string;
  activity_date: string;
  outcome: string;
  duration_minutes: number | string;
}

export interface LeadDetails {
  lead: LeadItem;
  company: {
    company_id: string;
    name: string;
    industry: string;
    size: string;
    country: string;
    created_at: string;
  };
  contact: {
    contact_id: string;
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
  };
  salesrep: {
    salesrep_id: string;
    name: string;
    email: string;
    territory: string;
    product_specialty: string;
    is_active: boolean | string;
  };
  tasks: Array<{
    task_id: string;
    lead_id: string;
    assigned_to: string;
    type: string;
    title: string;
    due_date: string;
    status: string;
    priority: string;
    created_at: string;
  }>;
  activities: ActivityItem[];
  opportunities: Array<{
    opportunity_id: string;
    stage: string;
    amount: number | string;
    close_date: string;
    won_lost_reason?: string;
    competitor?: string;
    is_duplicate: boolean | string;
  }>;
  stage_history: Array<{
    stage_history_id: string;
    from_stage: string;
    to_stage: string;
    changed_by: string;
    changed_at: string;
    reason: string;
  }>;
  consents: Array<{
    consent_id: string;
    channel: string;
    status: string;
    consented_at: string;
    withdrawn_at?: string;
    expires_at?: string;
  }>;
  task_decisions: Array<{
    decision_id: string;
    decision: string;
    reason: string;
    evaluated_at: string;
    consent_status_at_evaluation: string;
    lead_score: number | string;
    task_id?: string;
  }>;
  scoring_breakdown: {
    fit_score: number;
    intent_score: number;
    engagement_score: number;
    lead_score: number;
    formula: string;
    frozen: boolean;
  };
  routing_status: {
    is_assigned: boolean;
    routing_exception: boolean;
    routing_reason?: string;
  };
}

export interface TaskItem {
  task_id: string;
  lead_id: string;
  assigned_to: string;
  assigned_salesrep_name: string;
  type: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  priority: string;
  created_at: string;
}

export interface OpportunityItem {
  opportunity_id: string;
  lead_id: string;
  salesrep_id: string;
  salesrep_name: string;
  stage: string;
  amount: number | string;
  currency: string;
  close_date: string;
  won_lost_reason?: string;
  competitor?: string;
  is_duplicate: boolean | string;
  duplicate_of_opportunity_id?: string;
  created_at: string;
}

export interface InvestigationItem {
  id: string;
  issue_type: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  rule_name: string;
  description: string;
  evidence: Record<string, any>;
  detection_query: string;
  recommended_action: string;
  status: string;
}

export interface ValidationIssueItem {
  issue_type: string;
  record_type: string;
  record_id: string;
  description: string;
  severity: string;
}

export interface ValidationStatus {
  dataset_directory: string;
  is_valid: boolean;
  error_count: number;
  warning_count: number;
  total_issues: number;
  checked_at: string;
  rules_checked: string[];
  is_system_error?: boolean;
  error_message?: string;
  issues?: ValidationIssueItem[];
}
