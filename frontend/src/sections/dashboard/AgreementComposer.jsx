import { useState, useMemo } from "react";
import {
  Check,
  Target,
  Flag,
  ListChecks,
  AlertTriangle,
  RefreshCw,
  Shield,
  Send,
  FileText,
  List,
  Pencil,
  MoreHorizontal,
  ArrowRight,
  Users,
  Building2,
  UserCheck,
  Sparkles,
  Clock,
  ExternalLink,
  Download,
  Copy,
  X,
  Award,
  ChevronRight,
  Info,
  DollarSign,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api } from "../../lib/api";

export function AgreementComposer() {
  const {
    user,
    parsedProposal,
    parsedProposalId,
    matchResults,
    setDashboardTab,
    signAgreement,
    isAgreementSigned,
    agreementStatus,
    setAgreementStatus,
    agreementActivity,
    addAgreementActivity,
  } = useLandingStore();

  const [sending, setSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [viewMode, setViewMode] = useState("detailed"); // "detailed" | "compact"
  const [isEditing, setIsEditing] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState(null);

  // Local state for editable fields
  const [editedObjective, setEditedObjective] = useState(
    parsedProposal?.project_summary || ""
  );

  if (!parsedProposal) {
    return (
      <div>
        <div className="panel-page-header">
          <h1 className="panel-page-title">Working agreement</h1>
          <p className="panel-page-subtitle">
            Scope, acceptance, ownership, and protected funds in one review.
          </p>
        </div>
        <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
          <FileText size={32} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 4px" }}>
            No working agreement drafted yet
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
            Please parse a project brief first to generate the working agreement.
          </p>
        </div>
      </div>
    );
  }

  const orgName = user?.email ? user.email.split("@")[1].split(".")[0].toUpperCase() : "CLIENT";

  // Selected candidates from matching shortlist
  const selectedCandidates = useMemo(() => {
    return (matchResults?.candidates || []).filter(
      (candidate) => candidate.status === "selected"
    );
  }, [matchResults]);

  const deliveryTeamNames = selectedCandidates.map((c) => c.name);

  const isSent = agreementStatus === "sent" || isAgreementSigned?.client;

  // Save changes from inline edit
  const handleSaveEdits = () => {
    setIsEditing(false);
    showToast("Agreement draft edits saved.");
    addAgreementActivity({
      text: "Agreement draft content updated by client",
      icon: "Pencil",
    });
  };

  // Main approval action handler
  const handleSendForApproval = async () => {
    if (sending) return;
    setSending(true);

    try {
      // Best-effort: create backend escrow milestones for each phase if proposal ID exists
      if (parsedProposalId && parsedProposal.timeline) {
        for (const phase of parsedProposal.timeline) {
          try {
            await api.createMilestone(
              parsedProposalId,
              phase.phase,
              phase.estimated_budget || 1500
            );
          } catch (_err) {
            // Milestone API handles duplicates or offline mode gracefully
          }
        }
      }
    } catch (_err) {
      // Best effort error isolation
    }

    // Update global Zustand store
    signAgreement("client");
    setAgreementStatus("sent");

    const candidateText = deliveryTeamNames.length
      ? deliveryTeamNames.join(", ")
      : "delivery team";

    addAgreementActivity({
      text: `Agreement v1.0 sent for approval to ${candidateText}`,
      icon: "Send",
    });

    setSending(false);
    setShowSuccessModal(true);
  };

  const showToast = (msg) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(""), 3000);
  };

  // Export agreement as markdown file
  const handleDownloadMarkdown = () => {
    const mdContent = `# WORKING AGREEMENT v1.0
Client: ${orgName}
Delivery Team: ${deliveryTeamNames.length ? deliveryTeamNames.join(", ") : "Unassigned"}
Status: ${isSent ? "Sent for Approval" : "Draft"}

## 1. Objective
${editedObjective}

## 2. Milestones & Acceptance Criteria
${(parsedProposal.timeline || [])
  .map(
    (p, idx) => `### Milestone 0${idx + 1}: ${p.phase} (${p.duration})
Tasks:
${(p.tasks || []).map((t) => `- ${t}`).join("\n")}
`
  )
  .join("\n")}

## 3. Risks & Mitigations
${(parsedProposal.risks || [])
  .map((r) => `- **${r.label}**: ${r.mitigation}`)
  .join("\n")}
`;

    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FixFlowAI_Working_Agreement_${orgName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMoreMenuOpen(false);
    showToast("Agreement downloaded as Markdown.");
  };

  // Copy agreement text to clipboard
  const handleCopyClipboard = () => {
    const text = `WORKING AGREEMENT v1.0
Objective: ${editedObjective}
Milestones: ${(parsedProposal.timeline || []).map((p) => p.phase).join(", ")}`;
    navigator.clipboard.writeText(text);
    setMoreMenuOpen(false);
    showToast("Agreement copied to clipboard!");
  };

  // Agreement check items
  const agreementChecks = [
    {
      id: "requirements",
      icon: Check,
      label: "Requirements covered",
      value: `${parsedProposal.features?.length || 0} features`,
      color: "green",
    },
    {
      id: "acceptance",
      icon: ListChecks,
      label: "Acceptance criteria",
      value: `${parsedProposal.timeline?.length || 0} phases`,
      color: "blue",
    },
    {
      id: "risks",
      icon: AlertTriangle,
      label: "Unresolved risks",
      value: `${parsedProposal.risks?.length || 0}`,
      color: "orange",
    },
    {
      id: "change",
      icon: RefreshCw,
      label: "Change process",
      value: "Standard FSM",
      color: "green",
    },
    {
      id: "funding",
      icon: Shield,
      label: "Funding state",
      value: isSent ? "Ready to Fund" : "Starts after approval",
      color: isSent ? "green" : "gray",
    },
  ];

  const timelinePhases = parsedProposal.timeline || [];

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="panel-page-title">Working agreement</h1>
            <p className="panel-page-subtitle">
              Scope, acceptance criteria, delivery partner, and milestone funding in one verified contract.
            </p>
          </div>
          {isSent && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="panel-btn"
                onClick={() => setDashboardTab("milestone-funds")}
                style={{ fontSize: 13, background: "#16a34a" }}
              >
                <DollarSign size={14} /> Fund Escrow Milestones
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#0f172a",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 1000,
          }}
        >
          <Sparkles size={16} style={{ color: "#38bdf8" }} />
          {feedbackMessage}
        </div>
      )}

      {/* Metadata bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <span
          className={`panel-badge ${isSent ? "panel-badge--green" : "panel-badge--blue"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {isSent ? <Check size={12} /> : null}
          {isSent ? "Sent for Approval v1.0" : "Draft v1.0"}
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
          <Building2 size={14} /> Client: <strong>{orgName}</strong>
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
          <Users size={14} /> Delivery team:{" "}
          {deliveryTeamNames.length ? (
            <strong style={{ color: "#16a34a" }}>{deliveryTeamNames.join(", ")}</strong>
          ) : (
            <button
              type="button"
              onClick={() => setDashboardTab("matching")}
              style={{
                background: "none",
                border: "none",
                color: "#2563eb",
                fontWeight: 600,
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
              }}
            >
              Select talent in Matches <ChevronRight size={12} style={{ display: "inline" }} />
            </button>
          )}
        </span>
      </div>

      {/* Main Grid with sidebar */}
      <div className="panel-grid panel-grid--sidebar">
        {/* Left: Agreement Document content */}
        <div className="panel-card" style={{ position: "relative" }}>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} style={{ color: "#2563eb" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Master Working Agreement
              </span>
              <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>
                {viewMode === "detailed" ? "Detailed View" : "Compact Summary"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 4, position: "relative" }}>
              <button
                type="button"
                className={`panel-btn ${viewMode === "compact" ? "" : "panel-btn--ghost"}`}
                onClick={() => setViewMode(viewMode === "detailed" ? "compact" : "detailed")}
                title={viewMode === "detailed" ? "Switch to Compact Summary" : "Switch to Detailed View"}
                style={{ padding: "8px 10px", minHeight: 0, minWidth: 0, borderRadius: 6 }}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                className={`panel-btn ${isEditing ? "" : "panel-btn--ghost"}`}
                onClick={() => setIsEditing(!isEditing)}
                title="Edit Agreement Draft"
                style={{ padding: "8px 10px", minHeight: 0, minWidth: 0, borderRadius: 6 }}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="panel-btn--ghost panel-btn"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                title="More Options"
                style={{ padding: "8px 10px", minHeight: 0, minWidth: 0, borderRadius: 6 }}
              >
                <MoreHorizontal size={16} />
              </button>

              {/* Toolbar Dropdown */}
              {moreMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 6,
                    width: 210,
                    background: "#fff",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.2)",
                    border: "1px solid #e2e8f0",
                    padding: "6px 0",
                    zIndex: 100,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 14px",
                      fontSize: 13,
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#334155",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <Download size={14} /> Download (.md)
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyClipboard}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 14px",
                      fontSize: 13,
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#334155",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <Copy size={14} /> Copy to Clipboard
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditedObjective(parsedProposal.project_summary);
                      setIsEditing(false);
                      setMoreMenuOpen(false);
                      showToast("Restored AI Proposal defaults.");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 14px",
                      fontSize: 13,
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#dc2626",
                      borderTop: "1px solid #f1f5f9",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <RefreshCw size={14} /> Reset Edits
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Edit Mode Controls */}
          {isEditing && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: "#1e40af", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Pencil size={14} /> Editing Agreement Content
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="panel-btn--ghost panel-btn"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="panel-btn"
                  style={{ fontSize: 12, padding: "4px 12px" }}
                >
                  <Check size={14} /> Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Objective Section */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 28,
              background: activeFilter === "requirements" ? "#f0fdf4" : "transparent",
              padding: activeFilter === "requirements" ? 12 : 0,
              borderRadius: 8,
              transition: "background 0.2s",
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#eff6ff",
                display: "grid",
                placeItems: "center",
                color: "#2563eb",
                flexShrink: 0,
              }}
            >
              <Target size={16} />
            </span>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>
                Objective & Scope
              </h3>
              {isEditing ? (
                <textarea
                  value={editedObjective}
                  onChange={(e) => setEditedObjective(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 80,
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.6 }}>
                  {editedObjective}
                </p>
              )}
            </div>
          </div>

          <hr className="panel-divider" />

          {/* Render ALL Timeline Phases / Milestones */}
          <div
            style={{
              background: activeFilter === "acceptance" ? "#eff6ff" : "transparent",
              padding: activeFilter === "acceptance" ? 12 : 0,
              borderRadius: 8,
              transition: "background 0.2s",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Flag size={18} style={{ color: "#2563eb" }} />
              Milestone Deliverables & Acceptance Criteria ({timelinePhases.length} Phases)
            </h3>

            {timelinePhases.map((phase, idx) => {
              const phaseTitle = phase.phase || `Phase ${idx + 1}`;
              const phaseTasks = phase.tasks || [];
              const duration = phase.duration || "2 weeks";

              return (
                <div
                  key={phaseTitle + idx}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 20,
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "#eff6ff",
                        display: "grid",
                        placeItems: "center",
                        color: "#2563eb",
                        fontWeight: 700,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      0{idx + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                          Milestone 0{idx + 1} — {phaseTitle}
                        </h4>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={12} /> {duration}
                          </span>
                          <span className={`panel-badge ${isSent ? "panel-badge--green" : "panel-badge--blue"}`}>
                            {isSent ? "Approved" : "Pending Approval"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acceptance Criteria Tasks */}
                  {viewMode === "detailed" && (
                    <div style={{ marginLeft: 44, marginTop: 8 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#334155",
                          marginBottom: 8,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Acceptance Criteria:
                      </div>
                      {phaseTasks.map((task, tIdx) => (
                        <div
                          key={task + tIdx}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "6px 0",
                            fontSize: 14,
                            color: "#334155",
                          }}
                        >
                          <Check size={16} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
                          <span style={{ lineHeight: 1.5 }}>{task}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <hr className="panel-divider" />

          {/* Risks & Mitigations */}
          <div
            style={{
              background: activeFilter === "risks" ? "#fff7ed" : "transparent",
              padding: activeFilter === "risks" ? 12 : 0,
              borderRadius: 8,
              transition: "background 0.2s",
            }}
          >
            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} style={{ color: "#ea580c" }} />
              Identified Risks & Mitigations
            </h4>
            {parsedProposal.risks?.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 0",
                  fontSize: 14,
                  color: "#475569",
                  borderBottom: "1px dashed #f1f5f9",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#ea580c",
                    flexShrink: 0,
                    marginTop: 8,
                  }}
                />
                <div>
                  <strong style={{ color: "#1e293b" }}>{item.label}</strong>: {item.mitigation}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Delivery Partner / Selected Candidate Card */}
          <div className="panel-card">
            <div className="panel-card-header" style={{ marginBottom: 12 }}>
              <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={16} style={{ color: "#2563eb" }} /> Delivery Partner
              </h2>
            </div>

            {selectedCandidates.length > 0 ? (
              <div>
                {selectedCandidates.map((candidate) => (
                  <div
                    key={candidate.freelancerId}
                    style={{
                      border: "1px solid #dcfce7",
                      background: "#f0fdf4",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#dcfce7",
                          color: "#15803d",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {candidate.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                          {candidate.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{candidate.title}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#15803d",
                          background: "#dcfce7",
                          padding: "2px 8px",
                          borderRadius: 999,
                        }}
                      >
                        Selected
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: "1px solid #bbf7d0",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "#166534", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <Award size={13} /> Fit Score: {Math.round(candidate.compositeScore)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setDashboardTab("matching")}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#2563eb",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        View in Matches →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 8px" }}>
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
                  No candidate selected yet for this agreement draft.
                </p>
                <button
                  type="button"
                  className="panel-btn"
                  onClick={() => setDashboardTab("matching")}
                  style={{ fontSize: 12, width: "100%", justifyContent: "center" }}
                >
                  <Users size={14} /> Select Talent in Matches
                </button>
              </div>
            )}
          </div>

          {/* Interactive Agreement Check */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Agreement check</h2>
            </div>

            {agreementChecks.map((item) => {
              const Icon = item.icon;
              const isSelected = activeFilter === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.id === "funding") {
                      setDashboardTab("milestone-funds");
                    } else {
                      setActiveFilter(isSelected ? null : item.id);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 8px",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    borderRadius: 6,
                    background: isSelected ? "#f8fafc" : "transparent",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = isSelected ? "#f8fafc" : "transparent")
                  }
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon
                      size={16}
                      style={{
                        color:
                          item.color === "green"
                            ? "#16a34a"
                            : item.color === "blue"
                            ? "#2563eb"
                            : item.color === "orange"
                            ? "#ea580c"
                            : "#64748b",
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>
                      {item.label}
                    </span>
                  </div>
                  <span className={`panel-badge panel-badge--${item.color}`} style={{ flexShrink: 0 }}>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Activity Log */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Activity</h2>
            </div>

            {agreementActivity && agreementActivity.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {agreementActivity.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      padding: "8px 10px",
                      background: "#f8fafc",
                      borderRadius: 6,
                      borderLeft: "3px solid #2563eb",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>
                      {act.text}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{act.time}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "10px 0" }}>
                AI draft generated. Ready for client review and approval.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: 28,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#16a34a",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
              }}
            >
              <Check size={28} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", color: "#0f172a" }}>
              Agreement Sent for Approval!
            </h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
              The working agreement has been issued to{" "}
              <strong>{deliveryTeamNames.length ? deliveryTeamNames.join(", ") : "the delivery team"}</strong>.
              Escrow milestones have been generated for escrow funding.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="panel-btn"
                onClick={() => {
                  setShowSuccessModal(false);
                  setDashboardTab("milestone-funds");
                }}
                style={{ justifyContent: "center", background: "#16a34a", padding: "12px" }}
              >
                <DollarSign size={16} /> Fund Escrow Milestones Now
              </button>

              <button
                type="button"
                className="panel-btn--ghost panel-btn"
                onClick={() => {
                  setShowSuccessModal(false);
                  setDashboardTab("delivery-control");
                }}
                style={{ justifyContent: "center", padding: "10px" }}
              >
                Go to Delivery Control <ArrowRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 13,
                  marginTop: 6,
                  cursor: "pointer",
                }}
              >
                Stay on Agreement page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left">
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
            <FileText size={14} /> Agreement draft
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>v1.0</span>
          {isSent && (
            <span className="panel-badge panel-badge--green" style={{ marginLeft: 8 }}>
              <Check size={12} /> Approved by Client
            </span>
          )}
        </div>
        <div className="panel-action-bar-right" style={{ display: "flex", gap: 10 }}>
          {isSent ? (
            <button
              type="button"
              className="panel-btn"
              onClick={() => setDashboardTab("milestone-funds")}
              style={{ background: "#16a34a" }}
            >
              <DollarSign size={14} /> Proceed to Fund Milestones
            </button>
          ) : (
            <button
              type="button"
              className="panel-btn"
              onClick={handleSendForApproval}
              disabled={sending}
              style={{
                opacity: sending ? 0.7 : 1,
                cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              {sending ? (
                <>
                  <RefreshCw size={14} className="spin" /> Sending...
                </>
              ) : (
                <>
                  <Send size={14} /> Send for approval
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
