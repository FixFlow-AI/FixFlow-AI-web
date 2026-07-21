import { useState } from "react";
import {
  Users,
  RefreshCw,
  Sparkles,
  Award,
  AlertTriangle,
  Check,
  X,
  Layers,
  Eye,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";
import { FreelancerAnalytics } from "./FreelancerAnalytics";

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

  // Candidate profile modal (client viewing a freelancer's analytics).
  const [viewing, setViewing] = useState(null); // { id, name }
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const runMatch = async () => {
    await runMatchFreelancers();
  };

  const openProfile = async (c) => {
    setViewing({ id: c.freelancerId, name: c.name });
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      setProfile(await api.candidateProfile(c.freelancerId));
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : "Could not load this candidate's profile.",
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setViewing(null);
    setProfile(null);
    setProfileError("");
  };

  const coverage = result?.coverage;

  const renderCandidate = (c, idx, supplementary = false) => (
    <div
      key={c.freelancerId}
      style={{
        border: supplementary ? "1px dashed #c7d2fe" : "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        background: supplementary ? "#f8faff" : "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: supplementary ? "#eef2ff" : "#eff6ff",
            color: supplementary ? "#4f46e5" : "#2563eb",
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
              {supplementary ? "" : `#${idx + 1} `}
              {c.name}
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

      {/* Supplementary: which gap skills this person covers */}
      {supplementary && c.coversSkills?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {c.coversSkills.map((s, i) => (
            <span key={i} className="panel-badge panel-badge--blue" style={{ fontSize: 11 }}>
              <Check size={11} /> covers {s}
            </span>
          ))}
        </div>
      )}

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

      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <button type="button" className="panel-link" onClick={() => openProfile(c)}>
          <Eye size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          View profile
        </button>
        <button
          type="button"
          className="panel-link"
          onClick={() => setExpanded(expanded === c.freelancerId ? null : c.freelancerId)}
        >
          {expanded === c.freelancerId ? "Hide" : "Show"} score breakdown
        </button>
      </div>

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
  );

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
              Evaluated {result.totalCandidatesEvaluated} candidates · showing top{" "}
              {result.shortlist.length}
            </p>

            {/* Skill-coverage summary — can this shortlist deliver the project? */}
            {coverage && coverage.requiredSkills.length > 0 && (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 14,
                  background: "#fafcff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: 8,
                  }}
                >
                  <span>Required-skill coverage</span>
                  <span style={{ color: coverage.coveragePct >= 80 ? "#16a34a" : "#ea580c" }}>
                    {coverage.coveragePct}%
                  </span>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4 }}>
                  <div
                    style={{
                      width: `${coverage.coveragePct}%`,
                      height: "100%",
                      borderRadius: 4,
                      background: coverage.coveragePct >= 80 ? "#16a34a" : "#ea580c",
                    }}
                  />
                </div>
                {coverage.uncoveredSkills.length > 0 ? (
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                    Gaps the shortlist doesn't cover:{" "}
                    {coverage.uncoveredSkills.map((s, i) => (
                      <span key={i} className="panel-badge panel-badge--orange" style={{ fontSize: 11, marginRight: 4 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#16a34a", marginTop: 8 }}>
                    <Check size={12} style={{ verticalAlign: "-2px" }} /> The shortlist covers every required skill.
                  </div>
                )}
              </div>
            )}

            {result.shortlist.map((c, idx) => renderCandidate(c, idx))}

            {/* Supplementary team composition — added when the shortlist can't
                deliver alone (few strong fits or uncovered skills). */}
            {result.supplementary?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#eef2ff",
                    border: "1px solid #c7d2fe",
                    marginBottom: 12,
                  }}
                >
                  <Layers size={16} style={{ color: "#4f46e5", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#3730a3" }}>
                      Build a team to complete the project
                    </div>
                    <div style={{ fontSize: 12, color: "#4f46e5" }}>
                      {coverage?.uncoveredSkills.length > 0
                        ? "The top matches don't cover every requirement — these freelancers fill the remaining gaps."
                        : "Few strong single-fit candidates were found — these profiles add capacity to deliver together."}
                    </div>
                  </div>
                </div>
                {result.supplementary.map((c, idx) => renderCandidate(c, idx, true))}
              </div>
            )}
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

      {/* Candidate profile modal — the freelancer's Analytics dashboard, read-only */}
      {viewing && (
        <div className="fixflow-modal-overlay" onClick={closeProfile}>
          <div
            className="fixflow-modal-content"
            style={{ maxWidth: 1200, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fixflow-modal-header">
              <h3 className="fixflow-modal-title">
                <Users size={18} style={{ color: "#2563eb" }} />
                {viewing.name} · Candidate analytics
              </h3>
              <button
                type="button"
                className="panel-btn--ghost"
                onClick={closeProfile}
                style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fixflow-modal-body fixflow-custom-scroll">
              {profileLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, color: "#64748b" }}>
                  <RefreshCw size={16} className="animate-spin" /> Loading profile…
                </div>
              ) : profileError ? (
                <div style={{ padding: 24, color: "#b91c1c", fontSize: 14 }}>{profileError}</div>
              ) : (
                <FreelancerAnalytics externalProfile={profile} readOnly />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
