import { useState } from "react";
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
  Sparkles,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";

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
  const {
    contractExtensions,
    extensionsSource,
    setContractExtensions,
    setExtensionsSource,
  } = useLandingStore();
  const [suggesting, setSuggesting] = useState(false);
  const [extNotice, setExtNotice] = useState("");

  const suggestNextPhase = async () => {
    setExtNotice("");
    setSuggesting(true);
    try {
      const completedDeliverables = milestoneTasks
        .filter((t) => t.done)
        .map((t) => t.label);
      const chatSummary =
        "Client mentioned wanting tax-region reconciliation and analytics next. Migration delivered on time with strong reliability.";
      const output = await api.contractExtensions(
        completedDeliverables.length ? completedDeliverables : ["Webhook migration"],
        chatSummary,
      );
      setContractExtensions(output);
      setExtensionsSource("api");
    } catch (err) {
      const reason =
        err instanceof ApiError && err.status === 503
          ? "AI not configured (missing GEMINI_API_KEY). Showing sample suggestions."
          : "Couldn't reach the extensions service. Showing sample suggestions.";
      setExtNotice(reason);
      // The backend skill self-heals, so this is the local offline fallback.
      setContractExtensions({
        extensionReasoning:
          "The migration is delivered and stable. A support window plus the discussed analytics phase are the natural next steps.",
        suggestedMilestones: [
          {
            title: "Post-delivery support & monitoring",
            description: "2-week support window to monitor the cutover and resolve production issues.",
            estimatedDuration: "14 days",
            complexity: "Low",
            estimatedBudgetPct: 15,
          },
          {
            title: "Tax-region reconciliation analytics",
            description: "Dashboard for reconciliation variance by tax region, as discussed.",
            estimatedDuration: "10 days",
            complexity: "Medium",
            estimatedBudgetPct: 25,
          },
        ],
        extensionOfferDraft:
          "Hi Elena — now that the billing migration is live and stable, I'd suggest a short support window plus the tax-region analytics dashboard we discussed. Happy to add these as new milestones to the existing agreement. Want me to draft them?",
      });
      setExtensionsSource("mock");
    } finally {
      setSuggesting(false);
    }
  };

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

      {/* AI-004: Contextual Contract Extensions (retention) */}
      <div className="panel-card" style={{ marginTop: 20 }}>
        <div className="panel-card-header">
          <h2 className="panel-card-title">
            <TrendingUp size={16} style={{ verticalAlign: "-2px", marginRight: 6, color: "#6d4aff" }} />
            Retention — suggest the next phase
          </h2>
          <button
            type="button"
            className="panel-btn"
            onClick={suggestNextPhase}
            disabled={suggesting}
          >
            {suggesting ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Suggest next phase
              </>
            )}
          </button>
        </div>

        {!contractExtensions ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0" }}>
            When milestones wrap up, generate AI-suggested follow-up phases and a ready-to-send
            offer to turn this project into a recurring engagement.
          </p>
        ) : (
          <div>
            {extensionsSource && (
              <span
                className={`panel-badge panel-badge--${extensionsSource === "api" ? "blue" : "outline"}`}
                style={{ marginBottom: 12, display: "inline-flex" }}
              >
                {extensionsSource === "api" ? "AI-generated" : "Sample"}
              </span>
            )}
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 16px" }}>
              {contractExtensions.extensionReasoning}
            </p>

            <div className="panel-grid panel-grid--2" style={{ gap: 12, marginBottom: 16 }}>
              {contractExtensions.suggestedMilestones.map((m, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 14,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{m.title}</span>
                    <span
                      className={`panel-badge panel-badge--${
                        m.complexity === "High" ? "orange" : m.complexity === "Medium" ? "blue" : "green"
                      }`}
                    >
                      {m.complexity}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, margin: "0 0 10px" }}>
                    {m.description}
                  </p>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#475569" }}>
                    <span><Clock size={12} style={{ verticalAlign: "-2px" }} /> {m.estimatedDuration}</span>
                    <span>~{m.estimatedBudgetPct}% of budget</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ready-to-send offer</h3>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 14,
                background: "#f7f8fa",
                fontSize: 13,
                color: "#334155",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {contractExtensions.extensionOfferDraft}
            </div>
          </div>
        )}

        {extNotice && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 8,
              fontSize: 12,
              color: "#c2410c",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={14} /> {extNotice}
          </div>
        )}
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
