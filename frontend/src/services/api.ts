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

const API_BASE = "http://127.0.0.1:8000";

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
    if (params.sort_by) q.set("sort_by", params.sort_by);
    if (params.sort_order) q.set("sort_order", params.sort_order);
    if (params.is_duplicate !== undefined) q.set("is_duplicate", params.is_duplicate.toString());

    return fetchJson<PaginatedResponse<LeadItem>>(`/api/leads?${q.toString()}`);
  },

  getLeadDetails: (leadId: string) => fetchJson<LeadDetails>(`/api/leads/${leadId}`),

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

  getInvestigations: () => fetchJson<InvestigationItem[]>("/api/investigations"),

  getValidationStatus: () => fetchJson<ValidationStatus>("/api/validation/status"),

  runValidation: () => fetchJson<ValidationStatus>("/api/validation/run", { method: "POST" }),
};
