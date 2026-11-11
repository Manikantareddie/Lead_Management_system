import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { useData } from "../context/DataContext";
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
  RotateCcw,
  CalendarClock,
} from "lucide-react";

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated?: () => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ leadId, onClose, onLeadUpdated }) => {
  const { version } = useData();
  const [details, setDetails] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activities" | "details">("overview");

  // Follow-up creation state (lives inside the "Update progress" panel)
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState("email");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);
  const [followUpMsg, setFollowUpMsg] = useState<string | null>(null);

  // The single primary action on this lead: "Update progress".
  const [showProgress, setShowProgress] = useState(false);

  // What happened (activity) state — lives inside the "Update progress" panel.
  const [activityType, setActivityType] = useState("call");
  const [activitySubject, setActivitySubject] = useState("");
  const [activityOutcome, setActivityOutcome] = useState("");

  // Buying decision state — recorded against the lead's deal.
  const [dealId, setDealId] = useState("");
  const [decision, setDecision] = useState<"" | "bought" | "decision_pending" | "lost">("");
  const [decisionReason, setDecisionReason] = useState("");

  // Deals on this lead; a buying decision is recorded against the selected one.
  const deals = details?.opportunities || [];
  const selectedDeal = deals.find((d) => d.opportunity_id === dealId) || deals[0] || null;

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      setFollowUpMsg("Follow-up updated.");
      setTimeout(() => setFollowUpMsg(null), 3000);
      onLeadUpdated?.();
    } catch {
      setFollowUpMsg("Could not update the follow-up. Please try again.");
      setTimeout(() => setFollowUpMsg(null), 4000);
    }
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    const hasActivity = activitySubject.trim().length > 0;
    const hasFollowUp = newTaskTitle.trim().length > 0;
    const hasDecision = decision !== "";

    if (!hasActivity && !hasFollowUp && !hasDecision) {
      setTaskMsg("Add what happened, a follow-up, or a buying decision.");
      setTimeout(() => setTaskMsg(null), 4000);
      return;
    }
    if (decision === "decision_pending" && !hasFollowUp) {
      setTaskMsg("A deal awaiting the customer's decision needs a follow-up.");
      setTimeout(() => setTaskMsg(null), 4000);
      return;
    }
    // The decision endpoint schedules the follow-up itself for decision-pending deals.
    const decisionSchedulesFollowUp = decision === "decision_pending" && hasFollowUp;

    setTaskSubmitting(true);
    setTaskMsg(null);
    try {
      if (hasActivity) {
        await api.createActivity({
          lead_id: leadId,
          type: activityType,
          subject: activitySubject.trim(),
          outcome: activityOutcome || undefined,
        });
      }
      if (hasFollowUp && !decisionSchedulesFollowUp) {
        await api.createTask({
          lead_id: leadId,
          type: newTaskType,
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
          due_date: newTaskDueDate || undefined,
          status: "open",
        });
      }

      let guidance: string;
      if (hasDecision && selectedDeal) {
        await api.decideOpportunity(selectedDeal.opportunity_id, {
          decision: decision as "bought" | "decision_pending" | "lost",
          reason: decisionReason.trim() || undefined,
          next_follow_up_title: decisionSchedulesFollowUp ? newTaskTitle.trim() : undefined,
          next_follow_up_type: newTaskType,
          next_follow_up_due_date: newTaskDueDate || undefined,
          next_follow_up_priority: newTaskPriority,
        });
        guidance =
          decision === "bought"
            ? "Saved. This deal is marked as Bought."
            : decision === "lost"
            ? "Saved. This deal is marked as Lost."
            : `Saved. The customer is still deciding — follow-up on ${newTaskDueDate || "the scheduled date"}.`;
      } else if (hasFollowUp) {
        guidance = `Saved. Next: ${newTaskTitle.trim()}${newTaskDueDate ? ` on ${newTaskDueDate}` : ""}.`;
      } else {
        guidance = "Saved. Activity logged.";
      }

      setActivitySubject("");
      setActivityOutcome("");
      setNewTaskTitle("");
      setNewTaskDueDate("");
      setDecision("");
      setDecisionReason("");
      setTaskMsg(guidance);
      setTimeout(() => setTaskMsg(null), 6000);
      onLeadUpdated?.();
    } catch {
      setTaskMsg("Could not save your update. Please try again.");
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Re-read the lead whenever it changes or the shared refresh bus fires, so the
  // drawer never shows stale status, activities, follow-ups, or deals.
  useEffect(() => {
    if (leadId) {
      loadLead(leadId);
    } else {
      setDetails(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, version]);

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
      case "decision_pending":
        return <span className="badge badge-warning">Decision Pending</span>;
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

  const OPP_STAGE_LABELS: Record<string, string> = {
    discovery: "Discovery",
    qualification: "Qualification",
    proposal: "Proposal",
    negotiation: "Negotiation",
    decision_pending: "Decision Pending",
    closed_won: "Bought",
    closed_lost: "Lost",
  };

  const oppStageLabel = (stage: string) =>
    OPP_STAGE_LABELS[(stage || "").toLowerCase().replace(" ", "_")] || (stage || "").replace(/_/g, " ");

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

  const scoring = details?.scoring_breakdown;
  const assignedRep = details?.salesrep?.name?.trim() || "Unassigned";
  const openTasks = (details?.tasks || []).filter((t) =>
    ["open", "in_progress"].includes((t.status || "").toLowerCase())
  );
  const nextFollowUp = openTasks.reduce<(typeof openTasks)[number] | null>(
    (soonest, t) => (!soonest || (t.due_date || "") < (soonest.due_date || "") ? t : soonest),
    null
  );

  if (!leadId) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              {details && getStatusBadge(details.lead.status)}
              {details?.lead.is_duplicate && (
                <span className="badge badge-warning">Possible duplicate</span>
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
              Overview
            </button>
            <button
              className={`tab-btn ${activeTab === "activities" ? "active" : ""}`}
              onClick={() => setActiveTab("activities")}
            >
              Activity ({details?.activities.length || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === "details" ? "active" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              Details
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="drawer-body">
          {loading && (
            <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
              Loading lead...
            </div>
          )}
          {error && (
            <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
              <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
            </div>
          )}

          {details && !loading && (
            <div>
              {/* Tab: Overview */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Current sales stage + the single primary action */}
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
                          Current sales stage
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500, marginTop: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
                          {getStatusBadge(details.lead.status)}
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={() => setShowProgress((prev) => !prev)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <Plus size={14} />
                        <span>{showProgress ? "Close" : "Update Progress"}</span>
                      </button>
                    </div>

                    {showProgress && (
                      <div
                        style={{
                          borderTop: "1px solid var(--border-subtle)",
                          paddingTop: "12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                            What happened, and what is next?
                          </div>
                          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                            Log your last contact, schedule the next follow-up, and record the buying decision.
                          </p>
                        </div>

                        {taskMsg && (
                          <div
                            style={{
                              fontSize: "12px",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              background: "var(--primary-light)",
                              color: "var(--primary)",
                            }}
                          >
                            {taskMsg}
                          </div>
                        )}

                        <form onSubmit={handleSaveProgress} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                          {/* 1. What happened */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                              1. What happened?
                            </div>
                            <div className="grid-2" style={{ gap: "8px" }}>
                              <select
                                className="select-compact"
                                style={{ height: "30px" }}
                                value={activityType}
                                onChange={(e) => setActivityType(e.target.value)}
                                title="How did you reach them?"
                              >
                                <option value="call">Call</option>
                                <option value="email">Email</option>
                                <option value="meeting">Meeting</option>
                                <option value="demo">Demo</option>
                              </select>
                              <select
                                className="select-compact"
                                style={{ height: "30px" }}
                                value={activityOutcome}
                                onChange={(e) => setActivityOutcome(e.target.value)}
                                title="How did it go?"
                              >
                                <option value="">How did it go? (optional)</option>
                                <option value="connected">Connected</option>
                                <option value="left voicemail">Left voicemail</option>
                                <option value="no answer">No answer</option>
                                <option value="interested">Interested</option>
                                <option value="not interested">Not interested</option>
                              </select>
                            </div>
                            <input
                              type="text"
                              placeholder="What happened? (e.g. Discussed pricing, asked for a proposal)"
                              className="input-search"
                              style={{ width: "100%", height: "30px", fontSize: "12px" }}
                              value={activitySubject}
                              onChange={(e) => setActivitySubject(e.target.value)}
                            />
                          </div>

                          {/* 2. What is next */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                              2. What is next?
                            </div>
                            <input
                              type="text"
                              placeholder="Next step (e.g. Send pricing, Call back about quote)"
                              className="input-search"
                              style={{ width: "100%", height: "30px", fontSize: "12px" }}
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                            />
                            <div className="grid-3" style={{ gap: "8px" }}>
                              <select
                                className="select-compact"
                                style={{ height: "30px" }}
                                value={newTaskType}
                                onChange={(e) => setNewTaskType(e.target.value)}
                                title="How will you follow up?"
                              >
                                <option value="call">Call</option>
                                <option value="email">Email</option>
                                <option value="meeting">Meeting</option>
                                <option value="demo">Demo</option>
                              </select>
                              <select
                                className="select-compact"
                                style={{ height: "30px" }}
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value)}
                                title="Priority"
                              >
                                <option value="low">Low priority</option>
                                <option value="medium">Medium priority</option>
                                <option value="high">High priority</option>
                              </select>
                              <input
                                type="date"
                                className="select-compact"
                                style={{ height: "30px" }}
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                title="Due date"
                              />
                            </div>
                          </div>

                          {/* 3. Buying decision */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                              3. Buying decision (optional)
                            </div>
                            {deals.length === 0 ? (
                              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                                No deal on this lead yet — a deal is created once the lead is qualified.
                              </p>
                            ) : (
                              <>
                                {deals.length > 1 && (
                                  <select
                                    className="select-compact"
                                    style={{ height: "30px" }}
                                    value={dealId || deals[0].opportunity_id}
                                    onChange={(e) => setDealId(e.target.value)}
                                    title="Which deal is this decision for?"
                                  >
                                    {deals.map((d) => (
                                      <option key={d.opportunity_id} value={d.opportunity_id}>
                                        {formatCurrency(d.amount)} · {oppStageLabel(d.stage)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <div className="grid-2" style={{ gap: "8px" }}>
                                  <select
                                    className="select-compact"
                                    style={{ height: "30px" }}
                                    value={decision}
                                    onChange={(e) => setDecision(e.target.value as typeof decision)}
                                    title="Has the customer decided?"
                                  >
                                    <option value="">No decision yet</option>
                                    <option value="bought">Bought</option>
                                    <option value="decision_pending">Decision Pending</option>
                                    <option value="lost">Lost</option>
                                  </select>
                                  {decision && (
                                    <input
                                      type="text"
                                      placeholder="Reason (optional)"
                                      className="input-search"
                                      style={{ height: "30px", fontSize: "12px" }}
                                      value={decisionReason}
                                      onChange={(e) => setDecisionReason(e.target.value)}
                                    />
                                  )}
                                </div>
                                {decision === "decision_pending" && (
                                  <p style={{ fontSize: "11px", color: "var(--warning-text)", margin: 0 }}>
                                    Decision Pending keeps the deal active — add a follow-up above.
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={taskSubmitting}
                              style={{ height: "28px" }}
                            >
                              {taskSubmitting ? "Saving..." : "Save progress"}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>

                  {/* At a glance: assigned rep & next follow-up */}
                  <div className="grid-2" style={{ gap: "12px" }}>
                    <div className="card" style={{ padding: "14px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <User size={13} /> Assigned representative
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: assignedRep === "Unassigned" ? "var(--warning-text)" : "var(--text-main)",
                        }}
                      >
                        {assignedRep}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {assignedRep === "Unassigned"
                          ? "Not yet assigned — needs review"
                          : details.salesrep?.territory
                          ? `Covers ${details.salesrep.territory}`
                          : "Owns this lead"}
                      </div>
                    </div>

                    <div className="card" style={{ padding: "14px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <CalendarClock size={13} /> Next follow-up
                      </div>
                      {nextFollowUp ? (
                        <>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
                            {nextFollowUp.title}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", textTransform: "capitalize" }}>
                            Due {nextFollowUp.due_date ? String(nextFollowUp.due_date).slice(0, 10) : "—"} · {nextFollowUp.priority} priority
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No follow-up scheduled</div>
                      )}
                    </div>
                  </div>

                  {/* Lead score explained */}
                  <div className="card" style={{ background: "var(--bg-subtle)", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>Lead score</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                          <div style={{ fontSize: "26px", fontWeight: 600, color: "var(--primary)", lineHeight: 1.2 }}>
                            {details.scoring_breakdown.lead_score}
                          </div>
                          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>out of 100</span>
                          {scoring?.band && <span className="badge badge-primary">{scoring.band}</span>}
                        </div>
                      </div>
                      {details.scoring_breakdown.frozen && (
                        <span className="badge badge-success">Final score (converted)</span>
                      )}
                    </div>

                    {scoring?.summary && (
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "10px 0 14px", lineHeight: 1.5 }}>
                        {scoring.summary}
                      </p>
                    )}

                    {/* Why this score — plain-language breakdown */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(scoring?.factors ?? []).map((factor) => (
                        <div
                          key={factor.key}
                          style={{ padding: "10px 12px", background: "#ffffff", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>{factor.label}</span>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
                              {factor.score}
                            </span>
                          </div>
                          {factor.text && (
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>{factor.text}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Company & Profile Info */}
                  <div className="grid-2" style={{ gap: "12px" }}>
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

                  {/* Recent activity preview */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
                        Recent activity
                      </h3>
                      {details.activities.length > 3 && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "11px", height: "26px", padding: "0 8px" }}
                          onClick={() => setActiveTab("activities")}
                        >
                          View all ({details.activities.length})
                        </button>
                      )}
                    </div>

                    {details.activities.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                        Nothing recorded yet. Use “Update Progress” to log what happened.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {[...details.activities]
                          .sort((a, b) => String(b.activity_date).localeCompare(String(a.activity_date)))
                          .slice(0, 3)
                          .map((act) => (
                            <div
                              key={act.activity_id}
                              style={{
                                padding: "9px 12px",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "6px",
                                fontSize: "13px",
                                background: "#ffffff",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "10px",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div className="text-truncate" style={{ fontWeight: 500, color: "var(--text-main)" }}>
                                  {act.subject}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                                  {act.type} · {act.activity_date?.slice(0, 10)}
                                </div>
                              </div>
                              {getActivityOutcomeBadge(act.outcome)}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Follow-ups */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
                        Follow-ups ({details.tasks.length})
                      </h3>
                    </div>

                    {followUpMsg && (
                      <div
                        style={{
                          marginBottom: "8px",
                          padding: "7px 11px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          backgroundColor: followUpMsg.startsWith("Could not") ? "var(--bg-danger-soft, #fef2f2)" : "var(--bg-success-soft, #f0fdf4)",
                          color: followUpMsg.startsWith("Could not") ? "var(--text-danger, #b91c1c)" : "var(--text-success, #15803d)",
                        }}
                      >
                        {followUpMsg}
                      </div>
                    )}

                    {details.tasks.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No follow-ups scheduled yet.</p>
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
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {["open", "in_progress"].includes((t.status || "").toLowerCase()) ? (
                                <>
                                  {t.status?.toLowerCase() === "open" && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleUpdateTaskStatus(t.task_id, "in_progress")}
                                      title="Start working on this follow-up"
                                    >
                                      Start
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleUpdateTaskStatus(t.task_id, "completed")}
                                    title="Mark this follow-up as done"
                                  >
                                    <Check size={12} />
                                    <span>Done</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleUpdateTaskStatus(t.task_id, "open")}
                                  title="Reopen this follow-up"
                                >
                                  <RotateCcw size={12} />
                                  <span>Reopen</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Details: Deals */}
              {activeTab === "details" && (
                <div style={{ marginBottom: "26px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
                        Deals ({details.opportunities.length})
                      </h3>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                        Opportunities linked to this lead
                      </p>
                    </div>
                  </div>

                  {details.opportunities.length === 0 ? (
                    <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      <Briefcase size={24} color="var(--text-light)" style={{ margin: "0 auto 8px", display: "block" }} />
                      No deals yet for this lead.
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>
                        A deal is created once the lead is qualified.
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
                              {getOppStageBadge(opp.stage)}
                              {opp.is_duplicate && (
                                <span className="badge badge-warning">Possible duplicate</span>
                              )}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
                              {formatCurrency(opp.amount)}
                            </div>
                          </div>

                          <div className="grid-2" style={{ gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
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
                      Activity history ({details.activities.length})
                    </h3>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                      Every contact with this customer, in order
                    </p>
                  </div>

                  {details.activities.length === 0 ? (
                    <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      <Activity size={24} color="var(--text-light)" style={{ margin: "0 auto 8px", display: "block" }} />
                      Nothing recorded yet for this lead.
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

              {/* Details: Assignment */}
              {activeTab === "details" && (
                <div style={{ marginBottom: "26px" }}>
                  {details.routing_status.is_assigned ? (
                    <div className="card" style={{ borderLeft: "4px solid var(--success)", marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--success-text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={14} /> Assigned representative
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginTop: "4px" }}>
                        {details.salesrep.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Email: {details.salesrep.email}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                        Territory: <span style={{ color: "var(--success)", fontWeight: 500 }}>{details.salesrep.territory}</span> (Lead: {details.lead.territory})
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Specialty: <span style={{ color: "var(--success)", fontWeight: 500 }}>{details.salesrep.product_specialty}</span> (Product: {details.lead.product_interest})
                      </div>
                    </div>
                  ) : (
                    <div className="card" style={{ borderLeft: "4px solid var(--warning)", marginBottom: "16px", background: "var(--warning-bg)" }}>
                      <div style={{ fontSize: "12px", color: "var(--warning-text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertTriangle size={14} /> Not yet assigned
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.45 }}>
                        No sales representative covers both territory '{details.lead.territory}' and product interest '{details.lead.product_interest}'. Outreach is on hold until someone is assigned.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Details: Consent */}
              {activeTab === "details" && (
                <div style={{ marginBottom: "26px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "10px" }}>
                    Consent
                  </h3>
                  {details.consents.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No consent records on file for this contact.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {details.consents.map((csn) => (
                        <div key={csn.consent_id} style={{ padding: "10px 14px", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
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

              {/* Details: Stage history */}
              {activeTab === "details" && (
                <div style={{ marginBottom: "26px" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
                      Stage history
                    </h3>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                      How this lead moved between sales stages, and who moved it
                    </p>
                  </div>

                  {details.stage_history.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No stage changes recorded yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {details.stage_history.map((sh, idx) => (
                        <div key={sh.stage_history_id} style={{ padding: "10px 14px", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px", background: "#f8fafc" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 500, color: "var(--text-main)" }}>Step {idx + 1}: {sh.from_stage || "None"} → {sh.to_stage}</span>
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>When: {sh.changed_at}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>By: {sh.changed_by}</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>{sh.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Details: Follow-up decisions */}
              {activeTab === "details" && (
                <div style={{ marginBottom: "26px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>
                    Follow-up decisions
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                    Why the system did or did not schedule a follow-up for this lead.
                  </p>
                  {details.task_decisions.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No follow-up decisions recorded yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {details.task_decisions.map((td) => (
                        <div key={td.decision_id} style={{ padding: "10px 14px", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontSize: "13px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span className={`badge ${td.decision === 'created' ? 'badge-success' : td.decision === 'deferred' ? 'badge-warning' : 'badge-danger'}`}>
                              Outcome: {td.decision}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px" }}>Reason: <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{td.reason}</span></div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>Consent at the time: {td.consent_status_at_evaluation}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Checked at: {td.evaluated_at}</div>
                          {td.task_id && <div style={{ color: "var(--success)", fontSize: "11px", marginTop: "2px" }}>A follow-up was scheduled from this decision.</div>}
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
