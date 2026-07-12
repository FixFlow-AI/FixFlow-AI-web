import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Code2,
  FolderGit2,
  Activity,
  Gauge,
  Languages,
  RefreshCw,
  Loader2,
  AlertCircle,
  Lock,
  Star,
  GitCommitHorizontal,
  Sparkles,
  MapPin,
  Building2,
  Users,
  Github,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";

/**
 * Freelancer Analytics (roles/01) — a fully dynamic dashboard rendered from the
 * verified GitHub scan stored in the database. Nothing here is hardcoded: every
 * chart, metric, and label is derived from /api/freelancer/profile.
 *
 * The GitHub API is NOT called on load. It is only invoked when the freelancer
 * clicks "Re-analyze", which opens a live SSE stream and updates the charts as
 * each segment lands.
 */

const BAND_LABEL = {
  emerging: { text: "Emerging", color: "#dc2626", bg: "#fef2f2" },
  developing: { text: "Developing", color: "#ca8a04", bg: "#fefce8" },
  match_ready: { text: "Match-Ready", color: "#16a34a", bg: "#f0fdf4" },
};

const CATEGORY_LABEL = {
  language: "Languages",
  framework: "Frameworks",
  tool: "Tools & Infra",
  domain: "Domains",
};

// A stable, deterministic color per label — so charts are dynamic yet consistent.
const PALETTE = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#0d9488",
  "#9333ea", "#c026d3", "#65a30d", "#e11d48", "#0284c7",
];
function colorFor(label, index) {
  if (typeof index === "number") return PALETTE[index % PALETTE.length];
  let hash = 0;
  for (let i = 0; i < String(label).length; i += 1) {
    hash = (hash * 31 + String(label).charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

const FACTOR_LABELS = {
  skillBreadthDepth: "Skill breadth & depth",
  projectStrength: "Project strength",
  recency: "Recency",
  contributionVolume: "Contribution volume",
  documentation: "Documentation",
};

export function FreelancerAnalytics() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const esRef = useRef(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = await api.freelancerProfile();
      setProfile(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    return () => {
      if (esRef.current) esRef.current.close();
    };
  }, [loadProfile]);

  const startRescan = async () => {
    setScanning(true);
    setScanNote("Requesting a fresh GitHub analysis…");
    setError("");
    try {
      const { scanJobId } = await api.rescanGithub();
      if (!scanJobId) throw new Error("No scan job was created.");
      openStream(scanJobId);
    } catch (err) {
      setScanning(false);
      setScanNote("");
      setError(
        err instanceof ApiError ? err.message : "Could not start the re-analysis.",
      );
    }
  };

  const openStream = (jobId) => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(api.scanStreamUrl(jobId));
    esRef.current = es;
    setScanNote("Analyzing your repositories… segments appear as they finish.");

    es.addEventListener("segment_ready", (e) => {
      const { segment, payload } = JSON.parse(e.data);
      setProfile((prev) => {
        const next = { ...(prev || {}) };
        if (segment === "skills") next.skills = payload || [];
        if (segment === "projects") next.projects = payload || [];
        if (segment === "experience") {
          next.latestJob = { ...(next.latestJob || {}), experience: payload || null };
        }
        return next;
      });
    });

    es.addEventListener("scan_complete", (e) => {
      const data = JSON.parse(e.data);
      setProfile((prev) => {
        const next = { ...(prev || {}) };
        if (data.confidence) next.confidence = data.confidence;
        if (data.languages) {
          next.latestJob = { ...(next.latestJob || {}), languages: data.languages };
        }
        return next;
      });
      es.close();
      setScanning(false);
      setScanNote("");
      // Reconcile with the persisted record (authoritative).
      loadProfile();
    });

    es.addEventListener("scan_error", (e) => {
      const data = JSON.parse(e.data);
      es.close();
      setScanning(false);
      setScanNote("");
      setError(data.error || "The re-analysis failed. Please try again.");
    });

    es.onerror = () => {
      es.close();
      setScanning(false);
      setScanNote("");
      loadProfile();
    };
  };

  if (loading) {
    return (
      <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: "#2563eb" }} />
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>Loading your analytics…</p>
      </div>
    );
  }

  const skills = profile?.skills || [];
  const projects = profile?.projects || [];
  const confidence = profile?.confidence || null;
  const experience = profile?.latestJob?.experience || null;
  const languages = profile?.latestJob?.languages || {};
  const job = profile?.latestJob || null;
  const snapshot = profile?.snapshot || null;
  const hasData = skills.length > 0 || projects.length > 0 || !!experience || !!confidence;

  const scannedAt = job?.finishedAt || job?.updatedAt || null;

  return (
    <div>
      <div
        className="panel-page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}
      >
        <div>
          <h1 className="panel-page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart3 size={22} /> Skill Analytics
          </h1>
          <p className="panel-page-subtitle">
            A live view of your verified skills, projects, and experience — derived from your GitHub code.
            {scannedAt && (
              <span style={{ color: "#94a3b8" }}>
                {" "}Last analyzed {new Date(scannedAt).toLocaleString()}.
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="panel-btn"
          onClick={startRescan}
          disabled={scanning}
          style={{ whiteSpace: "nowrap" }}
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {scanning ? "Analyzing…" : "Re-analyze from GitHub"}
        </button>
      </div>

      {scanNote && (
        <div style={noteStyle("#eff6ff", "#bfdbfe", "#1e40af")}>
          <Sparkles size={15} /> {scanNote}
        </div>
      )}
      {error && (
        <div style={noteStyle("#fef2f2", "#fee2e2", "#b91c1c")}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!hasData ? (
        <>
        {snapshot && <ProfileSnapshotCard snapshot={snapshot} username={job?.githubUsername} />}
        <div className="panel-card" style={{ textAlign: "center", padding: 40 }}>
          <BarChart3 size={32} style={{ color: "#94a3b8" }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 4px" }}>No analytics yet</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
            Run an analysis of your GitHub profile to generate your verified skill dashboard.
          </p>
          <button type="button" className="panel-btn" onClick={startRescan} disabled={scanning}>
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {scanning ? "Analyzing…" : "Analyze my GitHub"}
          </button>
        </div>
        </>
      ) : (
        <>
          {/* GitHub profile snapshot (captured at sign-up) */}
          {snapshot && <ProfileSnapshotCard snapshot={snapshot} username={job?.githubUsername} />}

          {/* Top row: confidence + languages */}
          <div className="panel-grid panel-grid--2" style={{ marginBottom: 20 }}>
            <ConfidenceCard confidence={confidence} />
            <LanguagesCard languages={languages} />
          </div>

          {/* Experience metrics */}
          {experience && (
            <div className="panel-card" style={{ marginBottom: 20 }}>
              <div className="panel-card-header">
                <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Activity size={16} /> Experience signals
                </h2>
                {job?.reposDiscovered != null && (
                  <span className="panel-badge panel-badge--gray">
                    {job.reposAnalyzed}/{job.reposDiscovered} repos analyzed
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 16,
                }}
              >
                <Metric
                  icon={GitCommitHorizontal}
                  label="Commits authored"
                  value={experience.totalCommits}
                  hint="Commits you personally authored across analyzed repos"
                />
                {experience.linesAuthored > 0 && (
                  <Metric
                    icon={Code2}
                    label="Lines authored"
                    value={compact(experience.linesAuthored)}
                    hint="Net lines you wrote in your top repositories"
                  />
                )}
                <Metric icon={FolderGit2} label="Repos analyzed" value={experience.reposAnalyzed} />
                {experience.pullRequests != null && (
                  <Metric icon={Activity} label="Pull requests" value={experience.pullRequests} hint="PRs opened in the last year" />
                )}
                <Metric icon={Activity} label="Active years" value={experience.activeYears} />
                {experience.accountAgeYears > 0 && (
                  <Metric icon={Gauge} label="Account age" value={`${experience.accountAgeYears}y`} />
                )}
                <Metric icon={Star} label="Avg stars" value={experience.avgStars} />
                <Metric icon={Code2} label="Team repos" value={experience.collaborationRepos} hint="Others' repos you committed to" />
                <Metric icon={Gauge} label="Docs quality" value={`${experience.documentationQuality}%`} />
              </div>
            </div>
          )}

          {/* Skills by category */}
          <SkillsCard skills={skills} />

          {/* Projects */}
          <ProjectsCard projects={projects} />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── Profile snapshot ─────────────────────────── */

function ProfileSnapshotCard({ snapshot, username }) {
  const handle = snapshot.githubUsername || username;
  const chips = [
    snapshot.company && { icon: Building2, text: snapshot.company },
    snapshot.location && { icon: MapPin, text: snapshot.location },
    typeof snapshot.followers === "number" && { icon: Users, text: `${snapshot.followers} followers` },
    typeof snapshot.publicRepos === "number" && { icon: FolderGit2, text: `${snapshot.publicRepos} public repos` },
  ].filter(Boolean);

  return (
    <div className="panel-card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#0f172a",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <Github size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              {snapshot.name || handle}
            </span>
            {handle && (
              <a
                href={`https://github.com/${handle}`}
                target="_blank"
                rel="noreferrer"
                className="panel-badge panel-badge--gray"
                style={{ fontSize: 11, textDecoration: "none" }}
              >
                @{handle}
              </a>
            )}
          </div>
          {snapshot.bio && (
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0", lineHeight: 1.5 }}>
              {snapshot.bio}
            </p>
          )}
          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              {chips.map((c, i) => {
                const Icon = c.icon;
                return (
                  <span
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}
                  >
                    <Icon size={13} /> {c.text}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Confidence ─────────────────────────── */

function ConfidenceCard({ confidence }) {
  const band = confidence ? BAND_LABEL[confidence.band] || BAND_LABEL.developing : null;
  const score = confidence?.score ?? 0;
  const factors = confidence?.factorBreakdown || {};
  return (
    <div className="panel-card">
      <div className="panel-card-header">
        <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Gauge size={16} /> Profile confidence
        </h2>
        {band && (
          <span className="panel-badge" style={{ background: band.bg, color: band.color, fontWeight: 700 }}>
            {band.text}
          </span>
        )}
      </div>
      {!confidence ? (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Confidence appears once an analysis completes.</p>
      ) : (
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <ScoreRing score={score} color={band?.color || "#2563eb"} />
          <div style={{ flex: 1, minWidth: 200 }}>
            {Object.keys(FACTOR_LABELS).map((key) => (
              <BarRow
                key={key}
                label={FACTOR_LABELS[key]}
                value={factors[key] ?? 0}
                max={100}
                suffix=""
                color={band?.color || "#2563eb"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score, color }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div style={{ position: "relative", width: 120, height: 120 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{clamped}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>/ 100</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Languages ─────────────────────────── */

function LanguagesCard({ languages }) {
  const entries = Object.entries(languages || {})
    .filter(([, pct]) => pct > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="panel-card">
      <div className="panel-card-header">
        <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Languages size={16} /> Language distribution
        </h2>
      </div>
      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>No language data available yet.</p>
      ) : (
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Donut entries={entries} />
          <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.slice(0, 8).map(([name, pct], i) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: colorFor(name, i),
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "#334155", fontWeight: 600, flex: 1 }}>{name}</span>
                <span style={{ color: "#94a3b8" }}>{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Donut({ entries }) {
  const total = entries.reduce((sum, [, pct]) => sum + pct, 0) || 1;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  return (
    <div style={{ position: "relative", width: 120, height: 120 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {entries.map(([name, pct], i) => {
          const fraction = pct / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const offset = -(cumulative / total) * circumference;
          cumulative += pct;
          return (
            <circle
              key={name}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={colorFor(name, i)}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
            {entries.length}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>languages</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Skills ─────────────────────────── */

function SkillsCard({ skills }) {
  const grouped = skills.reduce((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});
  const order = ["language", "framework", "tool", "domain"];
  const categories = order.filter((c) => grouped[c]?.length);

  return (
    <div className="panel-card" style={{ marginBottom: 20 }}>
      <div className="panel-card-header">
        <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Code2 size={16} /> Verified skills
          <span className="panel-badge panel-badge--gray">{skills.length}</span>
        </h2>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
          <Lock size={12} /> AI-verified · not editable
        </span>
      </div>
      {skills.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>No skills detected yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {categories.map((cat) => {
            const list = [...grouped[cat]].sort((a, b) => b.confidence - a.confidence);
            return (
              <div key={cat}>
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#94a3b8",
                    margin: "0 0 10px",
                  }}
                >
                  {CATEGORY_LABEL[cat] || cat}
                </h3>
                {list.map((s) => (
                  <BarRow
                    key={s.name}
                    label={s.name}
                    value={s.confidence}
                    max={100}
                    suffix="%"
                    color={confidenceColor(s.confidence)}
                    title={`Proven by ${s.evidence?.length || 0} repo(s)`}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function confidenceColor(c) {
  if (c >= 75) return "#16a34a";
  if (c >= 50) return "#ca8a04";
  return "#dc2626";
}

/* ─────────────────────────── Projects ─────────────────────────── */

function ProjectsCard({ projects }) {
  const sorted = [...projects].sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0));
  return (
    <div className="panel-card">
      <div className="panel-card-header">
        <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FolderGit2 size={16} /> Top projects
          <span className="panel-badge panel-badge--gray">{projects.length}</span>
        </h2>
      </div>
      {projects.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>No projects detected yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {sorted.map((p) => (
            <div
              key={p.repoName}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", wordBreak: "break-word" }}>
                  {p.repoName}
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <Star size={12} /> {p.stars}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{p.summary}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {p.domain && (
                  <span className="panel-badge panel-badge--blue" style={{ fontSize: 10 }}>{p.domain}</span>
                )}
                {(p.stack || []).slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="panel-badge"
                    style={{ fontSize: 10, background: "#f8fafc", color: "#475569" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              {typeof p.commitShare === "number" && (
                <div style={{ marginTop: 2 }}>
                  <BarRow
                    label="Your authorship"
                    value={p.commitShare}
                    max={100}
                    suffix="%"
                    color="#4f46e5"
                    compact
                    title="Share of this repo's commits/code you authored"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Primitives ─────────────────────────── */

function BarRow({ label, value, max = 100, suffix = "", color = "#2563eb", title, compact }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
  return (
    <div style={{ marginBottom: compact ? 0 : 10 }} title={title}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#334155", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#94a3b8" }}>
          {value}
          {suffix}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 4,
            background: color,
            transition: "width 600ms ease",
          }}
        />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }} title={hint}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8" }}>
        {Icon && <Icon size={14} />}
        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{value ?? 0}</div>
    </div>
  );
}

function compact(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

function noteStyle(bg, border, color) {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    background: bg,
    border: `1px solid ${border}`,
    color,
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
  };
}
