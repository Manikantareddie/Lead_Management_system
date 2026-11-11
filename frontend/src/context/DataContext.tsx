import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";
import type { DashboardSummary, HealthStatus } from "../types";

/**
 * Centralized read-only store for server data that is shared across views.
 *
 * Previously the dashboard summary was fetched independently by the App shell,
 * the Dashboard view, and the Pipeline view, and `/health` by the Data Quality
 * view — each holding its own copy that could drift apart. This store fetches
 * that shared data once and exposes a single refresh bus so every view stays
 * consistent after a mutation.
 */
interface DataContextValue {
  summary: DashboardSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  health: HealthStatus | null;
  anomaliesCount: number;
  /** Increments on every refresh; views use it as a re-fetch key. */
  version: number;
  isRefreshing: boolean;
  refresh: () => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [version, setVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      setHealth(null);
      setSummaryError(null);
      return;
    }

    let cancelled = false;
    setSummaryLoading(true);
    Promise.all([
      api.getDashboardSummary(),
      api.getHealth().catch(() => null),
    ])
      .then(([summaryRes, healthRes]) => {
        if (cancelled) return;
        setSummary(summaryRes);
        setSummaryError(null);
        if (healthRes) setHealth(healthRes);
      })
      .catch((err: { message?: string }) => {
        if (cancelled) return;
        setSummaryError(err?.message || "Failed to load dashboard metrics");
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setVersion((v) => v + 1);
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setIsRefreshing(false), 600);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const anomaliesCount = summary?.anomalies_detected ?? 0;

  return (
    <DataContext.Provider
      value={{ summary, summaryLoading, summaryError, health, anomaliesCount, version, isRefreshing, refresh }}
    >
      {children}
    </DataContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useData = (): DataContextValue => {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
};
