import React from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import {
  CheckSquare,
  UserCheck,
  Briefcase,
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  Inbox,
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (view: string, filter?: { stage?: string; oppStage?: string; scoreBand?: string }) => void;
  onSelectLead: (leadId: string) => void;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDueDate(value: string): string {
  const raw = (value || "").slice(0, 10);
  const parts = raw.split("-");
  if (parts.length !== 3) return value || "No due date";
  const [y, m, d] = parts;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(m, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return raw;
  return `${parseInt(d, 10)} ${months[monthIndex]} ${y}`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onSelectLead }) => {
  const { summary: data, summaryLoading, summaryError, refresh } = useData();
  const { user } = useAuth();

  if (summaryLoading && !data) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)" }}>
        <p>Loading your day...</p>
      </div>
    );
  }

  if (summaryError || !data) {
    return (
      <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "16px 20px" }}>
        <h3 style={{ color: "var(--danger)", margin: "0 0 6px 0", fontSize: "15px", fontWeight: 600 }}>Unable to load your day</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>{summaryError}</p>
        <button onClick={refresh} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
          Retry
        </button>
      </div>
    );
  }

  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const todayLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const firstName = (user?.display_name || "").split(" ")[0];

  const nextActions = data.next_actions || [];

  return (
    <div className="view-container">
      {/* Greeting */}
      <div style={{ marginBottom: "4px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
          Here's what needs your attention today · {todayLabel}
        </p>
      </div>

      {/* Action Counts */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <div
          className="stat-card"
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate("tasks")}
          title="View follow-up tasks"
        >
          <div className="stat-header">
            <span className="stat-label">Follow-ups due</span>
            <CheckSquare size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.follow_ups_due.toLocaleString()}</div>
          <div className="stat-sub">
            {data.tasks_overdue.toLocaleString()} overdue · {data.tasks_due_today.toLocaleString()} due today
          </div>
        </div>

        <div
          className="stat-card"
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate("leads", { stage: "New" })}
          title="View new leads awaiting review"
        >
          <div className="stat-header">
            <span className="stat-label">New leads</span>
            <Inbox size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.new_leads.toLocaleString()}</div>
          <div className="stat-sub">Awaiting first review</div>
        </div>

        <div
          className="stat-card"
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate("leads", { stage: "Qualified" })}
          title="View qualified leads"
        >
          <div className="stat-header">
            <span className="stat-label">Qualified leads</span>
            <UserCheck size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.qualified_leads.toLocaleString()}</div>
          <div className="stat-sub">Ready for follow-up</div>
        </div>

        <div
          className="stat-card"
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate("pipeline")}
          title="View open opportunities"
        >
          <div className="stat-header">
            <span className="stat-label">Open opportunities</span>
            <Briefcase size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.open_opportunities.toLocaleString()}</div>
          <div className="stat-sub">Active deals in progress</div>
        </div>
      </div>

      {/* Next Actions */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarClock size={16} color="var(--primary)" />
              Your next actions
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              The follow-ups that need you most — most overdue first
            </p>
          </div>
          <button onClick={() => onNavigate("tasks")} className="btn btn-secondary btn-sm">
            <span>View all tasks</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {nextActions.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            You're all caught up — no follow-ups are waiting.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {nextActions.map((action) => (
              <div
                key={action.task_id}
                onClick={() => action.lead_id && onSelectLead(action.lead_id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "#f8fafc",
                  cursor: action.lead_id ? "pointer" : "default",
                }}
                title={action.lead_id ? "Open lead details" : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "6px",
                      backgroundColor: action.overdue ? "#fef2f2" : "var(--primary-light)",
                      color: action.overdue ? "var(--danger)" : "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {action.overdue ? <AlertTriangle size={15} /> : <CheckSquare size={15} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-main)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {action.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {action.lead_name || "Unknown contact"}
                      {action.company_name ? ` · ${action.company_name}` : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  {action.priority && action.priority.toLowerCase() === "high" && (
                    <span className="badge badge-warning" style={{ fontSize: "10px" }}>High</span>
                  )}
                  {action.overdue ? (
                    <span className="badge badge-danger" style={{ fontSize: "11px" }}>Overdue</span>
                  ) : (
                    <span className="badge badge-neutral" style={{ fontSize: "11px" }}>
                      Due {formatDueDate(action.due_date)}
                    </span>
                  )}
                  <ArrowRight size={13} color="var(--text-muted)" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
