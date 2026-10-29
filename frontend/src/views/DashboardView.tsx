import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import type { DashboardSummary } from "../types";
import { 
  Users, 
  AlertTriangle, 
  DollarSign, 
  TrendingUp, 
  ShieldCheck, 
  CheckSquare, 
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (view: string) => void;
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
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
        <p>Loading operations overview telemetry...</p>
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

  return (
    <div className="view-container">
      {/* 4 Primary Operational Metric Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Leads</span>
            <Users size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.total_leads.toLocaleString()}</div>
          <div className="stat-sub">Across {data.total_companies.toLocaleString()} enterprise accounts</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Pipeline Volume</span>
            <DollarSign size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">${(data.total_pipeline_value / 1_000_000).toFixed(1)}M</div>
          <div className="stat-sub">{data.total_opportunities.toLocaleString()} pipeline opportunities</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Avg Lead Score</span>
            <TrendingUp size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">
            {data.average_lead_score} <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)" }}>/ 100</span>
          </div>
          <div className="stat-sub">Fit 50% • Intent 30% • Eng 20%</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Follow-up Tasks</span>
            <CheckSquare size={16} color="var(--primary)" />
          </div>
          <div className="stat-value">{data.total_tasks.toLocaleString()}</div>
          <div className="stat-sub">{(data.task_status_distribution["open"] || data.total_tasks).toLocaleString()} open outreach tasks</div>
        </div>
      </div>

      {/* Grid: Lifecycle Funnel & Territory Allocation */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
        {/* Lifecycle Stage Funnel */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>Lead Lifecycle Progression Funnel</h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Sequential progression governed by lifecycle business transition rules
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
                <div key={stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{stage}</span>
                    <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "var(--bg-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        backgroundColor:
                          stage === "Converted" ? "var(--success)" :
                          stage === "Qualified" ? "var(--primary)" :
                          stage === "Contacted" ? "#3b82f6" :
                          stage === "Disqualified" ? "var(--border-strong)" : "#93c5fd",
                        borderRadius: "3px",
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
            <h2 className="section-heading" style={{ margin: 0 }}>Territory Distribution</h2>
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

      {/* Grid: Score Bands & Data Integrity / Benchmark Scenarios */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Score Breakdown Card */}
        <div className="card">
          <div style={{ marginBottom: "16px" }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Lead Scoring Distribution</h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Arithmetic weighted score breakdown: Fit (50%) + Intent (30%) + Engagement (20%)
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {Object.entries(data.score_bands).map(([band, count]) => (
              <div
                key={band}
                style={{
                  padding: "12px 14px",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>{band}</div>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-main)", marginTop: "2px", fontVariantNumeric: "tabular-nums" }}>
                  {count.toLocaleString()}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {((count / data.total_leads) * 100).toFixed(1)}% of pipeline
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomaly Governance Card */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 className="section-heading" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <ShieldAlert size={16} color="var(--primary)" />
                Benchmark Anomaly Scenarios
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                5 controlled assessment exceptions tracked for validator evaluation
              </p>
            </div>
            <button onClick={() => onNavigate("investigations")} className="btn btn-secondary btn-sm">
              <span>Investigate</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span>Opted-out contact outreach</span>
              <span className="badge badge-danger">Critical</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span>Post-conversion score leak</span>
              <span className="badge badge-warning">High</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span>Cross-territory routing mismatch</span>
              <span className="badge badge-primary">Medium</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span>Duplicate opportunity inflation</span>
              <span className="badge badge-warning">High</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span>Lifecycle stage progression gap</span>
              <span className="badge badge-warning">High</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
