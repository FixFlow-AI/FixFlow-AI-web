import { useState } from "react";
import {
  Check,
  Code2,
  Users,
  FileCheck2,
  Briefcase,
  Calendar,
  GitBranch,
  RefreshCw,
  Cpu,
  AlertTriangle,
  Sparkles,
  Zap,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";

const requirements = [
  { icon: Check, label: "Preserve subscription state" },
  { icon: Users, label: "Idempotent webhook processing" },
  { icon: GitBranch, label: "Tested rollback plan" },
  { icon: Briefcase, label: "Billing reconciliation" },
  { icon: Calendar, label: "Six-week delivery window" },
];

const evidenceNodes = [
  { type: "source", icon: Code2, label: "Repository:", sub: "billing-migration" },
  { type: "source", icon: Users, label: "Webhook:", sub: "payment webhook handler" },
  { type: "source", icon: Briefcase, label: "Job:", sub: "billing reconciliation" },
  { type: "target", icon: FileCheck2, label: "Outcome:", sub: "subscription cutover" },
  { type: "target", icon: Check, label: "Artifact:", sub: "rollback test suite" },
  { type: "target", icon: FileCheck2, label: "Delivery record:", sub: "5-week migration" },
  { type: "ref", icon: Users, label: "Reference:", sub: "platform engineering lead" },
];

// Used as the fallback view when no live evaluation is available.
const fallbackConfidence = [
  { label: "Subscription state", badge: "Strong evidence", color: "green" },
  { label: "Webhook reliability", badge: "Strong evidence", color: "green" },
  { label: "Rollback design", badge: "Relevant evidence", color: "blue" },
  { label: "Reconciliation", badge: "Relevant evidence", color: "blue" },
  { label: "Target runtime", badge: "Open question", color: "orange" },
];

function scoreColor(score) {
  if (score >= 80) return "green";
  if (score >= 60) return "blue";
  return "orange";
}

function ScoreBar({ label, score }) {
  const color = scoreColor(score);
  const stroke =
    color === "green" ? "#16a34a" : color === "blue" ? "#2563eb" : "#ea580c";
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
          color: "#334155",
          marginBottom: 6,
        }}
      >
        <span>{label}</span>
        <span style={{ color: stroke }}>{score}</span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4 }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(100, score))}%`,
            height: "100%",
            background: stroke,
            borderRadius: 4,
            transition: "width .5s ease",
          }}
        />
      </div>
    </div>
  );
}

export function EvidenceConfidence() {
  const {
    rawBriefText,
    parsedProposal,
    confidenceResult,
    confidenceSource,
    setConfidenceResult,
    setConfidenceSource,
    interviewQuestions,
    interviewSource,
    setInterviewQuestions,
    setInterviewSource,
  } = useLandingStore();

  const [evaluating, setEvaluating] = useState(false);
  const [generatingInterview, setGeneratingInterview] = useState(false);
  const [notice, setNotice] = useState("");

  const runEvaluation = async () => {
    setNotice("");
    setEvaluating(true);
    try {
      // The evaluate endpoint needs a proposal. Use the live parsed proposal
      // when available; otherwise tell the user to parse a brief first.
      if (!parsedProposal) {
        setNotice(
          "Parse a brief in the Brief Ingestion tab first to run a live evaluation. Showing sample confidence.",
        );
        setConfidenceResult(null);
        setConfidenceSource("mock");
        return;
      }
      const result = await api.evaluateProposal(
        rawBriefText,
        parsedProposal,
        useLandingStore.getState().parsedProposalId,
      );
      setConfidenceResult(result);
      setConfidenceSource("api");
    } catch (err) {
      const reason =
        err instanceof ApiError && err.status === 503
          ? "AI not configured on the server (missing GEMINI_API_KEY). Showing sample confidence."
          : "Couldn't reach the evaluation service. Showing sample confidence.";
      setNotice(reason);
      setConfidenceResult(null);
      setConfidenceSource("mock");
    } finally {
      setEvaluating(false);
    }
  };

  const generateInterview = async () => {
    setGeneratingInterview(true);
    try {
      // Derive "missing skills" from open-question confidence items / risks.
      const missingSkills = parsedProposal?.risks
        ?.slice(0, 3)
        .map((r) => r.label) ?? ["Target runtime confirmation"];
      const githubScan =
        "Languages: TypeScript, Node.js. Repos: billing-migration, webhook-utils.";
      const output = await api.interviewQuestions(
        rawBriefText || "Billing migration project",
        githubScan,
        missingSkills,
      );
      setInterviewQuestions(output);
      setInterviewSource("api");
    } catch (err) {
      // The backend skill self-heals with fallback questions, so a failure here
      // is almost always "no key / offline" — show a small local fallback.
      setInterviewQuestions({
        questions: [
          {
            question:
              "How would you keep webhook processing idempotent during a live billing migration?",
            rationale: "Tests the core reliability requirement of this project.",
            expectedKeywords: ["idempotency key", "dedupe", "retry", "ledger"],
            idealAnswerSummary:
              "Uses a persisted idempotency key and a dedup table to make retries safe.",
          },
          {
            question:
              "Describe your rollback strategy if the cutover fails mid-migration.",
            rationale: "Rollback ownership is the top open risk on this brief.",
            expectedKeywords: ["rollback", "snapshot", "feature flag", "dry run"],
            idealAnswerSummary:
              "Has a tested, reversible plan with clear ownership and a dry run.",
          },
        ],
      });
      setInterviewSource("mock");
    } finally {
      setGeneratingInterview(false);
    }
  };

  const liveResult = confidenceSource === "api" ? confidenceResult : null;

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
          Atlas Commerce / Northstar Billing Migration
        </p>
        <h1 className="panel-page-title">Evidence connected to requirements</h1>
        <p className="panel-page-subtitle">
          Northline Studio · Review before shortlist
        </p>
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Requirements */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Requirements</h2>
          </div>

          {requirements.map((req) => {
            const Icon = req.icon;
            return (
              <div
                key={req.label}
                style={{
                  display: "flex",
                  alignItems: "center",
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
                    background: "#eff6ff",
                    border: "1.5px solid #bfdbfe",
                    display: "grid",
                    placeItems: "center",
                    color: "#2563eb",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>
                  {req.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Center: Evidence relationships (visual) */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Evidence relationships</h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              padding: "8px 0",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {evidenceNodes
                .filter((n) => n.type === "source")
                .map((node) => {
                  const NIcon = node.icon;
                  return (
                    <div
                      key={node.label + node.sub}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        background: "#fff",
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
                        <NIcon size={14} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                          {node.label}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                          {node.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {evidenceNodes
                .filter((n) => n.type === "target" || n.type === "ref")
                .map((node) => {
                  const NIcon = node.icon;
                  return (
                    <div
                      key={node.label + node.sub}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        background: "#fff",
                        borderStyle: node.type === "ref" ? "dashed" : "solid",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: node.type === "ref" ? "#f8fafc" : "#f0fdf4",
                          display: "grid",
                          placeItems: "center",
                          color: node.type === "ref" ? "#64748b" : "#16a34a",
                          flexShrink: 0,
                        }}
                      >
                        <NIcon size={14} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                          {node.label}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                          {node.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "8px 0",
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            — Connected via 7 evidence links —
          </div>
        </div>

        {/* Right: Confidence Grid (LIVE — AI-002) */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Confidence grid</h2>
            {liveResult ? (
              <span className="panel-badge panel-badge--blue">
                <Cpu size={12} /> Live
              </span>
            ) : null}
          </div>

          {liveResult ? (
            <>
              {/* Headline confidence index */}
              <div
                style={{
                  textAlign: "center",
                  padding: "12px 0 16px",
                  borderBottom: "1px solid #f1f5f9",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 800,
                    color: scoreColor(liveResult.confidenceIndex) === "green"
                      ? "#16a34a"
                      : scoreColor(liveResult.confidenceIndex) === "blue"
                      ? "#2563eb"
                      : "#ea580c",
                    lineHeight: 1,
                  }}
                >
                  {liveResult.confidenceIndex}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Consensus confidence index
                </div>
                {liveResult.optimized && (
                  <span
                    className="panel-badge panel-badge--blue"
                    style={{ marginTop: 8, display: "inline-flex" }}
                  >
                    <Zap size={12} /> Auto-corrected
                  </span>
                )}
              </div>

              <ScoreBar
                label="Budget alignment"
                score={liveResult.auditor.budget_alignment_score}
              />
              <ScoreBar
                label="Deliverable coverage"
                score={liveResult.auditor.deliverable_coverage_score}
              />
              <ScoreBar
                label="Technical feasibility"
                score={liveResult.feasibility.technical_feasibility_score}
              />
              <ScoreBar
                label="Timeline realism"
                score={liveResult.feasibility.timeline_realism_score}
              />
            </>
          ) : (
            <>
              {fallbackConfidence.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                    {item.label}
                  </span>
                  <span
                    className={`panel-badge panel-badge--${item.color}`}
                    style={{ flexShrink: 0, fontSize: 11 }}
                  >
                    {item.badge}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Issues from the two agents (live only) */}
      {liveResult &&
        (liveResult.auditor.issues.length > 0 ||
          liveResult.feasibility.issues.length > 0) && (
          <div className="panel-card" style={{ marginTop: 20 }}>
            <div className="panel-card-header">
              <h2 className="panel-card-title">Agent findings</h2>
            </div>
            <div className="panel-grid panel-grid--2" style={{ gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                  🔍 Auditor
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569" }}>
                  {liveResult.auditor.issues.map((issue, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{issue}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                  ⚙️ Feasibility
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569" }}>
                  {liveResult.feasibility.issues.map((issue, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

      {/* Generated interview questions (AI-003) */}
      {interviewQuestions?.questions?.length > 0 && (
        <div className="panel-card" style={{ marginTop: 20 }}>
          <div className="panel-card-header">
            <h2 className="panel-card-title">Focused interview questions</h2>
            <span
              className={`panel-badge panel-badge--${interviewSource === "api" ? "blue" : "outline"}`}
            >
              {interviewSource === "api" ? "AI-generated" : "Sample"}
            </span>
          </div>
          {interviewQuestions.questions.map((q, i) => (
            <div
              key={i}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
                {i + 1}. {q.question}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                {q.rationale}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {q.expectedKeywords.map((kw, k) => (
                  <span key={k} className="panel-badge panel-badge--outline" style={{ fontSize: 11 }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notice */}
      {notice && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            fontSize: 13,
            color: "#c2410c",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} /> {notice}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="panel-action-bar">
        <div
          className="panel-action-bar-left"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ color: "#2563eb" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Confidence is based on relevance, source strength, recency, and unresolved risk.
          </span>
        </div>
        <div className="panel-action-bar-right">
          <button
            type="button"
            className="panel-btn"
            onClick={runEvaluation}
            disabled={evaluating}
          >
            {evaluating ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Evaluating…
              </>
            ) : (
              <>
                <Cpu size={14} /> Run evaluation
              </>
            )}
          </button>
          <button
            type="button"
            className="panel-btn--ghost panel-btn"
            onClick={generateInterview}
            disabled={generatingInterview}
          >
            {generatingInterview ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Generate focused interview
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
