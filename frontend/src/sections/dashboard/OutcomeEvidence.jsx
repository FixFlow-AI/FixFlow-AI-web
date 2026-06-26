import {
  Check,
  AlertTriangle,
  Link2,
  FileText,
  Handshake,
  Award,
  Clock,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Shield,
  Sparkles,
  ToggleLeft,
} from "lucide-react";

const acceptedCriteria = [
  "Dependency map is complete",
  "Rollback owner is named",
  "Reconciliation tests are approved",
];

const timelineEvents = [
  { icon: FileText, color: "blue", title: "Requirement captured", time: "May 1, 9:12 AM" },
  { icon: AlertTriangle, color: "orange", title: "Risk acknowledged", time: "May 1, 10:05 AM" },
  { icon: Link2, color: "blue", title: "Proof connected", time: "May 2, 11:18 AM" },
  { icon: Handshake, color: "green", title: "Agreement approved", time: "May 3, 1:40 PM" },
  { icon: Shield, color: "green", title: "Milestone funded", time: "May 4, 9:00 AM" },
  { icon: ArrowUpRight, color: "blue", title: "Delivery submitted", time: "May 8, 11:15 AM" },
  { icon: Check, color: "green", title: "Outcome accepted", time: "May 8, 2:15 PM", highlight: true },
  { icon: Sparkles, color: "blue", title: "Reputation updated", time: "May 8, 2:18 PM" },
];

const sourceConnections = [
  { icon: FileText, label: "Source brief v1.2" },
  { icon: Handshake, label: "Agreement v2.0" },
  { icon: FileText, label: "Rollback design.pdf" },
  { icon: Check, label: "Client acceptance event" },
];

export function OutcomeEvidence() {
  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <h1 className="panel-page-title">Verified outcome record</h1>
        <p className="panel-page-subtitle">
          Northstar Billing Migration · <span style={{ color: "#16a34a", fontWeight: 600 }}>Milestone 01 accepted</span>
        </p>
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Accepted outcome */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Accepted outcome</h2>
          </div>

          {/* Highlighted item */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="panel-check panel-check--done">
                <Check size={11} strokeWidth={3} />
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  Migration plan and rollback design
                </div>
                <div style={{ fontSize: 12, color: "#16a34a" }}>
                  Accepted against 3 criteria
                </div>
              </div>
            </div>
          </div>

          {acceptedCriteria.map((item) => (
            <div className="panel-checklist-item" key={item}>
              <span className="panel-check panel-check--done">
                <Check size={11} strokeWidth={3} />
              </span>
              <div className="panel-checklist-content">
                <div className="panel-checklist-label">{item}</div>
              </div>
            </div>
          ))}

          <hr className="panel-divider" />

          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Outcome</h3>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px" }}>
            The approved migration plan is ready for implementation.
          </p>

          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Accepted by</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#e2e8f0",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#475569",
              }}
            >
              EP
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Elena Park</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>May 8, 2:15 PM</div>
            </div>
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Accepted version</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
            <FileText size={14} /> Agreement v2.0
          </div>
        </div>

        {/* Center: Evidence timeline */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Evidence timeline</h2>
          </div>

          {timelineEvents.map((evt) => {
            const Icon = evt.icon;
            return (
              <div
                className="panel-timeline-item"
                key={evt.title}
                style={
                  evt.highlight
                    ? {
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 8,
                        padding: "10px 12px",
                        margin: "4px -12px",
                      }
                    : undefined
                }
              >
                <span className={`panel-timeline-icon panel-timeline-icon--${evt.color}`}>
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <div className="panel-timeline-body">
                  <div className="panel-timeline-title">{evt.title}</div>
                  <div className="panel-timeline-meta">{evt.time}</div>
                </div>
              </div>
            );
          })}

          <hr className="panel-divider" />

          {/* Source connections */}
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Source connections</h3>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 12,
            }}
          >
            {sourceConnections.map((src) => {
              const SrcIcon = src.icon;
              return (
                <div
                  key={src.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    fontSize: 13,
                    color: "#475569",
                  }}
                >
                  <SrcIcon size={14} strokeWidth={1.8} />
                  {src.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Reputation and reuse */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Reputation and reuse</h2>
          </div>

          {/* Reuse CTA */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Award size={18} strokeWidth={1.8} style={{ color: "#16a34a" }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Reuse this proof</span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
              This accepted outcome can support future recommendations.
            </p>
          </div>

          <div className="panel-info-row">
            <span className="panel-info-label">Requirement relevance</span>
            <span className="panel-info-value">Billing migration</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Evidence type</span>
            <span className="panel-info-value">Accepted outcome</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Visibility</span>
            <span className="panel-info-value">Private to network</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Available for matching</span>
            <span className="panel-info-value" style={{ color: "#16a34a" }}>Yes</span>
          </div>

          <hr className="panel-divider" />

          {/* Toggle controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Use for future recommendations</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                Allow FixFlowAI to surface this proof in relevant opportunities.
              </div>
            </div>
            <button type="button" className="panel-toggle is-on" aria-label="Toggle recommendations" />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Show project name publicly</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                Hide project name when shared in external recommendations.
              </div>
            </div>
            <button type="button" className="panel-toggle" aria-label="Toggle public name" />
          </div>

          <hr className="panel-divider" />

          <button type="button" className="panel-btn--ghost panel-btn" style={{ width: "100%" }}>
            Preview proof record <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#2563eb" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Trust is a trail of sources, decisions, delivery evidence, and accepted outcomes.
          </span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-link">
            View full outcome history <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
