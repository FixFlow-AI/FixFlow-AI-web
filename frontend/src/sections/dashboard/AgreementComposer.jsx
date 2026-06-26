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

const agreementChecks = [
  { icon: Check, label: "Requirements covered", value: "5 of 5", color: "green" },
  { icon: ListChecks, label: "Acceptance criteria", value: "3 defined", color: "blue" },
  { icon: AlertTriangle, label: "Unresolved assumptions", value: "1", color: "red" },
  { icon: RefreshCw, label: "Change process", value: "Included", color: "green" },
  { icon: Shield, label: "Funding state", value: "Starts after approval", color: "gray" },
];

const activityItems = [
  {
    avatar: "MC",
    name: "Maya Chen",
    action: "Draft v2.0 created",
    time: "May 8, 11:32 AM",
    color: "#16a34a",
  },
  {
    avatar: "MC",
    name: "Maya Chen",
    action: "Changes from v1.4 reviewed",
    time: "May 8, 11:35 AM",
    color: "#2563eb",
  },
];

export function AgreementComposer() {
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
        <span className="panel-badge panel-badge--blue">Draft v2.0</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
          <Building2 size={14} /> Client: Atlas Commerce
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
          <Users size={14} /> Delivery team: Northline Studio
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
                Move the billing service without interrupting active subscriptions.
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
                  Milestone 01 — Migration plan and rollback design
                </h3>
                <span className="panel-badge panel-badge--green">
                  <Check size={11} /> Ready for approval
                </span>
              </div>
            </div>
          </div>

          {/* Acceptance criteria */}
          <div style={{ marginLeft: 48 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Acceptance criteria
            </h4>
            {["Dependency map is complete", "Rollback owner is named", "Reconciliation test cases are approved"].map(
              (item) => (
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
              )
            )}

            <hr className="panel-divider" />

            {/* Assumptions */}
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Assumptions
            </h4>
            {["Client provides current billing event samples", "Target runtime is confirmed before implementation"].map(
              (item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    fontSize: 14,
                    color: "#475569",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
                  {item}
                </div>
              )
            )}

            <hr className="panel-divider" />

            {/* Out of scope */}
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Out of scope
            </h4>
            {["Pricing model redesign", "Historical invoice correction"].map(
              (item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    fontSize: 14,
                    color: "#94a3b8",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#cbd5e1", flexShrink: 0 }} />
                  {item}
                </div>
              )
            )}
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
                            : item.color === "red"
                            ? "#dc2626"
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

          {/* Revision note */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Revision note</h2>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#2563eb",
                  flexShrink: 0,
                }}
              >
                EP
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                  Client requested explicit rollback ownership
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  Elena Park · May 8, 10:07 AM
                </div>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Activity</h2>
              <button type="button" className="panel-link" style={{ fontSize: 12 }}>
                View full activity
              </button>
            </div>

            {activityItems.map((item) => (
              <div className="panel-timeline-item" key={item.action}>
                <span
                  className={`panel-timeline-icon panel-timeline-icon--${item.color === "#16a34a" ? "green" : "blue"}`}
                >
                  {item.color === "#16a34a" ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : (
                    <FileText size={14} />
                  )}
                </span>
                <div className="panel-timeline-body">
                  <div className="panel-timeline-title">{item.action}</div>
                  <div className="panel-timeline-meta">
                    {item.name} · {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left">
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
            <FileText size={14} /> Agreement history
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>v1.4 · Apr 30, 2:15 PM</span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-btn--ghost panel-btn">
            <GitCompare size={14} /> Compare with v1.4
          </button>
          <button type="button" className="panel-btn">
            <Send size={14} /> Send for approval
          </button>
        </div>
      </div>
    </div>
  );
}
