import {
  DashboardSummary,
  PaginatedResponse,
  LeadItem,
  LeadDetails,
  TaskItem,
  OpportunityItem,
  ActivityItem,
  InvestigationItem,
  ValidationStatus,
} from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error(`Failed to fetch ${url}:`, err);
    throw err;
  }
}

export const api = {
  getHealth: () => fetchJson<{ status: string; mode: string; record_counts: Record<string, number> }>("/health"),

  getDashboardSummary: () => fetchJson<DashboardSummary>("/api/dashboard/summary"),

  getLeads: (params: {
    page?: number;
    page_size?: number;
    search?: string;
    stage?: string;
    territory?: string;
    score_band?: string;
    sort_by?: string;
    sort_order?: string;
    is_duplicate?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", params.page.toString());
    if (params.page_size) q.set("page_size", params.page_size.toString());
    if (params.search) q.set("search", params.search);
    if (params.stage) q.set("stage", params.stage);
    if (params.territory) q.set("territory", params.territory);
    if (params.score_band) q.set("score_band", params.score_band);
    if (params.sort_by) q.set("sort_by", params.sort_by);
    if (params.sort_order) q.set("sort_order", params.sort_order);
    if (params.is_duplicate !== undefined) q.set("is_duplicate", params.is_duplicate.toString());

    return fetchJson<PaginatedResponse<LeadItem>>(`/api/leads?${q.toString()}`);
  },

  getLeadDetails: (leadId: string) => fetchJson<LeadDetails>(`/api/leads/${leadId}`),

  transitionLeadStage: (
    leadId: string,
    data: { to_stage: string; changed_by?: string; reason?: string }
  ) =>
    fetchJson<{ lead: any; stage_history: any }>(`/api/leads/${leadId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getTasks: (params: {
    page?: number;
    page_size?: number;
    status?: string;
    task_type?: string;
    priority?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", params.page.toString());
    if (params.page_size) q.set("page_size", params.page_size.toString());
    if (params.status) q.set("status", params.status);
    if (params.task_type) q.set("task_type", params.task_type);
    if (params.priority) q.set("priority", params.priority);
    if (params.search) q.set("search", params.search);
    return fetchJson<PaginatedResponse<TaskItem>>(`/api/tasks?${q.toString()}`);
  },

  getActivities: (params: { page?: number; page_size?: number; activity_type?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", params.page.toString());
    if (params.page_size) q.set("page_size", params.page_size.toString());
    if (params.activity_type) q.set("activity_type", params.activity_type);
    if (params.search) q.set("search", params.search);
    return fetchJson<PaginatedResponse<ActivityItem>>(`/api/activities?${q.toString()}`);
  },

  getOpportunities: (params: {
    page?: number;
    page_size?: number;
    stage?: string;
    is_duplicate?: boolean;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", params.page.toString());
    if (params.page_size) q.set("page_size", params.page_size.toString());
    if (params.stage) q.set("stage", params.stage);
    if (params.is_duplicate !== undefined) q.set("is_duplicate", params.is_duplicate.toString());
    if (params.search) q.set("search", params.search);
    return fetchJson<PaginatedResponse<OpportunityItem>>(`/api/opportunities?${q.toString()}`);
  },

  createTask: (data: {
    lead_id: string;
    type?: string;
    title?: string;
    description?: string;
    due_date?: string;
    priority?: string;
    status?: string;
    assigned_to?: string;
  }) =>
    fetchJson<TaskItem>("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  updateTask: (
    taskId: string,
    data: {
      status?: string;
      priority?: string;
      title?: string;
      description?: string;
      due_date?: string;
    }
  ) =>
    fetchJson<TaskItem>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getInvestigations: () => fetchJson<InvestigationItem[]>("/api/investigations"),

  getValidationStatus: () => fetchJson<ValidationStatus>("/api/validation/status"),

  runValidation: () => fetchJson<ValidationStatus>("/api/validation/run", { method: "POST" }),
};

