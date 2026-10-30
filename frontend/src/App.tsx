import React, { useState, useEffect } from "react";
import { Sidebar, type NavTab } from "./components/Sidebar";
import { Header } from "./components/Header";
import { api } from "./services/api";
import { DashboardView } from "./views/DashboardView";
import { LeadsView } from "./views/LeadsView";
import { TasksView } from "./views/TasksView";
import { PipelineView } from "./views/PipelineView";
import { InvestigationsView } from "./views/InvestigationsView";
import { DataQualityView } from "./views/DataQualityView";
import { LeadDetailDrawer } from "./views/LeadDetailDrawer";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [initialLeadStage, setInitialLeadStage] = useState<string | undefined>(undefined);
  const [initialLeadScoreBand, setInitialLeadScoreBand] = useState<string | undefined>(undefined);
  const [initialOppStage, setInitialOppStage] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [anomaliesCount, setAnomaliesCount] = useState<number>(5);

  useEffect(() => {
    api.getDashboardSummary()
      .then((summary) => {
        if (typeof summary.anomalies_detected === "number") {
          setAnomaliesCount(summary.anomalies_detected);
        }
      })
      .catch(() => {});
  }, [refreshKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleNavigate = (tab: string, filter?: { stage?: string; oppStage?: string; scoreBand?: string }) => {
    if (["dashboard", "leads", "tasks", "pipeline", "investigations", "validation"].includes(tab)) {
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
        onNavigate={(tab) => {
          setCurrentTab(tab);
          setSidebarOpen(false);
        }}
        anomaliesCount={anomaliesCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="app-main-content">
        {/* Sticky Top Header */}
        <Header
          currentTab={currentTab}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Dynamic View Container (State-Preserved for Instant Tab Switching) */}
        <main style={{ flex: 1, padding: "20px 24px", maxWidth: "1440px", width: "100%", margin: "0 auto" }}>
          <div style={{ display: currentTab === "dashboard" ? "block" : "none" }}>
            <DashboardView
              key={refreshKey}
              onNavigate={handleNavigate}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          <div style={{ display: currentTab === "leads" ? "block" : "none" }}>
            <LeadsView
              key={`${refreshKey}-${initialLeadStage || "all"}-${initialLeadScoreBand || "all"}`}
              initialStage={initialLeadStage}
              initialScoreBand={initialLeadScoreBand}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          <div style={{ display: currentTab === "tasks" ? "block" : "none" }}>
            <TasksView
              key={refreshKey}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          <div style={{ display: currentTab === "pipeline" ? "block" : "none" }}>
            <PipelineView
              key={`${refreshKey}-${initialOppStage || "all"}`}
              initialStage={initialOppStage}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          <div style={{ display: currentTab === "investigations" ? "block" : "none" }}>
            <InvestigationsView
              key={refreshKey}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          <div style={{ display: currentTab === "validation" ? "block" : "none" }}>
            <DataQualityView key={refreshKey} onNavigate={handleNavigate} />
          </div>
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
