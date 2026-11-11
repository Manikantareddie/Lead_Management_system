import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Sidebar, type NavTab, isAdminTab } from "./components/Sidebar";
import { Header } from "./components/Header";
import { useAuth } from "./context/AuthContext";
import { useData } from "./context/DataContext";
import { DashboardView } from "./views/DashboardView";
import { LeadsView } from "./views/LeadsView";
import { TasksView } from "./views/TasksView";
import { PipelineView } from "./views/PipelineView";
import { ReportsView } from "./views/ReportsView";
import { InvestigationsView } from "./views/InvestigationsView";
import { DataQualityView } from "./views/DataQualityView";
import { LeadDetailDrawer } from "./views/LeadDetailDrawer";
import { LoginView } from "./views/LoginView";

export const App: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const { anomaliesCount, isRefreshing, refresh } = useData();
  const [currentTab, setCurrentTab] = useState<NavTab>("my-leads");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [initialLeadStage, setInitialLeadStage] = useState<string | undefined>(undefined);
  const [initialLeadScoreBand, setInitialLeadScoreBand] = useState<string | undefined>(undefined);
  const [initialOppStage, setInitialOppStage] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleRefresh = refresh;

  // Technical / administrative consoles are limited to privileged roles.
  const canViewAdmin = user?.role === "admin" || user?.role === "manager";

  const handleNavigate = (tab: string, filter?: { stage?: string; oppStage?: string; scoreBand?: string }) => {
    if (isAdminTab(tab) && !canViewAdmin) return;
    if (
      ["my-leads", "leads", "tasks", "pipeline", "dashboard", "reports", "investigations", "validation"].includes(tab)
    ) {
      if (tab === "leads") {
        setInitialLeadStage(filter?.stage);
        setInitialLeadScoreBand(filter?.scoreBand);
      }
      if (tab === "pipeline") {
        setInitialOppStage(filter?.oppStage);
      }
      setCurrentTab(tab as NavTab);
      setSidebarOpen(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-muted)",
          fontSize: "14px",
        }}
      >
        <RefreshCw size={18} className="spin" />
        <span>Loading YottaFlex...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-primary)", position: "relative" }}>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={handleNavigate}
        anomaliesCount={anomaliesCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        showAdmin={canViewAdmin}
      />

      {/* Main Content Area */}
      <div className="app-main-content">
        {/* Sticky Top Header */}
        <Header
          currentTab={currentTab}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onSignOut={logout}
        />

        {/* Dynamic View Container (State-Preserved for Instant Tab Switching) */}
        <main className="app-main-inner">
          <div style={{ display: currentTab === "dashboard" ? "block" : "none" }}>
            <DashboardView
              onNavigate={handleNavigate}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          <div style={{ display: currentTab === "my-leads" ? "block" : "none" }}>
            <LeadsView
              title="My Leads"
              ownerScope={user?.salesrep_id || undefined}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
              onDataChanged={handleRefresh}
            />
          </div>

          <div style={{ display: currentTab === "leads" ? "block" : "none" }}>
            <LeadsView
              title="All Leads / Team"
              initialStage={initialLeadStage}
              initialScoreBand={initialLeadScoreBand}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
              onDataChanged={handleRefresh}
            />
          </div>

          <div style={{ display: currentTab === "tasks" ? "block" : "none" }}>
            <TasksView
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
              onDataChanged={handleRefresh}
            />
          </div>

          <div style={{ display: currentTab === "pipeline" ? "block" : "none" }}>
            <PipelineView
              initialStage={initialOppStage}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          <div style={{ display: currentTab === "reports" ? "block" : "none" }}>
            <ReportsView />
          </div>

          {canViewAdmin && (
            <div style={{ display: currentTab === "investigations" ? "block" : "none" }}>
              <InvestigationsView
                onSelectLead={(leadId) => setSelectedLeadId(leadId)}
              />
            </div>
          )}

          {canViewAdmin && (
            <div style={{ display: currentTab === "validation" ? "block" : "none" }}>
              <DataQualityView onNavigate={handleNavigate} />
            </div>
          )}
        </main>
      </div>

      {/* Lead Detail 360 Slide-over Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={handleRefresh}
      />
    </div>
  );
};

export default App;
