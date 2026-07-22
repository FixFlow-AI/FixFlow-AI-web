import { useCallback, useEffect, useRef, useState } from "react";
import {
  Github,
  Code2,
  Users,
  GitFork,
  Star,
  History,
  MapPin,
  Link2,
  Calendar,
  Info,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Server,
  LayoutTemplate,
  Database,
  Cloud,
  Cpu,
  BookOpen,
  Zap,
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  GitPullRequest,
  FolderGit2,
  Activity,
  Handshake,
  GitCommitHorizontal,
  X,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useLandingStore } from "../../store/useLandingStore";

/**
 * GitHub Skill Dashboard (roles/01) — pixel-faithful to the product design.
 * 100% dynamic: every value comes from /api/freelancer/profile or the live SSE
 * scan. Nothing is hardcoded; the GitHub API is only re-invoked on demand.
 */

/* Confidence band → headline shown in the verification card. */
const BAND_HEADLINE = {
  match_ready: { title: "Strong &\nWell-validated", accent: "text-indigo-600" },
  developing: { title: "Solid &\nDeveloping", accent: "text-blue-600" },
  emerging: { title: "Emerging &\nGrowing", accent: "text-amber-600" },
};

/* Skill classification into the design's area groups (driven by real skills). */
const AREA_RULES = [
  {
    key: "backend",
    label: "Core Backend",
    icon: Server,
    chip: "bg-indigo-50 text-indigo-700",
    dot: "#6366f1",
    names: ["node.js", "node", "express", "express.js", "nestjs", "fastapi", "django", "flask", "gin", "spring", "spring boot", "graphql", "grpc", "rest apis", "rest api", "microservices", "websockets", "rails", "ruby on rails", "laravel", ".net", "deno", "go"],
  },
  {
    key: "frontend",
    label: "Frontend Architecture",
    icon: LayoutTemplate,
    chip: "bg-emerald-50 text-emerald-700",
    dot: "#10b981",
    names: ["react", "next.js", "vue", "svelte", "angular", "tailwind css", "vite", "zustand", "tanstack query", "redux", "framer motion", "shadcn/ui", "html5", "html", "css3", "css", "scss", "sass", "three.js"],
  },
  {
    key: "database",
    label: "Database & Cache",
    icon: Database,
    chip: "bg-violet-50 text-violet-700",
    dot: "#8b5cf6",
    names: ["postgresql", "mongodb", "mysql", "redis", "prisma", "prisma orm", "supabase", "firebase", "sql", "sqlite", "dynamodb", "elasticsearch", "indexing", "query optimization"],
  },
  {
    key: "devops",
    label: "DevOps & Cloud",
    icon: Cloud,
    chip: "bg-sky-50 text-sky-700",
    dot: "#0ea5e9",
    names: ["docker", "kubernetes", "aws", "aws lambda", "aws s3", "gcp", "google cloud", "azure", "terraform", "ci/cd", "github actions", "vercel", "render", "nginx"],
  },
  {
    key: "ai",
    label: "Data & AI",
    icon: Cpu,
    chip: "bg-rose-50 text-rose-700",
    dot: "#f43f5e",
    names: ["pytorch", "tensorflow", "pandas", "numpy", "gemini api", "openai", "langchain", "jupyter notebook", "opencv", "scikit-learn", "keras"],
  },
];
const FALLBACK_AREAS = {
  language: { key: "languages", label: "Languages", icon: Code2, chip: "bg-blue-50 text-blue-700", dot: "#3b82f6" },
  domain: { key: "domain", label: "Domain Expertise", icon: BookOpen, chip: "bg-amber-50 text-amber-700", dot: "#f59e0b" },
  _: { key: "tools", label: "Tools & Platforms", icon: Zap, chip: "bg-slate-100 text-slate-700", dot: "#64748b" },
};
const AREA_ORDER = ["backend", "frontend", "database", "devops", "ai", "languages", "tools", "domain"];

const COMPLEXITY = {
  High: { label: "High Complexity", cls: "bg-rose-50 text-rose-600", dot: "#f43f5e" },
  Medium: { label: "Medium Complexity", cls: "bg-amber-50 text-amber-600", dot: "#f59e0b" },
  Low: { label: "Low Complexity", cls: "bg-emerald-50 text-emerald-600", dot: "#10b981" },
};

const PALETTE = ["#3b82f6", "#14b8a6", "#8b5cf6", "#f59e0b", "#ec4899", "#10b981", "#6366f1", "#ef4444"];
const colorFor = (i) => PALETTE[i % PALETTE.length];

const compact = (n) => {
  const x = Number(n) || 0;
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}k`;
  return String(x);
};
const withCommas = (n) => (Number(n) || 0).toLocaleString("en-US");

function relTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w} week${w > 1 ? "s" : ""} ago`;
  const m = Math.floor(days / 30);
  if (m < 12) return `${m} month${m > 1 ? "s" : ""} ago`;
  const y = Math.floor(days / 365);
  return `${y} year${y > 1 ? "s" : ""} ago`;
}
function joinedLabel(iso) {
  if (!iso) return null;
  return `Joined ${new Date(iso).toLocaleString("en-US", { month: "short", year: "numeric" })}`;
}
const safeParse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

function classifySkills(skills) {
  const buckets = {};
  for (const s of skills) {
    const name = (s.name || "").toLowerCase();
    let area = AREA_RULES.find((r) => r.names.includes(name));
    if (!area) area = FALLBACK_AREAS[s.category] || FALLBACK_AREAS._;
    (buckets[area.key] = buckets[area.key] || { meta: area, items: [] }).items.push(s);
  }
  return AREA_ORDER.filter((k) => buckets[k]).map((k) => buckets[k]);
}

export function FreelancerAnalytics({ externalProfile = null, readOnly = false }) {
  const { user } = useLandingStore();
  const [profile, setProfile] = useState(externalProfile);
  const [loading, setLoading] = useState(!externalProfile);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showLanguagesModal, setShowLanguagesModal] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const esRef = useRef(null);

  const loadProfile = useCallback(async () => {
    // In read-only mode (a client viewing a candidate) the profile is supplied
    // by the parent — never fetch the logged-in user's own analytics.
    if (externalProfile) {
      setProfile(externalProfile);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setProfile(await api.freelancerProfile());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your analytics.");
    } finally {
      setLoading(false);
    }
  }, [externalProfile]);

  useEffect(() => {
    if (externalProfile) {
      setProfile(externalProfile);
      setLoading(false);
      return;
    }
    loadProfile();
    return () => esRef.current?.close();
  }, [loadProfile, externalProfile]);

  const startRescan = async () => {
    setScanning(true);
    setError("");
    setScanNote("Queuing a fresh GitHub analysis…");
    try {
      const { scanJobId } = await api.rescanGithub();
      if (!scanJobId) throw new Error("No scan job was created.");
      openStream(scanJobId);
    } catch (err) {
      setScanning(false);
      setScanNote("");
      setError(err instanceof ApiError ? err.message : "Could not start the analysis.");
    }
  };

  const openStream = (jobId) => {
    esRef.current?.close();
    const es = new EventSource(api.scanStreamUrl(jobId));
    esRef.current = es;

    es.addEventListener("scan_started", (e) => {
      const d = safeParse(e.data);
      setScanNote(d?.reposDiscovered ? `Scanning ${d.reposDiscovered} repositories…` : "Scanning your repositories…");
    });
    es.addEventListener("segment_ready", (e) => {
      const { segment, payload } = safeParse(e.data) || {};
      if (!segment) return;
      setProfile((prev) => {
        const next = { ...(prev || {}) };
        if (segment === "skills") next.skills = payload || [];
        if (segment === "projects") next.projects = payload || [];
        if (segment === "experience") next.latestJob = { ...(next.latestJob || {}), experience: payload || null };
        return next;
      });
    });
    es.addEventListener("scan_complete", (e) => {
      const d = safeParse(e.data) || {};
      setProfile((prev) => {
        const next = { ...(prev || {}) };
        if (d.confidence) next.confidence = d.confidence;
        if (d.languages) next.latestJob = { ...(next.latestJob || {}), languages: d.languages };
        return next;
      });
      es.close();
      setScanning(false);
      setScanNote("");
      loadProfile();
    });
    es.addEventListener("scan_error", (e) => {
      const d = safeParse(e.data) || {};
      es.close();
      setScanning(false);
      setScanNote("");
      setError(d.error || "The analysis failed. Please try again.");
    });
    es.onerror = () => {
      es.close();
      setScanning(false);
      setScanNote("");
      loadProfile();
    };
  };

  const skills = profile?.skills || [];
  const projects = profile?.projects || [];
  const confidence = profile?.confidence || null;
  const experience = profile?.latestJob?.experience || null;
  const languages = profile?.latestJob?.languages || {};
  const job = profile?.latestJob || null;
  const snapshot = profile?.snapshot || null;
  const username = snapshot?.githubUsername || job?.githubUsername || user?.githubUsername || null;
  const hasData = skills.length > 0 || projects.length > 0 || !!experience || !!confidence;
  const scannedAt = job?.finishedAt || job?.updatedAt || null;

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      {/* Slim toolbar (re-analyze) — hidden when a client is viewing read-only */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-3">
          {scanNote && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
              <Loader2 size={13} className="animate-spin" /> {scanNote}
            </span>
          )}
          <button
            type="button"
            onClick={startRescan}
            disabled={scanning}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.6)] transition hover:brightness-110 disabled:opacity-60"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} className="transition group-hover:rotate-180" />}
            {scanning ? "Analyzing…" : hasData ? "Re-analyze" : "Analyze my GitHub"}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="flex items-center gap-2"><AlertTriangle size={15} /> {error}</span>
          <button onClick={() => { setError(""); loadProfile(); }} className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}


      {loading ? (
        <SkeletonDashboard />
      ) : !hasData ? (
        readOnly ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            This candidate hasn't published a verified analytics profile yet.
          </div>
        ) : (
          <>
            {snapshot && <ProfileHeader snapshot={snapshot} username={username} experience={experience} />}
            <OnboardingCard scanning={scanning} onScan={startRescan} />
          </>
        )
      ) : (
        <>
          <ProfileHeader snapshot={snapshot} username={username} experience={experience} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <VerificationCard confidence={confidence} scannedAt={scannedAt} />
            </div>
            <div className="lg:col-span-2">
              <SkillsMatrix skills={skills} onOpenDetailed={() => setShowSkillsModal(true)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <LanguageCard languages={languages} onOpenDetailed={() => setShowLanguagesModal(true)} />
            </div>
            <div className="lg:col-span-2">
              <ProjectsCard projects={projects} onOpenDetailed={() => setShowProjectsModal(true)} />
            </div>
          </div>

          {experience && <ExperienceSignals experience={experience} />}

          {/* ── DETAILED SKILLS MATRIX MODAL ── */}
          {showSkillsModal && (
            <div className="fixflow-modal-overlay" onClick={() => setShowSkillsModal(false)}>
              <div className="fixflow-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780 }}>
                <div className="fixflow-modal-header">
                  <h3 className="fixflow-modal-title flex items-center gap-2 text-base font-bold text-slate-900">
                    <ShieldCheck size={22} className="text-indigo-600" />
                    Verified Skills & Code Evidence Matrix ({skills.length})
                  </h3>
                  <button
                    type="button"
                    className="panel-btn--ghost"
                    onClick={() => setShowSkillsModal(false)}
                    style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="fixflow-modal-body fixflow-custom-scroll space-y-4" style={{ maxHeight: 520 }}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filter skills by name or domain..."
                      value={skillFilter}
                      onChange={(e) => setSkillFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                    />
                    <Code2 size={16} className="absolute left-3 top-3 text-slate-400" />
                  </div>

                  {classifySkills(skills.filter((s) => s.name.toLowerCase().includes(skillFilter.toLowerCase()))).map(({ meta, items }) => {
                    const Icon = meta.icon;
                    return (
                      <div key={meta.key} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${meta.dot}20`, color: meta.dot }}>
                              <Icon size={14} />
                            </span>
                            <span className="font-bold text-slate-800 text-sm">{meta.label}</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{items.length} verified</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {items.sort((a, b) => b.confidence - a.confidence).map((s) => (
                            <div
                              key={s.name}
                              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-indigo-300 transition"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-900 text-sm">{s.name}</span>
                                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600">
                                  {s.confidence}% Rating
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 mb-2 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                                  style={{ width: `${s.confidence}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                                <span>{s.evidence?.length || 0} code repo evidence</span>
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                  <CheckCircle2 size={11} /> Read-only
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="fixflow-modal-footer">
                  <button
                    type="button"
                    className="panel-btn--ghost panel-btn"
                    onClick={() => setShowSkillsModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── EXPLORE REPOSITORIES MODAL ── */}
          {showProjectsModal && (
            <div className="fixflow-modal-overlay" onClick={() => setShowProjectsModal(false)}>
              <div className="fixflow-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780 }}>
                <div className="fixflow-modal-header">
                  <h3 className="fixflow-modal-title flex items-center gap-2 text-base font-bold text-slate-900">
                    <FolderGit2 size={22} className="text-blue-600" />
                    Scanned Repositories & Contribution Analysis ({projects.length})
                  </h3>
                  <button
                    type="button"
                    className="panel-btn--ghost"
                    onClick={() => setShowProjectsModal(false)}
                    style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="fixflow-modal-body fixflow-custom-scroll space-y-4" style={{ maxHeight: 520 }}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filter repositories by name or tech stack..."
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <Github size={16} className="absolute left-3 top-3 text-slate-400" />
                  </div>

                  <div className="space-y-3">
                    {projects
                      .filter((p) => p.repoName?.toLowerCase().includes(projectFilter.toLowerCase()) || p.summary?.toLowerCase().includes(projectFilter.toLowerCase()))
                      .map((p) => (
                        <div key={p.repoName} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <FolderGit2 size={18} className="text-blue-600" />
                              <a
                                href={username ? `https://github.com/${username}/${p.repoName}` : "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-slate-900 text-sm hover:text-blue-600 flex items-center gap-1"
                              >
                                {p.repoName} <ExternalLink size={12} />
                              </a>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
                                {p.domain || "software"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Star size={13} className="text-amber-500 fill-amber-500" /> {p.stars || 0}</span>
                              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                                {p.commitShare || 100}% Code Share
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">{p.summary || "Public repository analyzed by FixFlowAI Gemini code scanner."}</p>

                          {p.stack?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {p.stack.map((t) => (
                                <span key={t} className="rounded-md bg-blue-50/70 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="fixflow-modal-footer">
                  <button
                    type="button"
                    className="panel-btn--ghost panel-btn"
                    onClick={() => setShowProjectsModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── FULL LANGUAGES DISTRIBUTION MODAL ── */}
          {showLanguagesModal && (
            <div className="fixflow-modal-overlay" onClick={() => setShowLanguagesModal(false)}>
              <div className="fixflow-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <div className="fixflow-modal-header">
                  <h3 className="fixflow-modal-title flex items-center gap-2 text-base font-bold text-slate-900">
                    <Code2 size={22} className="text-indigo-600" />
                    Full Programming Languages Distribution ({Object.keys(languages || {}).length})
                  </h3>
                  <button
                    type="button"
                    className="panel-btn--ghost"
                    onClick={() => setShowLanguagesModal(false)}
                    style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="fixflow-modal-body fixflow-custom-scroll space-y-3" style={{ maxHeight: 450 }}>
                  {Object.entries(languages || {})
                    .filter(([, pct]) => pct > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([lang, pct], idx) => (
                      <div key={lang} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ background: colorFor(idx) }} />
                            {lang}
                          </span>
                          <span className="text-indigo-600 font-extrabold">{pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colorFor(idx) }} />
                        </div>
                      </div>
                    ))}
                </div>

                <div className="fixflow-modal-footer">
                  <button
                    type="button"
                    className="panel-btn--ghost panel-btn"
                    onClick={() => setShowLanguagesModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────────── shells ───────────────── */

function Card({ children, className = "" }) {
  return (
    <div className={"rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(15,23,42,0.12)] " + className}>
      {children}
    </div>
  );
}

function CardHead({ icon: Icon, title, right }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
        {title}
        <Info size={13} className="text-slate-300" />
      </h2>
      {right}
    </div>
  );
}

/* ───────────────── Profile header ───────────────── */

function HeaderStat({ icon: Icon, tint, value, label }) {
  return (
    <div className="flex min-w-[70px] flex-col items-center px-2 text-center">
      <span className={`mb-1.5 grid h-9 w-9 place-items-center rounded-xl ${tint}`}>
        <Icon size={16} />
      </span>
      <span className="text-xl font-extrabold leading-none text-slate-900">{value}</span>
      <span className="mt-1 text-[11px] font-medium text-slate-400">{label}</span>
    </div>
  );
}

function ProfileHeader({ snapshot, username, experience }) {
  const handle = snapshot?.githubUsername || username;
  const initials = (snapshot?.name || handle || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const joined = joinedLabel(snapshot?.accountCreatedAt);

  const stats = [
    { icon: Code2, tint: "bg-blue-50 text-blue-600", value: snapshot?.publicRepos ?? "—", label: "Public Repos" },
    { icon: Users, tint: "bg-violet-50 text-violet-600", value: compact(snapshot?.followers ?? 0), label: "Followers" },
    { icon: GitFork, tint: "bg-teal-50 text-teal-600", value: compact(snapshot?.following ?? 0), label: "Following" },
    { icon: Star, tint: "bg-amber-50 text-amber-600", value: compact(experience?.totalStars ?? 0), label: "Total Stars" },
    { icon: History, tint: "bg-orange-50 text-orange-600", value: compact(experience?.totalCommits ?? 0), label: "Total Commits" },
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-6">
        {/* left: identity */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {snapshot?.avatarUrl ? (
              <img src={snapshot.avatarUrl} alt={handle} className="h-[70px] w-[70px] rounded-full object-cover ring-2 ring-slate-100" />
            ) : (
              <div className="grid h-[70px] w-[70px] place-items-center rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-lg font-bold text-white">
                {initials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-white">
              <CheckCircle2 size={18} className="fill-emerald-500 text-white" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900">{snapshot?.name || handle}</h1>
              <a
                href={handle ? `https://github.com/${handle}` : "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600"
              >
                <Github size={11} /> Verified via GitHub
              </a>
            </div>
            {snapshot?.bio && <p className="mt-0.5 text-sm text-slate-500">{snapshot.bio}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-400">
              {snapshot?.location && <span className="flex items-center gap-1"><MapPin size={12} /> {snapshot.location}</span>}
              {snapshot?.blog && (
                <a href={/^https?:\/\//.test(snapshot.blog) ? snapshot.blog : `https://${snapshot.blog}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-500">
                  <Link2 size={12} /> {snapshot.blog.replace(/^https?:\/\//, "")}
                </a>
              )}
              {joined && <span className="flex items-center gap-1"><Calendar size={12} /> {joined}</span>}
            </div>
          </div>
        </div>

        {/* right: stat blocks */}
        <div className="flex items-center gap-1 sm:gap-2">
          {stats.map((s) => (
            <HeaderStat key={s.label} {...s} />
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ───────────────── Verification score ───────────────── */

function VerificationCard({ confidence, scannedAt }) {
  const score = confidence?.score ?? 0;
  const band = confidence?.band || "developing";
  const head = BAND_HEADLINE[band] || BAND_HEADLINE.developing;
  const prev = confidence?.previousScore;
  const delta = typeof prev === "number" ? score - prev : null;

  return (
    <Card className="h-full p-5">
      <CardHead title="Skill Verification Score" />
      {!confidence ? (
        <p className="py-8 text-center text-sm text-slate-400">Run an analysis to compute your verification score.</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <GradientRing score={score} />
            <div className="flex-1">
              <p className="text-sm text-slate-400">Your skills are</p>
              <p className={`whitespace-pre-line text-lg font-extrabold leading-tight ${head.accent}`}>{head.title}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Based on code contributions, project depth, documentation, and community engagement.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            {delta != null ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {delta >= 0 ? "+" : ""}{delta}% vs last scan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                <Sparkles size={12} /> First analysis
              </span>
            )}
            {scannedAt && <span className="text-[11px] text-slate-400">Last analyzed: {new Date(scannedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>}
          </div>
        </>
      )}
    </Card>
  );
}

function GradientRing({ score }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score));
  const off = c - (v / 100) * c;
  return (
    <div className="relative h-[132px] w-[132px] flex-shrink-0">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <defs>
          <linearGradient id="ffaRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={r} fill="none" stroke="#eef2f7" strokeWidth="12" />
        <circle
          cx="66" cy="66" r={r} fill="none" stroke="url(#ffaRing)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 66 66)"
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[28px] font-extrabold leading-none text-slate-900">
            {v}<span className="text-base font-bold text-slate-400">%</span>
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">Verified</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Verified skills matrix ───────────────── */

function SkillsMatrix({ skills, onOpenDetailed }) {
  const groups = classifySkills(skills);
  return (
    <Card className="h-full p-5">
      <CardHead
        title="Verified Skills Matrix"
        right={
          <button
            type="button"
            onClick={onOpenDetailed}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            View detailed skills <ArrowRight size={13} />
          </button>
        }
      />
      {skills.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No verified skills yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ meta, items }) => {
            const Icon = meta.icon;
            return (
              <div key={meta.key} className="flex items-start gap-3">
                <div className="flex w-36 flex-shrink-0 items-center gap-2 pt-1">
                  <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${meta.dot}1a`, color: meta.dot }}>
                    <Icon size={15} />
                  </span>
                  <span className="text-[13px] font-bold leading-tight text-slate-700">{meta.label}</span>
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {[...items].sort((a, b) => b.confidence - a.confidence).map((s) => (
                    <span
                      key={s.name}
                      onClick={onOpenDetailed}
                      title={`${s.confidence}% confidence · proven in ${s.evidence?.length || 0} repo(s) — Click to view details`}
                      className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${meta.chip} cursor-pointer hover:opacity-80 transition`}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ───────────────── Language distribution ───────────────── */

function LanguageCard({ languages, onOpenDetailed }) {
  const entries = Object.entries(languages || {}).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 4);
  return (
    <Card className="flex h-full flex-col p-5">
      <CardHead title="Language Distribution" />
      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No language data yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <LangDonut entries={entries} />
            <div className="flex-1 space-y-2">
              {top.map(([name, pct], i) => (
                <div key={name} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor(i) }} />
                  <span className="flex-1 font-medium text-slate-600">{name}</span>
                  <span className="font-semibold text-slate-400">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenDetailed}
            className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
          >
            View all languages <ArrowRight size={13} />
          </button>
        </>
      )}
    </Card>
  );
}

function LangDonut({ entries }) {
  const total = entries.reduce((s, [, p]) => s + p, 0) || 1;
  const R = 54, SW = 22, r = R - SW / 2;
  const c = 2 * Math.PI * r;
  let cum = 0;
  return (
    <div className="relative h-[128px] w-[128px] flex-shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={SW} />
        {entries.map(([name, pct], i) => {
          const frac = pct / total;
          const dash = frac * c;
          const seg = (
            <circle
              key={name} cx="64" cy="64" r={r} fill="none" stroke={colorFor(i)} strokeWidth={SW}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-(cum / total) * c}
              transform="rotate(-90 64 64)"
            />
          );
          cum += pct;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-xl font-extrabold leading-none text-slate-900">{entries.length}</div>
          <div className="text-[10px] font-medium text-slate-400">Languages</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Scanned projects ───────────────── */

function ProjectsCard({ projects, onOpenDetailed }) {
  const sorted = [...projects].sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0));
  return (
    <Card className="flex h-full flex-col p-5">
      <CardHead
        title="Scanned Projects"
        right={
          <button
            type="button"
            onClick={onOpenDetailed}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            Explore all repositories <ArrowRight size={13} />
          </button>
        }
      />
      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No projects detected yet.</p>
      ) : (
        <div className="-mr-2 max-h-[360px] space-y-1 overflow-y-auto pr-2">
          {sorted.map((p, i) => (
            <ProjectRow key={p.repoName} p={p} accent={colorFor(i)} onOpenDetailed={onOpenDetailed} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProjectRow({ p, accent, onOpenDetailed }) {
  const cx = COMPLEXITY[p.complexity || "Medium"];
  const tags = [p.primaryLanguage, ...(p.stack || []).filter((t) => t !== p.primaryLanguage)].filter(Boolean).slice(0, 4);
  const letter = (p.repoName || "?")[0].toUpperCase();
  return (
    <div onClick={onOpenDetailed} className="flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-slate-50/70 cursor-pointer">
      {/* icon */}
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: accent }}>
        {letter}
      </span>
      {/* name + desc + chips */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {p.url ? (
            <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-sm font-bold text-slate-900 hover:text-blue-600">{p.repoName}</a>
          ) : (
            <span className="truncate text-sm font-bold text-slate-900">{p.repoName}</span>
          )}
          <span className="flex flex-shrink-0 items-center gap-0.5 text-[11px] text-slate-400"><Star size={11} /> {p.stars}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">{p.summary}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{t}</span>
          ))}
        </div>
      </div>
      {/* commits + updated */}
      <div className="hidden w-28 flex-shrink-0 md:block">
        <div className="flex items-center gap-1 text-[12px] font-semibold text-slate-600"><Star size={11} className="text-slate-300" /> {compact(p.commits || 0)} commits</div>
        <div className="mt-0.5 text-[11px] text-slate-400">Updated {relTime(p.updatedAt || p.lastActiveAt)}</div>
      </div>
      {/* sparkline */}
      <div className="hidden w-32 flex-shrink-0 lg:block">
        <div className="mb-1 text-[10px] text-slate-400">Commit activity (last 60 days)</div>
        <Sparkline data={p.commitActivity} color={accent} />
      </div>
      {/* complexity */}
      <div className="hidden w-36 flex-shrink-0 text-right xl:block">
        <div className="mb-1 text-[10px] text-slate-400">AI Complexity Rating</div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cx.cls}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cx.dot }} /> {cx.label}
        </span>
      </div>
    </div>
  );
}

function Sparkline({ data, color }) {
  const series = Array.isArray(data) && data.length > 1 ? data : null;
  if (!series) return <div className="h-8 rounded bg-slate-50" />;
  const w = 120, h = 32, max = Math.max(...series, 1);
  const step = w / (series.length - 1);
  const pts = series.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────── Experience signals ───────────────── */

function ExperienceSignals({ experience }) {
  const items = [
    { icon: GitCommitHorizontal, tint: "text-blue-500", label: "Commits Authored", value: withCommas(experience.totalCommits) },
    { icon: Code2, tint: "text-violet-500", label: "Lines of Code", value: compact(experience.linesAuthored || 0) },
    { icon: GitPullRequest, tint: "text-emerald-500", label: "Pull Requests", value: withCommas(experience.pullRequests || 0) },
    { icon: FolderGit2, tint: "text-amber-500", label: "Repositories Analyzed", value: experience.reposAnalyzed },
    { icon: Calendar, tint: "text-rose-500", label: "Active Years", value: experience.activeYears },
    { icon: Star, tint: "text-yellow-500", label: "Avg. Stars / Repo", value: experience.avgStars },
    { icon: Activity, tint: "text-sky-500", label: "Contributions/Week", value: experience.contributionsPerWeek ?? 0 },
    { icon: Handshake, tint: "text-teal-500", label: "Collaboration Score", value: `${experience.collaborationScore ?? 0}`, suffix: "/100" },
  ];
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-y-4">
        <div className="mr-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white"><Activity size={16} /></span>
          <span className="text-[13px] font-bold leading-tight text-slate-700">Experience<br />Signals</span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.label} className="flex flex-col gap-1">
                <span className={`flex items-center gap-1 text-[10px] font-medium text-slate-400`}>
                  <Icon size={12} className={it.tint} /> {it.label}
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {it.value}{it.suffix && <span className="text-xs font-semibold text-slate-400">{it.suffix}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ───────────────── Onboarding + Skeleton ───────────────── */

function OnboardingCard({ scanning, onScan }) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 ring-1 ring-blue-100">
        <Sparkles size={26} />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">Build your verified skill profile</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
        We'll analyze your public GitHub repositories to generate a tamper-proof, code-backed proof of skill — the shortlist clients trust.
      </p>
      <button
        type="button"
        onClick={onScan}
        disabled={scanning}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.6)] transition hover:brightness-110 disabled:opacity-60"
      >
        {scanning ? <Loader2 size={15} className="animate-spin" /> : <Github size={15} />}
        {scanning ? "Analyzing…" : "Analyze my GitHub"}
      </button>
    </Card>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="ffa-shimmer h-[70px] w-[70px] rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="ffa-shimmer h-4 w-40 rounded" />
            <div className="ffa-shimmer h-3 w-64 rounded" />
            <div className="ffa-shimmer h-3 w-52 rounded" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="ffa-shimmer mb-4 h-4 w-40 rounded" />
          <div className="flex items-center gap-4">
            <div className="ffa-shimmer h-[132px] w-[132px] rounded-full" />
            <div className="flex-1 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="ffa-shimmer h-3 rounded" />)}</div>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="ffa-shimmer mb-4 h-4 w-48 rounded" />
          <div className="space-y-4">{[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="ffa-shimmer h-8 w-32 rounded" />
              <div className="flex flex-1 flex-wrap gap-1.5">{Array.from({ length: 6 }).map((_, j) => <div key={j} className="ffa-shimmer h-6 w-20 rounded-full" />)}</div>
            </div>
          ))}</div>
        </Card>
      </div>
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2"><div className="ffa-shimmer h-3 w-16 rounded" /><div className="ffa-shimmer h-6 w-10 rounded" /></div>
          ))}
        </div>
      </Card>
    </div>
  );
}
