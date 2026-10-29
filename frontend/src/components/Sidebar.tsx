import React from "react";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Layers,
} from "lucide-react";

export type NavTab = "dashboard" | "leads" | "tasks" | "pipeline" | "investigations" | "validation";

interface SidebarProps {
  currentTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  anomaliesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onNavigate, anomaliesCount = 5 }) => {
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
      label: "Investigations",
      icon: <ShieldAlert size={17} />,
      badge: `${anomaliesCount} findings`,
      badgeVariant: "warning",
    },
    {
      id: "validation",
      label: "Data Quality",
      icon: <ShieldCheck size={17} />,
    },
  ];

  return (
    <aside
      style={{
        width: "240px",
        height: "100vh",
        backgroundColor: "#ffffff",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 50,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: "18px 20px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
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
          <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
            YottaFlex
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>
            Operations Console
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav style={{ padding: "14px 10px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
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

      {/* Minimal Status Footer */}
      <div
        style={{
          padding: "14px 18px",
          borderTop: "1px solid var(--border-subtle)",
          backgroundColor: "#fafafa",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "var(--success)",
              boxShadow: "0 0 0 2px rgba(5, 150, 105, 0.2)",
            }}
          />
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>
            Operational
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-light)", fontFamily: "monospace" }}>
          v1.0
        </span>
      </div>
    </aside>
  );
};
