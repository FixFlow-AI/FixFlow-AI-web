import {
  Check,
  Clock,
  AlertTriangle,
  Upload,
  GitPullRequest,
  FileText,
  Users,
  ArrowRight,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";

/* Milestone tasks */
const milestoneTasks = [
  { label: "Idempotent webhook handler", desc: "All tasks complete", status: "Complete", done: true },
  { label: "Reconciliation report", desc: "Under client review", status: "In review", progress: true },
  { label: "Failure replay test", desc: "Evidence in progress", status: "In progress", progress: true },
  { label: "Cutover runbook", desc: "Not started", status: "Not started", pending: true },
];

/* Delivery timeline events */
const timelineEvents = [
  {
    icon: GitPullRequest,
    color: "blue",
    title: "Maya Chen linked pull request #184",
    time: "Today, 10:21 AM",
    badge: "PR #184",
    badgeIcon: "github",
  },
  {
    icon: FileText,
    color: "blue",
    title: "Reconciliation test report attached",
    time: "Today, 10:45 AM",
    badge: "recon-report.pdf",
  },
  {
    icon: Users,
    color: "orange",
    title: "Elena Park requested a variance example",
    time: "Today, 11:07 AM",
    badgeType: "action",
    badge: "Action needed",
  },
  {
    icon: Upload,
    color: "green",
    title: "Failure replay evidence submitted",
    time: "Today, 1:15 PM",
    badge: "replay-evidence.zip",
  },
  {
    icon: AlertTriangle,
    color: "orange",
    title: "Change request CR-03 opened",
    time: "Today, 1:32 PM",
    badgeType: "action",
    badge: "Scope review",
  },
];

export function DeliveryControl() {
  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="panel-page-title">
              Milestone 02 — Webhook and reconciliation implementation
            </h1>
            <p className="panel-page-subtitle">
              <span className="panel-badge panel-badge--blue" style={{ marginRight: 8 }}>In progress</span>
              Northstar Billing Migration
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="panel-btn--ghost panel-btn">
              Milestone actions <ChevronDown size={14} />
            </button>
            <button type="button" className="panel-btn--ghost panel-btn" style={{ padding: "10px" }}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Milestone definition */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Milestone definition</h2>
          </div>

          {milestoneTasks.map((task) => (
            <div className="panel-checklist-item" key={task.label}>
              <span
                className={`panel-check ${
                  task.done
                    ? "panel-check--done"
                    : task.progress
                    ? "panel-check--progress"
                    : "panel-check--pending"
                }`}
              >
                {task.done && <Check size={11} strokeWidth={3} />}
                {task.progress && <Clock size={11} />}
              </span>
              <div className="panel-checklist-content">
                <div className="panel-checklist-label">{task.label}</div>
                <div className="panel-checklist-desc">{task.desc}</div>
              </div>
              <span
                className={`panel-badge ${
                  task.done
                    ? "panel-badge--green"
                    : task.progress
                    ? "panel-badge--blue"
                    : "panel-badge--gray"
                }`}
                style={{ alignSelf: "center", flexShrink: 0 }}
              >
                {task.status}
              </span>
            </div>
          ))}

          <hr className="panel-divider" />

          {/* Acceptance summary */}
          <div style={{ padding: "8px 0" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Acceptance summary</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  2 / 4
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  criteria currently evidenced
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                  2 criteria met
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", display: "inline-block" }} />
                  0 in review
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid #bcc7d5", display: "inline-block" }} />
                  2 not started
                </div>
              </div>
            </div>
          </div>

          <hr className="panel-divider" />
          <button type="button" className="panel-link">
            View acceptance criteria <ArrowRight size={14} />
          </button>
        </div>

        {/* Center: Delivery timeline */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Delivery timeline</h2>
          </div>

          {timelineEvents.map((evt) => {
            const Icon = evt.icon;
            return (
              <div className="panel-timeline-item" key={evt.title}>
                <span className={`panel-timeline-icon panel-timeline-icon--${evt.color}`}>
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <div className="panel-timeline-body">
                  <div className="panel-timeline-title">{evt.title}</div>
                  <div className="panel-timeline-meta">{evt.time}</div>
                </div>
                {evt.badge && (
                  <span
                    className={`panel-badge ${
                      evt.badgeType === "action"
                        ? "panel-badge--orange"
                        : "panel-badge--outline"
                    }`}
                    style={{ alignSelf: "center", flexShrink: 0 }}
                  >
                    {evt.badge}
                  </span>
                )}
              </div>
            );
          })}

          <hr className="panel-divider" />
          <button type="button" className="panel-btn--ghost panel-btn" style={{ width: "100%" }}>
            View full timeline
          </button>
        </div>

        {/* Right: Change control */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Change control</h2>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="panel-badge panel-badge--red">CR-03</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Add regional tax reconciliation
              </span>
            </div>

            <div className="panel-info-row">
              <span className="panel-info-label">State</span>
              <span className="panel-badge panel-badge--orange">Scope review</span>
            </div>
          </div>

          <hr className="panel-divider" />

          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Details</h3>

          <div className="panel-info-row">
            <span className="panel-info-label">Original</span>
            <span className="panel-info-value">Reconcile billing records</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Requested</span>
            <span className="panel-info-value">Reconcile billing records by tax region</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Timeline impact</span>
            <span className="panel-info-value" style={{ color: "#ea580c" }}>+3 working days</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Acceptance criteria</span>
            <span className="panel-info-value">2 added</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Current milestone</span>
            <span className="panel-info-value" style={{ color: "#ea580c" }}>Requires approval</span>
          </div>

          <hr className="panel-divider" />

          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Description</h3>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px" }}>
            Extend reconciliation to include tax region aggregation and variance reporting.
          </p>

          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" className="panel-btn" style={{ width: "100%" }}>
              Approve change
            </button>
            <button type="button" className="panel-btn--ghost panel-btn" style={{ width: "100%" }}>
              Keep original scope
            </button>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left">
          <span className="panel-badge panel-badge--outline">
            <FileText size={12} /> Agreement v2.0
          </span>
          <span className="panel-step-arrow">→</span>
          <span className="panel-badge panel-badge--orange">
            <AlertTriangle size={12} /> Change CR-03
          </span>
          <span className="panel-step-arrow">→</span>
          <span className="panel-badge panel-badge--outline">
            <Users size={12} /> Client decision
          </span>
          <span style={{ fontSize: 12, color: "#ea580c", fontWeight: 600 }}>Required</span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-btn--ghost panel-btn">
            Open change log
          </button>
        </div>
      </div>
    </div>
  );
}
