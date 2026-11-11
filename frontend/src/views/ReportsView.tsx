import React from "react";
import { useData } from "../context/DataContext";
import {
  BarChart3,
  Layers,
  MapPin,
  TrendingUp,
  Sparkles,
  Briefcase,
} from "lucide-react";

/**
 * Reports — a dedicated home for the pipeline, territory, and scoring analytics
 * that are computed by the backend and shared through the DataContext store.
 * Sales users read the plain-language summary; the numbers are never hardcoded.
 */
export const ReportsView: React.FC = () => {
  const { summary: data, summaryLoading, summaryError, refresh } = useData();

  if (summaryLoading && !data) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)" }}>
        <p>Loading reports...</p>
      </div>
    );
  }

  if (summaryError || !data) {
    return (
      <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "16px 20px" }}>
        <h3 style={{ color: "var(--danger)", margin: "0 0 6px 0", fontSize: "15px", fontWeight: 600 }}>
          Unable to load reports
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>{summaryError}</p>
        <button onClick={refresh} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
          Retry
        </button>
      </div>
    );
  }

  const stageOrder = ["New", "Contacted", "Qualified", "Converted", "Disqualified"];
  const totalLeads = data.total_leads || 1;

  const oppStages = data.opportunity_stages || {};
  const oppStageOrder = ["discovery", "qualification", "proposal", "negotiation", "decision_pending", "closed_won", "closed_lost"];
  const oppStageLabels: Record<string, string> = {
    discovery: "Discovery",
    qualification: "Qualification",
    proposal: "Proposal",
    negotiation: "Negotiation",
    decision_pending: "Decision Pending",
    closed_won: "Closed Won",
    closed_lost: "Closed Lost",
  };
  const totalOpps = data.total_opportunities || 1;

  return (
    <div className="view-container">
      {/* Explainer Banner */}
      <div
        className="card"
        style={{
          backgroundColor: "#ffffff",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          borderLeft: "4px solid var(--primary)",
        }}
      >
        <BarChart3 size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text-main)" }}>Reports:</strong> How your{" "}
          {data.total_leads.toLocaleString()} leads and {data.total_opportunities.toLocaleString()} opportunities are
          distributed across the lifecycle, territories, and score tiers. All figures are calculated live from your data.
        </div>
      </div>

      {/* Lead Lifecycle Funnel */}
      <div className="card">
        <div style={{ marginBottom: "16px" }}>
          <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={16} color="var(--primary)" />
            Lead Lifecycle Distribution
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
            How leads are spread across each stage of the journey
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {stageOrder.map((stage) => {
            const count = data.stage_distribution[stage] || 0;
            const pct = ((count / totalLeads) * 100).toFixed(1);
            return (
              <div key={stage}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{stage}</span>
                  <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {count.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div style={{ height: "7px", background: "var(--bg-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor:
                        stage === "Converted" ? "var(--success)" :
                        stage === "Qualified" ? "var(--primary)" :
                        stage === "Contacted" ? "#3b82f6" :
                        stage === "Disqualified" ? "var(--border-strong)" : "#93c5fd",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Bands & Territory side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {/* Score Band Distribution */}
        <div className="card">
          <div style={{ marginBottom: "16px" }}>
            <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={16} color="var(--primary)" />
              Lead Score Distribution
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Leads grouped by score tier • Average score {data.average_lead_score} / 100
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(data.score_bands).map(([band, count]) => {
              const pct = ((count / totalLeads) * 100).toFixed(1);
              return (
                <div
                  key={band}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "13px", color: "var(--text-main)" }}>{band}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{pct}% of leads</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>
                    {count.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Territory Distribution */}
        <div className="card">
          <div style={{ marginBottom: "16px" }}>
            <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={16} color="var(--primary)" />
              Territory Distribution
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Leads across {data.total_salesreps} active representatives
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(data.territory_distribution).map(([terr, count]) => {
              const pct = ((count / totalLeads) * 100).toFixed(1);
              return (
                <div
                  key={terr}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "13px", color: "var(--text-main)" }}>{terr} Territory</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{pct}% of leads</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>
                    {count.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Opportunity Stage Breakdown */}
      <div className="card">
        <div style={{ marginBottom: "16px" }}>
          <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <Briefcase size={16} color="var(--primary)" />
            Opportunity Stages
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
            {data.total_opportunities.toLocaleString()} deals by stage • ₹{(data.total_pipeline_value / 10_000_000).toFixed(2)} Cr total value
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
          {oppStageOrder.map((stage) => {
            const count = oppStages[stage] || 0;
            const pct = ((count / totalOpps) * 100).toFixed(1);
            return (
              <div
                key={stage}
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>
                  {oppStageLabels[stage]}
                </div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>
                  {count.toLocaleString()}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <TrendingUp size={11} /> {pct}% of deals
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
