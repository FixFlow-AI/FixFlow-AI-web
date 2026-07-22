import {
  Check,
  Target,
  Flag,
  ListChecks,
  AlertTriangle,
  RefreshCw,
  Shield,
  Send,
  GitCompare,
  FileText,
  List,
  Pencil,
  MoreHorizontal,
  ArrowRight,
  Users,
  Building2,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";

export function AgreementComposer() {
  const { user, parsedProposal, matchResults } = useLandingStore();

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

  const agreementChecks = [
    { icon: Check, label: "Requirements covered", value: `${parsedProposal.features?.length || 0} features`, color: "green" },
    { icon: ListChecks, label: "Acceptance criteria", value: `${parsedProposal.timeline?.length || 0} phases`, color: "blue" },
    { icon: AlertTriangle, label: "Unresolved risks", value: `${parsedProposal.risks?.length || 0}`, color: "orange" },
    { icon: RefreshCw, label: "Change process", value: "Standard", color: "green" },
    { icon: Shield, label: "Funding state", value: "Starts after approval", color: "gray" },
  ];

  const firstPhase = parsedProposal.timeline?.[0];
  const firstPhaseTitle = firstPhase ? firstPhase.phase : "Migration Phase";
  const firstPhaseTasks = firstPhase ? firstPhase.tasks : [];
  const selectedTalent = (matchResults?.candidates || [])
    .filter((candidate) => candidate.status === "selected")
    .map((candidate) => candidate.name);

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <h1 className="panel-page-title">Working agreement</h1>
        <p className="panel-page-subtitle">
          Scope, acceptance, ownership, and protected funds in one review.
        </p>
      </div>

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
        <span className="panel-badge panel-badge--blue">Draft v1.0</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
          <Building2 size={14} /> Client: {orgName}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
          <Users size={14} /> Delivery team: {selectedTalent.length ? selectedTalent.join(", ") : "Select talent in Matches"}
        </span>
      </div>

      {/* Grid with sidebar */}
      <div className="panel-grid panel-grid--sidebar">
        {/* Left: Agreement content */}
        <div className="panel-card">
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 4,
              marginBottom: 20,
            }}
          >
            <button type="button" className="panel-btn--ghost panel-btn" style={{ padding: "8px 10px", minHeight: 0, minWidth: 0, borderRadius: 6 }}>
              <List size={16} />
            </button>
            <button type="button" className="panel-btn--ghost panel-btn" style={{ padding: "8px 10px", minHeight: 0, minWidth: 0, borderRadius: 6 }}>
              <Pencil size={16} />
            </button>
            <button type="button" className="panel-btn--ghost panel-btn" style={{ padding: "8px 10px", minHeight: 0, minWidth: 0, borderRadius: 6 }}>
              <MoreHorizontal size={16} />
            </button>
          </div>

          {/* Objective */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
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
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Objective</h3>
              <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.6 }}>
                {parsedProposal.project_summary}
              </p>
            </div>
          </div>

          <hr className="panel-divider" />

          {/* Milestone 01 */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
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
              <Flag size={16} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  Milestone 01 — {firstPhaseTitle} ({firstPhase?.duration || "2 weeks"})
                </h3>
                <span className="panel-badge panel-badge--blue">
                  Pending Approval
                </span>
              </div>
            </div>
          </div>

          {/* Acceptance criteria */}
          <div style={{ marginLeft: 48 }}>
            {firstPhaseTasks.length > 0 && (
              <>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                  Acceptance criteria
                </h4>
                {firstPhaseTasks.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 0",
                      fontSize: 14,
                      color: "#334155",
                    }}
                  >
                    <Check size={16} style={{ color: "#16a34a" }} />
                    {item}
                  </div>
                ))}
                <hr className="panel-divider" />
              </>
            )}

            {/* Risks / Assumptions */}
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Risks & Mitigations
            </h4>
            {parsedProposal.risks?.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "6px 0",
                  fontSize: 14,
                  color: "#475569",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", flexShrink: 0, marginTop: 8 }} />
                <div>
                  <strong>{item.label}</strong>: {item.mitigation}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Agreement check sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Agreement check */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Agreement check</h2>
            </div>

            {agreementChecks.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
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
                  <span
                    className={`panel-badge panel-badge--${item.color}`}
                    style={{ flexShrink: 0 }}
                  >
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Activity */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Activity</h2>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "10px 0" }}>
              No revisions or activity recorded yet.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left">
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
            <FileText size={14} /> Agreement draft
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>v1.0</span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-btn">
            <Send size={14} /> Send for approval
          </button>
        </div>
      </div>
    </div>
  );
}

