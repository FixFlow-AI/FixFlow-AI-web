import { useState } from "react";
import {
  Users,
  RefreshCw,
  Sparkles,
  Award,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";

const FACTOR_LABELS = {
  skillOverlap: "Skill overlap",
  githubSignal: "GitHub signal",
  domainExperience: "Domain experience",
  budgetAlignment: "Budget alignment",
  reputation: "Reputation",
  availability: "Availability",
  sbtCredentials: "SBT credentials",
};

function barColor(v) {
  if (v >= 80) return "#16a34a";
  if (v >= 60) return "#2563eb";
  return "#ea580c";
}

export function MatchResults() {
  const {
    parsedProposal,
    matchResults: result,
    matchError: notice,
    matchingLoading: loading,
    runMatchFreelancers,
  } = useLandingStore();
  const [expanded, setExpanded] = useState(null);

  const runMatch = async () => {
    // Fire the store-level thunk — survives tab navigation
    await runMatchFreelancers();
  };

  return (
    <div>
      <div className="panel-page-header">
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
          {parsedProposal?.project_summary
            ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
            : "No active project brief"}
        </p>
        <h1 className="panel-page-title">Matched candidates</h1>
        <p className="panel-page-subtitle">
          Zero-noise shortlist · ranked by 7-factor fit, not bids
        </p>
      </div>

      <div className="panel-card">
        <div className="panel-card-header">
          <h2 className="panel-card-title">
            <Users size={16} style={{ verticalAlign: "-2px", marginRight: 6, color: "#2563eb" }} />
            Shortlist
          </h2>
          <button type="button" className="panel-btn" onClick={runMatch} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Matching…
              </>
            ) : (
              <>
                <Sparkles size={14} /> {result ? "Re-run match" : "Generate shortlist"}
              </>
            )}
          </button>
        </div>

        {!result ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0" }}>
            Generate a ranked shortlist of pre-qualified candidates for this brief. Each candidate
            is scored across skill overlap, GitHub signal, domain experience, budget fit,
            reputation, availability, and verified credentials.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
              Evaluated {result.totalCandidatesEvaluated} candidates · showing top {result.shortlist.length}
            </p>
            {result.shortlist.map((c, idx) => (
              <div
                key={c.freelancerId}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#eff6ff",
                      color: "#2563eb",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {c.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                        #{idx + 1} {c.name}
                      </span>
                      {c.factorBreakdown.sbtCredentials > 0 && (
                        <Award size={14} style={{ color: "#6d4aff" }} title="Verified credentials" />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{c.title}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: barColor(c.compositeScore),
                      }}
                    >
                      {Math.round(c.compositeScore)}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>fit score</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  {c.fitReasons.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                        fontSize: 13,
                        color: "#475569",
                        marginBottom: 4,
                      }}
                    >
                      <Check size={14} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
                      {r}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {c.skillGaps.map((g, i) => (
                    <span key={i} className="panel-badge panel-badge--orange" style={{ fontSize: 11 }}>
                      <AlertTriangle size={11} /> {g}
                    </span>
                  ))}
                  {c.riskFlags.map((f, i) => (
                    <span key={`r${i}`} className="panel-badge panel-badge--gray" style={{ fontSize: 11 }}>
                      {f}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  className="panel-link"
                  style={{ marginTop: 10 }}
                  onClick={() => setExpanded(expanded === c.freelancerId ? null : c.freelancerId)}
                >
                  {expanded === c.freelancerId ? "Hide" : "Show"} score breakdown
                </button>

                {expanded === c.freelancerId && (
                  <div style={{ marginTop: 10 }}>
                    {Object.entries(c.factorBreakdown).map(([k, v]) => (
                      <div key={k} style={{ padding: "6px 0" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            color: "#64748b",
                            marginBottom: 4,
                          }}
                        >
                          <span>{FACTOR_LABELS[k] ?? k}</span>
                          <span style={{ color: barColor(v), fontWeight: 600 }}>{v}</span>
                        </div>
                        <div style={{ height: 5, background: "#f1f5f9", borderRadius: 4 }}>
                          <div
                            style={{
                              width: `${Math.max(0, Math.min(100, v))}%`,
                              height: "100%",
                              background: barColor(v),
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {notice && (
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
            <AlertTriangle size={14} /> {notice}
          </div>
        )}
      </div>
    </div>
  );
}
