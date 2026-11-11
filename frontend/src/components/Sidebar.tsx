import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CheckSquare,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Layers,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export type NavTab =
  | "my-leads"
  | "tasks"
  | "pipeline"
  | "leads"
  | "dashboard"
  | "reports"
  | "investigations"
  | "validation";

const ADMIN_TABS: NavTab[] = ["investigations", "validation"];
export const isAdminTab = (tab: string): boolean => ADMIN_TABS.includes(tab as NavTab);

interface SidebarProps {
  currentTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  anomaliesCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
  showAdmin?: boolean;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: "warning" | "neutral";
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  anomaliesCount = 0,
  isOpen = false,
  onClose,
  showAdmin = false,
}) => {
  // Technical / administrative sections stay collapsed unless the user is already in one of them.
  const [adminOpen, setAdminOpen] = useState(ADMIN_TABS.includes(currentTab));

  useEffect(() => {
    if (ADMIN_TABS.includes(currentTab)) {
      setAdminOpen(true);
    }
  }, [currentTab]);

  // The sales representative's day-to-day workspace: only what the job needs.
  const workspaceItems: NavItem[] = [
    {
      id: "my-leads",
      label: "My Leads",
      icon: <UserCheck size={17} />,
    },
    {
      id: "tasks",
      label: "Follow-ups",
      icon: <CheckSquare size={17} />,
    },
    {
      id: "pipeline",
      label: "Pipeline",
      icon: <TrendingUp size={17} />,
    },
    {
      id: "leads",
      label: "All Leads / Team",
      icon: <Users size={17} />,
    },
  ];

  // Overview and analytics, kept secondary so the working sections stay dominant.
  const insightItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={17} />,
    },
    {
      id: "reports",
      label: "Reports",
      icon: <BarChart3 size={17} />,
    },
  ];

  const adminItems: NavItem[] = [
    {
      id: "investigations",
      label: "Alerts & Compliance",
      icon: <ShieldAlert size={17} />,
      badge: String(anomaliesCount),
      badgeVariant: "warning",
    },
    {
      id: "validation",
      label: "Data Quality",
      icon: <ShieldCheck size={17} />,
    },
  ];

  const renderNavButton = (item: NavItem) => {
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          onNavigate(item.id);
          if (onClose) onClose();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderRadius: "6px",
          backgroundColor: isActive ? "var(--primary-light)" : "transparent",
          color: isActive ? "var(--primary)" : "var(--text-main)",
          fontWeight: isActive ? 600 : 500,
          fontSize: "13px",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background-color 0.12s, color 0.12s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: isActive ? "var(--primary)" : "var(--text-muted)", display: "flex" }}>
            {item.icon}
          </span>
          <span>{item.label}</span>
        </div>

        {item.badge && (
          <span
            className={`badge badge-${item.badgeVariant || "neutral"}`}
            style={{ fontSize: "10px", padding: "1px 6px" }}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className={`app-sidebar ${isOpen ? "open" : ""}`}>
      {/* Brand Header */}
      <div
        style={{
          padding: "18px 20px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              backgroundColor: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
              LMS
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>
              Lead Management System
            </div>
          </div>
        </div>
        {onClose && (
          <button
            className="mobile-menu-btn"
            style={{ margin: 0 }}
            onClick={onClose}
            aria-label="Close Navigation Menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav style={{ padding: "14px 10px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {workspaceItems.map(renderNavButton)}
        </div>

        {/* Secondary: overview & analytics */}
        <div
          style={{
            marginTop: "14px",
            paddingTop: "14px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {insightItems.map(renderNavButton)}
        </div>

        {/* Admin / Technical Section (restricted to admin & manager roles) */}
        {showAdmin && (
          <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setAdminOpen((prev) => !prev)}
              aria-expanded={adminOpen}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "6px 12px",
                borderRadius: "6px",
                backgroundColor: "transparent",
                color: "var(--text-muted)",
                fontWeight: 600,
                fontSize: "11px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>Admin</span>
              {adminOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {adminOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                {adminItems.map(renderNavButton)}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
};
