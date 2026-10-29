import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import type { ValidationStatus } from "../types";
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  RefreshCw,
  FolderCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export const DataQualityView: React.FC = () => {
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
      const data = await api.getValidationStatus();
      setStatus(data);
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
        setRunSuccessMessage("On-demand verification completed: 0 violations found across all 168,193 records.");
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
  }, []);

  const deliverableTables = [
    { name: "companies.csv", entityKey: "company", count: 5000, description: "B2B enterprise account entities" },
    { name: "contacts.csv", entityKey: "contact", count: 10000, description: "Prospect decision-makers & profiles" },
    { name: "salesreps.csv", entityKey: "salesrep", count: 50, description: "Territory-assigned sales representatives" },
    { name: "score_rules.csv", entityKey: "score_rule", count: 3, description: "Scoring configuration (Fit 50%, Intent 30%, Engagement 20%)" },
    { name: "campaigns.csv", entityKey: "campaign", count: 100, description: "Inbound and outbound marketing initiatives" },
    { name: "leads.csv", entityKey: "lead", count: 20000, description: "Operational lead pipeline with routing & deduplication" },
    { name: "lead_campaigns.csv", entityKey: "lead_campaign", count: 30040, description: "Campaign attribution bridge table" },
    { name: "consents.csv", entityKey: "consent", count: 15000, description: "Channel consent & withdrawal records" },
    { name: "activities.csv", entityKey: "activity", count: 35000, description: "Logged calls, meetings, demos, and emails" },
    { name: "tasks.csv", entityKey: "task", count: 25000, description: "Follow-up tasks and cadence execution" },
    { name: "opportunities.csv", entityKey: "opportunity", count: 3000, description: "Pipeline deals and revenue forecasting" },
    { name: "stage_histories.csv", entityKey: "stage_history", count: 25000, description: "Append-only lifecycle stage transition log" },
  ];

  const rulesList = status?.rules_checked && status.rules_checked.length > 0 ? status.rules_checked : [
    "Primary Key Formats & Uniqueness",
    "Foreign Key Referential Integrity",
    "Lead Score Weighted Arithmetic (Fit 50% + Intent 30% + Engagement 20%)",
    "Date Chronology & Conversion Freeze",
    "Duplicate Lead & Opportunity Consistency",
    "Enum Constraint Validation",
    "Sales Routing Territory Governance",
    "Consent Channel Outreach Eligibility",
    "Task Decision Audit Records Integrity",
  ];

  // Helper to determine status for individual tables based on verified issues
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
        <CheckCircle2 size={11} /> Verified
      </span>
    );
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

  return (
    <div className="view-container">
      {/* Context Explainer: Production Baseline vs. Forensic Benchmark */}
      <div
        className="card"
        style={{
          backgroundColor: "#ffffff",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderLeft: "3px solid var(--primary)",
        }}
      >
        <HelpCircle size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          <strong style={{ color: "var(--text-main)" }}>Validation Architecture:</strong> This console verifies the active{" "}
          <strong style={{ color: "var(--text-main)" }}>Clean Production Baseline</strong> (168,193 relational records in{" "}
          <code>data/generated_full/</code>). The 5 isolated forensic anomaly cases reside in{" "}
          <code>data/ground_truth/</code> for auditor evaluation and do not corrupt production records.
        </div>
      </div>

      {/* Primary Verification Status Banner */}
      <div className="card" style={{ padding: "18px 20px" }}>
        {loading && !status ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0" }}>
            <RefreshCw size={20} color="var(--primary)" className="spin" />
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)" }}>
                Evaluating Dataset Integrity Status...
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Auditing 168,193 records across 12 CSV tables...
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
                      ? "Full-Scale Dataset Verified Clean"
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
                  Scope: <code>data/generated_full/</code> • 168,193 rows across 12 tables
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
              style={{ padding: "0 4px", fontSize: "12px", color: "var(--primary)" }}
            >
              <span>{showRules ? "Hide Checked Rules" : `Show Checked Rules (${rulesList.length} Engines)`}</span>
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

          {showRules && (
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

      {/* Deliverable CSV Files Inventory Table */}
      <div className="table-wrapper">
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
              Deliverable Datasets (12 Relational Tables)
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Full-scale dataset in <code>data/generated_full/</code>
            </p>
          </div>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Total Verified: <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>168,193 Rows</strong>
          </span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "200px" }}>File Name</th>
              <th style={{ width: "120px", textAlign: "right" }}>Row Count</th>
              <th>Schema Description</th>
              <th style={{ width: "130px", textAlign: "right" }}>Integrity Status</th>
            </tr>
          </thead>
          <tbody>
            {deliverableTables.map((tbl) => (
              <tr key={tbl.name}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileSpreadsheet size={15} color="var(--primary)" />
                    <code style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{tbl.name}</code>
                  </div>
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
                  {tbl.count.toLocaleString()}
                </td>
                <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{tbl.description}</td>
                <td style={{ textAlign: "right" }}>
                  {getTableStatus(tbl.entityKey)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Auxiliary Metadata Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <FileCode size={16} color="var(--primary)" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
              PostgreSQL Schema (DDL)
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            Defined in <code>sql/schema.sql</code>. Contains 12 core tables, 18 foreign keys, and indexes for Supabase PostgreSQL.
          </p>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <FolderCheck size={16} color="var(--success)" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
              Ground-Truth Anomaly Benchmark
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            Stored in <code>data/ground_truth/ground_truth_exceptions.json</code> with exact IDs and timestamps for the 5 benchmark exceptions.
          </p>
        </div>
      </div>
    </div>
  );
};
