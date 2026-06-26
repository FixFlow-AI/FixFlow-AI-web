import {
  ArrowRight,
  Check,
  FileText,
  GitBranch,
  Handshake,
  Hammer,
  ClipboardCheck,
  Award,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Users,
  Target,
} from "lucide-react";

const steps = [
  { label: "Brief", done: true },
  { label: "Evidence", done: true },
  { label: "Agreement", active: true },
  { label: "Build", done: false },
  { label: "Approval", done: false },
  { label: "Outcome", done: false },
];

const recentEvents = [
  {
    icon: GitBranch,
    color: "blue",
    title: "Evidence linked to 4 requirements",
    time: "Today, 2:15 PM",
  },
  {
    icon: AlertTriangle,
    color: "orange",
    title: "Risk flagged: rollback ownership unresolved",
    time: "Today, 11:30 AM",
  },
  {
    icon: FileText,
    color: "green",
    title: "Brief v1.2 parsed — 6 requirements extracted",
    time: "Yesterday, 4:45 PM",
  },
  {
    icon: Users,
    color: "blue",
    title: "Maya Chen added to project workspace",
    time: "Yesterday, 10:00 AM",
  },
];

export function Overview() {
  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <h1 className="panel-page-title">Northstar Billing Migration</h1>
        <p className="panel-page-subtitle">
          Atlas Commerce · Real-time billing migration with zero downtime
        </p>
      </div>

      {/* Horizontal stepper */}
      <div className="panel-stepper">
        {steps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
            <div
              className={`panel-step${step.done ? " panel-step--done" : ""}${step.active ? " panel-step--active" : ""}`}
            >
              <span className="panel-step-num">
                {step.done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight size={14} className="panel-step-arrow" />
            )}
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="panel-grid panel-grid--sidebar">
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Project truth */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Project truth</h2>
              <span className="panel-badge panel-badge--blue">In progress</span>
            </div>

            <div className="panel-info-row">
              <span className="panel-info-label">Objective</span>
              <span className="panel-info-value">
                Migrate billing without interrupting active subscriptions
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Current decision</span>
              <span className="panel-info-value" style={{ color: "#ea580c" }}>
                Rollback ownership needs agreement
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Relevant proof</span>
              <span className="panel-info-value">
                4 evidence sources linked
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Next milestone</span>
              <span className="panel-info-value">
                Migration plan + rollback design
              </span>
            </div>
          </div>

          {/* Recent events */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Recent events</h2>
              <button type="button" className="panel-link">
                View all <ArrowRight size={14} />
              </button>
            </div>

            {recentEvents.map((evt) => {
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Agreement state */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Agreement state</h2>
            </div>

            <div className="panel-info-row">
              <span className="panel-info-label">Scope</span>
              <span className="panel-info-value">
                <span className="panel-badge panel-badge--green">Defined</span>
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Acceptance criteria</span>
              <span className="panel-info-value">5 criteria set</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Protected funds</span>
              <span className="panel-info-value">$32,000 in escrow</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-label">Open risks</span>
              <span className="panel-info-value" style={{ color: "#ea580c" }}>
                2 unresolved
              </span>
            </div>

            <hr className="panel-divider" />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="panel-badge panel-badge--outline">
                <ShieldCheck size={12} /> Escrow active
              </span>
              <span className="panel-badge panel-badge--outline">
                <Clock size={12} /> 10–12 weeks
              </span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Summary</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="panel-stat">
                <div className="panel-stat-value">6</div>
                <div className="panel-stat-label">Requirements</div>
              </div>
              <div className="panel-stat">
                <div className="panel-stat-value">4</div>
                <div className="panel-stat-label">Evidence links</div>
              </div>
              <div className="panel-stat">
                <div className="panel-stat-value">3</div>
                <div className="panel-stat-label">Milestones</div>
              </div>
              <div className="panel-stat">
                <div className="panel-stat-value" style={{ color: "#16a34a" }}>88%</div>
                <div className="panel-stat-label">Confidence</div>
              </div>
            </div>
          </div>

          {/* Next steps */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Next steps</h2>
            </div>
            <div className="panel-checklist-item">
              <span className="panel-check panel-check--progress">
                <Target size={11} />
              </span>
              <div className="panel-checklist-content">
                <div className="panel-checklist-label">Resolve rollback ownership</div>
                <div className="panel-checklist-desc">Risk needs client decision</div>
              </div>
            </div>
            <div className="panel-checklist-item">
              <span className="panel-check panel-check--pending" />
              <div className="panel-checklist-content">
                <div className="panel-checklist-label">Finalize agreement v2.0</div>
                <div className="panel-checklist-desc">Pending risk resolution</div>
              </div>
            </div>
            <div className="panel-checklist-item">
              <span className="panel-check panel-check--pending" />
              <div className="panel-checklist-content">
                <div className="panel-checklist-label">Fund Milestone 01</div>
                <div className="panel-checklist-desc">After agreement approval</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left">
          <span className="panel-badge panel-badge--outline">
            <Handshake size={12} /> Agreement v1.2
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Last updated 2 hours ago
          </span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-btn--ghost panel-btn">
            View agreement
          </button>
          <button type="button" className="panel-btn">
            Continue to agreement <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
