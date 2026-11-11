import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { useData } from "../context/DataContext";
import type { LeadItem, PaginatedResponse, SalesRep } from "../types";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
} from "lucide-react";

interface LeadsViewProps {
  onSelectLead: (leadId: string) => void;
  initialStage?: string;
  initialScoreBand?: string;
  onDataChanged?: () => void;
  /** Page heading. Defaults to "Leads". */
  title?: string;
  /** When set, the list is locked to this representative (used by "My Leads"). */
  ownerScope?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShortDate(value?: string | null): string {
  const raw = (value || "").slice(0, 10);
  const parts = raw.split("-");
  if (parts.length !== 3) return "";
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return raw;
  return `${parseInt(parts[2], 10)} ${MONTHS[monthIndex]}`;
}

function isOverdue(value?: string | null): boolean {
  const raw = (value || "").slice(0, 10);
  if (!raw) return false;
  return raw < new Date().toISOString().slice(0, 10);
}

function isDuplicateLead(lead: LeadItem): boolean {
  return lead.is_duplicate === true || String(lead.is_duplicate).toLowerCase() === "true";
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  onSelectLead,
  initialStage,
  initialScoreBand,
  onDataChanged,
  title = "Leads",
  ownerScope,
}) => {
  const { version } = useData();
  const [data, setData] = useState<PaginatedResponse<LeadItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stage, setStage] = useState(initialStage || "");
  const [owner, setOwner] = useState(ownerScope || "");
  const [scoreBand, setScoreBand] = useState(initialScoreBand || "");

  // Owner filter options
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [showAddLead, setShowAddLead] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    api
      .getSalesreps()
      .then((res) => {
        if (active) setReps(res);
      })
      .catch(() => {
        /* owner filter degrades gracefully if the list is unavailable */
      });
    return () => {
      active = false;
    };
  }, []);

  // Apply drill-down filters coming from other views (e.g. dashboard cards).
  useEffect(() => {
    setStage(initialStage || "");
    setScoreBand(initialScoreBand || "");
    setPage(1);
  }, [initialStage, initialScoreBand]);

  // Lock the list to a single representative when scoped (the "My Leads" section).
  useEffect(() => {
    if (ownerScope) {
      setOwner(ownerScope);
      setPage(1);
    }
  }, [ownerScope]);

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, stage, owner, scoreBand, debouncedSearch, version]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getLeads({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        stage: stage || undefined,
        score_band: scoreBand || undefined,
        assigned_salesrep_id: owner || undefined,
        sort_by: "created_at",
        sort_order: "desc",
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const hasFilters = Boolean(search || stage || scoreBand || (!ownerScope && owner));

  const clearFilters = () => {
    setSearch("");
    setStage("");
    setOwner(ownerScope || "");
    setScoreBand("");
    setPage(1);
  };

  const handleLeadCreated = () => {
    setShowAddLead(false);
    setPage(1);
    loadLeads();
    onDataChanged?.();
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
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-main)" }}>{title}</h1>
          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
            {data ? (
              <>
                Showing <strong style={{ color: "var(--text-main)" }}>{data.items.length}</strong> of{" "}
                <strong style={{ color: "var(--text-main)" }}>{data.total.toLocaleString()}</strong> leads
              </>
            ) : (
              "Loading leads..."
            )}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddLead(true)}>
          <Plus size={15} />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar">
        <div className="toolbar-filters">
          <div style={{ position: "relative", display: "inline-block" }}>
            <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: "10px", top: "10px" }} />
            <input
              type="text"
              placeholder="Search by name, company, or email..."
              className="input-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="select-compact"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
            title="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Converted">Converted</option>
            <option value="Disqualified">Disqualified</option>
          </select>

          {ownerScope ? (
            <span
              className="badge badge-primary"
              style={{ fontSize: "11px", padding: "3px 8px" }}
              title="This list shows only leads assigned to you"
            >
              Showing your leads
            </span>
          ) : (
            <select
              className="select-compact"
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                setPage(1);
              }}
              title="Filter by assigned representative"
            >
              <option value="">All representatives</option>
              {reps.map((rep) => (
                <option key={rep.salesrep_id} value={rep.salesrep_id}>
                  {rep.name}
                </option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={13} /> Clear
            </button>
          )}
        </div>

        <select
          className="select-compact"
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
              <th style={{ width: "230px" }}>Lead</th>
              <th style={{ width: "190px" }}>Company</th>
              <th style={{ width: "90px", textAlign: "center" }}>Score</th>
              <th style={{ width: "120px" }}>Status</th>
              <th style={{ width: "170px" }}>Owner</th>
              <th>Next action</th>
              <th style={{ width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                  Loading leads...
                </td>
              </tr>
            ) : data && data.items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                  No leads found matching current criteria. Try adjusting your search or filters.
                </td>
              </tr>
            ) : (
              data?.items.map((lead) => (
                <tr
                  key={lead.lead_id}
                  onClick={() => onSelectLead(lead.lead_id)}
                  style={{ cursor: "pointer" }}
                  title="Open lead details"
                >
                  <td>
                    <div style={{ lineHeight: 1.35 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                        {lead.contact_name?.trim() || "Unnamed contact"}
                        {isDuplicateLead(lead) && (
                          <span className="badge badge-warning" style={{ fontSize: "10px", padding: "1px 4px", marginLeft: "6px" }}>
                            Possible duplicate
                          </span>
                        )}
                      </div>
                      {lead.contact_email && (
                        <div className="text-truncate" style={{ fontSize: "12px", color: "var(--text-muted)" }} title={lead.contact_email}>
                          {lead.contact_email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{lead.company_name || "—"}</span>
                  </td>
                  <td style={{ textAlign: "center" }}>{getScoreBadge(Number(lead.lead_score))}</td>
                  <td>{getStageBadge(lead.status)}</td>
                  <td>
                    <span
                      style={{
                        color: !lead.assigned_salesrep_name || lead.assigned_salesrep_name === "Unassigned"
                          ? "var(--warning-text)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {lead.assigned_salesrep_name || "Unassigned"}
                    </span>
                  </td>
                  <td>
                    {lead.next_action ? (
                      <div style={{ lineHeight: 1.35 }}>
                        <div className="text-truncate" style={{ fontWeight: 500, color: "var(--text-main)" }} title={lead.next_action}>
                          {lead.next_action}
                        </div>
                        {lead.next_action_due && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: isOverdue(lead.next_action_due) ? "var(--danger)" : "var(--text-muted)",
                            }}
                          >
                            {isOverdue(lead.next_action_due) ? "Overdue · " : "Due "}
                            {formatShortDate(lead.next_action_due)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No next step</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <ChevronRight size={15} color="var(--text-light)" />
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

      {showAddLead && (
        <AddLeadModal reps={reps} onClose={() => setShowAddLead(false)} onCreated={handleLeadCreated} />
      )}
    </div>
  );
};

interface AddLeadModalProps {
  reps: SalesRep[];
  onClose: () => void;
  onCreated: () => void;
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ reps, onClose, onCreated }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [productInterest, setProductInterest] = useState("SMB");
  const [territory, setTerritory] = useState("North");
  const [owner, setOwner] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setFormError("Please enter the company name.");
      return;
    }
    if (!firstName.trim()) {
      setFormError("Please enter the contact's first name.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      await api.createLead({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        company_name: companyName.trim(),
        product_interest: productInterest,
        territory,
        assigned_salesrep_id: owner || undefined,
      });
      onCreated();
    } catch (err: any) {
      setFormError(err.message || "Unable to create the lead. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add lead">
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>Add a lead</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-field">
              <label className="form-label" htmlFor="lead-company">Company name</label>
              <input
                id="lead-company"
                className="form-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
                autoFocus
              />
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label className="form-label" htmlFor="lead-first">First name</label>
                <input
                  id="lead-first"
                  className="form-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Jordan"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="lead-last">Last name</label>
                <input
                  id="lead-last"
                  className="form-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Patel"
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="lead-email">Email</label>
              <input
                id="lead-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. jordan.patel@acme.com"
              />
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label className="form-label" htmlFor="lead-product">Product interest</label>
                <select id="lead-product" className="form-input" value={productInterest} onChange={(e) => setProductInterest(e.target.value)}>
                  <option value="Enterprise">Enterprise</option>
                  <option value="Mid-Market">Mid-Market</option>
                  <option value="SMB">SMB</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="lead-territory">Territory</label>
                <select id="lead-territory" className="form-input" value={territory} onChange={(e) => setTerritory(e.target.value)}>
                  <option value="North">North</option>
                  <option value="South">South</option>
                  <option value="East">East</option>
                  <option value="West">West</option>
                  <option value="Central">Central</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="lead-owner">Assign to</label>
              <select id="lead-owner" className="form-input" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Unassigned</option>
                {reps.map((rep) => (
                  <option key={rep.salesrep_id} value={rep.salesrep_id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--danger)" }}>
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Adding..." : "Add lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
