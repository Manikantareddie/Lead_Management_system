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
  ShieldCheck,
  Code,
} from "lucide-react";

interface InvestigationsViewProps {
  onSelectLead: (leadId: string) => void;
}

export const InvestigationsView: React.FC<InvestigationsViewProps> = ({ onSelectLead }) => {
  const [investigations, setInvestigations] = useState<InvestigationItem[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSqlForId, setShowSqlForId] = useState<string | null>(null);
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
      setError(err.message || "Failed to load governance alerts");
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
            <AlertOctagon size={11} /> Critical Policy Breach
          </span>
        );
      case "HIGH":
        return (
          <span className="badge badge-warning">
            <AlertTriangle size={11} /> High Priority Alert
          </span>
        );
      case "MEDIUM":
        return (
          <span className="badge badge-primary">
            <Info size={11} /> Medium Priority Alert
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
      {/* Context Explainer Banner */}
      <div
        className="card"
        style={{
          borderLeft: "4px solid var(--primary)",
          backgroundColor: "#ffffff",
          padding: "14px 18px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <ShieldCheck size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text-main)" }}>Automated Policy & Governance Monitoring:</strong> This
          console continuously monitors the CRM pipeline for compliance, territory routing, and lifecycle stage violations.
          Review quarantined exceptions below and execute guided remediation steps.
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
            <option value="">All Alert Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>

          <select
            className="select-compact"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Policy Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Showing <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{filtered.length}</strong> of{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{investigations.length}</span> Active Alerts
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
          <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
        </div>
      )}

      {/* Exception Alert Cards */}
      {loading && investigations.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
          Checking automated policy rules...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
          No active policy alerts match the selected filters.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filtered.map((inv) => {
            const isExpanded = expandedId === inv.id;
            const isSqlVisible = showSqlForId === inv.id;
            const leadIdInEvidence = inv.evidence?.lead_id || inv.evidence?.canonical_lead_id;

            return (
              <div key={inv.id} className="card" style={{ padding: "18px 20px" }}>
                {/* 1. Header: ID, Title, Severity, Category, Action */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    marginBottom: "12px",
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
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                        Enforced Policy: <strong style={{ color: "var(--text-main)" }}>{inv.rule_name}</strong>
                      </div>
                    </div>
                  </div>

                  {leadIdInEvidence && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onSelectLead(leadIdInEvidence)}
                      title={`Review lead profile for ${leadIdInEvidence}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <span>Review Lead Profile</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>

                {/* 2. Business Description */}
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 14px 0" }}>
                  {inv.description}
                </p>

                {/* 3. Action Callout & Quick Controls */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: "13px", lineHeight: 1.45, flex: 1, minWidth: "260px" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "12px", marginRight: "6px" }}>
                      Remediation Plan:
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{inv.recommended_action}</span>
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleExpand(inv.id)}
                    style={{ flexShrink: 0, fontSize: "12px", color: "var(--primary)" }}
                  >
                    {isExpanded ? (
                      <>Hide Audit Context <ChevronUp size={13} /></>
                    ) : (
                      <>Inspect Audit Context <ChevronDown size={13} /></>
                    )}
                  </button>
                </div>

                {/* 4. Progressive Disclosure: Context & Verification Query */}
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
                    {/* Key Attributes */}
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                        Captured Audit Attributes:
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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

                    {/* Technical Diagnostic Query (Collapsed by Default) */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowSqlForId((prev) => (prev === inv.id ? null : inv.id))}
                          style={{ padding: "0", fontSize: "12px", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <Code size={13} />
                          <span>{isSqlVisible ? "Hide Diagnostic Query" : "Show Diagnostic Query (Technical)"}</span>
                          {isSqlVisible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {isSqlVisible && (
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
                                <Copy size={12} /> Copy Query
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {isSqlVisible && (
                        <pre className="code-box" style={{ margin: "8px 0 0 0", fontSize: "12px" }}>
                          <code>{inv.detection_query}</code>
                        </pre>
                      )}
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
