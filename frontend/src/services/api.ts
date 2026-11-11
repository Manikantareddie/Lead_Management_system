import {
  DashboardSummary,
  PaginatedResponse,
  LeadItem,
  LeadDetails,
  SalesRep,
  TaskItem,
  OpportunityItem,
  PipelineStageStat,
  ActivityItem,
  InvestigationItem,
  ValidationStatus,
  AuthUser,
  LoginResponse,
} from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const TOKEN_KEY = "yottaflex_token";

const GENERIC_SERVER_ERROR = "Something went wrong on our side. Please try again.";
const NETWORK_ERROR = "Unable to reach the server. Please check your connection and try again.";
const FALLBACK_ERROR = "Request failed. Please try again.";
const DETAIL_STATUSES = [400, 401, 403, 404, 409];

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function extractDetail(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    if (body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string") {
      return (body as { detail: string }).detail;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options?.headers || {});
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("yottaflex:unauthorized"));
    }

    if (res.status >= 500) {
      throw new ApiError(GENERIC_SERVER_ERROR, res.status);
    }

    if (DETAIL_STATUSES.includes(res.status)) {
      const detail = await extractDetail(res);
      if (detail) {
        throw new ApiError(detail, res.status);
      }
    }

    throw new ApiError(FALLBACK_ERROR, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(NETWORK_ERROR, res.status);
  }
}

export const api = {
  login: async (username: string, password: string): Promise<AuthUser> => {
    const res = await fetchJson<LoginResponse>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setToken(res.access_token);
    return res.user;
  },

  me: () => fetchJson<AuthUser>("/api/auth/me"),

  logout: () => {
    clearToken();
  },

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
    assigned_salesrep_id?: string;
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
    if (params.assigned_salesrep_id) q.set("assigned_salesrep_id", params.assigned_salesrep_id);

    return fetchJson<PaginatedResponse<LeadItem>>(`/api/leads?${q.toString()}`);
  },

  createLead: (data: {
    first_name: string;
    last_name?: string;
    email?: string;
    company_name: string;
    source?: string;
    product_interest?: string;
    territory?: string;
    assigned_salesrep_id?: string;
  }) =>
    fetchJson<LeadItem>("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  getSalesreps: () => fetchJson<SalesRep[]>("/api/salesreps"),

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
    due?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", params.page.toString());
    if (params.page_size) q.set("page_size", params.page_size.toString());
    if (params.status) q.set("status", params.status);
    if (params.task_type) q.set("task_type", params.task_type);
    if (params.priority) q.set("priority", params.priority);
    if (params.search) q.set("search", params.search);
    if (params.due) q.set("due", params.due);
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

  // Record a sales activity. Activities never change the lead's sales stage.
  createActivity: (data: {
    lead_id: string;
    type?: string;
    subject?: string;
    description?: string;
    activity_date?: string;
    duration_minutes?: number;
    outcome?: string;
    created_by?: string;
  }) =>
    fetchJson<ActivityItem>("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

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

  // Record the customer's buying decision. Bought/Lost close the deal;
  // Decision Pending keeps it active and schedules the next follow-up.
  decideOpportunity: (
    opportunityId: string,
    data: {
      decision: "bought" | "decision_pending" | "lost";
      reason?: string;
      next_follow_up_title?: string;
      next_follow_up_type?: string;
      next_follow_up_due_date?: string;
      next_follow_up_priority?: string;
    }
  ) =>
    fetchJson<{ opportunity: OpportunityItem; task: TaskItem | null }>(
      `/api/opportunities/${opportunityId}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    ),

  getPipelineAnalytics: () =>
    fetchJson<{ stages: PipelineStageStat[] }>("/api/analytics/pipeline"),

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

