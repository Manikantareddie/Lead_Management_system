import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useData } from "../context/DataContext";
import type { TaskItem, ActivityItem, PaginatedResponse } from "../types";
import {
  CheckSquare,
  Activity,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Check,
  RotateCcw,
} from "lucide-react";

interface TasksViewProps {
  onSelectLead: (leadId: string) => void;
  onDataChanged?: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ onSelectLead, onDataChanged }) => {
  const { version } = useData();
  const [activeTab, setActiveTab] = useState<"tasks" | "activities">("tasks");

  // Tasks state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(25);
  const [taskTotalPages, setTaskTotalPages] = useState(1);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [taskPriority, setTaskPriority] = useState("");
  const [taskType, setTaskType] = useState("");
  const [taskScope, setTaskScope] = useState<"" | "overdue" | "today" | "week">("");

  // Activities state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(25);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityType, setActivityType] = useState("");

  const [debouncedTaskSearch, setDebouncedTaskSearch] = useState("");
  const [debouncedActivitySearch, setDebouncedActivitySearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTaskSearch(taskSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [taskSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedActivitySearch(activitySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [activitySearch]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pre-load totals on initial mount so both tab badges display real counts
  useEffect(() => {
    api.getActivities({ page: 1, page_size: 1 }).then((res) => {
      setActivityTotal(res.total);
    }).catch(() => {});
    api.getTasks({ page: 1, page_size: 1 }).then((res) => {
      setTaskTotal(res.total);
    }).catch(() => {});
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedResponse<TaskItem> = await api.getTasks({
        page: taskPage,
        page_size: taskPageSize,
        status: taskStatus || undefined,
        priority: taskPriority || undefined,
        task_type: taskType || undefined,
        search: debouncedTaskSearch.trim() || undefined,
        due: taskScope || undefined,
      });
      setTasks(res.items);
      setTaskTotal(res.total);
      setTaskTotalPages(res.total_pages);
    } catch (err: any) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedResponse<ActivityItem> = await api.getActivities({
        page: activityPage,
        page_size: activityPageSize,
        activity_type: activityType || undefined,
        search: debouncedActivitySearch.trim() || undefined,
      });
      setActivities(res.items);
      setActivityTotal(res.total);
      setActivityTotalPages(res.total_pages);
    } catch (err: any) {
      setError(err.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tasks") {
      loadTasks();
    } else {
      loadActivities();
    }
  }, [
    activeTab,
    version,
    taskPage,
    taskPageSize,
    taskStatus,
    taskPriority,
    taskType,
    taskScope,
    debouncedTaskSearch,
    activityPage,
    activityPageSize,
    activityType,
    debouncedActivitySearch,
  ]);

  const clearTaskFilters = () => {
    setTaskSearch("");
    setTaskStatus("");
    setTaskPriority("");
    setTaskType("");
    setTaskScope("");
    setTaskPage(1);
  };

  const clearActivityFilters = () => {
    setActivitySearch("");
    setActivityType("");
    setActivityPage(1);
  };

  const handleStatusChange = async (task: TaskItem, newStatus: string) => {
    try {
      await api.updateTask(task.task_id, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.task_id === task.task_id ? { ...t, status: newStatus } : t))
      );
      const label = task.lead_name || task.title || "Follow-up";
      setToastMessage(
        newStatus === "completed"
          ? `Marked "${label}" as done.`
          : `Reopened "${label}".`
      );
      setTimeout(() => setToastMessage(null), 3500);
      onDataChanged?.();
    } catch (err: any) {
      setError("Failed to update follow-up: " + err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const isOpenTask = (status: string) =>
    ["open", "in_progress"].includes((status || "").toLowerCase());

  const todayIso = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  const formatDueDate = (date: string) => {
    if (!date) return "—";
    const d = new Date(date.slice(0, 10));
    if (isNaN(d.getTime())) return date.slice(0, 10);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  const hasTaskFilters = Boolean(taskSearch || taskStatus || taskPriority || taskType || taskScope);
  const hasActivityFilters = Boolean(activitySearch || activityType);

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return <span className="badge badge-warning">High</span>;
      case "medium":
        return <span className="badge badge-primary">Medium</span>;
      case "low":
        return <span className="badge badge-neutral">Low</span>;
      default:
        return <span className="badge badge-neutral">{priority}</span>;
    }
  };

  const getActivityOutcomeBadge = (outcome: string) => {
    switch (outcome?.toLowerCase()) {
      case "completed":
      case "connected":
      case "answered":
        return <span className="badge badge-success">{outcome}</span>;
      case "bounced":
      case "no answer":
      case "left voicemail":
        return <span className="badge badge-warning">{outcome}</span>;
      default:
        return <span className="badge badge-neutral">{outcome}</span>;
    }
  };

  return (
    <div className="view-container" style={{ position: "relative" }}>
      {/* Toast Pop-up Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 9999,
            backgroundColor: "#065f46",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 500,
            animation: "slideInRight 0.2s ease-out",
          }}
        >
          <CheckCircle2 size={17} color="#34d399" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "#a7f3d0",
              cursor: "pointer",
              padding: "0 0 0 6px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Top Segmented View Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div className="segmented-control">
          <button
            className={`segmented-btn ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            <CheckSquare size={14} />
            <span>Follow-ups</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "2px", fontVariantNumeric: "tabular-nums" }}>
              ({taskTotal.toLocaleString()})
            </span>
          </button>
          <button
            className={`segmented-btn ${activeTab === "activities" ? "active" : ""}`}
            onClick={() => setActiveTab("activities")}
          >
            <Activity size={14} />
            <span>Activity</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "2px", fontVariantNumeric: "tabular-nums" }}>
              ({activityTotal.toLocaleString()})
            </span>
          </button>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          {activeTab === "tasks" ? (
            <span>
              Showing <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{tasks.length}</strong> of{" "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{taskTotal.toLocaleString()}</span> follow-ups
            </span>
          ) : (
            <span>
              Showing <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{activities.length}</strong> of{" "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{activityTotal.toLocaleString()}</span> interactions
            </span>
          )}
        </div>
      </div>

      {/* Focus scope for follow-ups */}
      {activeTab === "tasks" && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Show:</span>
          <div className="segmented-control">
            {(
              [
                { key: "", label: "All" },
                { key: "overdue", label: "Overdue" },
                { key: "today", label: "Due today" },
                { key: "week", label: "Upcoming" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                className={`segmented-btn ${taskScope === opt.key ? "active" : ""}`}
                onClick={() => {
                  setTaskScope(opt.key);
                  setTaskPage(1);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="toolbar">
        <div className="toolbar-filters">
          {activeTab === "tasks" ? (
            <>
              {/* Search input */}
              <div style={{ position: "relative", display: "inline-block" }}>
                <Search
                  size={14}
                  color="var(--text-muted)"
                  style={{ position: "absolute", left: "10px", top: "10px" }}
                />
                <input
                  type="text"
                  className="input-search"
                  placeholder="Search follow-up or lead..."
                  value={taskSearch}
                  onChange={(e) => {
                    setTaskSearch(e.target.value);
                    setTaskPage(1);
                  }}
                />
              </div>

              {/* Status Select */}
              <select
                className="select-compact"
                value={taskStatus}
                onChange={(e) => {
                  setTaskStatus(e.target.value);
                  setTaskPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Priority Select */}
              <select
                className="select-compact"
                value={taskPriority}
                onChange={(e) => {
                  setTaskPriority(e.target.value);
                  setTaskPage(1);
                }}
              >
                <option value="">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Type Select */}
              <select
                className="select-compact"
                value={taskType}
                onChange={(e) => {
                  setTaskType(e.target.value);
                  setTaskPage(1);
                }}
              >
                <option value="">All Channels</option>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="demo">Demo</option>
                <option value="other">Other</option>
              </select>

              {hasTaskFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearTaskFilters}>
                  <X size={13} /> Reset filters
                </button>
              )}
            </>
          ) : (
            <>
              {/* Activity search */}
              <div style={{ position: "relative", display: "inline-block" }}>
                <Search
                  size={14}
                  color="var(--text-muted)"
                  style={{ position: "absolute", left: "10px", top: "10px" }}
                />
                <input
                  type="text"
                  className="input-search"
                  placeholder="Search activity subject or lead..."
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    setActivityPage(1);
                  }}
                />
              </div>

              {/* Activity Type */}
              <select
                className="select-compact"
                value={activityType}
                onChange={(e) => {
                  setActivityType(e.target.value);
                  setActivityPage(1);
                }}
              >
                <option value="">All Activity Types</option>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="demo">Demo</option>
                <option value="linkedin">LinkedIn</option>
              </select>

              {hasActivityFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearActivityFilters}>
                  <X size={13} /> Reset filters
                </button>
              )}
            </>
          )}
        </div>

        {/* Page size selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
          <span>Show:</span>
          <select
            className="select-compact"
            style={{ height: "28px", padding: "0 6px" }}
            value={activeTab === "tasks" ? taskPageSize : activityPageSize}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (activeTab === "tasks") {
                setTaskPageSize(val);
                setTaskPage(1);
              } else {
                setActivityPageSize(val);
                setActivityPage(1);
              }
            }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
          <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
        </div>
      )}

      {/* Main Table Content */}
      <div className="table-wrapper">
        {activeTab === "tasks" ? (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "260px" }}>Follow-up</th>
                <th style={{ width: "210px" }}>Lead</th>
                <th style={{ width: "150px" }}>Due</th>
                <th style={{ width: "95px" }}>Priority</th>
                <th style={{ width: "150px" }}>Assigned to</th>
                <th style={{ width: "180px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    Loading follow-ups...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    No follow-ups found. Nothing is waiting on you right now.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const open = isOpenTask(task.status);
                  const overdued = open && (task.overdue ?? (!!task.due_date && task.due_date.slice(0, 10) < todayIso));
                  const dueToday = open && !overdued && task.due_date?.slice(0, 10) === todayIso;
                  return (
                    <tr key={task.task_id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{task.title}</span>
                          <span
                            className="badge badge-neutral"
                            style={{ textTransform: "capitalize", alignSelf: "flex-start" }}
                          >
                            {task.type}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => onSelectLead(task.lead_id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            textAlign: "left",
                            color: "var(--primary)",
                            fontWeight: 500,
                            fontSize: "13px",
                          }}
                          title="Open this lead"
                        >
                          {task.lead_name || "View lead"}
                        </button>
                        {task.company_name && (
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{task.company_name}</div>
                        )}
                      </td>
                      <td>
                        {overdued ? (
                          <span className="badge badge-danger">Overdue · {formatDueDate(task.due_date)}</span>
                        ) : dueToday ? (
                          <span className="badge badge-warning">Due today</span>
                        ) : (
                          <span style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                      </td>
                      <td>{getPriorityBadge(task.priority)}</td>
                      <td>
                        <span
                          style={{
                            color:
                              task.assigned_salesrep_name === "Unassigned"
                                ? "var(--warning-text)"
                                : "var(--text-secondary)",
                          }}
                        >
                          {task.assigned_salesrep_name || "Unassigned"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          {open ? (
                            <>
                              {task.status?.toLowerCase() === "open" && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleStatusChange(task, "in_progress")}
                                  title="Start working on this follow-up"
                                >
                                  Start
                                </button>
                              )}
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleStatusChange(task, "completed")}
                                title="Mark this follow-up as done"
                              >
                                <Check size={12} />
                                <span>Done</span>
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStatusChange(task, "open")}
                              title="Reopen this follow-up"
                            >
                              <RotateCcw size={12} />
                              <span>Reopen</span>
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onSelectLead(task.lead_id)}
                            title="Open lead"
                            style={{ padding: "0 8px" }}
                          >
                            <ArrowUpRight size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "100px" }}>Type</th>
                <th style={{ width: "240px" }}>Subject</th>
                <th style={{ width: "110px" }}>Outcome</th>
                <th style={{ width: "110px" }}>Date</th>
                <th style={{ width: "95px" }}>Duration</th>
                <th style={{ width: "85px", textAlign: "right" }}>Lead</th>
              </tr>
            </thead>
            <tbody>
              {loading && activities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    Loading activities...
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    No activity records found matching criteria.
                  </td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr key={act.activity_id}>
                    <td>
                      <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
                        {act.type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: "var(--text-main)" }}>
                        {act.subject}
                      </span>
                    </td>
                    <td>{getActivityOutcomeBadge(act.outcome)}</td>
                    <td>
                      <span style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {act.activity_date?.slice(0, 10)}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <Clock size={11} /> {act.duration_minutes}m
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectLead(act.lead_id)}
                        title="Open lead"
                        style={{ padding: "0 8px" }}
                      >
                        <span>Lead</span>
                        <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Pagination Bar */}
        {(activeTab === "tasks" ? taskTotalPages : activityTotalPages) > 1 && (
          <div className="pagination-bar">
            <span>
              Page{" "}
              <strong style={{ color: "var(--text-main)" }}>
                {activeTab === "tasks" ? taskPage : activityPage}
              </strong>{" "}
              of{" "}
              <strong style={{ color: "var(--text-main)" }}>
                {(activeTab === "tasks" ? taskTotalPages : activityTotalPages).toLocaleString()}
              </strong>
            </span>

            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (activeTab === "tasks") setTaskPage((p) => Math.max(1, p - 1));
                  else setActivityPage((p) => Math.max(1, p - 1));
                }}
                disabled={activeTab === "tasks" ? taskPage <= 1 : activityPage <= 1}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (activeTab === "tasks") setTaskPage((p) => Math.min(taskTotalPages, p + 1));
                  else setActivityPage((p) => Math.min(activityTotalPages, p + 1));
                }}
                disabled={activeTab === "tasks" ? taskPage >= taskTotalPages : activityPage >= activityTotalPages}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
