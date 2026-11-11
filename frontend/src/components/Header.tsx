import React from "react";
import type { NavTab } from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { RefreshCw, Menu, LogOut } from "lucide-react";

interface HeaderProps {
  currentTab: NavTab;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onToggleSidebar?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onRefresh,
  isRefreshing = false,
  onToggleSidebar,
  onSignOut,
}) => {
  const { user } = useAuth();

  const getTabInfo = (tab: NavTab) => {
    switch (tab) {
      case "my-leads":
        return { title: "My Leads", subtitle: "Your leads and what to do next" };
      case "tasks":
        return { title: "Follow-ups", subtitle: "Calls, emails, and next steps to work today" };
      case "pipeline":
        return { title: "Pipeline", subtitle: "Deals moving toward a buying decision" };
      case "leads":
        return { title: "All Leads / Team", subtitle: "Every lead across the team" };
      case "dashboard":
        return { title: "Dashboard", subtitle: "Overview of leads, follow-ups, and pipeline" };
      case "reports":
        return { title: "Reports", subtitle: "Pipeline, territory, and scoring analytics" };
      case "investigations":
        return { title: "Alerts & Compliance", subtitle: "Policy and data exceptions that need review" };
      case "validation":
        return { title: "Data Quality", subtitle: "Dataset integrity and schema verification" };
      default:
        return { title: "Lead Management System", subtitle: "Enterprise Lead Management" };
    }
  };

  const { title, subtitle } = getTabInfo(currentTab);

  return (
    <header
      className="app-header"
      style={{
        height: "56px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
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
          <h1 className="header-title">
            {title}
          </h1>
          <div className="header-subtitle">
            {subtitle}
          </div>
        </div>
      </div>

      {/* Refresh Action & Signed-in User */}
      <div className="header-actions">
        {user && (
          <span className="header-user">
            Signed in as{" "}
            <strong style={{ color: "var(--text-main)", fontWeight: 600 }}>{user.display_name}</strong>{" "}
            ({user.role})
          </span>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          title="Refresh current view"
          style={{ color: "var(--text-muted)" }}
        >
          <RefreshCw size={13} className={isRefreshing ? "spin" : ""} />
          <span>Refresh</span>
        </button>

        {onSignOut && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onSignOut}
            title="Sign out of YottaFlex"
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </header>
  );
};
