import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useData } from "../context/DataContext";
import type { ValidationStatus } from "../types";
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  Layers,
} from "lucide-react";

interface DataQualityViewProps {
  onNavigate?: (tab: string) => void;
}

const PLACEHOLDER = "—";

export const DataQualityView: React.FC<DataQualityViewProps> = ({ onNavigate }) => {
  const { health, version } = useData();
  const recordCounts = health?.record_counts ?? null;
  const [status, setStatus] = useState<ValidationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runSuccessMessage, setRunSuccessMessage] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const validation = await api.getValidationStatus();
      setStatus(validation);
    } catch (err: any) {
      setError(err.message || "Failed to load validation status");
    } finally {
      setLoading(false);
    }
  };

  const handleRunValidation = async () => {
    setRunning(true);
    setRunSuccessMessage(null);
    setError(null);
    try {
      const data = await api.runValidation();
      setStatus(data);
      if (data.is_valid) {
        setRunSuccessMessage("On-demand verification completed: dataset is valid with 0 violations.");
      } else {
        setRunSuccessMessage(`Verification completed with ${data.error_count} error(s) and ${data.warning_count} warning(s).`);
      }
    } catch (err: any) {
      setError(err.message || "Validation run failed");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const deliverableTables: Array<{
    entity: string;
    name: string;
    category: string;
    countKey?: string;
    entityKey: string;
    description: string;
  }> = [
    { entity: "Companies", name: "companies.csv", category: "Master Data", countKey: "companies", entityKey: "company", description: "B2B enterprise account entities (domain, size, industry, tier)" },
    { entity: "Contacts", name: "contacts.csv", category: "Master Data", countKey: "contacts", entityKey: "contact", description: "Prospect decision-makers, verified emails, and job titles" },
    { entity: "Sales Representatives", name: "salesreps.csv", category: "Operations", entityKey: "salesrep", description: "Territory-assigned active reps and product specialty alignments" },
    { entity: "Score Configuration", name: "score_rules.csv", category: "Configuration", entityKey: "score_rule", description: "Deterministic weighting rules (Fit 50%, Intent 30%, Engagement 20%)" },
    { entity: "Marketing Campaigns", name: "campaigns.csv", category: "Master Data", entityKey: "campaign", description: "Inbound channels and outbound marketing initiatives" },
    { entity: "Operational Leads", name: "leads.csv", category: "Core Pipeline", countKey: "leads", entityKey: "lead", description: "Operational leads with composite scoring, territory routing, and deduplication" },
    { entity: "Campaign Attributions", name: "lead_campaigns.csv", category: "Bridge Table", entityKey: "lead_campaign", description: "Multi-touch campaign attribution mapping (N:M join)" },
    { entity: "Channel Consents", name: "consents.csv", category: "Compliance", entityKey: "consent", description: "Time-effective consent grants and opt-out timestamps by channel" },
    { entity: "Activity Touchpoints", name: "activities.csv", category: "Event History", countKey: "activities", entityKey: "activity", description: "Cadence interactions (calls, emails, meetings, demos) with duration" },
    { entity: "Follow-up Tasks", name: "tasks.csv", category: "Operations", countKey: "tasks", entityKey: "task", description: "Actionable outreach tasks prioritized by lead score and rep allocation" },
    { entity: "Task Decision Audits", name: "task_decisions.csv", category: "Explainability Audit", countKey: "task_decisions", entityKey: "task_decision", description: "Immutable governance records explaining task gating decisions" },
    { entity: "Pipeline Opportunities", name: "opportunities.csv", category: "Revenue Pipeline", countKey: "opportunities", entityKey: "opportunity", description: "Qualified deals with win/loss reasons and competitor attributions" },
    { entity: "Stage Histories", name: "stage_histories.csv", category: "Lifecycle Audit", entityKey: "stage_history", description: "Monotonic append-only lifecycle stage transition log" },
  ];

  const rulesList = status?.rules_checked && status.rules_checked.length > 0 ? status.rules_checked : [];

  // ---- Live-derived metrics (no hardcoded constants) ----
  const grandTotal = recordCounts
    ? Object.values(recordCounts).reduce((acc, v) => acc + (Number(v) || 0), 0)
    : null;
  const trackedTables = recordCounts ? Object.keys(recordCounts).length : null;

  const getRowCount = (countKey?: string): number | null => {
    if (!countKey || !recordCounts) return null;
    const value = recordCounts[countKey];
    return typeof value === "number" ? value : null;
  };

  const integrityRate = status && !status.is_system_error
    ? status.is_valid
      ? "100.0%"
      : grandTotal && grandTotal > 0
      ? `${Math.max(0, 100 - (status.total_issues / grandTotal) * 100).toFixed(1)}%`
      : PLACEHOLDER
    : PLACEHOLDER;

  const rulesTotal = status?.rules_checked?.length ?? 0;
  const rulesPassed = status ? Math.max(0, rulesTotal - (status.is_system_error ? 0 : status.error_count)) : 0;
  const rulesVerifiedValue = status && rulesTotal > 0 ? `${rulesPassed} of ${rulesTotal} Passed` : PLACEHOLDER;

  const getTableStatus = (entityKey: string) => {
    if (loading && !status) {
      return <span className="badge badge-neutral">Checking...</span>;
    }
    if (!status) {
      return <span className="badge badge-neutral">Pending Check</span>;
    }
    if (status.is_system_error) {
      return <span className="badge badge-warning">Unverified</span>;
    }
    const tableIssues = (status.issues || []).filter(
      (i) => i.record_type?.toLowerCase() === entityKey || i.record_type?.toLowerCase().includes(entityKey)
    );
    if (tableIssues.length > 0) {
      const errors = tableIssues.filter((i) => i.severity === "ERROR").length;
      return (
        <span className="badge badge-danger">
          <AlertTriangle size={11} /> {errors} Issue{errors !== 1 ? "s" : ""}
        </span>
      );
    }
    return (
      <span className="badge badge-success">
        <CheckCircle2 size={11} /> Verified Clean
      </span>
    );
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Core Pipeline":
        return <span className="badge badge-primary">Core Pipeline</span>;
      case "Revenue Pipeline":
        return <span className="badge badge-success">Revenue Pipeline</span>;
      case "Compliance":
        return <span className="badge badge-warning">Compliance</span>;
      case "Explainability Audit":
      case "Lifecycle Audit":
        return <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{category}</span>;
      default:
        return <span className="badge badge-neutral">{category}</span>;
    }
  };

  const formattedTimestamp = status?.checked_at
    ? new Date(status.checked_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
      })
    : null;

  const grandTotalLabel = grandTotal !== null ? grandTotal.toLocaleString() : PLACEHOLDER;

  return (
    <div className="view-container">
      {/* Clean Baseline Architecture Explainer Banner */}
      <div
        className="card"
        style={{
          backgroundColor: "#ffffff",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          borderLeft: "4px solid var(--primary)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: "280px" }}>
          <ShieldCheck size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-main)" }}>Clean Baseline Architecture:</strong> All{" "}
            <strong style={{ color: "var(--text-main)" }}>{grandTotalLabel} active production records</strong> are continuously
            verified for referential integrity and schema compliance. Benchmark anomaly cases are isolated in a separate
            evaluation set so production data remains uncorrupted.
          </div>
        </div>
        {onNavigate && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate("investigations")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
          >
            <span>View Anomaly Investigations</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* High-Level Data Health KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Total Production Records
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>
            {grandTotalLabel}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Across {trackedTables !== null ? trackedTables : PLACEHOLDER} Relational Tables
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Referential Integrity
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--success)", marginTop: "4px" }}>
            {integrityRate}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {status
              ? status.is_system_error
                ? "Validation engine unavailable"
                : status.is_valid
                ? "Zero Broken Joins or Foreign Keys"
                : `${status.total_issues.toLocaleString()} issues detected`
              : "Pending verification"}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Rule Engines Verified
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--primary)", marginTop: "4px" }}>
            {rulesVerifiedValue}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {status?.is_valid ? "Complete Schema Compliance" : "Live rule evaluation"}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            Last Verified
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>
            {formattedTimestamp || PLACEHOLDER}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Continuous integrity monitoring
          </div>
        </div>
      </div>

      {/* Primary Verification Status Banner */}
      <div className="card" style={{ padding: "18px 20px" }}>
        {loading && !status ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0" }}>
            <RefreshCw size={20} color="var(--primary)" className="spin" />
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)" }}>
                Evaluating Production Dataset Integrity...
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Auditing production records across relational tables...
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  backgroundColor: status?.is_valid ? "var(--success-bg)" : status?.is_system_error ? "var(--warning-bg)" : "var(--danger-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {status?.is_valid ? (
                  <ShieldCheck size={22} color="var(--success)" />
                ) : status?.is_system_error ? (
                  <AlertCircle size={22} color="var(--warning)" />
                ) : (
                  <AlertTriangle size={22} color="var(--danger)" />
                )}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "17px", fontWeight: 600, margin: 0, color: "var(--text-main)" }}>
                    {status?.is_valid
                      ? "Full Production Dataset Verified Clean"
                      : status?.is_system_error
                      ? "Validation Engine Diagnostic Notice"
                      : "Integrity Violations Found in Dataset"}
                  </h2>
                  <span className={`badge ${status?.is_valid ? "badge-success" : status?.is_system_error ? "badge-warning" : "badge-danger"}`}>
                    {status?.is_valid
                      ? "0 Errors • 0 Warnings"
                      : status?.is_system_error
                      ? "Execution Error"
                      : `${status?.error_count} Errors • ${status?.warning_count} Warnings`}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Active Production Baseline
                  {grandTotal !== null && <span> • {grandTotalLabel} records</span>}
                  {formattedTimestamp && (
                    <span> • Last verified: {formattedTimestamp}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleRunValidation}
              disabled={running}
              style={{ minWidth: "190px" }}
            >
              {running ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
              <span>{running ? "Verifying Dataset..." : "Run Dataset Verification"}</span>
            </button>
          </div>
        )}

        {/* System Error Details Banner */}
        {status?.is_system_error && status.error_message && (
          <div style={{ marginTop: "14px", padding: "10px 14px", backgroundColor: "var(--warning-bg)", borderRadius: "6px", border: "1px solid var(--warning-border)", fontSize: "13px", color: "var(--warning-text)" }}>
            <div style={{ fontWeight: 600, marginBottom: "2px" }}>Notice from validation engine:</div>
            <div>{status.error_message}</div>
          </div>
        )}

        {/* Success / Notification Feedback */}
        {runSuccessMessage && (
          <div style={{ marginTop: "14px", padding: "10px 14px", backgroundColor: "var(--success-bg)", borderRadius: "6px", border: "1px solid var(--success-border)", fontSize: "13px", color: "var(--success-text)", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} />
            <span>{runSuccessMessage}</span>
          </div>
        )}

        {/* Collapsible Rules Toggle */}
        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowRules((prev) => !prev)}
              disabled={rulesList.length === 0}
              style={{ padding: "0 4px", fontSize: "12px", color: "var(--primary)" }}
            >
              <span>{showRules ? "Hide Verification Rules" : `Show Checked Rules (${rulesList.length} Engines)`}</span>
              {showRules ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {status?.issues && status.issues.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowIssues((prev) => !prev)}
                style={{ fontSize: "12px", color: "var(--danger)" }}
              >
                <span>{showIssues ? "Hide Violation Details" : `View ${status.issues.length} Violation Details`}</span>
                {showIssues ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>

          {showRules && rulesList.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
              {rulesList.map((rule, idx) => (
                <span
                  key={idx}
                  className="badge badge-neutral"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                >
                  <CheckCircle2 size={12} color="var(--success)" />
                  {rule}
                </span>
              ))}
            </div>
          )}

          {showIssues && status?.issues && status.issues.length > 0 && (
            <div style={{ marginTop: "12px", border: "1px solid var(--danger-border)", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", backgroundColor: "var(--danger-bg)", color: "var(--danger-text)", fontSize: "12px", fontWeight: 600 }}>
                Recorded Issue Details ({status.issues.length}):
              </div>
              <div style={{ maxHeight: "200px", overflowY: "auto", padding: "8px 12px", backgroundColor: "#fff", fontSize: "12px" }}>
                {status.issues.map((issue, idx) => (
                  <div key={idx} style={{ padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span className="badge badge-danger" style={{ fontSize: "10px", marginRight: "6px" }}>{issue.severity}</span>
                    <strong style={{ marginRight: "6px" }}>{issue.record_type} ({issue.record_id}):</strong>
                    <span style={{ color: "var(--text-secondary)" }}>{issue.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
          <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
        </div>
      )}

      {/* Relational Tables & Entities Inventory Table */}
      <div className="table-wrapper">
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Layers size={16} color="var(--primary)" />
              Production Relational Tables & Entities ({deliverableTables.length} Tables)
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Continuous foreign key referential integrity and volume audit
            </p>
          </div>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Total Verified: <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{grandTotalLabel} Rows</strong>
          </span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "230px" }}>Entity & Table</th>
              <th style={{ width: "150px" }}>Category</th>
              <th style={{ width: "110px", textAlign: "right" }}>Row Count</th>
              <th>Schema Role & Constraints</th>
              <th style={{ width: "140px", textAlign: "right" }}>Integrity Status</th>
            </tr>
          </thead>
          <tbody>
            {deliverableTables.map((tbl) => {
              const rowCount = getRowCount(tbl.countKey);
              return (
                <tr key={tbl.name}>
                  <td>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "13px" }}>
                        {tbl.entity}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "1px" }}>
                        {tbl.name}
                      </div>
                    </div>
                  </td>
                  <td>{getCategoryBadge(tbl.category)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-main)", fontWeight: 500 }}>
                    {rowCount !== null ? rowCount.toLocaleString() : PLACEHOLDER}
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{tbl.description}</td>
                  <td style={{ textAlign: "right" }}>
                    {getTableStatus(tbl.entityKey)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
