import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import type { DashboardSummary } from "../types";
import { 
  Users, 
  TrendingUp, 
  CheckSquare, 
  ArrowRight,
  Briefcase,
  Sparkles,
  Layers,
  MapPin,
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (view: string, filter?: { stage?: string; oppStage?: string; scoreBand?: string }) => void;
  onSelectLead: (leadId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboardSummary();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)" }}>
        <p>Loading operations dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "16px 20px" }}>
        <h3 style={{ color: "var(--danger)", margin: "0 0 6px 0", fontSize: "15px", fontWeight: 600 }}>Unable to load dashboard</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>{error}</p>
        <button onClick={loadSummary} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
          Retry
        </button>
      </div>
    );
  }

  const stageOrder = ["New", "Contacted", "Qualified", "Converted", "Disqualified"];

  // Opportunity stages breakdown (all active deals)
  const oppStages = data.opportunity_stages || {};
  const activePipelineOrder = [
    { key: "discovery", label: "Discovery", count: oppStages["discovery"] || 0, color: "#60a5fa" },
    { key: "qualification", label: "Qualification", count: oppStages["qualification"] || 0, color: "#3b82f6" },
    { key: "proposal", label: "Proposal", count: oppStages["proposal"] || 0, color: "#2563eb" },
    { key: "negotiation", label: "Negotiation (High Intent)", count: oppStages["negotiation"] || 0, color: "#1d4ed8" },
  ];

  return (
    <div className="view-container">
      {/* 4 Primary Operational Metric Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div 
          className="stat-card" 
          style={{ cursor: "pointer", transition: "transform 150ms ease, box-shadow 150ms ease" }}
          onClick={() => onNavigate("leads")}
          title="Click to view all leads"
        >
          <div className="stat-header">
            <span className="stat-label">Total Leads</span>
            <Users size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.total_leads.toLocaleString()}</div>
          <div className="stat-sub">Across {data.total_companies.toLocaleString()} enterprise accounts</div>
        </div>

        <div 
          className="stat-card" 
          style={{ cursor: "pointer", transition: "transform 150ms ease, box-shadow 150ms ease" }}
          onClick={() => onNavigate("pipeline")}
          title="Click to view pipeline opportunities"
        >
          <div className="stat-header">
            <span className="stat-label">Active Pipeline Forecast</span>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--primary)" }}>₹</span>
          </div>
          <div className="stat-value">₹{(data.total_pipeline_value / 10_000_000).toFixed(2)} Cr</div>
          <div className="stat-sub">{data.total_opportunities.toLocaleString()} active enterprise opportunities</div>
        </div>

        <div 
          className="stat-card"
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate("leads")}
          title="Click to view scoring distribution"
        >
          <div className="stat-header">
            <span className="stat-label">Avg Lead Score</span>
            <TrendingUp size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">
            {data.average_lead_score} <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)" }}>/ 100</span>
          </div>
          <div className="stat-sub">Fit 50% • Intent 30% • Eng 20%</div>
        </div>

        <div 
          className="stat-card"
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate("tasks")}
          title="Click to view open outreach tasks"
        >
          <div className="stat-header">
            <span className="stat-label">Follow-up Tasks</span>
            <CheckSquare size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.total_tasks.toLocaleString()}</div>
          <div className="stat-sub">{(data.task_status_distribution["open"] || data.total_tasks).toLocaleString()} open outreach tasks</div>
        </div>
      </div>

      {/* Meaningful Active Opportunity Pipeline Stage Distribution */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Briefcase size={16} color="var(--primary)" />
              Active Opportunity Pipeline by Deal Stage (3,000 Opportunities)
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Enterprise deals progressing through the qualification and closing lifecycle • Click any stage to view matching deals
            </p>
          </div>

          <button onClick={() => onNavigate("pipeline")} className="btn btn-secondary btn-sm">
            <span>Explore All Deals</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* 4 Active Stage Visual Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "14px" }}>
          {activePipelineOrder.map((stg) => {
            const pct = data.total_opportunities > 0 ? ((stg.count / data.total_opportunities) * 100).toFixed(1) : "0.0";
            return (
              <div
                key={stg.key}
                onClick={() => onNavigate("pipeline", { oppStage: stg.key })}
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.transform = "none";
                }}
                title={`Filter opportunities by ${stg.label}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>
                    {stg.label}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: "11px" }}>
                    {pct}%
                  </span>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>
                  {stg.count.toLocaleString()} <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-muted)" }}>deals</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>View deals</span>
                  <ArrowRight size={11} color="var(--primary)" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Multi-segment Pipeline Bar */}
        <div style={{ height: "8px", width: "100%", backgroundColor: "var(--bg-subtle)", borderRadius: "4px", overflow: "hidden", display: "flex" }}>
          {activePipelineOrder.map((stg) => (
            <div
              key={stg.key}
              title={`${stg.label}: ${stg.count.toLocaleString()} deals`}
              style={{
                width: `${(stg.count / (data.total_opportunities || 1)) * 100}%`,
                backgroundColor: stg.color,
              }}
            />
          ))}
        </div>
      </div>

      {/* Grid: Lifecycle Funnel & Territory Allocation */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {/* Interactive Lifecycle Stage Funnel */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <Layers size={16} color="var(--primary)" />
                Lead Lifecycle Progression Funnel
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Click any stage to filter leads in the explorer
              </p>
            </div>
            <button onClick={() => onNavigate("leads")} className="btn btn-secondary btn-sm">
              <span>Explore Leads</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {stageOrder.map((stage) => {
              const count = data.stage_distribution[stage] || 0;
              const pct = ((count / data.total_leads) * 100).toFixed(1);
              return (
                <div 
                  key={stage}
                  onClick={() => onNavigate("leads", { stage })}
                  style={{ cursor: "pointer", padding: "4px", borderRadius: "4px" }}
                  title={`Click to filter leads by stage: ${stage}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 500, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "4px" }}>
                      {stage} <ArrowRight size={11} color="var(--primary)" />
                    </span>
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

        {/* Territory Allocation */}
        <div className="card">
          <div style={{ marginBottom: "16px" }}>
            <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={16} color="var(--primary)" />
              Territory Volume Distribution
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Allocated across {data.total_salesreps} active territory representatives
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Object.entries(data.territory_distribution).map(([terr, count]) => {
              const pct = ((count / data.total_leads) * 100).toFixed(1);
              return (
                <div
                  key={terr}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "13px", color: "var(--text-main)" }}>{terr} Territory</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{pct}% volume allocation</div>
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

      {/* Grid: Multi-Factor Scoring Distribution */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={16} color="var(--primary)" />
              Multi-Factor Lead Scoring Distribution
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Rule SCR-000001: Fit (50%) + Intent (30%) + Engagement (20%) • Click any tier to view filtered leads
            </p>
          </div>
          <button onClick={() => onNavigate("leads")} className="btn btn-secondary btn-sm">
            <span>All Leads</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          {Object.entries(data.score_bands).map(([band, count]) => {
            const bandKey = band.split(" ")[0];
            return (
              <div
                key={band}
                onClick={() => onNavigate("leads", { scoreBand: bandKey })}
                style={{
                  padding: "14px 16px",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  background: "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.backgroundColor = "#f0f7ff";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(37, 99, 235, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                  e.currentTarget.style.boxShadow = "none";
                }}
                title={`Click to view all leads in score tier ${band}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>{band}</span>
                  <ArrowRight size={12} color="var(--primary)" />
                </div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", marginTop: "3px", fontVariantNumeric: "tabular-nums" }}>
                  {count.toLocaleString()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {((count / data.total_leads) * 100).toFixed(1)}% of total leads
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 500 }}>
                    View leads &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
