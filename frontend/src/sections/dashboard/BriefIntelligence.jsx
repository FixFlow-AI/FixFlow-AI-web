import { useState, useEffect } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import {
  FileText,
  Cpu,
  AlertTriangle,
  Check,
  RefreshCw,
  Paperclip,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Minus,
  ArrowRight,
  Shield,
  MessageSquare,
  Bookmark,
} from "lucide-react";

/* Static attachments shown in the mockup */
const attachments = [];

/* Default parsed requirements when using mock data */
const defaultRequirements = [];

const defaultDecisions = [];

export function BriefIntelligence() {
  const {
    user,
    rawBriefText,
    isBriefParsed,
    setBriefText,
    setBriefParsed,
    parsedProposal,
    briefSource,
    briefError,
    briefParsing,
    runBriefParse,
    setParsedProposal,
    setBriefSource,
    setBriefError,
  } = useLandingStore();

  const [text, setText] = useState(rawBriefText);
  const [parsingStep, setParsingStep] = useState(0);

  useEffect(() => {
    setText(rawBriefText);
  }, [rawBriefText]);

  /* ── Decision interaction state ── */
  const [expandedDecision, setExpandedDecision] = useState(null); // index or null
  const [decisionStatuses, setDecisionStatuses] = useState({}); // { [index]: "clarification_requested" | "assumed" }
  const [noSelectionPrompt, setNoSelectionPrompt] = useState(false);

  const handleParse = async (e) => {
    e.preventDefault();
    setParsingStep(1);

    const stepTimers = [
      setTimeout(() => setParsingStep(2), 600),
      setTimeout(() => setParsingStep(3), 1200),
    ];

    // Fire the store-level thunk. The promise lives in the store —
    // results are written regardless of whether this component unmounts.
    await runBriefParse(text);

    stepTimers.forEach(clearTimeout);
  };

  /* Build requirements list from parsed proposal or defaults */
  const requirements =
    parsedProposal && parsedProposal.features
      ? parsedProposal.features.map((f) => ({
          text: f.title,
          status:
            f.confidence_pct >= 80
              ? "Confirmed"
              : f.confidence_pct >= 50
              ? "In scope"
              : "Constraint",
        }))
      : defaultRequirements;

  /* Preserve full Risk objects so we can show severity / category / mitigation */
  const decisions =
    parsedProposal && parsedProposal.risks
      ? parsedProposal.risks.map((r) =>
          typeof r === "string"
            ? { label: r, severity: 5, mitigation: "", category: "General" }
            : {
                label: r.label || r.description || "Unresolved risk",
                severity: r.severity ?? 5,
                mitigation: r.mitigation || "",
                category: r.category || "General",
              }
        )
      : defaultDecisions;

  const reqCounts = {
    outcomes: requirements.filter((r) => r.status !== "Constraint").length,
    constraints: requirements.filter((r) => r.status === "Constraint").length,
    decisions: decisions.length,
  };

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <h1 className="panel-page-title">Brief intelligence</h1>
        <p className="panel-page-subtitle">
          {parsedProposal?.project_summary
            ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
            : "No active project brief"}
        </p>
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Source request */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Source request</h2>
          </div>

          {/* Input / display area */}
          {!isBriefParsed ? (
            <form onSubmit={handleParse}>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (isBriefParsed) setBriefParsed(false);
                }}
                placeholder="Describe your project requirements..."
                rows={6}
                style={{
                  width: "100%",
                  padding: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#0f172a",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                required
              />
              <button
                type="submit"
                disabled={briefParsing}
                className="panel-btn"
                style={{ width: "100%", marginTop: 12 }}
              >
                {briefParsing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    {parsingStep === 1
                      ? "Structuring..."
                      : parsingStep === 2
                      ? "Analyzing gaps..."
                      : "Mapping risks..."}
                  </>
                ) : (
                  <>
                    <Cpu size={14} /> Parse Project Brief
                  </>
                )}
              </button>
            </form>
          ) : (
            <>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, margin: "0 0 20px" }}>
                {text ||
                  "Move our billing service without interrupting active subscriptions. We need a safe rollback path and clear reconciliation before cutover."}
              </p>

              {/* Attachments */}
              {attachments.length > 0 && (
                <>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 10 }}>
                    Attachments
                  </h3>
                  {attachments.map((att) => (
                    <div
                      key={att.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: att.color + "15",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {att.icon}
                      </span>
                      <span style={{ fontWeight: 500, color: "#334155" }}>{att.name}</span>
                    </div>
                  ))}
                </>
              )}

              <hr className="panel-divider" />

              {/* Source info */}
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
                Source
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#dbeafe",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#2563eb",
                  }}
                >
                  {user?.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase() : "U"}
                </div>
                <span style={{ fontSize: 13, color: "#64748b" }}>Provided by {user?.name || user?.email || "User"}</span>
              </div>

              {/* Reparse button */}
              <button
                type="button"
                className="panel-link"
                style={{ marginTop: 16 }}
                onClick={() => setBriefParsed(false)}
              >
                <RefreshCw size={13} /> Edit and reparse
              </button>
            </>
          )}
        </div>

        {/* Center: Parsed requirements */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Parsed requirements</h2>
          </div>

          {/* Status banner */}
          {briefSource === "api" && isBriefParsed && (
            <div
              style={{
                padding: "8px 12px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 6,
                fontSize: 12,
                color: "#1d4ed8",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <Cpu size={13} /> Parsed live by Gemini brief parser.
            </div>
          )}
          {briefError && isBriefParsed && (
            <div
              style={{
                padding: "8px 12px",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 6,
                fontSize: 12,
                color: "#c2410c",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <AlertTriangle size={13} /> {briefError}
            </div>
          )}

          {isBriefParsed || parsing ? (
            <>
              {/* Counts */}
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
                {reqCounts.outcomes} outcomes · {reqCounts.constraints} constraints ·{" "}
                {reqCounts.decisions} open decisions
              </p>

              {parsing ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 200,
                    color: "#64748b",
                    gap: 12,
                  }}
                >
                  <RefreshCw size={28} className="animate-spin" style={{ color: "#2563eb" }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Parsing requirements...</span>
                </div>
              ) : (
                requirements.map((req) => (
                  <div
                    key={req.text}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <span style={{ fontSize: 14, color: "#334155" }}>{req.text}</span>
                    <span
                      className={`panel-badge ${
                        req.status === "Confirmed"
                          ? "panel-badge--green"
                          : req.status === "In scope"
                          ? "panel-badge--outline"
                          : "panel-badge--gray"
                      }`}
                      style={{ flexShrink: 0, marginLeft: 12, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {req.status === "Confirmed" && <Check size={11} />}
                      {req.status === "In scope" && <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid #94a3b8" }} />}
                      {req.status === "Constraint" && <Minus size={11} />}
                      {req.status}
                    </span>
                  </div>
                ))
              )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 280,
                color: "#94a3b8",
                textAlign: "center",
                gap: 8,
              }}
            >
              <FileText size={28} />
              <span style={{ fontSize: 13 }}>
                Parse a brief to see structured requirements here.
              </span>
            </div>
          )}
        </div>

        {/* Right: Needs a decision */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Needs a decision</h2>
          </div>

          {isBriefParsed ? (
            <>
              {decisions.map((q, idx) => {
                const isExpanded = expandedDecision === idx;
                const status = decisionStatuses[idx]; // undefined | "clarification_requested" | "assumed"
                const severityColor =
                  q.severity <= 3 ? "#16a34a" : q.severity <= 6 ? "#d97706" : "#dc2626";
                const severityBg =
                  q.severity <= 3 ? "#f0fdf4" : q.severity <= 6 ? "#fffbeb" : "#fef2f2";
                const isSelected = expandedDecision === idx;

                return (
                  <div key={q.label + idx}>
                    {/* Clickable row */}
                    <div
                      onClick={() => {
                        setExpandedDecision(isExpanded ? null : idx);
                        setNoSelectionPrompt(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "14px 0",
                        borderBottom: isExpanded ? "none" : "1px solid #f1f5f9",
                        cursor: "pointer",
                        background: isSelected ? "#f8fafc" : "transparent",
                        borderRadius: isSelected ? 8 : 0,
                        paddingLeft: isSelected ? 8 : 0,
                        paddingRight: isSelected ? 8 : 0,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: status === "clarification_requested" ? "#eff6ff" : status === "assumed" ? "#fffbeb" : "#fff7ed",
                          border: `1px solid ${status === "clarification_requested" ? "#93c5fd" : status === "assumed" ? "#fcd34d" : "#fed7aa"}`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          color: status === "clarification_requested" ? "#2563eb" : status === "assumed" ? "#d97706" : "#ea580c",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {status === "clarification_requested" ? (
                          <MessageSquare size={13} />
                        ) : status === "assumed" ? (
                          <Bookmark size={13} />
                        ) : (
                          <HelpCircle size={14} />
                        )}
                      </span>
                      <span style={{ fontSize: 13, color: "#334155", flex: 1, fontWeight: 500 }}>
                        {q.label}
                      </span>
                      {/* Status badge (if resolved) */}
                      {status && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: status === "clarification_requested" ? "#eff6ff" : "#fffbeb",
                            color: status === "clarification_requested" ? "#2563eb" : "#d97706",
                            border: `1px solid ${status === "clarification_requested" ? "#bfdbfe" : "#fde68a"}`,
                            whiteSpace: "nowrap",
                            transition: "all 0.3s ease",
                          }}
                        >
                          {status === "clarification_requested" ? "Clarification sent" : "Assumed"}
                        </span>
                      )}
                      {/* Animated chevron */}
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          transition: "transform 0.25s ease",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          flexShrink: 0,
                        }}
                      >
                        <ChevronRight size={16} style={{ color: "#94a3b8" }} />
                      </span>
                    </div>

                    {/* Expanded detail card */}
                    <div
                      style={{
                        maxHeight: isExpanded ? 300 : 0,
                        overflow: "hidden",
                        transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, padding 0.3s ease",
                        opacity: isExpanded ? 1 : 0,
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 14px",
                          margin: "0 0 12px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {/* Category + Severity row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 10px",
                              borderRadius: 12,
                              background: "#f1f5f9",
                              color: "#475569",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {q.category}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 10px",
                              borderRadius: 12,
                              background: severityBg,
                              color: severityColor,
                              border: `1px solid ${severityColor}30`,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Shield size={11} />
                            Severity {q.severity}/10
                          </span>
                        </div>

                        {/* Mitigation */}
                        {q.mitigation && (
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Mitigation
                            </span>
                            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "4px 0 0" }}>
                              {q.mitigation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* No-selection prompt */}
              {noSelectionPrompt && expandedDecision === null && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#92400e",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    animation: "fadeIn 0.3s ease",
                  }}
                >
                  <AlertTriangle size={13} />
                  Click a decision item above first, then choose an action.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  className="panel-btn"
                  style={{ width: "100%" }}
                  onClick={() => {
                    if (expandedDecision === null) {
                      setNoSelectionPrompt(true);
                      return;
                    }
                    setDecisionStatuses((prev) => ({ ...prev, [expandedDecision]: "clarification_requested" }));
                    setNoSelectionPrompt(false);
                    // Auto-collapse after marking
                    setTimeout(() => setExpandedDecision(null), 600);
                  }}
                >
                  <MessageSquare size={14} />
                  Request clarification
                </button>
                <button
                  type="button"
                  className="panel-btn--ghost panel-btn"
                  style={{ width: "100%" }}
                  onClick={() => {
                    if (expandedDecision === null) {
                      setNoSelectionPrompt(true);
                      return;
                    }
                    setDecisionStatuses((prev) => ({ ...prev, [expandedDecision]: "assumed" }));
                    setNoSelectionPrompt(false);
                    // Auto-collapse after marking
                    setTimeout(() => setExpandedDecision(null), 600);
                  }}
                >
                  <Bookmark size={14} />
                  Mark as assumption
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
                color: "#94a3b8",
                textAlign: "center",
                gap: 8,
              }}
            >
              <HelpCircle size={28} />
              <span style={{ fontSize: 13 }}>
                Decisions will appear after parsing.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#2563eb" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Every interpretation remains linked to the source request.
          </span>
        </div>
      </div>
    </div>
  );
}
