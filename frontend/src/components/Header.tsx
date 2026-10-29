import React from "react";
import type { NavTab } from "./Sidebar";
import { RefreshCw } from "lucide-react";

interface HeaderProps {
  currentTab: NavTab;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onRefresh, isRefreshing = false }) => {
  const getTabInfo = (tab: NavTab) => {
    switch (tab) {
      case "dashboard":
        return { title: "Operations Overview", subtitle: "System health and pipeline summary" };
      case "leads":
        return { title: "Leads Explorer", subtitle: "Lead profiles, routing, and scoring history" };
      case "tasks":
        return { title: "Tasks & Activities", subtitle: "Operational outreach tasks and logged cadence interactions" };
      case "pipeline":
        return { title: "Opportunities Pipeline", subtitle: "Deal stages, revenue forecast, and deduplication" };
      case "investigations":
        return { title: "Anomaly Investigations", subtitle: "Audit findings and forensic inspection for benchmark exceptions" };
      case "validation":
        return { title: "Dataset Integrity & Validation", subtitle: "Referential integrity checks and CSV deliverables" };
      default:
        return { title: "Operations Console", subtitle: "Enterprise Lead Management" };
    }
  };

  const { title, subtitle } = getTabInfo(currentTab);

  return (
    <header
      style={{
        height: "56px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Title & Context */}
      <div>
        <h1 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)", margin: 0, lineHeight: 1.2 }}>
          {title}
        </h1>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
          {subtitle}
        </div>
      </div>

      {/* Subtle Refresh Action */}
      <button
        className="btn btn-secondary btn-sm"
        onClick={onRefresh}
        title="Refresh current view"
        style={{ color: "var(--text-muted)" }}
      >
        <RefreshCw size={13} className={isRefreshing ? "spin" : ""} />
        <span>Refresh</span>
      </button>
    </header>
  );
};
