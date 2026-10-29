import React, { useState } from "react";
import { Sidebar, type NavTab } from "./components/Sidebar";
import { Header } from "./components/Header";
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleNavigate = (tab: string) => {
    if (["dashboard", "leads", "tasks", "pipeline", "investigations", "validation"].includes(tab)) {
      setCurrentTab(tab as NavTab);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={(tab) => setCurrentTab(tab)}
        anomaliesCount={5}
      />

      {/* Main Content Area */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Sticky Top Header */}
        <Header
          currentTab={currentTab}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Dynamic View Container */}
        <main style={{ flex: 1, padding: "20px 24px", maxWidth: "1440px", width: "100%", margin: "0 auto" }}>
          {currentTab === "dashboard" && (
            <DashboardView
              key={refreshKey}
              onNavigate={handleNavigate}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          )}

          {currentTab === "leads" && (
            <LeadsView
              key={refreshKey}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          )}

          {currentTab === "tasks" && (
            <TasksView
              key={refreshKey}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          )}

          {currentTab === "pipeline" && (
            <PipelineView
              key={refreshKey}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          )}

          {currentTab === "investigations" && (
            <InvestigationsView
              key={refreshKey}
              onSelectLead={(leadId) => setSelectedLeadId(leadId)}
            />
          )}

          {currentTab === "validation" && (
            <DataQualityView key={refreshKey} />
          )}
        </main>
      </div>

      {/* Lead Detail 360 Slide-over Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
};

export default App;
