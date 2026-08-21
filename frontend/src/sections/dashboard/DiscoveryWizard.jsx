import { useState, useCallback, useEffect } from "react";
import { api } from "../../lib/api";
import { Sparkles, ArrowRight, Check, RefreshCw, MessageSquareText, RotateCcw, DollarSign, Calendar } from "lucide-react";


/**
 * Requirement Discovery Agent UI (Talent section only).
 *
 * Runs an adaptive, one-question-at-a-time discovery loop against
 * `POST /api/discovery/next`. Prefers multiple-choice answers, adapts to prior
 * answers, and stops once the agent reports `status: "complete"`. On completion
 * it assembles a rich brief string and hands it to `onBriefReady` (which the
 * parent wires to the existing brief-parse flow).
 *
 * Props:
 *   - initialRequest: string  (the client's initial idea text)
 *   - onBriefReady: (briefText: string, brief: object) => void
 */
const DISCOVERY_STORAGE_KEY = "ff_discovery_session_v1";

export function DiscoveryWizard({ initialRequest, onBriefReady }) {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState([]);
  const [turn, setTurn] = useState(null); // latest DiscoveryTurn from the server
  const [customText, setCustomText] = useState("");
  const [numBudget, setNumBudget] = useState("");
  const [numMonths, setNumMonths] = useState("");
  const [done, setDone] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);


  // Restore saved session on mount if available
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(DISCOVERY_STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved && Array.isArray(saved.answers) && saved.turn) {
          setAnswers(saved.answers);
          setTurn(saved.turn);
          setDone(Boolean(saved.done));
          setStarted(true);
          setHasSavedDraft(true);
        }
      }
    } catch {
      /* ignore storage parse errors */
    }
  }, []);

  const saveSession = useCallback((nextAnswers, nextTurn, isDone) => {
    try {
      localStorage.setItem(
        DISCOVERY_STORAGE_KEY,
        JSON.stringify({
          initialRequest,
          answers: nextAnswers,
          turn: nextTurn,
          done: isDone,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      /* ignore storage quota errors */
    }
  }, [initialRequest]);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(DISCOVERY_STORAGE_KEY);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const question = turn?.status === "questioning" ? turn.next_question : null;
  const confidence = turn?.confidence ?? 0;

  const requestTurn = useCallback(
    async (nextAnswers) => {
      setLoading(true);
      setError("");
      try {
        const res = await api.discoveryNext(initialRequest, nextAnswers);
        setTurn(res);
        const isComplete = res.status === "complete" && Boolean(res.brief);
        saveSession(nextAnswers, res, isComplete);

        if (isComplete) {
          setDone(true);
          onBriefReady?.(briefToText(initialRequest, res.brief), res.brief);
        }
      } catch (err) {
        setError(
          err?.status === 503
            ? "AI discovery is not configured on the server (missing GEMINI_API_KEY)."
            : "Couldn't reach the discovery agent. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [initialRequest, onBriefReady, saveSession],
  );

  const start = () => {
    clearSession();
    setStarted(true);
    setAnswers([]);
    setDone(false);
    setHasSavedDraft(false);
    requestTurn([]);
  };

  const resetSession = () => {
    clearSession();
    setStarted(false);
    setAnswers([]);
    setTurn(null);
    setDone(false);
    setHasSavedDraft(false);
  };

  const submitAnswer = (answerText) => {
    if (!question || !answerText?.trim()) return;
    const nextAnswers = [...answers, { question: question.question, answer: answerText.trim() }];
    setAnswers(nextAnswers);
    setCustomText("");
    requestTurn(nextAnswers);
  };

  const handleSubmitNumeric = () => {
    const parts = [];
    if (numBudget?.trim()) {
      const val = Number(numBudget.replace(/[^0-9.]/g, ""));
      parts.push(`Budget: $${val ? val.toLocaleString() : numBudget} USD`);
    }
    if (numMonths?.trim()) {
      const m = Number(numMonths.replace(/[^0-9]/g, ""));
      parts.push(`Target Duration: ${m || numMonths} Month${m === 1 ? "" : "s"}`);
    }
    if (parts.length === 0) return;
    const answerText = parts.join(" | ");
    submitAnswer(answerText);
    setNumBudget("");
    setNumMonths("");
  };


  // ── Intro (before the first question) ──
  if (!started) {
    return (
      <div>
        <div style={introHeader}>
          <MessageSquareText size={16} style={{ color: "#2563eb" }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Guided requirement discovery</span>
        </div>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
          Answer a few quick questions and the AI will build a complete, proposal-ready brief for you.
        </p>
        <button
          type="button"
          className="panel-btn"
          style={{ width: "100%" }}
          onClick={start}
          disabled={!initialRequest?.trim()}
          data-tour="discovery-start"
        >
          <Sparkles size={14} /> Start discovery
        </button>
        {!initialRequest?.trim() && (
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
            Describe your idea above first.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Confidence progress */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{done ? "Discovery complete" : `Question ${answers.length + 1}`}</span>
            {hasSavedDraft && (
              <span style={{ fontSize: 10, background: "#eff6ff", color: "#2563eb", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                Restored draft
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, color: confidence >= 90 ? "#16a34a" : "#2563eb" }}>
              {confidence}% ready
            </span>
            <button
              type="button"
              onClick={resetSession}
              title="Reset discovery session"
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>

          <div
            style={{
              height: "100%",
              width: `${confidence}%`,
              borderRadius: 3,
              background: confidence >= 90 ? "#16a34a" : "linear-gradient(90deg,#2563eb,#7c3aed)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {error && (
        <div style={errorBox}>
          <span>{error}</span>
          <button type="button" className="panel-link" onClick={() => requestTurn(answers)}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 13, padding: "16px 0" }}>
          <RefreshCw size={14} className="spin" /> Thinking…
        </div>
      )}

      {/* Completed */}
      {done && !loading && (
        <div style={completeBox}>
          <Check size={16} style={{ color: "#16a34a" }} />
          <span style={{ fontSize: 13, color: "#166534" }}>
            Brief assembled from {answers.length} answer{answers.length === 1 ? "" : "s"}. Generating your proposal…
          </span>
        </div>
      )}

      {/* Active question */}
      {!loading && !done && question && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            {question.category}
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 12px" }}>
            {question.question}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(question.options || []).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => submitAnswer(opt.label)}
                style={optionBtn}
              >
                <span style={optionKey}>{opt.key}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{opt.label}</span>
                <ArrowRight size={14} style={{ color: "#94a3b8" }} />
              </button>
            ))}
          </div>

          {question.allow_custom && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Or type your custom response</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAnswer(customText)}
                  placeholder="Your answer…"
                  style={customInput}
                />
                <button
                  type="button"
                  className="panel-btn"
                  onClick={() => submitAnswer(customText)}
                  disabled={!customText.trim()}
                >
                  Send
                </button>
              </div>
              <button
                type="button"
                className="panel-link"
                style={{ marginTop: 8, fontSize: 12 }}
                onClick={() => submitAnswer("I don't know")}
              >
                Skip — I don't know
              </button>
            </div>
          )}

          {/* Always Available Numerical Parameters (Budget & Duration) */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed #e2e8f0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <DollarSign size={13} style={{ color: "#16a34a" }} />
              <span>Enter Exact Numerical Budget ($) & Duration (Months)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3, fontWeight: 600 }}>
                  Budget ($ USD)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94a3b8" }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 5000"
                    value={numBudget}
                    onChange={(e) => setNumBudget(e.target.value)}
                    style={{ ...customInput, width: "100%", paddingLeft: 20 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3, fontWeight: 600 }}>
                  Duration (Months)
                </label>
                <div style={{ position: "relative" }}>
                  <Calendar size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="number"
                    min="1"
                    max="36"
                    step="1"
                    placeholder="e.g. 3"
                    value={numMonths}
                    onChange={(e) => setNumMonths(e.target.value)}
                    style={{ ...customInput, width: "100%", paddingLeft: 24 }}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="panel-btn--ghost panel-btn"
              onClick={handleSubmitNumeric}
              disabled={!numBudget.trim() && !numMonths.trim()}
              style={{ width: "100%", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 10px" }}
            >
              <Check size={13} style={{ color: "#16a34a" }} /> Submit Numerical Budget & Timeline
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/** Assemble a readable brief string from the structured brief for the parser. */
function briefToText(initialRequest, b) {
  const lines = [`Project request: ${initialRequest}`, ""];
  const put = (label, val) => {
    if (Array.isArray(val) ? val.length : val) {
      lines.push(`${label}: ${Array.isArray(val) ? val.join(", ") : val}`);
    }
  };
  put("Goal", b.project_goal);
  put("Problem", b.problem_statement);
  put("Target users", b.target_users);
  put("Platform", b.platform);
  put("Industry", b.industry);
  put("Core features", b.core_features);
  put("Nice-to-have features", b.nice_to_have_features);
  put("Integrations", b.integrations);
  put("Authentication", b.authentication);
  if (b.admin_panel) lines.push("Admin panel: required");
  put("AI features", b.ai_features);
  put("Timeline", b.timeline);
  put("Budget", b.budget);
  put("Design style", b.design_style);
  put("Technical preferences", b.technical_preferences);
  put("Existing assets", b.existing_assets);
  put("Success criteria", b.success_criteria);
  return lines.join("\n");
}

/* ── inline styles (match existing panel look) ── */
const introHeader = { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 };
const errorBox = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a",
  borderRadius: 8, padding: "8px 12px", marginBottom: 12,
};
const completeBox = {
  display: "flex", alignItems: "center", gap: 8,
  background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px",
};
const optionBtn = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px",
  border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer",
  fontSize: 13, color: "#0f172a", textAlign: "left",
};
const optionKey = {
  width: 22, height: 22, borderRadius: 6, background: "#eff6ff", color: "#2563eb",
  display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
};
const customInput = {
  flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13,
};
