import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Check,
  Eye,
  Layers,
  RefreshCw,
  Send,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import { api, ApiError } from "../../lib/api";
import { useLandingStore } from "../../store/useLandingStore";
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

const STATUS_COPY = {
  suggested: { label: "Suggested", color: "#2563eb", background: "#eff6ff" },
  shortlisted: { label: "Shortlisted", color: "#7c3aed", background: "#f5f3ff" },
  invited: { label: "Invitation sent", color: "#c2410c", background: "#fff7ed" },
  interviewing: { label: "Interviewing", color: "#0369a1", background: "#ecfeff" },
  selected: { label: "Selected", color: "#15803d", background: "#f0fdf4" },
  archived: { label: "Archived", color: "#64748b", background: "#f8fafc" },
};

function barColor(value) {
  if (value >= 80) return "#16a34a";
  if (value >= 60) return "#2563eb";
  return "#ea580c";
}

function actionForStatus(status) {
  if (status === "suggested") return ["shortlist", "invite"];
  if (status === "shortlisted") return ["invite"];
  if (status === "invited") return ["start_interview"];
  if (status === "interviewing") return ["select"];
  return [];
}

function actionLabel(action) {
  return {
    shortlist: "Shortlist",
    invite: "Invite",
    start_interview: "Start interview",
    select: "Select candidate",
  }[action];
}

export function MatchResults() {
  const {
    user,
    parsedProposal,
    parsedProposalId,
    matchResults: workflow,
    matchError: notice,
    matchingLoading: loading,
    matchActionLoading,
    loadClientMatches,
    runMatchFreelancers,
    updateClientMatch,
    setDashboardTab,
  } = useLandingStore();
  const [expanded, setExpanded] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (parsedProposalId && user?.role === "client") loadClientMatches();
  }, [parsedProposalId, user?.role, loadClientMatches]);

  const funnel = useMemo(() => {
    const counts = {
      suggested: 0,
      shortlisted: 0,
      invited: 0,
      interviewing: 0,
      selected: 0,
    };
    for (const candidate of workflow?.candidates || []) {
      if (Object.hasOwn(counts, candidate.status)) counts[candidate.status] += 1;
    }
    return counts;
  }, [workflow]);

  const openProfile = async (candidate) => {
    if (!parsedProposalId) return;
    setViewing({ id: candidate.freelancerId, name: candidate.name });
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      setProfile(await api.candidateProfile(candidate.freelancerId, parsedProposalId));
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

  const continueToAgreement = () => {
    setDashboardTab("agreement-composer");
    window.location.hash = "#/dashboard/agreement-composer";
  };

  const renderCandidate = (candidate, index, supplementary = false) => {
    const status = STATUS_COPY[candidate.status] || STATUS_COPY.suggested;
    const actions = actionForStatus(candidate.status);
    const isBusy = matchActionLoading === candidate.freelancerId;

    return (
      <div
        key={candidate.freelancerId}
        style={{
          border: supplementary ? "1px dashed #c7d2fe" : "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 16,
          marginBottom: 12,
          background: supplementary ? "#f8faff" : "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-hidden="true"
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
            {candidate.name.split(" ").map((name) => name[0]).join("")}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                {supplementary ? "" : `#${index + 1} `}
                {candidate.name}
              </span>
              {candidate.factorBreakdown.sbtCredentials > 0 && (
                <Award size={14} style={{ color: "#6d4aff" }} title="Verified credentials" />
              )}
              <span
                style={{
                  padding: "3px 7px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  color: status.color,
                  background: status.background,
                }}
              >
                {status.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{candidate.title}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: barColor(candidate.compositeScore) }}>
              {Math.round(candidate.compositeScore)}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>fit score</div>
          </div>
        </div>

        {supplementary && candidate.coversSkills?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {candidate.coversSkills.map((skill) => (
              <span key={skill} className="panel-badge panel-badge--blue" style={{ fontSize: 11 }}>
                <Check size={11} /> covers {skill}
              </span>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          {candidate.fitReasons.slice(0, 3).map((reason) => (
            <div
              key={reason}
              style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, color: "#475569", marginBottom: 4 }}
            >
              <Check size={14} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
              {reason}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {candidate.skillGaps.map((gap) => (
            <span key={gap} className="panel-badge panel-badge--orange" style={{ fontSize: 11 }}>
              <AlertTriangle size={11} /> {gap}
            </span>
          ))}
          {candidate.riskFlags.map((flag) => (
            <span key={flag} className="panel-badge panel-badge--gray" style={{ fontSize: 11 }}>
              {flag}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="panel-link" onClick={() => openProfile(candidate)}>
            <Eye size={14} /> View evidence
          </button>
          <button
            type="button"
            className="panel-link"
            onClick={() => setExpanded(expanded === candidate.freelancerId ? null : candidate.freelancerId)}
          >
            {expanded === candidate.freelancerId ? "Hide" : "Show"} score breakdown
          </button>
          <span style={{ flex: 1 }} />
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className={action === "invite" || action === "select" ? "panel-btn" : "panel-btn--ghost panel-btn"}
              onClick={() => updateClientMatch(candidate.freelancerId, action)}
              disabled={isBusy}
              style={{ fontSize: 12 }}
            >
              {isBusy ? <RefreshCw size={13} className="animate-spin" /> : action === "invite" ? <Send size={13} /> : <UserCheck size={13} />}
              {actionLabel(action)}
            </button>
          ))}
          {candidate.status === "selected" && (
            <button type="button" className="panel-btn" onClick={continueToAgreement} style={{ fontSize: 12 }}>
              <Check size={13} /> Continue to agreement
            </button>
          )}
        </div>

        {expanded === candidate.freelancerId && (
          <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
            {Object.entries(candidate.factorBreakdown).map(([key, value]) => (
              <div key={key} style={{ padding: "6px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>{FACTOR_LABELS[key] || key}</span>
                  <span style={{ color: barColor(value), fontWeight: 600 }}>{value}</span>
                </div>
                <div style={{ height: 5, background: "#f1f5f9", borderRadius: 4 }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: barColor(value), borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (user?.role && user.role !== "client") {
    return (
      <div className="panel-card">
        <h1 className="panel-page-title">Client hiring matches</h1>
        <p className="panel-page-subtitle">This workspace is reserved for the client hiring workflow.</p>
      </div>
    );
  }

  const primary = (workflow?.candidates || []).filter((candidate) => candidate.matchType !== "supplementary");
  const supplementary = (workflow?.candidates || []).filter((candidate) => candidate.matchType === "supplementary");
  const coverage = workflow?.coverage;

  return (
    <div>
      <div className="panel-page-header">
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
          {parsedProposal?.project_summary ? parsedProposal.project_summary.split(".")[0].slice(0, 80) : "No active project brief"}
        </p>
        <h1 className="panel-page-title" data-tour="matches-header">
          Client hiring matches
        </h1>
        <p className="panel-page-subtitle">A clear shortlist, controlled invitations, and a direct hand-off to agreement.</p>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="panel-card-header">
          <h2 className="panel-card-title"><Users size={16} style={{ verticalAlign: "-2px", marginRight: 6, color: "#2563eb" }} />Hiring funnel</h2>
          <button type="button" className="panel-btn" onClick={runMatchFreelancers} disabled={loading || !parsedProposalId}>
            {loading ? <><RefreshCw size={14} className="animate-spin" /> Matching…</> : <><Sparkles size={14} />{workflow ? "Refresh shortlist" : "Generate shortlist"}</>}
          </button>
        </div>
        <div className="panel-grid panel-grid--3" style={{ marginTop: 10 }}>
          {[
            ["Suggested", funnel.suggested],
            ["Shortlisted", funnel.shortlisted],
            ["Invited", funnel.invited],
            ["Interviewing", funnel.interviewing],
            ["Selected", funnel.selected],
          ].map(([label, count]) => (
            <div key={label} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", background: "#fafcff" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{count}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {workflow && coverage && (
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
            <span>Required-skill coverage</span>
            <span style={{ color: coverage.coveragePct >= 80 ? "#16a34a" : "#ea580c" }}>{coverage.coveragePct}%</span>
          </div>
          <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4 }}>
            <div style={{ width: `${coverage.coveragePct}%`, height: "100%", borderRadius: 4, background: coverage.coveragePct >= 80 ? "#16a34a" : "#ea580c" }} />
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0" }}>
            {coverage.uncoveredSkills.length
              ? `Open skills: ${coverage.uncoveredSkills.join(", ")}`
              : "The current shortlist covers every required skill."}
          </p>
        </div>
      )}

      <div className="panel-card">
        <div className="panel-card-header">
          <h2 className="panel-card-title">Shortlist</h2>
          {workflow && <span style={{ fontSize: 12, color: "#94a3b8" }}>Evaluated {workflow.totalCandidatesEvaluated} candidates</span>}
        </div>
        {!workflow ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0" }}>
            Parse a brief, then generate a compact shortlist of verified freelancers. Client decisions are saved here, not lost when you switch tabs.
          </p>
        ) : (
          <>
            {primary.map((candidate, index) => renderCandidate(candidate, index))}
            {supplementary.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe", marginBottom: 12 }}>
                  <Layers size={16} style={{ color: "#4f46e5" }} />
                  <span style={{ fontSize: 13, color: "#3730a3", fontWeight: 700 }}>Complementary team candidates</span>
                </div>
                {supplementary.map((candidate, index) => renderCandidate(candidate, index, true))}
              </div>
            )}
          </>
        )}
        {notice && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 12, color: "#c2410c", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} /> {notice}
          </div>
        )}
      </div>

      {viewing && (
        <div className="fixflow-modal-overlay" onClick={closeProfile}>
          <div className="fixflow-modal-content" style={{ maxWidth: 1200, width: "95%" }} onClick={(event) => event.stopPropagation()}>
            <div className="fixflow-modal-header">
              <h3 className="fixflow-modal-title"><Users size={18} style={{ color: "#2563eb" }} />{viewing.name} · verified evidence</h3>
              <button type="button" className="panel-btn--ghost" onClick={closeProfile} aria-label="Close candidate evidence" style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div className="fixflow-modal-body fixflow-custom-scroll">
              {profileLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, color: "#64748b" }}><RefreshCw size={16} className="animate-spin" /> Loading profile…</div>
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
