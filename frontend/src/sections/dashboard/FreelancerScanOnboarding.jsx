import { useEffect, useRef, useState } from "react";
import {
  Github,
  Lock,
  Code2,
  FolderGit2,
  Activity,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api } from "../../lib/api";

/**
 * Freelancer GitHub onboarding — live streamed segments (roles/01).
 *
 * Opens an SSE stream to /api/freelancer/scan/:jobId/stream and reveals each
 * segment (Skills, Projects, Experience) the moment it lands, then shows the
 * profile confidence. Skills are AI-verified and read-only (no edit control).
 */

const BAND_LABEL = {
  emerging: { text: "Emerging", color: "#dc2626", bg: "#fef2f2" },
  developing: { text: "Developing", color: "#ca8a04", bg: "#fefce8" },
  match_ready: { text: "Match-Ready", color: "#16a34a", bg: "#f0fdf4" },
};

function SegmentCard({ title, icon: Icon, state, children }) {
  const analyzing = state === "pending" || state === "running" || !state;
  return (
    <div className="panel-card" style={{ minHeight: 180 }}>
      <div className="panel-card-header">
        <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={16} /> {title}
        </h2>
        {analyzing ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2563eb" }}>
            <Loader2 size={13} className="animate-spin" /> Analyzing…
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#16a34a" }}>
            <CheckCircle2 size={13} /> Ready
          </span>
        )}
      </div>
      {analyzing ? (
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
          Researching your repositories… this can take a minute.
        </p>
      ) : (
        children
      )}
    </div>
  );
}

export function FreelancerScanOnboarding() {
  const [skills, setSkills] = useState(null);
  const [projects, setProjects] = useState(null);
  const [experience, setExperience] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [seg, setSeg] = useState({ skills: "pending", projects: "pending", experience: "pending" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    const jobId = sessionStorage.getItem("ff_scan_job_id");

    // No live job (e.g. returning later / page reload) → load persisted profile.
    if (!jobId) {
      api
        .freelancerProfile()
        .then((p) => {
          if (p.skills?.length) setSkills(p.skills);
          if (p.projects?.length) setProjects(p.projects);
          if (p.latestJob?.experience) setExperience(p.latestJob.experience);
          if (p.confidence) setConfidence(p.confidence);
          if (p.latestJob?.segmentStatus) setSeg(p.latestJob.segmentStatus);
          if (p.latestJob?.status === "complete") setDone(true);
        })
        .catch(() => setError("Could not load your profile yet."));
      return;
    }

    const es = new EventSource(api.scanStreamUrl(jobId));
    esRef.current = es;

    es.addEventListener("segment_ready", (e) => {
      const { segment, state, payload } = JSON.parse(e.data);
      setSeg((s) => ({ ...s, [segment]: state || "done" }));
      if (segment === "skills") setSkills(payload || []);
      if (segment === "projects") setProjects(payload || []);
      if (segment === "experience") setExperience(payload || null);
    });

    es.addEventListener("scan_complete", (e) => {
      const data = JSON.parse(e.data);
      if (data.confidence) setConfidence(data.confidence);
      setDone(true);
      es.close();
      sessionStorage.removeItem("ff_scan_job_id");
    });

    es.addEventListener("scan_error", (e) => {
      const data = JSON.parse(e.data);
      setError(data.error || "The scan failed. You can retry from settings.");
      es.close();
    });

    es.onerror = () => {
      // Network blip or server close — fall back to a one-shot profile fetch.
      es.close();
      api.freelancerProfile().then((p) => {
        if (p.skills?.length) setSkills(p.skills);
        if (p.projects?.length) setProjects(p.projects);
        if (p.confidence) setConfidence(p.confidence);
      }).catch(() => {});
    };

    return () => es.close();
  }, []);

  const band = confidence ? BAND_LABEL[confidence.band] || BAND_LABEL.developing : null;

  return (
    <div>
      <div className="panel-page-header">
        <h1 className="panel-page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Github size={22} /> Building your verified profile
        </h1>
        <p className="panel-page-subtitle">
          We're analyzing your GitHub in depth. Each section appears as it finishes — you don't have to wait for all of it.
        </p>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#fef2f2", border: "1px solid #fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Confidence banner (appears when complete) */}
      {confidence && band && (
        <div className="panel-card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "center", minWidth: 90 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: band.color, lineHeight: 1 }}>
              {confidence.score}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>/ 100</div>
          </div>
          <div>
            <span className="panel-badge" style={{ background: band.bg, color: band.color, fontWeight: 700 }}>
              {band.text}
            </span>
            <p style={{ fontSize: 13, color: "#64748b", margin: "8px 0 0", lineHeight: 1.5 }}>
              Profile confidence from your verified skills, projects, recency, and contribution history.
            </p>
          </div>
        </div>
      )}

      <div className="panel-grid panel-grid--3">
        {/* Skills — read-only / tamper-proof */}
        <SegmentCard title="Verified Skills" icon={Code2} state={seg.skills}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(skills || []).map((s) => (
              <span
                key={s.name}
                title={`${s.confidence}% confidence · proven by ${s.evidence?.length || 0} repo(s)`}
                className="panel-badge"
                style={{ background: "#eff6ff", color: "#1e40af", display: "flex", alignItems: "center", gap: 4 }}
              >
                {s.name} <span style={{ opacity: 0.6 }}>{s.confidence}%</span>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
            <Lock size={12} /> AI-verified from your code — not editable.
          </div>
        </SegmentCard>

        {/* Projects */}
        <SegmentCard title="Top Projects" icon={FolderGit2} state={seg.projects}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(projects || []).slice(0, 6).map((p) => (
              <div key={p.repoName} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.repoName}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>★ {p.stars}</span>
                </div>
                <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 4px", lineHeight: 1.4 }}>{p.summary}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {p.domain && (
                    <span className="panel-badge panel-badge--gray" style={{ fontSize: 10 }}>{p.domain}</span>
                  )}
                  {(p.stack || []).slice(0, 4).map((t) => (
                    <span key={t} className="panel-badge" style={{ fontSize: 10, background: "#f8fafc", color: "#475569" }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SegmentCard>

        {/* Experience */}
        <SegmentCard title="Work Experience" icon={Activity} state={seg.experience}>
          {experience && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Metric label="Commits authored" value={experience.totalCommits} />
              <Metric label="Repos analyzed" value={experience.reposAnalyzed} />
              <Metric label="Active years" value={experience.activeYears} />
              <Metric label="Avg stars" value={experience.avgStars} />
              <Metric label="Collaborations" value={experience.collaborationRepos} />
              <Metric label="Docs quality" value={`${experience.documentationQuality}%`} />
            </div>
          )}
        </SegmentCard>
      </div>

      {done && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <a href="#/dashboard/overview" className="panel-btn" style={{ textDecoration: "none", display: "inline-flex" }}>
            Continue to workspace
          </a>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{label}</div>
    </div>
  );
}
