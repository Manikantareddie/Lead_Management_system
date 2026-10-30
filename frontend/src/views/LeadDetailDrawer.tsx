import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import type { LeadDetails } from "../types";
import {
  X,
  User,
  Building,
  MapPin,
  Tag,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Check,
  TrendingUp,
  Activity,
  DollarSign,
  Clock,
  Briefcase,
  ArrowRight,
} from "lucide-react";

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated?: () => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ leadId, onClose, onLeadUpdated }) => {
  const [details, setDetails] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "opportunities" | "activities" | "routing" | "consent" | "history" | "audit"
  >("overview");

  // Task creation state
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState("email");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);

  // Stage transition state
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      setTaskMsg("Task status updated successfully.");
      setTimeout(() => setTaskMsg(null), 3000);
      if (leadId) loadLead(leadId);
    } catch (e: any) {
      setTaskMsg("Failed to update task: " + e.message);
      setTimeout(() => setTaskMsg(null), 4000);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !newTaskTitle.trim()) return;
    setTaskSubmitting(true);
    setTaskMsg(null);
    try {
      await api.createTask({
        lead_id: leadId,
        type: newTaskType,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        due_date: newTaskDueDate || undefined,
        status: "open",
      });
      setNewTaskTitle("");
      setNewTaskDueDate("");
      setShowCreateTask(false);
      setTaskMsg("Task created successfully!");
      setTimeout(() => setTaskMsg(null), 3000);
      loadLead(leadId);
    } catch (e: any) {
      setTaskMsg("Failed to create task: " + e.message);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const getNextStages = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case "New":
        return ["Contacted", "Disqualified"];
      case "Contacted":
        return ["Qualified", "Disqualified"];
      case "Qualified":
        return ["Converted", "Disqualified"];
      default:
        return [];
    }
  };

  const handleStageTransition = async (toStage: string) => {
    if (!leadId) return;
    setTransitioning(true);
    setTransitionMsg(null);
    try {
      await api.transitionLeadStage(leadId, {
        to_stage: toStage,
        changed_by: details?.lead.assigned_salesrep_id || undefined,
        reason: `Stage transition to ${toStage} executed from Sales Operations Console`,
      });
      setTransitionMsg({
        type: "success",
        text: `Stage successfully transitioned to "${toStage}". Monotonic history logged.`,
      });
      setTimeout(() => setTransitionMsg(null), 4000);
      await loadLead(leadId);
      if (onLeadUpdated) onLeadUpdated();
    } catch (err: any) {
      setTransitionMsg({
        type: "error",
        text: err.message || `Failed to transition lead to ${toStage}`,
      });
      setTimeout(() => setTransitionMsg(null), 5000);
    } finally {
      setTransitioning(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      loadLead(leadId);
    } else {
      setDetails(null);
    }
  }, [leadId]);

  const loadLead = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getLeadDetails(id);
      setDetails(res);
    } catch (err: any) {
      setError(err.message || "Failed to load lead details");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "qualified":
        return <span className="badge badge-success">Qualified</span>;
      case "contacted":
        return <span className="badge badge-primary">Contacted</span>;
      case "new":
        return <span className="badge badge-neutral">New</span>;
      case "converted":
        return <span className="badge badge-success">Converted</span>;
      case "disqualified":
        return <span className="badge badge-neutral">Disqualified</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getOppStageBadge = (stage: string) => {
    const s = stage?.toLowerCase().replace("-", "_").replace(" ", "_");
    switch (s) {
      case "closed_won":
        return <span className="badge badge-success">Closed Won</span>;
      case "closed_lost":
        return <span className="badge badge-neutral">Closed Lost</span>;
      case "negotiation":
        return <span className="badge badge-warning">Negotiation</span>;
      case "proposal":
        return <span className="badge badge-primary">Proposal</span>;
      case "qualification":
        return <span className="badge badge-neutral">Qualification</span>;
      case "discovery":
        return <span className="badge badge-neutral">Discovery</span>;
      default:
        return <span className="badge badge-neutral">{stage}</span>;
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
        return <span className="badge badge-neutral">{outcome || "logged"}</span>;
    }
  };

  if (!leadId) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="id-tag">{leadId}</span>
              {details && getStatusBadge(details.lead.status)}
              {details?.lead.is_duplicate && (
                <span className="badge badge-warning">Duplicate Lead</span>
              )}
            </div>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-main)", margin: "4px 0 2px" }}>
              {details ? details.company.name : "Loading lead..."}
            </h2>
            {details && (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                {details.contact.first_name} {details.contact.last_name} • {details.contact.email}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="btn btn-ghost btn-sm"
            style={{ width: "32px", height: "32px", padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ padding: "0 20px" }}>
          <div className="tabs-nav">
            <button
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Scoring & Profile
            </button>
            <button
              className={`tab-btn ${activeTab === "opportunities" ? "active" : ""}`}
              onClick={() => setActiveTab("opportunities")}
            >
              Deals ({details?.opportunities.length || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === "activities" ? "active" : ""}`}
              onClick={() => setActiveTab("activities")}
            >
              Activities ({details?.activities.length || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === "routing" ? "active" : ""}`}
              onClick={() => setActiveTab("routing")}
            >
              Routing
            </button>
            <button
              className={`tab-btn ${activeTab === "consent" ? "active" : ""}`}
              onClick={() => setActiveTab("consent")}
            >
              Consent ({details?.consents.length || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Stage History ({details?.stage_history.length || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
              onClick={() => setActiveTab("audit")}
            >
              Decision Audit ({details?.task_decisions.length || 0})
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="drawer-body">
          {loading && (
            <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
              Loading full 360° lead profile...
            </div>
          )}
          {error && (
            <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
              <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
            </div>
          )}

          {details && !loading && (
            <div>
              {/* Tab: Overview & Scoring */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Lifecycle Progression & Stage Action Bar */}
                  <div
                    className="card"
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                          Lifecycle Progression
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500, marginTop: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>Stage:</span>
                          {getStatusBadge(details.lead.status)}
                          {details.scoring_breakdown.frozen && (
                            <span style={{ fontSize: "11px", color: "var(--success-text)", fontWeight: 600 }}>
                              • Finalized / Score Frozen
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {getNextStages(details.lead.status).map((tgtStage) => (
                          <button
                            key={tgtStage}
                            className={tgtStage === "Disqualified" ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                            disabled={transitioning}
                            onClick={() => handleStageTransition(tgtStage)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px" }}
                          >
                            {transitioning ? (
                              "Updating..."
                            ) : tgtStage === "Disqualified" ? (
                              "Disqualify Lead"
                            ) : (
                              <>
                                Advance to {tgtStage}
                                <ArrowRight size={13} />
                              </>
                            )}
                          </button>
                        ))}
                        {getNextStages(details.lead.status).length === 0 && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <ShieldCheck size={14} color="var(--success)" /> Terminal Stage (Locked)
                          </span>
                        )}
                      </div>
                    </div>

                    {transitionMsg && (
                      <div
                        style={{
                          padding: "8px 12px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 500,
                          backgroundColor: transitionMsg.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                          color: transitionMsg.type === "success" ? "var(--success-text)" : "var(--danger-text)",
                          border: `1px solid ${transitionMsg.type === "success" ? "var(--success)" : "var(--danger)"}`,
                        }}
                      >
                        {transitionMsg.text}
                      </div>
                    )}
                  </div>

                  {/* Lead Scorecard */}
                  <div className="card" style={{ background: "var(--bg-subtle)", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>
                          Calculated Lead Score
                        </div>
                        <div style={{ fontSize: "26px", fontWeight: 600, color: "var(--primary)", lineHeight: 1.2 }}>
                          {details.scoring_breakdown.lead_score} <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)" }}>/ 100</span>
                        </div>
                      </div>
                      {details.scoring_breakdown.frozen && (
                        <span className="badge badge-success">Score Frozen (Converted)</span>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                      Multi-Factor Composite Score Evaluation (Model Active)
                    </div>

                    {/* Component scores */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <div style={{ padding: "10px", background: "#ffffff", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Fit (50% wt)</div>
                        <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
                          {details.scoring_breakdown.fit_score}
                        </div>
                      </div>
                      <div style={{ padding: "10px", background: "#ffffff", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Intent (30% wt)</div>
                        <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
                          {details.scoring_breakdown.intent_score}
                        </div>
                      </div>
                      <div style={{ padding: "10px", background: "#ffffff", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Engagement (20% wt)</div>
                        <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
                          {details.scoring_breakdown.engagement_score}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company & Profile Info */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="card" style={{ padding: "14px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Building size={13} /> Company Details
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)", marginBottom: "4px" }}>
                        {details.company.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Industry: {details.company.industry || "—"}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Size: {details.company.size || "—"} employees</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Country: {details.company.country || "—"}</div>
                    </div>

                    <div className="card" style={{ padding: "14px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Tag size={13} /> Lead Attributes
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Product: <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{details.lead.product_interest}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Territory: <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{details.lead.territory}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "3px" }}>
                        Source: <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{details.lead.source}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        Created: <span style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{details.lead.created_at.slice(0, 10)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tasks Summary */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
                        Associated Follow-up Tasks ({details.tasks.length})
                      </h3>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "11px", height: "26px", padding: "0 8px" }}
                        onClick={() => setShowCreateTask(!showCreateTask)}
                      >
                        <Plus size={12} />
                        <span>{showCreateTask ? "Cancel" : "Add Task"}</span>
                      </button>
                    </div>

                    {taskMsg && (
                      <div style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "4px", background: "var(--primary-light)", color: "var(--primary)", marginBottom: "8px" }}>
                        {taskMsg}
                      </div>
                    )}

                    {showCreateTask && (
                      <form onSubmit={handleCreateTask} style={{ background: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)", marginBottom: "12px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>New Follow-up Task</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <input
                            type="text"
                            placeholder="Task title (e.g. Follow-up demo call)..."
                            className="input-search"
                            style={{ width: "100%", height: "30px", fontSize: "12px" }}
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            required
                          />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                            <select
                              className="select-compact"
                              style={{ height: "30px" }}
                              value={newTaskType}
                              onChange={(e) => setNewTaskType(e.target.value)}
                            >
                              <option value="email">Email</option>
                              <option value="call">Call</option>
                              <option value="meeting">Meeting</option>
                              <option value="demo">Demo</option>
                            </select>
                            <select
                              className="select-compact"
                              style={{ height: "30px" }}
                              value={newTaskPriority}
                              onChange={(e) => setNewTaskPriority(e.target.value)}
                            >
                              <option value="low">Low Priority</option>
                              <option value="medium">Medium Priority</option>
                              <option value="high">High Priority</option>
                            </select>
                            <input
                              type="date"
                              className="select-compact"
                              style={{ height: "30px" }}
                              value={newTaskDueDate}
                              onChange={(e) => setNewTaskDueDate(e.target.value)}
                            />
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={taskSubmitting}
                              style={{ height: "28px" }}
                            >
                              {taskSubmitting ? "Saving..." : "Create Task"}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {details.tasks.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No outreach tasks recorded for this lead.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {details.tasks.map((t) => (
                          <div
                            key={t.task_id}
                            style={{
                              padding: "9px 12px",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "6px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "13px",
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 500, color: "var(--text-main)" }}>
                                {t.title} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({t.type})</span>
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Due: {t.due_date} • Priority: <span style={{ textTransform: "capitalize" }}>{t.priority}</span></div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <select
                                className="select-compact"
                                style={{ height: "26px", fontSize: "11px", padding: "0 6px" }}
                                value={t.status}
                                onChange={(e) => handleUpdateTaskStatus(t.task_id, e.target.value)}
                                title="Update task status"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Opportunities & Outcomes */}
              {activeTab === "opportunities" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
                        Pipeline Opportunities ({details.opportunities.length})
                      </h3>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                        Deal progression and rule-governed won/lost outcomes
                      </p>
                    </div>
                  </div>

                  {details.opportunities.length === 0 ? (
                    <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      <Briefcase size={24} color="var(--text-light)" style={{ margin: "0 auto 8px", display: "block" }} />
                      No opportunities associated with this lead.
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>
                        Opportunities are created when leads advance to Qualified or Converted status.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {details.opportunities.map((opp) => (
                        <div
                          key={opp.opportunity_id}
                          style={{
                            padding: "12px 14px",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "6px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className="id-tag">{opp.opportunity_id}</span>
                              {getOppStageBadge(opp.stage)}
                              {opp.is_duplicate && (
                                <span className="badge badge-warning">Duplicate Opp</span>
                              )}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
                              {formatCurrency(opp.amount)}
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                            <div>
                              Close Date: <span style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{opp.close_date || "—"}</span>
                            </div>
                            {opp.competitor && (
                              <div>
                                Competitor: <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{opp.competitor}</span>
                              </div>
                            )}
                          </div>

                          {opp.won_lost_reason && (
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "6px 10px",
                                borderRadius: "4px",
                                backgroundColor: opp.stage === "closed_won" ? "var(--success-bg)" : "var(--bg-subtle)",
                                border: `1px solid ${opp.stage === "closed_won" ? "var(--success-border)" : "var(--border-subtle)"}`,
                                fontSize: "12px",
                                color: opp.stage === "closed_won" ? "var(--success-text)" : "var(--text-secondary)",
                              }}
                            >
                              <strong>Outcome Reason:</strong> {opp.won_lost_reason.replace(/_/g, " ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Activity History */}
              {activeTab === "activities" && (
                <div>
                  <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
                      Logged Activity History ({details.activities.length})
                    </h3>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                      Append-only record of cadence interactions and buyer touchpoints
                    </p>
                  </div>

                  {details.activities.length === 0 ? (
                    <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      <Activity size={24} color="var(--text-light)" style={{ margin: "0 auto 8px", display: "block" }} />
                      No activity touchpoints recorded for this lead.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {details.activities.map((act) => (
                        <div
                          key={act.activity_id}
                          style={{
                            padding: "10px 14px",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "6px",
                            fontSize: "13px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className="id-tag">{act.activity_id}</span>
                              <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>{act.type}</span>
                              <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{act.subject}</span>
                            </div>
                            {getActivityOutcomeBadge(act.outcome)}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                            <span>Timestamp: {act.activity_date?.slice(0, 19).replace("T", " ")}</span>
                            <span>Duration: {act.duration_minutes} min</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Routing & Rep Assignment */}
              {activeTab === "routing" && (
                <div>
                  {details.routing_status.is_assigned ? (
                    <div className="card" style={{ borderLeft: "4px solid var(--success)", marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--success-text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={14} /> Representative Assigned
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                        {details.salesrep.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Email: {details.salesrep.email}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                        Territory Match: <span style={{ color: "var(--success)", fontWeight: 500 }}>{details.salesrep.territory}</span> (Lead: {details.lead.territory})
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Specialty Match: <span style={{ color: "var(--success)", fontWeight: 500 }}>{details.salesrep.product_specialty}</span> (Product: {details.lead.product_interest})
                      </div>
                    </div>
                  ) : (
                    <div className="card" style={{ borderLeft: "4px solid var(--warning)", marginBottom: "16px", background: "var(--warning-bg)" }}>
                      <div style={{ fontSize: "12px", color: "var(--warning-text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertTriangle size={14} /> Explicitly Unassigned State (Routing Exception)
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--warning-text)", marginTop: "4px" }}>
                        Reason: {details.routing_status.routing_reason || "no_compatible_salesrep"}
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.45 }}>
                        No active sales representative matched both territory '{details.lead.territory}' and product interest '{details.lead.product_interest}'. Follow-up outreach is held until compatible assignment.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Consent Compliance */}
              {activeTab === "consent" && (
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "10px" }}>
                    Append-Only Consent History
                  </h3>
                  {details.consents.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No consent records on file for this contact.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {details.consents.map((csn) => (
                        <div key={csn.consent_id} style={{ padding: "10px 14px", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span className="id-tag">{csn.consent_id}</span>
                            <span className={`badge ${csn.status === 'granted' ? 'badge-success' : 'badge-danger'}`}>
                              {csn.status}
                            </span>
                          </div>
                          <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>Channel: <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{csn.channel}</span></div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>Consented At: {csn.consented_at}</div>
                          {csn.withdrawn_at && <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "2px" }}>Withdrawn At: {csn.withdrawn_at}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Stage History */}
              {activeTab === "history" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
                        Monotonic Lifecycle Transitions
                      </h3>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                        Append-only event audit trail of stage progression
                      </p>
                    </div>

                    {getNextStages(details.lead.status).length > 0 && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        {getNextStages(details.lead.status).map((tgtStage) => (
                          <button
                            key={tgtStage}
                            className={tgtStage === "Disqualified" ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                            disabled={transitioning}
                            onClick={() => handleStageTransition(tgtStage)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            {transitioning ? "Updating..." : tgtStage === "Disqualified" ? "Disqualify" : <>Advance to {tgtStage} <ArrowRight size={12} /></>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {transitionMsg && (
                    <div
                      style={{
                        marginBottom: "12px",
                        padding: "8px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 500,
                        backgroundColor: transitionMsg.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                        color: transitionMsg.type === "success" ? "var(--success-text)" : "var(--danger-text)",
                        border: `1px solid ${transitionMsg.type === "success" ? "var(--success)" : "var(--danger)"}`,
                      }}
                    >
                      {transitionMsg.text}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {details.stage_history.map((sh, idx) => (
                      <div key={sh.stage_history_id} style={{ padding: "10px 14px", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px", background: "#f8fafc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 500, color: "var(--text-main)" }}>Step {idx + 1}: {sh.from_stage || "None"} → {sh.to_stage}</span>
                          <span className="id-tag">{sh.stage_history_id}</span>
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Timestamp: {sh.changed_at}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Actor: {sh.changed_by}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>{sh.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Decision Audit */}
              {activeTab === "audit" && (
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>
                    Task Decision Audit Log (Explainability)
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                    Audit record evaluated against business rules to guarantee explainable task gating.
                  </p>
                  {details.task_decisions.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No candidate decision logs evaluated for this lead.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {details.task_decisions.map((td) => (
                        <div key={td.decision_id} style={{ padding: "10px 14px", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span className="id-tag">{td.decision_id}</span>
                            <span className={`badge ${td.decision === 'created' ? 'badge-success' : td.decision === 'deferred' ? 'badge-warning' : 'badge-danger'}`}>
                              Decision: {td.decision}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px" }}>Reason: <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{td.reason}</span></div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>Consent Status: {td.consent_status_at_evaluation}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Evaluated At: {td.evaluated_at}</div>
                          {td.task_id && <div style={{ color: "var(--success)", fontSize: "11px", marginTop: "2px" }}>Linked Task: {td.task_id}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
