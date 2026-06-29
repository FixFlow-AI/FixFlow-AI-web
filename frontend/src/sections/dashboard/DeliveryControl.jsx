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

export function DeliveryControl() {
  const {
    user,
    parsedProposal,
    contractExtensions,
    extensionsSource,
    setContractExtensions,
    setExtensionsSource,
  } = useLandingStore();
  const [suggesting, setSuggesting] = useState(false);
  const [extNotice, setExtNotice] = useState("");

  if (!parsedProposal) {
    return (
      <div>
        <div className="panel-page-header">
          <h1 className="panel-page-title">Delivery control</h1>
          <p className="panel-page-subtitle">
            Track execution evidence, automated tests, and scope changes.
          </p>
        </div>
        <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
          <FileText size={32} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 4px" }}>
            No active project delivery
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
            Please parse a project brief first to begin tracking delivery.
          </p>
        </div>
      </div>
    );
  }

  const projectTitle = parsedProposal.project_summary
    ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
    : "Active Project";

  const displayTasks = parsedProposal.features?.map((f, idx) => ({
    label: f.title,
    desc: f.description,
    status: idx === 0 ? "In progress" : "Not started",
    progress: idx === 0,
    pending: idx > 0,
    done: false,
  })) || [];

  const suggestNextPhase = async () => {
    setExtNotice("");
    setSuggesting(true);
    try {
      const completedDeliverables = ["Webhook migration"];
      const chatSummary =
        "Client mentioned wanting tax-region reconciliation and analytics next. Migration delivered on time with strong reliability.";
      const output = await api.contractExtensions(
        completedDeliverables,
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
          "Hi — now that the billing migration is live and stable, I'd suggest a short support window plus the tax-region analytics dashboard we discussed. Happy to add these as new milestones to the existing agreement. Want me to draft them?",
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
              Delivery control
            </h1>
            <p className="panel-page-subtitle">
              <span className="panel-badge panel-badge--blue" style={{ marginRight: 8 }}>In execution</span>
              {projectTitle}
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

          {displayTasks.map((task) => (
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
                  0 / {displayTasks.length}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  criteria currently evidenced
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Delivery timeline */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Delivery timeline</h2>
          </div>

          <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "40px 0" }}>
            Timeline will populate dynamically with commits, pull requests, and status changes once execution begins.
          </p>
        </div>

        {/* Right: Change control */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Change control</h2>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "40px 0" }}>
            No active change requests. Submit new requests through the working agreement tab.
          </p>
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
              {contractExtensions.suggestedMilestones?.map((m, i) => (
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
            <FileText size={12} /> Active Agreement
          </span>
          <span className="panel-step-arrow">→</span>
          <span className="panel-badge panel-badge--outline">
            <Clock size={12} /> Execution Phase
          </span>
        </div>
      </div>
    </div>
  );
}

