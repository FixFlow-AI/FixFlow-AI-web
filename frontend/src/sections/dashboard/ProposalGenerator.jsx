import { useState } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import {
  Sparkles,
  RefreshCw,
  Check,
  FileSignature,
  ArrowRight,
  Bookmark,
  AlertTriangle,
  Target,
  Clock,
  DollarSign,
  Zap,
  BadgeCheck,
  Users,
  Code2,
  Shield,
  TrendingUp,
  Plus,
  Paperclip,
  MoreHorizontal,
  FileText,
} from "lucide-react";

/* Stepper for proposal stages */
const proposalSteps = [
  { num: 1, label: "Describe idea", active: true },
  { num: 2, label: "Structured scope" },
  { num: 3, label: "Intelligence analysis" },
  { num: 4, label: "Timeline & roles" },
  { num: 5, label: "Review & finalize" },
];

const summaryItems = [
  { icon: Target, label: "Project type", value: "Platform development" },
  { icon: BadgeCheck, label: "Primary goal", value: "Real-time billing migration with zero downtime" },
  { icon: Clock, label: "Estimated duration", value: "10 – 12 weeks" },
  { icon: DollarSign, label: "Estimated budget", value: "$32,000 – $48,000" },
  { icon: Zap, label: "Complexity", value: "High", badgeColor: "orange" },
  { icon: BadgeCheck, label: "Confidence", value: "High", badgeColor: "green" },
];

const intelligenceItems = [
  { icon: AlertTriangle, label: "Risk level", value: "3 high, 4 medium, 2 low risks detected", badge: "High", color: "#ef4444" },
  { icon: Users, label: "Competitor pressure", value: "5 active competitors in this space", badge: "Medium", color: "#f59e0b" },
  { icon: TrendingUp, label: "Differentiation potential", value: "Strong opportunity for reliability and migration automation", badge: "High", color: "#16a34a" },
  { icon: Code2, label: "Technical complexity", value: "Multiple integrations and data consistency required", badge: "High", color: "#ef4444" },
];

const scopeItems = [
  { icon: Target, title: "Build migration service", desc: "Create service to move customers, subscriptions, and billing data.", badge: "Core" },
  { icon: Zap, title: "Webhook engine", desc: "Process events from payment gateways and internal systems.", badge: "Core" },
  { icon: Shield, title: "Reconciliation service", desc: "Ensure financial records match across legacy and new systems.", badge: "Core" },
  { icon: RefreshCw, title: "Rollback and recovery", desc: "Enable safe rollback with data reversion and audit trail.", badge: "Important", badgeColor: "orange" },
  { icon: Code2, title: "Admin dashboard", desc: "Provide visibility, controls, and operational monitoring.", badge: "Important", badgeColor: "orange" },
];

const nextSteps = [
  { num: 1, title: "Review the structured scope", desc: "AI has generated the initial plan." },
  { num: 2, title: "Check intelligence insights", desc: "Review risks, competitors, and opportunities." },
  { num: 3, title: "Refine timeline and roles", desc: "Adjust milestones and team requirements." },
  { num: 4, title: "Match with verified talent", desc: "Invite the best proof-backed freelancers." },
];

export function ProposalGenerator() {
  const {
    rawBriefText,
    isProposalGenerated,
    generatedProposal,
    setGeneratedProposal,
    setProposalGenerated,
    setDashboardTab,
    parsedProposal,
  } = useLandingStore();

  const [generating, setGenerating] = useState(false);
  const [ideaText, setIdeaText] = useState(rawBriefText || "");
  const [activeTab, setActiveTab] = useState("scope");

  const buildSections = () => {
    if (parsedProposal) {
      const featureLines = parsedProposal.features
        .map((f) => `- **${f.title}** (${f.area}, ${f.complexity} complexity): ${f.description}`)
        .join("\n");
      const milestoneLines = parsedProposal.timeline
        .map((phase, idx) => `- **Phase ${idx + 1}: ${phase.phase}** (${phase.duration}) — ${phase.tasks.join(", ")}`)
        .join("\n");
      const riskLines = parsedProposal.risks
        .map((r) => `- **${r.label}** (severity ${r.severity}): ${r.mitigation}`)
        .join("\n");
      return [
        "# PROJECT PROPOSAL\n\n",
        `## 1. Project Summary\n${parsedProposal.project_summary}\n\n`,
        `## 2. Scope & Features\n${featureLines}\n\n`,
        `## 3. Timeline & Milestones\n${milestoneLines}\n\n`,
        `## 4. Risks & Mitigations\n${riskLines}`,
      ];
    }
    return [
      "# PROJECT PROPOSAL: Northstar Billing Migration\n\n",
      "## 1. Project Summary\nSecure payment workflow to replace legacy Stripe pipeline with Razorpay, backed by Web3 escrow using USDC on Polygon.\n\n",
      "## 2. Technical Architecture\n- **Backend**: Express + Redis deduplication webhooks.\n- **Web3**: Polygon ERC-20 Escrow contract.\n- **Database**: PostgreSQL via Prisma.\n\n",
      "## 3. Milestones & Escrow\n- **M1 ($12,000)**: Migration plan and validation.\n- **M2 ($18,000)**: Webhook and reconciliation.\n- **M3 ($15,000)**: Production cutover.\n\n",
      "## 4. Assumptions\n- Excludes legacy performance tuning.\n- Client provides sandbox credentials.",
    ];
  };

  const handleGenerate = () => {
    setGenerating(true);
    const sections = buildSections();
    let idx = 0;
    let text = "";
    const interval = setInterval(() => {
      if (idx < sections.length) {
        text += sections[idx];
        idx++;
      } else {
        clearInterval(interval);
        setGenerating(false);
        setGeneratedProposal(text);
        setProposalGenerated(true);
      }
    }, 450);
  };

  const tabs = [
    { id: "scope", label: "Scope outline" },
    { id: "risks", label: "Risk analysis" },
    { id: "competitors", label: "Competitor landscape" },
    { id: "architecture", label: "Technical architecture" },
    { id: "milestones", label: "Milestones" },
    { id: "roles", label: "Required roles" },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 className="panel-page-title">AI Project Proposal Generator</h1>
            <p className="panel-page-subtitle">
              Describe your idea and our AI will generate a complete, evidence-ready project proposal.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="panel-btn--ghost panel-btn">
              <FileText size={14} /> Load saved draft
            </button>
            <button type="button" className="panel-btn--ghost panel-btn" style={{ padding: "10px" }}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal stepper */}
      <div className="panel-stepper">
        {proposalSteps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
            <div className={`panel-step${step.active ? " panel-step--active" : ""}`}>
              <span className="panel-step-num">
                {step.active ? step.num : step.num}
              </span>
              {step.label}
            </div>
            {i < proposalSteps.length - 1 && (
              <ArrowRight size={14} className="panel-step-arrow" />
            )}
          </div>
        ))}
      </div>

      {/* Main three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Describe idea */}
        <div className="panel-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            1. Describe your project idea
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
            Tell us what you want to build and why.
          </p>

          <textarea
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            rows={6}
            placeholder="We want to build a real-time billing migration platform..."
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#0f172a",
              resize: "vertical",
              fontFamily: "inherit",
              marginBottom: 12,
            }}
          />

          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
            Attach reference <span style={{ color: "#cbd5e1" }}>(optional)</span>
          </p>
          <div
            style={{
              border: "1.5px dashed #e2e8f0",
              borderRadius: 8,
              padding: "14px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
              marginBottom: 12,
            }}
          >
            <Paperclip size={14} style={{ display: "inline", marginRight: 4 }} />
            Drag files here or <span style={{ color: "#2563eb", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>browse</span>
          </div>

          <div style={{ textAlign: "right", fontSize: 11, color: "#cbd5e1", marginBottom: 12 }}>
            {ideaText.length} / 2000
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="panel-btn"
            style={{ width: "100%" }}
          >
            {generating ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Generate proposal
              </>
            )}
          </button>
        </div>

        {/* Center: AI summary preview */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">AI summary preview</h2>
            {isProposalGenerated && (
              <span className="panel-badge panel-badge--green">Generated</span>
            )}
          </div>

          {isProposalGenerated || generating ? (
            <>
              {summaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <Icon size={16} style={{ color: "#2563eb", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#64748b", minWidth: 120 }}>
                      {item.label}
                    </span>
                    {item.badgeColor ? (
                      <span className={`panel-badge panel-badge--${item.badgeColor}`}>
                        {item.value}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                        {item.value}
                      </span>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                className="panel-link"
                style={{ marginTop: 12 }}
              >
                View full summary <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 220,
                color: "#94a3b8",
                textAlign: "center",
                gap: 8,
              }}
            >
              <Sparkles size={28} />
              <span style={{ fontSize: 13 }}>
                Generate a proposal to see the AI summary.
              </span>
            </div>
          )}
        </div>

        {/* Right: Intelligence at a glance */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Intelligence at a glance</h2>
          </div>

          {intelligenceItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "14px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: item.color + "15",
                    display: "grid",
                    placeItems: "center",
                    color: item.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: item.color + "15",
                        color: item.color,
                      }}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {item.value}
                  </div>
                </div>
              </div>
            );
          })}

          <button type="button" className="panel-link" style={{ marginTop: 8 }}>
            View full intelligence report <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Tabs section */}
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid #e2e8f0",
            marginBottom: 20,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #2563eb" : "2px solid transparent",
                background: "transparent",
                color: activeTab === tab.id ? "#2563eb" : "#64748b",
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: "pointer",
                transition: "color 150ms ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="panel-grid panel-grid--3">
          {/* Proposed scope */}
          <div className="panel-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              Proposed scope
            </h3>
            {scopeItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: "#eff6ff",
                      display: "grid",
                      placeItems: "center",
                      color: "#2563eb",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</div>
                  </div>
                  <span
                    className={`panel-badge panel-badge--${item.badgeColor || "blue"}`}
                    style={{ flexShrink: 0 }}
                  >
                    {item.badge}
                  </span>
                </div>
              );
            })}
            <button type="button" className="panel-link" style={{ marginTop: 12 }}>
              <Plus size={14} /> Add custom item
            </button>
          </div>

          {/* Acceptance criteria + Deliverables */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                Acceptance criteria (5)
              </h3>
              <button type="button" className="panel-link" style={{ fontSize: 12 }}>
                View all
              </button>
            </div>
            {[
              "All active subscriptions migrated successfully",
              "Webhook failures retried and logged",
              "Reconciliation difference is zero",
              "Rollback tested and documented",
              "Admin dashboard is production-ready",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 0",
                  fontSize: 13,
                  color: "#334155",
                }}
              >
                <Check size={16} style={{ color: "#16a34a" }} />
                {item}
              </div>
            ))}

            <hr className="panel-divider" />

            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Deliverables
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Migration runbook.pdf", "Data mapping.xlsx", "Architecture diagram.v1.0"].map((d) => (
                <span key={d} className="panel-badge panel-badge--outline">
                  <FileText size={12} /> {d}
                </span>
              ))}
            </div>
          </div>

          {/* Next steps */}
          <div className="panel-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              Next steps
            </h3>
            {nextSteps.map((step) => (
              <div
                key={step.num}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{step.desc}</div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="panel-btn"
                style={{ width: "100%" }}
                onClick={() => setDashboardTab("agreement-composer")}
              >
                Continue to structured scope <ArrowRight size={14} />
              </button>
              <button type="button" className="panel-btn--ghost panel-btn" style={{ width: "100%" }}>
                <Bookmark size={14} /> Save draft and exit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
