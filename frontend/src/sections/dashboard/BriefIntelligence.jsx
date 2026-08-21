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
  Plus,
} from "lucide-react";

/* Static attachments shown in the mockup */
const attachments = [];

/* Default parsed requirements when using mock data */
const defaultRequirements = [];

const defaultDecisions = [];

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span 
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 4 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <HelpCircle size={13} style={{ color: "#94a3b8", cursor: "help" }} />
      {show && (
        <span className="brief-tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

function extractMetadata(text) {
  if (!text) return { budget: "Not specified", timeline: "Not specified", source: "Manual" };
  
  // Try to find budget (e.g. $1000, $1,500, 1000 USD)
  const budgetRegex = /(\$\d[\d,]*(\.\d{2})?|\b\d+[\d,]*\s*USD\b)/i;
  const budgetMatch = text.match(budgetRegex);
  const budget = budgetMatch ? budgetMatch[0] : "Not specified";

  // Try to find timeline (e.g. 2 weeks, 1 month, 14 days)
  const timelineRegex = /(timeline is\s+)?(\d+\s*(weeks?|months?|days?|years?))/i;
  const timelineMatch = text.match(timelineRegex);
  let timeline = "Not specified";
  if (timelineMatch) {
    timeline = timelineMatch[2];
  } else {
    const durationRegex = /\b(\d+)\s*(weeks?|months?|days?)\b/i;
    const durationMatch = text.match(durationRegex);
    if (durationMatch) {
      timeline = durationMatch[0];
    }
  }

  return {
    budget,
    timeline,
    source: text.length > 200 ? "External Brief" : "Manual Input"
  };
}

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
    startNewProposal,
  } = useLandingStore();

  const [text, setText] = useState(rawBriefText);
  const [parsingStep, setParsingStep] = useState(0);

  useEffect(() => {
    setText(rawBriefText);
  }, [rawBriefText]);

  const handleNewProposal = () => {
    startNewProposal();
    setParsingStep(0);
    setExpandedDecision(null);
    setDecisionStatuses({});
    setNoSelectionPrompt(false);
  };

  /* ── Decision interaction state ── */
  const [expandedDecision, setExpandedDecision] = useState(null); // index or null
  const [decisionStatuses, setDecisionStatuses] = useState({}); // { [index]: "clarification_requested" | "assumed" }
  const [noSelectionPrompt, setNoSelectionPrompt] = useState(false);
  const [hoveredAction, setHoveredAction] = useState(null); // 'clarify' | 'assume' | null

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

  const resolvedCount = Object.keys(decisionStatuses).length;
  const totalDecisions = decisions.length;
  const completionPct = totalDecisions > 0 ? Math.round((resolvedCount / totalDecisions) * 100) : 0;

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="panel-page-title">Brief intelligence</h1>
          <p className="panel-page-subtitle">
            {parsedProposal?.project_summary
              ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
              : "No active project brief"}
          </p>
        </div>
        {isBriefParsed && user?.role === "client" && (
          <button
            type="button"
            className="panel-btn"
            onClick={handleNewProposal}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} />
            <span>New Proposal</span>
          </button>
        )}
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Source request */}
        <div className="panel-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-card-header" style={{ marginBottom: 8 }}>
            <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center" }}>
              Source request
              <InfoTooltip text="The original project description, budget, and timeline you submitted." />
            </h2>
          </div>
          <p className="brief-card-desc">The raw brief you submitted — edit anytime to reparse</p>

          {/* Input / display area */}
          {!isBriefParsed ? (
            <form onSubmit={handleParse} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <textarea
                data-lenis-prevent="true"
                data-tour="brief-input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (isBriefParsed) setBriefParsed(false);
                }}
                placeholder="Describe your project requirements, budget, and timeline (e.g., 'Create a React landing page. Budget is $1000, timeline is 2 weeks.')"
                rows={8}
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
                  flex: 1,
                  minHeight: 150
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
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div 
                style={{ 
                  fontSize: 14, 
                  color: "#475569", 
                  lineHeight: 1.7, 
                  margin: "0 0 16px",
                  padding: 12,
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  whiteSpace: "pre-wrap"
                }}
              >
                {text ||
                  "Move our billing service without interrupting active subscriptions. We need a safe rollback path and clear reconciliation before cutover."}
              </div>

              {/* Structured Metadata */}
              {(() => {
                const metadata = extractMetadata(text);
                return (
                  <div className="brief-metadata-card">
                    <div className="brief-metadata-title">Extracted Details</div>
                    <div className="brief-metadata-grid">
                      <span className="brief-metadata-label">Budget Range</span>
                      <span className="brief-metadata-value" style={{ color: metadata.budget !== "Not specified" ? "#16a34a" : "#64748b" }}>
                        {metadata.budget}
                      </span>

                      <span className="brief-metadata-label">Timeline</span>
                      <span className="brief-metadata-value">
                        {metadata.timeline}
                      </span>

                      <span className="brief-metadata-label">Ingestion Type</span>
                      <span className="brief-metadata-value">
                        {metadata.source}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Attachments */}
              {attachments.length > 0 && (
                <>
                  <h3 style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
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

              <hr className="panel-divider" style={{ marginTop: "auto" }} />

              {/* Source info */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
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
                  onClick={() => setBriefParsed(false)}
                >
                  <RefreshCw size={13} /> Edit and reparse
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: Parsed requirements */}
        <div className="panel-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-card-header" style={{ marginBottom: 8 }}>
            <h2
              className="panel-card-title"
              style={{ display: "flex", alignItems: "center" }}
              data-tour="parsed-requirements"
            >
              Parsed requirements
              <InfoTooltip text="AI-extracted deliverables, constraints, and scope items from your brief." />
            </h2>
          </div>
          <p className="brief-card-desc">AI-extracted scope items categorized by confidence level</p>

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

          {isBriefParsed || briefParsing ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {/* Counts Chips */}
              <div className="brief-stat-chips-container">
                <div className="brief-stat-chip brief-stat-chip--green">
                  <span className="brief-stat-chip-val">{reqCounts.outcomes}</span>
                  <span className="brief-stat-chip-label">
                    Outcomes
                    <InfoTooltip text="Deliverables the AI is confident about — ready to include in proposals." />
                  </span>
                </div>
                <div className="brief-stat-chip brief-stat-chip--gray">
                  <span className="brief-stat-chip-val">{reqCounts.constraints}</span>
                  <span className="brief-stat-chip-label">
                    Constraints
                    <InfoTooltip text="Limitations or boundaries (budget, timeline, tech stack) extracted from the brief." />
                  </span>
                </div>
                <div className="brief-stat-chip brief-stat-chip--orange">
                  <span className="brief-stat-chip-val">{reqCounts.decisions}</span>
                  <span className="brief-stat-chip-label">
                    Decisions
                    <InfoTooltip text="Ambiguous items requiring your clarification before work begins." />
                  </span>
                </div>
              </div>

              {briefParsing ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 200,
                    color: "#64748b",
                    gap: 12,
                    flex: 1
                  }}
                >
                  <RefreshCw size={28} className="animate-spin" style={{ color: "#2563eb" }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Parsing requirements...</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ flex: 1 }}>
                    {requirements.map((req) => (
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
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="brief-legend">
                    <div className="brief-legend-item">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                      Confirmed (≥80% confidence)
                    </div>
                    <div className="brief-legend-item">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
                      In scope (50-79%)
                    </div>
                    <div className="brief-legend-item">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b" }} />
                      Constraint (&lt;50%)
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 320,
                color: "#64748b",
                textAlign: "center",
                padding: "20px",
                background: "rgba(248, 250, 252, 0.5)",
                border: "1px dashed #e2e8f0",
                borderRadius: 10,
                gap: 16,
              }}
            >
              <div style={{ background: "#eff6ff", padding: 16, borderRadius: "50%", color: "#2563eb" }}>
                <FileText size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>Awaiting Project Brief</h4>
                <p style={{ fontSize: 12, color: "#64748b", maxWidth: 220, margin: "0 auto", lineHeight: 1.5 }}>
                  Submit your project requirements on the left to extract structured deliverables automatically.
                </p>
              </div>
              <ul style={{ fontSize: 12, color: "#64748b", textAlign: "left", listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <li style={{ display: "flex", alignItems: "center", gap: 6 }}>🟢 Extract key deliverables</li>
                <li style={{ display: "flex", alignItems: "center", gap: 6 }}>🟢 Identify hidden timeline risks</li>
                <li style={{ display: "flex", alignItems: "center", gap: 6 }}>🟢 Generate precision developer questions</li>
              </ul>
            </div>
          )}
        </div>

        {/* Right: Needs a decision */}
        <div className="panel-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-card-header" style={{ marginBottom: 8 }}>
            <h2
              className="panel-card-title"
              style={{ display: "flex", alignItems: "center" }}
              data-tour="brief-decisions"
            >
              Needs a decision
              <InfoTooltip text="Open questions or risks flagged by the AI that need your input before proceeding." />
            </h2>
          </div>
          <p className="brief-card-desc">Flagged risks and ambiguities that require your input</p>

          {isBriefParsed ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {/* Decision Progress Bar */}
              {totalDecisions > 0 && (
                <div className="brief-progress-container">
                  <div className="brief-progress-header">
                    <span>Decision Progress</span>
                    <span>{resolvedCount} of {totalDecisions} resolved ({completionPct}%)</span>
                  </div>
                  <div className="brief-progress-bar-bg">
                    <div className="brief-progress-bar-fill" style={{ width: `${completionPct}%` }} />
                  </div>
                </div>
              )}

              <div style={{ flex: 1 }}>
                {decisions.map((q, idx) => {
                  const isExpanded = expandedDecision === idx;
                  const status = decisionStatuses[idx]; // undefined | "clarification_requested" | "assumed"
                  const severityColor =
                    q.severity <= 3 ? "#16a34a" : q.severity <= 6 ? "#d97706" : "#dc2626";
                  const severityBg =
                    q.severity <= 3 ? "#f0fdf4" : q.severity <= 6 ? "#fffbeb" : "#fef2f2";
                  const severityDotColor =
                    q.severity <= 3 ? "#22c55e" : q.severity <= 6 ? "#eab308" : "#ef4444";
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
                        
                        {/* Severity Dot & Label */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                          <span 
                            className="brief-severity-dot" 
                            style={{ backgroundColor: severityDotColor }} 
                            title={`Severity ${q.severity}/10`} 
                          />
                          <span style={{ fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {q.label}
                          </span>
                        </div>

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
              </div>

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

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                {/* Option 1: Request Clarification */}
                <div
                  style={{ position: "relative" }}
                  onMouseEnter={() => setHoveredAction("clarify")}
                  onMouseLeave={() => setHoveredAction(null)}
                >
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

                  {hoveredAction === "clarify" && (
                    <div className="action-button-tooltip">
                      <div style={{ fontWeight: 700, color: "#93c5fd", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                        <MessageSquare size={13} />
                        Request Clarification
                      </div>
                      <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.45 }}>
                        <strong style={{ color: "#fbbf24" }}>Requirement:</strong> Select a decision item above first.<br />
                        <strong style={{ color: "#38bdf8" }}>What it does:</strong> Flags high-risk ambiguity and requests direct client input before contract setup.
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: Mark as Assumption */}
                <div
                  style={{ position: "relative" }}
                  onMouseEnter={() => setHoveredAction("assume")}
                  onMouseLeave={() => setHoveredAction(null)}
                >
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

                  {hoveredAction === "assume" && (
                    <div className="action-button-tooltip">
                      <div style={{ fontWeight: 700, color: "#fde68a", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                        <Bookmark size={13} />
                        Mark as Assumption
                      </div>
                      <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.45 }}>
                        <strong style={{ color: "#fbbf24" }}>Requirement:</strong> Select a decision item above first.<br />
                        <strong style={{ color: "#38bdf8" }}>What it does:</strong> Accepts standard AI mitigation as an official contract assumption to maintain project velocity.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 320,
                color: "#64748b",
                textAlign: "center",
                padding: "20px",
                background: "rgba(248, 250, 252, 0.5)",
                border: "1px dashed #e2e8f0",
                borderRadius: 10,
                gap: 16,
              }}
            >
              <div style={{ background: "#fff7ed", padding: 16, borderRadius: "50%", color: "#ea580c" }}>
                <HelpCircle size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>Risks & Assumptions</h4>
                <p style={{ fontSize: 12, color: "#64748b", maxWidth: 220, margin: "0 auto", lineHeight: 1.5 }}>
                  AI will analyze your brief for gaps, omissions, and ambiguities to raise flags before they become problems.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="panel-action-bar" style={{ marginTop: 24 }}>
        <div className="panel-action-bar-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#2563eb", fontWeight: "bold" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#475569" }}>
            Every interpretation remains directly linked to the source request. Modifying the source request will discard current resolutions.
          </span>
        </div>
        <div className="panel-action-bar-right">
          <span style={{ fontSize: 12, color: "#64748b" }}>Version 1.0</span>
        </div>
      </div>
    </div>
  );
}
