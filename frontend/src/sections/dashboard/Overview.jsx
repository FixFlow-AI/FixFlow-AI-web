import { useEffect, useState, useMemo } from "react";
import {
  ArrowRight,
  FileText,
  RefreshCw,
  AlertTriangle,
  Cpu,
  Coins,
  Award,
  Clock,
  CheckCircle,
  ChevronRight,
  Plus,
  Search,
  X,
  SearchX,
  Pin,
  PinOff,
  Pencil,
  Check,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";

export function Overview() {
  const {
    user,
    setDashboardTab,
    hydrateLatestProposal,
    proposalHistory,
    setProposalHistory,
    startNewProposal,
    parsedProposalId,
    selectProposalById,
    renameProposal,
    togglePinProposal,
  } = useLandingStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingBrief, setViewingBrief] = useState(null); // track which proposal is loading
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitleText, setEditTitleText] = useState("");


  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.overview();
      setData(res);
      // If the overview returns a proposals array, seed the store's history
      // so it's available even if Dashboard hydration hasn't run yet.
      if (res?.proposals?.length && proposalHistory.length === 0) {
        setProposalHistory(res.proposals);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your overview.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProposal = async (proposalId) => {
    setViewingBrief(proposalId);
    try {
      await selectProposalById(proposalId);
      go("brief-intelligence");
    } catch (err) {
      console.error("Failed to select proposal:", err);
    } finally {
      setViewingBrief(null);
    }
  };


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (tab) => {
    setDashboardTab(tab);
    window.location.hash = `#/dashboard/${tab}`;
  };

  const handleNewProposal = () => {
    startNewProposal();
    go("brief-intelligence");
  };

  // Merge: prefer the store's full proposalHistory (richer data), else
  // fall back to the overview API's lightweight proposals array.
  const history = proposalHistory.length > 0
    ? proposalHistory
    : data?.proposals ?? [];

  // Live client-side search engine over proposal history
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase().trim();
    return history.filter((p) => {
      const title = (p.title || p.proposal?.project_summary?.split(".")[0] || "").toLowerCase();
      const summary = (p.briefText || p.proposal?.project_summary || "").toLowerCase();
      const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      }).toLowerCase() : "";

      return title.includes(q) || summary.includes(q) || date.includes(q);
    });
  }, [history, searchQuery]);

  return (
    <div>
      <div className="panel-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="panel-page-title">
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="panel-page-subtitle">
            {user?.email} · {user?.role}
          </p>
        </div>
        {user?.role === "client" && (
          <button
            type="button"
            className="panel-btn"
            onClick={handleNewProposal}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} />
            <span>New Proposal</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: "#2563eb" }} />
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>Loading your workspace…</p>
        </div>
      ) : error ? (
        <div className="panel-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c2410c" }}>
            <AlertTriangle size={16} /> {error}
          </div>
          <button type="button" className="panel-btn" style={{ marginTop: 12 }} onClick={load}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Real counts */}
          <div className="panel-grid panel-grid--3" style={{ marginBottom: 20 }}>
            <div className="panel-stat">
              <div className="panel-stat-value">{data?.counts?.proposals ?? 0}</div>
              <div className="panel-stat-label">Proposals</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat-value">{data?.milestoneSummary?.total ?? 0}</div>
              <div className="panel-stat-label">Milestones</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat-value" style={{ color: "#16a34a" }}>
                {data?.milestoneSummary?.released ?? 0}
              </div>
              <div className="panel-stat-label">Released</div>
            </div>
          </div>

          {data?.latestProposal ? (
            <div className="panel-card">
              <div className="panel-card-header">
                <h2 className="panel-card-title">Latest project</h2>
                <span className="panel-badge panel-badge--blue">
                  {data.latestProposal.hasEvaluation ? "Evaluated" : "Parsed"}
                </span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Title</span>
                <span className="panel-info-value">{data.latestProposal.title}</span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Features</span>
                <span className="panel-info-value">{data.latestProposal.features}</span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Risks</span>
                <span className="panel-info-value">{data.latestProposal.risks}</span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Created</span>
                <span className="panel-info-value">
                  {new Date(data.latestProposal.createdAt).toLocaleString()}
                </span>
              </div>
              <hr className="panel-divider" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="panel-btn" onClick={() => go("evidence-confidence")}>
                  <Cpu size={14} /> Evaluate
                </button>
                <button type="button" className="panel-btn--ghost panel-btn" onClick={() => go("matching")}>
                  Find matches <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="panel-btn--ghost panel-btn"
                  onClick={() => handleViewBrief(data.latestProposal.proposalId)}
                  disabled={viewingBrief === data.latestProposal.proposalId}
                >
                  {viewingBrief === data.latestProposal.proposalId ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <FileText size={14} />
                  )}
                  View Brief
                </button>
              </div>
            </div>
          ) : (
            /* Honest empty state for a brand-new account — no mock data. */
            <div className="panel-card" style={{ textAlign: "center", padding: 40 }}>
              <FileText size={32} style={{ color: "#94a3b8" }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 4px" }}>
                No projects yet
              </h2>
              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
                Start by parsing a project brief — that creates your first real proposal.
              </p>
              <button type="button" className="panel-btn" onClick={() => go("brief-intelligence")}>
                Parse a brief <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* ─── Proposal History ──────────────────────────────────────── */}
          {history.length > 0 && (
            <div className="panel-card" style={{ marginTop: 20 }}>
              <div
                className="panel-card-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center" }}>
                  <Clock size={16} style={{ marginRight: 6 }} />
                  Proposal History
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {/* Search Engine Input */}
                  <div style={{ position: "relative", minWidth: 240 }}>
                    <Search
                      size={14}
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search proposals by title or brief..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        paddingLeft: 30,
                        paddingRight: searchQuery ? 28 : 10,
                        paddingTop: 6,
                        paddingBottom: 6,
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                        outline: "none",
                        transition: "border-color 0.15s ease",
                      }}
                      onFocus={(e) => { e.target.style.borderColor = "#2563eb"; }}
                      onBlur={(e) => { e.target.style.borderColor = "#cbd5e1"; }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        title="Clear search"
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                          display: "grid",
                          placeItems: "center",
                          padding: 0,
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <span className="panel-badge panel-badge--gray">
                    {filteredHistory.length} of {history.length} record{history.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {filteredHistory.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {filteredHistory.map((p, idx) => {
                    const id = p.proposalId;
                    const title = p.title || p.proposal?.project_summary?.split(".")[0] || "Untitled";
                    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    }) : "—";
                    const time = p.createdAt ? new Date(p.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit", minute: "2-digit",
                    }) : "";
                    const features = p.features ?? p.proposal?.features?.length ?? 0;
                    const risks = p.risks ?? p.proposal?.risks?.length ?? 0;
                    const evaluated = p.hasEvaluation ?? Boolean(p.evaluation);
                    const isEditingThis = editingId === id;
                    const isPinned = Boolean(p.pinned);

                    return (
                      <div
                        key={id || idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 8px",
                          borderBottom: idx < filteredHistory.length - 1 ? "1px solid #f1f5f9" : "none",
                          borderRadius: 6,
                          background: isActiveWorkspace ? "#f8fafc" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActiveWorkspace) e.currentTarget.style.background = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActiveWorkspace) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Left: title + meta */}
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                          {isEditingThis ? (
                            <div
                              style={{ display: "flex", alignItems: "center", gap: 6 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editTitleText}
                                onChange={(e) => setEditTitleText(e.target.value)}
                                autoFocus
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #2563eb",
                                  outline: "none",
                                  width: "100%",
                                  maxWidth: 320,
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    renameProposal(id, editTitleText);
                                    setEditingId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingId(null);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="panel-btn--ghost"
                                title="Save Title"
                                onClick={() => {
                                  renameProposal(id, editTitleText);
                                  setEditingId(null);
                                }}
                                style={{ padding: 4, color: "#16a34a" }}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                className="panel-btn--ghost"
                                title="Cancel"
                                onClick={() => setEditingId(null)}
                                style={{ padding: 4, color: "#94a3b8" }}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#1e293b",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}>
                              <span
                                style={{ cursor: isLoading ? "wait" : "pointer" }}
                                onClick={() => !isLoading && handleSelectProposal(id)}
                              >
                                {title}
                              </span>
                              {isActiveWorkspace && (
                                <span className="panel-badge panel-badge--blue" style={{ fontSize: 10 }}>
                                  Active Workspace
                                </span>
                              )}
                              {isPinned && (
                                <span className="panel-badge panel-badge--amber" style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <Pin size={10} style={{ color: "#d97706" }} /> Pinned
                                </span>
                              )}
                            </div>
                          )}

                          <div style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            marginTop: 3,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}>
                            <span>{date} {time}</span>
                            <span>·</span>
                            <span>{features} feature{features !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span>{risks} risk{risks !== 1 ? "s" : ""}</span>
                          </div>
                        </div>

                        {/* Right: badges & controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="panel-btn--ghost"
                            title={isPinned ? "Unpin proposal" : "Pin proposal to top"}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinProposal(id);
                            }}
                            style={{
                              padding: 6,
                              borderRadius: 6,
                              color: isPinned ? "#d97706" : "#94a3b8",
                              background: isPinned ? "#fef3c7" : "transparent",
                              cursor: "pointer",
                            }}
                          >
                            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                          </button>

                          <button
                            type="button"
                            className="panel-btn--ghost"
                            title="Rename proposal title"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(id);
                              setEditTitleText(title);
                            }}
                            style={{
                              padding: 6,
                              borderRadius: 6,
                              color: "#64748b",
                              cursor: "pointer",
                            }}
                          >
                            <Pencil size={14} />
                          </button>

                          {evaluated ? (
                            <span className="panel-badge panel-badge--green" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <CheckCircle size={11} /> Evaluated
                            </span>
                          ) : (
                            <span className="panel-badge panel-badge--outline">Parsed</span>
                          )}

                          <button
                            type="button"
                            onClick={() => !isLoading && handleSelectProposal(id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: isLoading ? "wait" : "pointer",
                              padding: 4,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {isLoading ? (
                              <RefreshCw size={14} className="animate-spin" style={{ color: "#2563eb" }} />
                            ) : (
                              <ChevronRight size={16} style={{ color: isActiveWorkspace ? "#2563eb" : "#94a3b8" }} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}


                </div>
              ) : (
                /* No matching proposals search state */
                <div style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                  <SearchX size={32} style={{ color: "#cbd5e1", marginBottom: 8 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>
                    No proposals match "{searchQuery}"
                  </p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>
                    Try searching for a different keyword or project title.
                  </p>
                  <button
                    type="button"
                    className="panel-btn--ghost panel-btn"
                    onClick={() => setSearchQuery("")}
                    style={{ fontSize: 12 }}
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

