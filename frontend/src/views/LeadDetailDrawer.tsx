import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import type { LeadDetails } from "../types";
import { X, User, Building, MapPin, Tag, Calendar, ShieldCheck, AlertTriangle } from "lucide-react";

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ leadId, onClose }) => {
  const [details, setDetails] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "routing" | "consent" | "history" | "audit">("overview");

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
              className={`tab-btn ${activeTab === "routing" ? "active" : ""}`}
              onClick={() => setActiveTab("routing")}
            >
              Sales Routing
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

                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", fontFamily: "monospace" }}>
                      Formula: {details.scoring_breakdown.formula}
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
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
                      Associated Follow-up Tasks ({details.tasks.length})
                    </h3>
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
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Due: {t.due_date}</div>
                            </div>
                            <span className="badge badge-neutral">{t.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "12px" }}>
                    Monotonic Lifecycle Transitions
                  </h3>
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
