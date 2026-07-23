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

const requirements = [];

const evidenceNodes = [];

// Used as the fallback view when no live evaluation is available.
const fallbackConfidence = [];

function scoreColor(score) {
  if (score >= 80) return "green";
  if (score >= 60) return "blue";
  return "orange";
}

// AIE-09: `factor` is a FactorScore { score, deterministic_base, llm_modifier,
// evidence }. Evidence is surfaced so the number is auditable/explainable.
function ScoreBar({ label, factor }) {
  if (!factor) return null;
  const { score, deterministic_base, llm_modifier, evidence } = factor;
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
      {(deterministic_base !== undefined || llm_modifier) && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          base {deterministic_base}
          {llm_modifier ? ` · LLM ${llm_modifier > 0 ? "+" : ""}${llm_modifier}` : ""}
        </div>
      )}
      {evidence?.length > 0 && (
        <ul
          style={{
            margin: "6px 0 0",
            paddingLeft: 16,
            fontSize: 11,
            color: "#64748b",
            listStyle: "disc",
          }}
        >
          {evidence.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EvidenceConfidence() {
  const {
    user,
    rawBriefText,
    parsedProposal,
    confidenceResult,
    confidenceSource,
    confidenceEvaluating,
    interviewQuestions,
    interviewSource,
    interviewGenerating,
    confidenceNotice,
    runConfidenceEval,
    runInterviewGenerate,
    setConfidenceNotice,
  } = useLandingStore();

  // Use the store-level notice that survives navigation
  const [localNotice, setLocalNotice] = useState("");
  const notice = confidenceNotice || localNotice;

  const runEvaluation = async () => {
    setLocalNotice("");
    setConfidenceNotice("");
    if (!parsedProposal) {
      setLocalNotice(
        "Parse a brief in the Brief Ingestion tab first to run a live evaluation. Showing sample confidence.",
      );
      useLandingStore.getState().setConfidenceResult(null);
      useLandingStore.getState().setConfidenceSource("mock");
      return;
    }
    // Fire the store-level thunk — survives tab navigation
    await runConfidenceEval();
  };

  const generateInterview = async () => {
    // Fire the store-level thunk — survives tab navigation
    await runInterviewGenerate();
  };

  const liveResult = confidenceSource === "api" ? confidenceResult : null;

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
          {parsedProposal?.project_summary
            ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
            : "No active project brief"}
        </p>
        <h1 className="panel-page-title">Evidence connected to requirements</h1>
        <p className="panel-page-subtitle">
          {user?.email ? user.email.split("@")[1].split(".")[0].toUpperCase() : "Workspace"} · Review before shortlist
        </p>
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Requirements */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Requirements</h2>
          </div>

          {parsedProposal?.features?.length > 0 ? (
            parsedProposal.features.map((req) => {
              return (
                <div
                  key={req.title}
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
                    <Check size={15} strokeWidth={1.8} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>
                    {req.title}
                  </span>
                </div>
              );
            })
          ) : (
            <p style={{ fontSize: 13, color: "#64748b" }}>
              No requirements parsed. Parse a brief in the Brief Ingestion tab first.
            </p>
          )}
        </div>

        {/* Center: Evidence relationships (visual) */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Evidence relationships</h2>
          </div>

          {evidenceNodes.length > 0 ? (
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
          ) : (
            <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "40px 0" }}>
              Connect your GitHub repository in Onboarding to trace work evidence dynamically.
            </p>
          )}

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

              {/* Budget is omitted when the brief states no budget (factor excluded). */}
              <ScoreBar
                label="Budget alignment"
                factor={liveResult.auditor.budget_alignment}
              />
              <ScoreBar
                label="Deliverable coverage"
                factor={liveResult.auditor.deliverable_coverage}
              />
              <ScoreBar
                label="Technical feasibility"
                factor={liveResult.feasibility.technical_feasibility}
              />
              <ScoreBar
                label="Timeline realism"
                factor={liveResult.feasibility.timeline_realism}
              />
            </>
          ) : (
            <>
              {fallbackConfidence.length > 0 ? (
                fallbackConfidence.map((item) => (
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
                ))
              ) : (
                <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "20px 0" }}>
                  Run evaluation below to populate the confidence grid.
                </p>
              )}
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
            disabled={confidenceEvaluating}
          >
            {confidenceEvaluating ? (
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
            disabled={interviewGenerating}
          >
            {interviewGenerating ? (
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
