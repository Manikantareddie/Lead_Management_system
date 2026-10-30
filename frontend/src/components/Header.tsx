import React from "react";
import type { NavTab } from "./Sidebar";
import { RefreshCw, Menu } from "lucide-react";

interface HeaderProps {
  currentTab: NavTab;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onRefresh, isRefreshing = false, onToggleSidebar }) => {
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
        return { title: "Governance & Compliance Alerts", subtitle: "Automated policy monitoring, consent compliance, and exception remediation" };
      case "validation":
        return { title: "Data Quality & System Health", subtitle: "Continuous referential integrity checks and schema validation" };
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
      <div style={{ display: "flex", alignItems: "center" }}>
        {onToggleSidebar && (
          <button
            className="mobile-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle Navigation Menu"
            title="Toggle Menu"
          >
            <Menu size={16} />
          </button>
        )}
        <div>
          <h1 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)", margin: 0, lineHeight: 1.2 }}>
            {title}
          </h1>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
            {subtitle}
          </div>
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
