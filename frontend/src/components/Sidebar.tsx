import React from "react";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Layers,
  X,
} from "lucide-react";

export type NavTab = "dashboard" | "leads" | "tasks" | "pipeline" | "investigations" | "validation";

interface SidebarProps {
  currentTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  anomaliesCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  anomaliesCount = 5,
  isOpen = false,
  onClose,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    badgeVariant?: "warning" | "neutral";
  }> = [
    {
      id: "dashboard",
      label: "Overview",
      icon: <LayoutDashboard size={17} />,
    },
    {
      id: "leads",
      label: "Leads",
      icon: <Users size={17} />,
    },
    {
      id: "tasks",
      label: "Tasks & Activities",
      icon: <CheckSquare size={17} />,
    },
    {
      id: "pipeline",
      label: "Opportunities",
      icon: <TrendingUp size={17} />,
    },
    {
      id: "investigations",
      label: "Governance Alerts",
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
          {navItems.map((item) => {
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
          })}
        </div>
      </nav>
    </aside>
  );
};
