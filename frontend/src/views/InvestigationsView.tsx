import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import type { InvestigationItem } from "../types";
import {
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowRight,
  Filter,
  CheckCircle2,
} from "lucide-react";

interface InvestigationsViewProps {
  onSelectLead: (leadId: string) => void;
}

export const InvestigationsView: React.FC<InvestigationsViewProps> = ({ onSelectLead }) => {
  const [investigations, setInvestigations] = useState<InvestigationItem[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvestigations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInvestigations();
      setInvestigations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load anomaly investigations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestigations();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleCopyQuery = (id: string, query: string) => {
    navigator.clipboard.writeText(query);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return (
          <span className="badge badge-danger">
            <AlertOctagon size={11} /> Critical
          </span>
        );
      case "HIGH":
        return (
          <span className="badge badge-warning">
            <AlertTriangle size={11} /> High
          </span>
        );
      case "MEDIUM":
        return (
          <span className="badge badge-primary">
            <Info size={11} /> Medium
          </span>
        );
      default:
        return <span className="badge badge-neutral">{severity}</span>;
    }
  };

  const filtered = investigations.filter((inv) => {
    if (selectedSeverity && inv.severity !== selectedSeverity) return false;
    if (selectedCategory && inv.category !== selectedCategory) return false;
    return true;
  });

  const categories = Array.from(new Set(investigations.map((i) => i.category)));

  return (
    <div className="view-container">
      {/* Overview Context Card */}
      <div
        className="card"
        style={{
          borderLeft: "3px solid var(--primary)",
          backgroundColor: "#ffffff",
          padding: "12px 16px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <ShieldAlert size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          <strong style={{ color: "var(--text-main)" }}>Forensic Audit Workspace:</strong> Continuous
          monitoring of the 5 controlled benchmark anomaly scenarios. Expand any finding below to inspect human-readable forensic evidence and verification SQL queries.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar">
        <div className="toolbar-filters">
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            <Filter size={13} /> Filter:
          </span>

          <select
            className="select-compact"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>

          <select
            className="select-compact"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Showing <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{filtered.length}</strong> of{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{investigations.length}</span> Benchmark Findings
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
          <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
        </div>
      )}

      {/* Investigation Cards */}
      {loading && investigations.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
          Loading forensic investigations...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
          No findings match the selected filters.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filtered.map((inv) => {
            const isExpanded = expandedId === inv.id;
            const leadIdInEvidence = inv.evidence?.lead_id || inv.evidence?.canonical_lead_id;

            return (
              <div key={inv.id} className="card" style={{ padding: "16px 20px" }}>
                {/* 1. Header: ID, Title, Severity, Category, Action */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    marginBottom: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <span className="id-tag">{inv.id}</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
                          {inv.title}
                        </h2>
                        {getSeverityBadge(inv.severity)}
                        <span className="badge badge-neutral">{inv.category}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Governance Rule: <code style={{ color: "var(--primary)", fontWeight: 500 }}>{inv.rule_name}</code>
                      </div>
                    </div>
                  </div>

                  {leadIdInEvidence && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onSelectLead(leadIdInEvidence)}
                      title={`Inspect affected lead record ${leadIdInEvidence}`}
                    >
                      <span>Inspect {leadIdInEvidence}</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {/* 2. Detection Explanation */}
                <p style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: 1.5, margin: "0 0 12px 0" }}>
                  {inv.description}
                </p>

                {/* 3. Operational Next Step Callout */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: "13px", lineHeight: 1.45, flex: 1, minWidth: "240px" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "12px", marginRight: "6px" }}>
                      Recommended Action:
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{inv.recommended_action}</span>
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleExpand(inv.id)}
                    style={{ flexShrink: 0, fontSize: "12px", color: "var(--primary)" }}
                  >
                    {isExpanded ? (
                      <>Hide Details <ChevronUp size={13} /></>
                    ) : (
                      <>View Technical Evidence & SQL <ChevronDown size={13} /></>
                    )}
                  </button>
                </div>

                {/* 4. Progressive Disclosure: Technical Evidence & SQL */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "14px",
                      borderTop: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {/* Structured Evidence Key-Value Grid */}
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                        Recorded Forensic Evidence:
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "8px",
                          backgroundColor: "#ffffff",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "6px",
                          padding: "10px 14px",
                        }}
                      >
                        {Object.entries(inv.evidence).map(([key, val]) => (
                          <div key={key}>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                              {String(val)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SQL Verification Query Box */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                          Verification SQL Query:
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleCopyQuery(inv.id, inv.detection_query)}
                          style={{ fontSize: "11px", padding: "0 6px" }}
                        >
                          {copiedId === inv.id ? (
                            <>
                              <Check size={12} color="var(--success)" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Copy SQL
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="code-box" style={{ margin: 0, fontSize: "12px" }}>
                        <code>{inv.detection_query}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
