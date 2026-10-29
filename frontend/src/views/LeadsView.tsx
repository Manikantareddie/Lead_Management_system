import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import type { LeadItem, PaginatedResponse } from "../types";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Filter,
} from "lucide-react";

interface LeadsViewProps {
  onSelectLead: (leadId: string) => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({ onSelectLead }) => {
  const [data, setData] = useState<PaginatedResponse<LeadItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [territory, setTerritory] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isDuplicate, setIsDuplicate] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    loadLeads();
  }, [page, pageSize, stage, territory, sortBy, sortOrder, isDuplicate, search]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getLeads({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        stage: stage || undefined,
        territory: territory || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        is_duplicate: isDuplicate,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const hasFilters = Boolean(search || stage || territory || isDuplicate !== undefined || sortBy !== "created_at");

  const clearFilters = () => {
    setSearch("");
    setStage("");
    setTerritory("");
    setIsDuplicate(undefined);
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const getStageBadge = (st: string) => {
    switch (st?.toLowerCase()) {
      case "qualified":
        return <span className="badge badge-success">Qualified</span>;
      case "contacted":
        return <span className="badge badge-primary">Contacted</span>;
      case "new":
        return <span className="badge badge-neutral">New</span>;
      case "converted":
        return <span className="badge badge-success">Converted</span>;
      case "disqualified":
        return <span className="badge badge-neutral">Disqualified</span>;
      default:
        return <span className="badge badge-neutral">{st}</span>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <span className="score-pill score-hot">{score}</span>;
    if (score >= 60) return <span className="score-pill score-warm">{score}</span>;
    if (score >= 40) return <span className="score-pill score-moderate">{score}</span>;
    return <span className="score-pill score-cold">{score}</span>;
  };

  return (
    <div className="view-container">
      {/* Compact Filter Toolbar */}
      <div className="toolbar">
        <div className="toolbar-filters">
          {/* Search */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <Search
              size={14}
              color="var(--text-muted)"
              style={{ position: "absolute", left: "10px", top: "10px" }}
            />
            <input
              type="text"
              placeholder="Search by ID, company, or email..."
              className="input-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Stage */}
          <select
            className="select-compact"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Stages</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Converted">Converted</option>
            <option value="Disqualified">Disqualified</option>
          </select>

          {/* Territory */}
          <select
            className="select-compact"
            value={territory}
            onChange={(e) => {
              setTerritory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Territories</option>
            <option value="North">North</option>
            <option value="South">South</option>
            <option value="East">East</option>
            <option value="West">West</option>
          </select>

          {/* Duplicate filter */}
          <select
            className="select-compact"
            value={isDuplicate === undefined ? "" : isDuplicate ? "true" : "false"}
            onChange={(e) => {
              if (e.target.value === "") setIsDuplicate(undefined);
              else setIsDuplicate(e.target.value === "true");
              setPage(1);
            }}
          >
            <option value="">All Records</option>
            <option value="false">Canonical Only</option>
            <option value="true">Duplicates Only</option>
          </select>

          {/* Sort order */}
          <select
            className="select-compact"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split("-");
              setSortBy(sb);
              setSortOrder(so);
              setPage(1);
            }}
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="lead_score-desc">Highest Score</option>
            <option value="lead_score-asc">Lowest Score</option>
          </select>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={13} /> Reset filters
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "var(--text-muted)" }}>
          <span>
            {data ? (
              <span>
                Showing <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{data.items.length}</strong> of{" "}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{data.total.toLocaleString()}</span> leads
              </span>
            ) : (
              "Loading..."
            )}
          </span>
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
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", padding: "12px 16px" }}>
          <span style={{ fontSize: "13px", color: "var(--danger)" }}>{error}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "155px" }}>Lead ID</th>
              <th style={{ width: "175px" }}>Company</th>
              <th style={{ width: "220px" }}>Contact</th>
              <th style={{ width: "100px" }}>Territory</th>
              <th style={{ width: "110px" }}>Stage</th>
              <th style={{ width: "85px", textAlign: "center" }}>Score</th>
              <th style={{ width: "145px" }}>Assigned Rep</th>
              <th style={{ width: "105px" }}>Created</th>
              <th style={{ width: "85px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                  Loading leads...
                </td>
              </tr>
            ) : data && data.items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                  No leads found matching current criteria. Try adjusting your search or filters.
                </td>
              </tr>
            ) : (
              data?.items.map((lead) => (
                <tr key={lead.lead_id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="id-tag" title={lead.lead_id}>{lead.lead_id}</span>
                      {lead.is_duplicate && (
                        <span className="badge badge-warning" style={{ fontSize: "10px", padding: "1px 4px" }}>
                          Dup
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500, color: "var(--text-main)" }}>
                      {lead.company_name || "—"}
                    </span>
                  </td>
                  <td>
                    <div style={{ lineHeight: 1.35 }}>
                      <div style={{ fontWeight: 500, color: "var(--text-main)" }}>
                        {lead.contact_name || "—"}
                      </div>
                      <div
                        className="text-truncate"
                        style={{ fontSize: "12px", color: "var(--text-muted)" }}
                        title={lead.contact_email}
                      >
                        {lead.contact_email}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-secondary)" }}>{lead.territory}</span>
                  </td>
                  <td>{getStageBadge(lead.status)}</td>
                  <td style={{ textAlign: "center" }}>
                    {getScoreBadge(Number(lead.lead_score))}
                  </td>
                  <td>
                    <span style={{ color: lead.assigned_salesrep_name === "Unassigned" ? "var(--warning-text)" : "var(--text-secondary)" }}>
                      {lead.assigned_salesrep_name}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {lead.created_at.slice(0, 10)}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onSelectLead(lead.lead_id)}
                      title={`Inspect lead ${lead.lead_id}`}
                      style={{ padding: "0 8px" }}
                    >
                      <span>View</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {data && data.total_pages > 1 && (
          <div className="pagination-bar">
            <span>
              Page <strong style={{ color: "var(--text-main)" }}>{page}</strong> of{" "}
              <strong style={{ color: "var(--text-main)" }}>{data.total_pages.toLocaleString()}</strong>
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
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
