import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useData } from "../context/DataContext";
import type { OpportunityItem, PaginatedResponse, PipelineStageStat } from "../types";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  LayoutGrid,
  List,
  Calendar,
  User,
} from "lucide-react";

interface PipelineViewProps {
  onSelectLead: (leadId: string) => void;
  initialStage?: string;
}

// How many deals to surface per board column (the busiest deals by value).
const BOARD_PAGE_SIZE = 20;

const STAGE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  decision_pending: "Decision Pending",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const stageLabel = (stage: string) =>
  STAGE_LABELS[(stage || "").toLowerCase().replace(" ", "_")] ||
  (stage || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Used when the analytics endpoint is unavailable so the board still renders
// the canonical columns instead of collapsing to nothing.
const FALLBACK_STAGES: PipelineStageStat[] = Object.keys(STAGE_LABELS).map((stage) => ({
  stage,
  count: 0,
  total_value: 0,
  avg_value: 0,
}));

const isDuplicateOpp = (opp: OpportunityItem) =>
  String(opp.is_duplicate).toLowerCase() === "true";

export const PipelineView: React.FC<PipelineViewProps> = ({ onSelectLead, initialStage }) => {
  // Board is the primary, visual view; a stage drill-down starts in the list instead.
  const [view, setView] = useState<"board" | "list">(initialStage ? "list" : "board");

  // Shared filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(initialStage || "");
  const [duplicateFilter, setDuplicateFilter] = useState("");

  // List state
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Board state
  const [stageStats, setStageStats] = useState<PipelineStageStat[]>([]);
  const [boardDeals, setBoardDeals] = useState<Record<string, OpportunityItem[]>>({});
  const [boardLoading, setBoardLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared cross-view summary metrics (from the centralized store)
  const { summary, version } = useData();
  const totalPipelineValue = summary?.total_pipeline_value || 0;
  const closedWonCount = summary?.won_opportunities ?? 0;
  const closedWonValue = summary?.closed_won_value || 0;
  const lostOppsCount = summary?.lost_opportunities ?? 0;
  const duplicateOppsCount = summary?.duplicate_opportunities_count ?? 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const dupParam = () =>
    duplicateFilter === "true" ? true : duplicateFilter === "false" ? false : undefined;

  const loadOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedResponse<OpportunityItem> = await api.getOpportunities({
        page,
        page_size: pageSize,
        stage: stageFilter || undefined,
        is_duplicate: dupParam(),
        search: debouncedSearch.trim() || undefined,
      });
      setOpportunities(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      setError(err.message || "Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  const loadBoard = async () => {
    setBoardLoading(true);
    setError(null);

    // The board is driven by the analytics endpoint, but a single failing call
    // must never blank the page. If it is unavailable we fall back to the
    // canonical stage columns and derive counts from the pipeline records.
    let stages: PipelineStageStat[] = FALLBACK_STAGES;
    let degradedNow = false;
    try {
      const analytics = await api.getPipelineAnalytics();
      if (Array.isArray(analytics?.stages) && analytics.stages.length > 0) {
        stages = analytics.stages;
      } else {
        degradedNow = true;
      }
    } catch {
      degradedNow = true;
    }
    setDegraded(degradedNow);

    try {
      const results = await Promise.all(
        stages.map((s) =>
          api
            .getOpportunities({
              page: 1,
              page_size: BOARD_PAGE_SIZE,
              stage: s.stage,
              is_duplicate: dupParam(),
              search: debouncedSearch.trim() || undefined,
            })
            .catch(
              (): PaginatedResponse<OpportunityItem> => ({
                items: [],
                total: 0,
                page: 1,
                page_size: BOARD_PAGE_SIZE,
                total_pages: 1,
              })
            )
        )
      );

      const map: Record<string, OpportunityItem[]> = {};
      const merged = stages.map((s, i) => {
        map[s.stage] = results[i].items;
        if (!degradedNow) return s;
        // Without analytics we know each stage's true count, but not its full value.
        return { ...s, count: results[i].total };
      });
      setStageStats(merged);
      setBoardDeals(map);
    } finally {
      setBoardLoading(false);
    }
  };

  // Apply stage drill-downs coming from other views (e.g. dashboard cards).
  useEffect(() => {
    if (initialStage === undefined) return;
    setStageFilter(initialStage || "");
    setView("list");
    setPage(1);
  }, [initialStage]);

  useEffect(() => {
    if (view === "board") {
      loadBoard();
    } else {
      loadOpportunities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, version, page, pageSize, stageFilter, duplicateFilter, debouncedSearch]);

  const filtersActive = Boolean(search.trim() || duplicateFilter);
  const hasFilters = Boolean(search || stageFilter || duplicateFilter);
  const clearFilters = () => {
    setSearch("");
    setStageFilter("");
    setDuplicateFilter("");
    setPage(1);
  };

  const boardTotal = stageStats.reduce((sum, s) => sum + s.count, 0);

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatCompactCurrency = (val: number) => {
    const num = Number(val) || 0;
    if (num >= 10_000_000) return `₹${(num / 10_000_000).toFixed(2)} Cr`;
    if (num >= 100_000) return `₹${(num / 100_000).toFixed(2)} L`;
    return formatCurrency(num);
  };

  const formatShortDate = (d: string) => {
    if (!d) return "—";
    const dt = new Date(d.slice(0, 10));
    if (isNaN(dt.getTime())) return d.slice(0, 10);
    return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  const getStageBadge = (stage: string) => {
    const s = stage?.toLowerCase().replace("-", "_").replace(" ", "_");
    switch (s) {
      case "closed_won":
        return <span className="badge badge-success">Closed Won</span>;
      case "closed_lost":
        return <span className="badge badge-neutral">Closed Lost</span>;
      case "negotiation":
        return <span className="badge badge-warning">Negotiation</span>;
      case "decision_pending":
        return <span className="badge badge-warning">Decision Pending</span>;
      case "proposal":
        return <span className="badge badge-primary">Proposal</span>;
      case "qualification":
        return <span className="badge badge-neutral">Qualification</span>;
      case "discovery":
        return <span className="badge badge-neutral">Discovery</span>;
      default:
        return <span className="badge badge-neutral">{stageLabel(stage)}</span>;
    }
  };

  return (
    <div className="view-container">
      {/* 4-Card Summary Row with Real Metrics */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Opportunities</span>
            <TrendingUp size={15} color="var(--primary)" />
          </div>
          <div className="stat-value">{(view === "board" ? boardTotal : total).toLocaleString()}</div>
          <div className="stat-sub">Across all pipeline stages</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Pipeline Volume</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary)" }}>₹</span>
          </div>
          <div className="stat-value">
            {`₹${(totalPipelineValue / 10_000_000).toFixed(2)} Cr`}
          </div>
          <div className="stat-sub">Aggregated contract value</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Closed-Won Deals</span>
            <CheckCircle2 size={15} color="var(--success)" />
          </div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {closedWonCount.toLocaleString()}
          </div>
          <div className="stat-sub">
            ₹{(closedWonValue / 10_000_000).toFixed(2)} Cr booked • {lostOppsCount.toLocaleString()} lost
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Possible Duplicates</span>
            <AlertTriangle size={15} color="var(--warning)" />
          </div>
          <div className="stat-value" style={{ color: "var(--warning)" }}>
            {duplicateOppsCount.toLocaleString()}
          </div>
          <div className="stat-sub">Excluded from pipeline forecast</div>
        </div>
      </div>

      {/* View switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div className="segmented-control">
          <button
            className={`segmented-btn ${view === "board" ? "active" : ""}`}
            onClick={() => setView("board")}
          >
            <LayoutGrid size={14} />
            <span>Board</span>
          </button>
          <button
            className={`segmented-btn ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}
          >
            <List size={14} />
            <span>List</span>
          </button>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          {view === "board" ? (
            <span>
              <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
                {boardTotal.toLocaleString()}
              </strong>{" "}
              deals across {stageStats.filter((s) => s.count > 0).length} stages
            </span>
          ) : (
            <span>
              Showing <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{opportunities.length}</strong> of{" "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{total.toLocaleString()}</span> deals
            </span>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar">
        <div className="toolbar-filters">
          <div style={{ position: "relative", display: "inline-block" }}>
            <Search
              size={14}
              color="var(--text-muted)"
              style={{ position: "absolute", left: "10px", top: "10px" }}
            />
            <input
              type="text"
              className="input-search"
              placeholder="Search deal or rep..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {view === "list" && (
            <select
              className="select-compact"
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Stages</option>
              <option value="discovery">Discovery</option>
              <option value="qualification">Qualification</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="decision_pending">Decision Pending</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>
          )}

          <select
            className="select-compact"
            value={duplicateFilter}
            onChange={(e) => {
              setDuplicateFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All deals</option>
            <option value="false">Standard deals</option>
            <option value="true">Possible duplicates</option>
          </select>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={13} /> Reset filters
            </button>
          )}
        </div>

        {view === "list" && (
          <select
            className="select-compact"
            style={{ height: "28px", padding: "0 6px" }}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
          <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
        </div>
      )}

      {view === "board" && degraded && (
        <div
          className="card"
          style={{
            borderLeft: "4px solid var(--warning)",
            padding: "10px 14px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Live stage totals are temporarily unavailable. Showing deal counts from the pipeline records instead.
          </span>
        </div>
      )}

      {view === "board" ? (
        <div className="pipeline-board">
          {stageStats.map((stat) => {
            const deals = boardDeals[stat.stage] || [];
            const visibleCount = filtersActive ? deals.length : stat.count;
            return (
              <div className="pipeline-column" key={stat.stage}>
                <div className="pipeline-column-header">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span className="pipeline-column-title">{stageLabel(stat.stage)}</span>
                    <span className="badge badge-neutral" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {visibleCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="pipeline-column-value">
                    {degraded ? "—" : formatCompactCurrency(stat.total_value)}
                  </div>
                </div>

                <div className="pipeline-cards">
                  {boardLoading && deals.length === 0 ? (
                    <div className="pipeline-empty">Loading…</div>
                  ) : deals.length === 0 ? (
                    <div className="pipeline-empty">
                      {filtersActive ? "No matching deals" : "No deals yet"}
                    </div>
                  ) : (
                    deals.map((opp) => (
                      <button
                        key={opp.opportunity_id}
                        className="deal-card"
                        onClick={() => onSelectLead(opp.lead_id)}
                        title="Open this deal's lead"
                      >
                        <div className="deal-card-value">{formatCurrency(opp.amount)}</div>
                        <div className="deal-card-name">{opp.lead_name || "View lead"}</div>
                        {opp.company_name && <div className="deal-card-company">{opp.company_name}</div>}
                        <div className="deal-card-meta">
                          <span>
                            <User size={11} /> {opp.salesrep_name}
                          </span>
                          <span>
                            <Calendar size={11} /> {formatShortDate(opp.close_date)}
                          </span>
                        </div>
                        {isDuplicateOpp(opp) && (
                          <span className="badge badge-warning" style={{ marginTop: "6px" }}>
                            Possible duplicate
                          </span>
                        )}
                      </button>
                    ))
                  )}

                  {!boardLoading && !filtersActive && deals.length < stat.count && (
                    <div className="pipeline-more">
                      Top {deals.length} of {stat.count.toLocaleString()} by value
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "200px" }}>Lead / Company</th>
                <th style={{ width: "125px" }}>Stage</th>
                <th style={{ width: "135px", textAlign: "right" }}>Contract Value</th>
                <th style={{ width: "115px" }}>Close Date</th>
                <th style={{ width: "160px" }}>Assigned Rep</th>
                <th style={{ width: "130px" }}>Duplicate check</th>
                <th style={{ width: "85px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && opportunities.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    Loading deals...
                  </td>
                </tr>
              ) : opportunities.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    No deals found matching criteria.
                  </td>
                </tr>
              ) : (
                opportunities.map((opp) => (
                  <tr key={opp.opportunity_id}>
                    <td>
                      <div style={{ lineHeight: 1.35 }}>
                        <div style={{ fontWeight: 500, color: "var(--text-main)" }}>
                          {opp.lead_name || "—"}
                        </div>
                        {opp.company_name && (
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{opp.company_name}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        {getStageBadge(opp.stage)}
                        {opp.won_lost_reason && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: opp.stage === "closed_won" ? "var(--success)" : "var(--text-muted)",
                              marginTop: "2px",
                              fontWeight: 500,
                            }}
                            title={`Outcome: ${opp.won_lost_reason}${opp.competitor ? ' • Competitor: ' + opp.competitor : ''}`}
                          >
                            {opp.won_lost_reason.replace(/_/g, " ")}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "var(--text-main)" }}>
                      {formatCurrency(opp.amount)}
                    </td>
                    <td>
                      <span style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {formatShortDate(opp.close_date)}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: opp.salesrep_name === "Unassigned" ? "var(--warning-text)" : "var(--text-secondary)" }}>
                        {opp.salesrep_name}
                      </span>
                    </td>
                    <td>
                      {isDuplicateOpp(opp) ? (
                        <span className="badge badge-warning" title="Duplicate opportunity identified">
                          Possible duplicate
                        </span>
                      ) : (
                        <span className="badge badge-neutral">
                          Standard
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectLead(opp.lead_id)}
                        title="Open this deal's lead"
                        style={{ padding: "0 8px" }}
                      >
                        <span>Lead</span>
                        <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="pagination-bar">
              <span>
                Page <strong style={{ color: "var(--text-main)" }}>{page}</strong> of{" "}
                <strong style={{ color: "var(--text-main)" }}>{totalPages.toLocaleString()}</strong>
              </span>

              <div className="pagination-controls">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
