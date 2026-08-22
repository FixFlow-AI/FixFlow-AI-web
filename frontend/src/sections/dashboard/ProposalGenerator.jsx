import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import { DiscoveryWizard } from "./DiscoveryWizard";
import { api } from "../../lib/api";
import { usePlan } from "../../hooks/usePlan";
import { DeferredViz } from "../../components/plan/DeferredViz";
import { EmptyDiagram } from "../../components/plan/EmptyDiagram";
import { sectionAvailability } from "../../lib/plan/selectors";
import { discloseSlice } from "../../lib/plan/disclosure";
import {
  Sparkles,
  RefreshCw,
  Check,
  FileSignature,
  ArrowRight,
  Bookmark,
  AlertTriangle,
  Target,
  Clock,
  DollarSign,
  Zap,
  BadgeCheck,
  Users,
  Code2,
  Shield,
  TrendingUp,
  Plus,
  Lock,
  Paperclip,
  MoreHorizontal,
  FileText,
  X,
  Download,
  Copy,
  FolderOpen,
  RotateCcw,
  Search,
  SearchX,
  Info,
} from "lucide-react";


/* Stepper for proposal stages */
const proposalSteps = [
  { num: 1, label: "Describe idea" },
  { num: 2, label: "Structured scope" },
  { num: 3, label: "Intelligence analysis" },
  { num: 4, label: "Timeline & roles" },
  { num: 5, label: "Review & finalize" },
];

// Which detail views belong to each approval step. Step 1 has no tabs (idea
// capture) and step 5 carries the workflow map rather than a tab set; steps 2-4
// group the relevant analysis sections.
const STEP_TABS = {
  2: ["scope", "architecture", "traceability"],
  3: ["risks", "competitors", "impact"],
  4: ["weeks", "schedule", "capacity", "roles"],
};

// Module-level dynamic-import factories. `DeferredViz` memoises `React.lazy` on
// the factory's identity, so these must be stable across renders — recreating
// one per render would discard the resolved chunk and remount the diagram.
// Keeping them here is also what gives each diagram its own Vite chunk, so
// nothing is fetched until the section is actually viewed (Requirement 12.2).
const loadArchitectureGraph = () => import("../../components/plan/ArchitectureGraph.jsx");
const loadTraceabilityMatrix = () => import("../../components/plan/TraceabilityMatrix.jsx");
const loadWeekDetail = () => import("../../components/plan/WeekDetail.jsx");
const loadScheduleGantt = () => import("../../components/plan/ScheduleGantt.jsx");
const loadCapacityHeatmap = () => import("../../components/plan/CapacityHeatmap.jsx");
const loadProjectWorkflowMap = () => import("../../components/plan/ProjectWorkflowMap.jsx");

// How many cards a long list shows before the reviewer asks for more.
const SECTION_PAGE_SIZE = 6;

/**
 * Read-back for a deterministic score (Requirement 2.4).
 *
 * Every number in the intelligence sections is derived server-side from
 * qualitative signals, and `score_basis` carries those signals plus the rule
 * that produced the figure. Rendering it as a disclosure keeps the card compact
 * while making the number explainable rather than asserted. Absent on
 * proposals generated before this feature, in which case nothing is rendered.
 *
 * @param {{basis?: {inputs?: string[], rule?: string} | null, label?: string}} props
 * @returns {JSX.Element|null}
 */
function ScoreBasisNote({ basis, label = "How this score was reached" }) {
  const inputs = Array.isArray(basis?.inputs)
    ? basis.inputs.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const rule = typeof basis?.rule === "string" ? basis.rule.trim() : "";
  if (inputs.length === 0 && !rule) return null;

  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ fontSize: 11.5, fontWeight: 600, color: "#2563eb", cursor: "pointer" }}>
        {label}
      </summary>
      <div
        style={{
          marginTop: 6,
          padding: "8px 10px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
        }}
      >
        {inputs.length > 0 && (
          <>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Inputs used
            </span>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
              {inputs.map((entry, idx) => (
                <li key={`${idx}-${entry}`}>{entry}</li>
              ))}
            </ul>
          </>
        )}
        {rule && (
          <p style={{ margin: inputs.length > 0 ? "8px 0 0" : 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            <strong style={{ color: "#334155" }}>Rule:</strong> {rule}
          </p>
        )}
      </div>
    </details>
  );
}

// The client's per-step approval action label (step 5 hands off to Agreement).
const STEP_APPROVE_LABEL = {
  2: "Approve scope & continue",
  3: "Approve intelligence & continue",
  4: "Approve timeline & continue",
  5: "Approve & send to Agreement",
};

const summaryItems = [];
const intelligenceItems = [];
const scopeItems = [];

const nextSteps = [
  { num: 1, title: "Review the structured scope", desc: "AI has generated the initial plan." },
  { num: 2, title: "Check intelligence insights", desc: "Review risks, competitors, and opportunities." },
  { num: 3, title: "Refine timeline and roles", desc: "Adjust milestones and team requirements." },
  { num: 4, title: "Match with verified talent", desc: "Invite the best proof-backed freelancers." },
];

export function ProposalGenerator() {
  const {
    rawBriefText,
    isProposalGenerated,
    generatedProposal,
    setGeneratedProposal,
    setProposalGenerated,
    setDashboardTab,
    parsedProposal,
    parsedProposalId,
    proposalWorkflow,
    runBriefParse,
    briefParsing,
    matchResults,
    milestones,
  } = useLandingStore();

  const [generating, setGenerating] = useState(false);
  const [ideaText, setIdeaText] = useState(rawBriefText || "");
  const [activeTab, setActiveTab] = useState("scope");
  const [activeStep, setActiveStep] = useState(1);
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  // Sequential approval: a step unlocks only after the previous one is approved.
  const [approvedSteps, setApprovedSteps] = useState([]);

  const hasProposal = Boolean(parsedProposal);
  // Tracks which proposalId the local step state was hydrated for, so we never
  // clobber in-session progress on unrelated re-renders.
  const hydratedFor = useRef(null);

  // The v2 execution plan behind the new diagrams. A proposal with no plan sets
  // `notGenerated` rather than an error, so the section offers to generate one
  // (Requirement 11.2); a genuine failure lands in `planError` and is shown
  // alongside the sections that can still render (Requirement 11.4).
  const {
    plan,
    diagnostics,
    status: planStatus,
    error: planError,
    notGenerated: planNotGenerated,
    loading: planLoading,
    generating: planGenerating,
    reload: reloadPlan,
    generate: generatePlan,
  } = usePlan(parsedProposalId);

  // Selector results are memoised on the plan/diagnostics identity so switching
  // sections never recomputes a projection (the diagrams do the same inside).
  const availability = useMemo(() => sectionAvailability(plan, diagnostics), [plan, diagnostics]);

  // Requirement 1.3: a proposal kept thin by a thin brief says so, instead of
  // looking complete. Absent on proposals generated before this feature.
  const depthReport = parsedProposal?.depth_report || null;
  const depthLimited = Boolean(depthReport?.depthLimited);
  const shortSections = useMemo(
    () => (Array.isArray(depthReport?.sections) ? depthReport.sections.filter((s) => s && s.met === false) : []),
    [depthReport],
  );

  // Progressive disclosure for the longer lists: the remainder is one click
  // away rather than silently truncated (Requirement 10.3).
  const [pagesShown, setPagesShown] = useState({});
  const showMore = useCallback((key) => {
    setPagesShown((current) => ({ ...current, [key]: (current[key] ?? 1) + 1 }));
  }, []);

  const isStepUnlocked = (num) => num === 1 || approvedSteps.includes(num - 1);

  // Persist workflow state: localStorage immediately (instant/offline restore)
  // + DB best-effort (authoritative, cross-device). Only runs once a proposal
  // has been persisted (has an id).
  const persistWorkflow = (step, approved) => {
    if (!parsedProposalId) return;
    const updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(
        `ff_wf_${parsedProposalId}`,
        JSON.stringify({ activeStep: step, approvedSteps: approved, updatedAt }),
      );
    } catch {
      /* storage disabled/full — DB remains the source of truth */
    }
    api.saveProposalWorkflow(parsedProposalId, step, approved, updatedAt).catch(() => {
      /* best-effort; localStorage already holds the latest for the next load */
    });
  };

  // Navigate to an (already unlocked) step and persist the position.
  const goToStep = (step) => {
    setActiveStep(step);
    persistWorkflow(step, approvedSteps);
  };

  // Approve the current step, unlock + advance to the next, and persist.
  const approveStep = (num) => {
    const nextApproved = approvedSteps.includes(num) ? approvedSteps : [...approvedSteps, num];
    const nextStep = num + 1 <= proposalSteps.length ? num + 1 : num;
    setApprovedSteps(nextApproved);
    setActiveStep(nextStep);
    persistWorkflow(nextStep, nextApproved);
  };

  // Section-per-step memory. Entering a step reopens the section the reviewer
  // was last reading there and falls back to its first section otherwise, so
  // moving between steps never loses their place (Requirement 10.1).
  const [sectionByStep, setSectionByStep] = useState({});

  useEffect(() => {
    const allowed = STEP_TABS[activeStep];
    if (!allowed) return;
    const remembered = sectionByStep[activeStep];
    const next = allowed.includes(remembered) ? remembered : allowed[0];
    if (next !== activeTab) setActiveTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  // Move between the sections of the current step. Deliberately changes nothing
  // else: no scrolling, no step change, no approval side effects (Requirement 10.1).
  const selectSection = useCallback(
    (tabId) => {
      setActiveTab(tabId);
      setSectionByStep((current) => ({ ...current, [activeStep]: tabId }));
    },
    [activeStep],
  );

  // Restore persisted step/approval state when the active proposal changes.
  // Priority: DB workflow (via store) > localStorage cache > clean defaults.
  // Runs once per proposalId so it won't overwrite in-session progress.
  useEffect(() => {
    if (!parsedProposalId) {
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === parsedProposalId) return;

    let wf = proposalWorkflow;
    if (!wf) {
      try {
        wf = JSON.parse(localStorage.getItem(`ff_wf_${parsedProposalId}`) || "null");
      } catch {
        wf = null;
      }
    }
    if (wf && Array.isArray(wf.approvedSteps)) {
      setApprovedSteps(wf.approvedSteps);
      setActiveStep(Math.min(Math.max(wf.activeStep || 1, 1), proposalSteps.length));
    } else {
      // Brand-new proposal, or switched to a different one: start clean.
      setApprovedSteps([]);
      setActiveStep(1);
    }
    hydratedFor.current = parsedProposalId;
  }, [parsedProposalId, proposalWorkflow]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [draftList, setDraftList] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const { startNewProposal } = useLandingStore();

  const handleOpenDrafts = async () => {
    setShowDraftsModal(true);
    setShowMoreMenu(false);
    setLoadingDrafts(true);
    try {
      const res = await api.listProposals();
      if (res && res.proposals) {
        setDraftList(res.proposals);
      }
    } catch (err) {
      console.error("Failed to load proposal drafts:", err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const handleSelectDraft = async (draft) => {
    if (draft && draft.proposalId) {
      const selectProposalById = useLandingStore.getState().selectProposalById;
      await selectProposalById(draft.proposalId);
      if (draft.workflow && Array.isArray(draft.workflow.approvedSteps)) {
        setApprovedSteps(draft.workflow.approvedSteps);
        setActiveStep(draft.workflow.activeStep || 1);
      } else {
        setApprovedSteps([1]);
        setActiveStep(2);
      }
      setShowDraftsModal(false);
    }
  };


  const handleExportProposal = () => {
    setShowMoreMenu(false);
    const sections = buildSections();
    const fullText = sections.length > 0 ? sections.join("") : generatedProposal || rawBriefText;
    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposal_${parsedProposalId || "draft"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyBrief = () => {
    setShowMoreMenu(false);
    const textToCopy = rawBriefText || parsedProposal?.project_summary || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    }
  };

  const handleStartNew = () => {
    setShowMoreMenu(false);
    startNewProposal();
    setApprovedSteps([]);
    setActiveStep(1);
  };

  const tabsRef = useRef(null);
  // Section buttons, so keyboard traversal can move focus with the selection.
  const sectionTabRefs = useRef(new Map());

  // Arrow/Home/End traversal across the current step's sections. Selection
  // moves with focus; the reviewer's step and scroll position are untouched.
  const handleSectionKeyDown = (event, index, list) => {
    if (list.length === 0) return;
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % list.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + list.length) % list.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = list.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const target = list[nextIndex];
    selectSection(target.id);
    sectionTabRefs.current.get(target.id)?.focus();
  };

  // The workflow map reads the builder's own progress; passing a memoised
  // object keeps its lifecycle derivation from recomputing on every render.
  const workflowForMap = useMemo(() => ({ activeStep, approvedSteps }), [activeStep, approvedSteps]);

  const handleViewFullSummary = () => {
    setActiveStep(2);
    setActiveTab("scope");
    // Record it as the step's section too, so the step-entry effect agrees with
    // this explicit jump instead of restoring a previously read section.
    setSectionByStep((current) => ({ ...current, 2: "scope" }));
    setShowSummaryModal(true);
    setTimeout(() => {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleViewFullIntelligence = () => {
    setActiveStep(3);
    setActiveTab("risks");
    setSectionByStep((current) => ({ ...current, 3: "risks" }));
    setShowIntelligenceModal(true);
    setTimeout(() => {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const displaySummary = parsedProposal
    ? [
        { icon: Target, label: "Project summary", value: parsedProposal.project_summary.slice(0, 60) + "..." },
        { icon: Clock, label: "Phase duration", value: parsedProposal.timeline?.[0]?.duration || "2 weeks" },
        { icon: DollarSign, label: "Features listed", value: `${parsedProposal.features?.length || 0} features` },
        { icon: Zap, label: "Confidence", value: parsedProposal.features?.[0]?.confidence || "High" },
      ]
    : [];

  const displayIntelligence = parsedProposal?.risks?.map((risk) => ({
    icon: AlertTriangle,
    label: risk.label,
    value: risk.mitigation,
    badge: risk.severity >= 70 ? "High" : risk.severity >= 40 ? "Medium" : "Low",
    color: risk.severity >= 70 ? "#ef4444" : risk.severity >= 40 ? "#f59e0b" : "#16a34a",
  })) || [];

  const displayScope = parsedProposal?.features?.map((f) => ({
    icon: Target,
    title: f.title,
    desc: f.description,
    badge: f.complexity,
    badgeColor: f.complexity === "High" ? "orange" : f.complexity === "Medium" ? "blue" : "green",
    // Derived server-side; carried through so the figure can be read back (R2.4).
    confidence: f.confidence,
    confidencePct: f.confidence_pct,
    scoreBasis: f.score_basis || null,
  })) || [];

  const buildSections = () => {
    if (parsedProposal) {
      const featureLines = parsedProposal.features
        .map((f) => `- **${f.title}** (${f.area}, ${f.complexity} complexity): ${f.description}`)
        .join("\n");
      const milestoneLines = parsedProposal.timeline
        .map((phase, idx) => `- **Phase ${idx + 1}: ${phase.phase}** (${phase.duration}) — ${phase.tasks.join(", ")}`)
        .join("\n");
      const riskLines = parsedProposal.risks
        .map((r) => `- **${r.label}** (severity ${r.severity}): ${r.mitigation}`)
        .join("\n");
      return [
        "# PROJECT PROPOSAL\n\n",
        `## 1. Project Summary\n${parsedProposal.project_summary}\n\n`,
        `## 2. Scope & Features\n${featureLines}\n\n`,
        `## 3. Timeline & Milestones\n${milestoneLines}\n\n`,
        `## 4. Risks & Mitigations\n${riskLines}`,
      ];
    }
    return [];
  };

  const handleGenerate = () => {
    setGenerating(true);
    setApprovedSteps([]); // regenerating restarts the approval sequence
    const sections = buildSections();
    let idx = 0;
    let text = "";
    const interval = setInterval(() => {
      if (idx < sections.length) {
        text += sections[idx];
        idx++;
      } else {
        clearInterval(interval);
        setGenerating(false);
        setGeneratedProposal(text);
        setProposalGenerated(true);
        // Step 1 (the brief) is complete once a proposal exists → unlock step 2.
        setApprovedSteps([1]);
        setActiveStep(2);
        persistWorkflow(2, [1]);
      }
    }, 450);
  };

  // Order here is the order the section nav shows within a step.
  const tabs = [
    { id: "scope", label: "Scope outline" },
    { id: "architecture", label: "Technical architecture" },
    { id: "traceability", label: "Requirement traceability" },
    { id: "risks", label: "Risk analysis" },
    { id: "competitors", label: "Competitor landscape" },
    { id: "impact", label: "Impact analysis" },
    { id: "weeks", label: "Week by week" },
    { id: "schedule", label: "Task schedule" },
    { id: "capacity", label: "Role capacity" },
    { id: "roles", label: "Required roles" },
  ];
  const stepTabs = tabs.filter((t) => (STEP_TABS[activeStep] || []).includes(t.id));

  /**
   * Mount one plan diagram.
   *
   * Diagrams always go through `DeferredViz` so their chunk is only requested
   * once the section is viewed (Requirement 12.2). When there is no stored plan
   * the generate affordance is rendered here instead, which both answers
   * Requirement 11.2 and avoids fetching a chunk just to show an empty state.
   * `section` is passed only for the diagrams that cannot offer generation
   * themselves; `ArchitectureGraph` and `ScheduleGantt` own that empty state.
   */
  const renderPlanDiagram = ({ load, title, section, ...props }) => {
    if (planLoading) {
      return (
        <div
          className="panel-card"
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b" }}
        >
          <RefreshCw size={15} className="animate-spin" style={{ color: "#2563eb" }} />
          Loading the execution plan…
        </div>
      );
    }
    if (!plan) {
      return (
        <EmptyDiagram
          title={`${title} needs an execution plan`}
          reason={
            planNotGenerated
              ? "This proposal has no execution plan yet. Generating one adds the week-by-week schedule, the architecture graph, role capacity, and requirement traceability."
              : "The execution plan could not be loaded, so this diagram has nothing to draw. Every other section of this step is unaffected."
          }
          action={{
            label: planGenerating ? "Generating plan…" : "Generate detailed plan",
            onClick: () => generatePlan(),
            disabled: planGenerating || !parsedProposalId,
          }}
        />
      );
    }
    if (section && !section.available) {
      return <EmptyDiagram title={`${title} is not available yet`} reason={section} />;
    }
    return <DeferredViz load={load} title={title} {...props} />;
  };

  /**
   * Phase-level timeline straight from the v1 proposal. It stays reachable
   * whenever the week-by-week breakdown cannot be shown, so a proposal without
   * a plan still has a timeline to review (Requirement 10.5).
   */
  const renderPhaseTimeline = () => {
    const timeline = parsedProposal?.timeline || [];
    if (timeline.length === 0) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {timeline.map((phase, idx) => (
          <div className="panel-card" key={phase.phase + idx}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  border: "2px solid #bfdbfe",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#2563eb",
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{phase.phase}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Duration: {phase.duration}</div>
              </div>
              <span className="panel-badge panel-badge--blue">{phase.duration}</span>
            </div>

            {/* Tasks */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tasks
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {phase.tasks.map((task, ti) => (
                  <div key={task + ti} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                    <Check size={14} style={{ color: "#16a34a" }} />
                    {task}
                  </div>
                ))}
              </div>
            </div>

            {/* Dependencies */}
            {phase.dependencies?.length > 0 && (
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Dependencies
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {phase.dependencies.map((dep, di) => (
                    <span key={dep + di} className="panel-badge panel-badge--outline" style={{ fontSize: 11 }}>
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  /** "Show more" affordance for a progressively disclosed list. */
  const renderShowMore = (key, slice, noun) =>
    slice.hasMore ? (
      <div style={{ gridColumn: "1 / -1", textAlign: "center" }}>
        <button type="button" className="panel-btn--ghost panel-btn" onClick={() => showMore(key)}>
          Show more {noun} ({slice.remaining} of {slice.total} not shown)
        </button>
      </div>
    ) : null;

  /* ── Tab content renderer ── */
  const renderTabContent = () => {
    const emptyState = (label) => (
      <div className="panel-card" style={{ gridColumn: "1 / -1" }}>
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
          <Sparkles size={28} />
          <span style={{ fontSize: 13 }}>
            Generate a proposal to see {label}.
          </span>
        </div>
      </div>
    );

    switch (activeTab) {
      /* ── SCOPE OUTLINE ── */
      case "scope": {
        const scopeSlice = discloseSlice(displayScope, SECTION_PAGE_SIZE, pagesShown.scope ?? 1);
        return (
          <div className="panel-grid panel-grid--3">
            {/* Proposed scope */}
            <div className="panel-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                Proposed scope{scopeSlice.total > 0 ? ` (${scopeSlice.total})` : ""}
              </h3>
              {scopeSlice.total > 0 ? (
                scopeSlice.visible.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                          <Icon size={14} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</div>
                        </div>
                        <span
                          className={`panel-badge panel-badge--${item.badgeColor || "blue"}`}
                          style={{ flexShrink: 0 }}
                        >
                          {item.badge}
                        </span>
                      </div>
                      {typeof item.confidencePct === "number" && (
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                          Confidence {item.confidence || "—"} · {item.confidencePct}/100
                        </div>
                      )}
                      <ScoreBasisNote basis={item.scoreBasis} label="How this confidence was reached" />
                    </div>
                  );
                })
              ) : (
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  Generate a proposal to see the scope outline.
                </p>
              )}
              {scopeSlice.hasMore && (
                <button
                  type="button"
                  className="panel-link"
                  style={{ marginTop: 12 }}
                  onClick={() => showMore("scope")}
                >
                  Show more scope items ({scopeSlice.remaining} of {scopeSlice.total} not shown)
                </button>
              )}
              <button type="button" className="panel-link" style={{ marginTop: 12 }}>
                <Plus size={14} /> Add custom item
              </button>
            </div>

            {/* Acceptance criteria + Deliverables */}
            <div className="panel-card">
              <div className="panel-card-header">
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                  Acceptance criteria ({parsedProposal?.timeline?.[0]?.tasks?.length || 0})
                </h3>
                <button type="button" className="panel-link" style={{ fontSize: 12 }}>
                  View all
                </button>
              </div>
              {parsedProposal?.timeline?.[0]?.tasks ? (
                parsedProposal.timeline[0].tasks.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 0",
                      fontSize: 13,
                      color: "#334155",
                    }}
                  >
                    <Check size={16} style={{ color: "#16a34a" }} />
                    {item}
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  No criteria defined.
                </p>
              )}

              <hr className="panel-divider" />

              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Deliverables
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {parsedProposal?.delivery_plan?.roadmap?.length > 0 ? (
                  parsedProposal.delivery_plan.roadmap.slice(0, 3).map((d) => (
                    <span key={d.id} className="panel-badge panel-badge--outline">
                      <FileText size={12} /> {d.title}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>No deliverables defined yet</span>
                )}
              </div>
            </div>

            {/* Next steps */}
            <div className="panel-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                Next steps
              </h3>
              {nextSteps.map((step) => (
                <div
                  key={step.num}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#f8fafc",
                      border: "1.5px solid #e2e8f0",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      flexShrink: 0,
                    }}
                  >
                    {step.num}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                      {step.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{step.desc}</div>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="panel-btn"
                  style={{ width: "100%" }}
                  onClick={() => setDashboardTab("agreement-composer")}
                  disabled={!isProposalGenerated}
                >
                  Continue to structured scope <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      }

      /* ── RISK ANALYSIS ── */
      case "risks": {
        const risks = parsedProposal?.risks || [];
        if (risks.length === 0) return emptyState("risk analysis");
        const riskSlice = discloseSlice(risks, SECTION_PAGE_SIZE, pagesShown.risks ?? 1);
        return (
          <div className="panel-grid panel-grid--3">
            {riskSlice.visible.map((risk, idx) => {
              const severityColor = risk.severity >= 70 ? "#ef4444" : risk.severity >= 40 ? "#f59e0b" : "#16a34a";
              const severityBg = risk.severity >= 70 ? "#fef2f2" : risk.severity >= 40 ? "#fffbeb" : "#f0fdf4";
              const badge = risk.severity >= 70 ? "High" : risk.severity >= 40 ? "Medium" : "Low";
              return (
                <div className="panel-card" key={risk.label + idx}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: severityBg,
                        display: "grid",
                        placeItems: "center",
                        color: severityColor,
                        flexShrink: 0,
                      }}
                    >
                      <AlertTriangle size={18} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                          {risk.label}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: severityBg,
                            color: severityColor,
                          }}
                        >
                          {badge}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: "#f1f5f9",
                          color: "#475569",
                          fontWeight: 600,
                        }}
                      >
                        {risk.category}
                      </span>
                    </div>
                  </div>

                  {/* Severity bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                      <span>Severity</span>
                      <span style={{ fontWeight: 700, color: severityColor }}>{risk.severity}/100</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${risk.severity}%`,
                          borderRadius: 3,
                          background: severityColor,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>

                  {/* Mitigation */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Mitigation Strategy
                    </span>
                    <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "4px 0 0" }}>
                      {risk.mitigation}
                    </p>
                    <ScoreBasisNote basis={risk.score_basis} label="How this severity was reached" />
                  </div>
                </div>
              );
            })}
            {renderShowMore("risks", riskSlice, "risks")}
          </div>
        );
      }

      /* ── COMPETITOR LANDSCAPE ── */
      case "competitors": {
        const market = parsedProposal?.market || [];
        if (market.length === 0) return emptyState("competitor landscape");
        const marketSlice = discloseSlice(market, SECTION_PAGE_SIZE, pagesShown.competitors ?? 1);
        return (
          <div className="panel-grid panel-grid--3">
            {marketSlice.visible.map((item, idx) => {
              const trendColor = item.trend === "up" ? "#16a34a" : item.trend === "down" ? "#ef4444" : "#f59e0b";
              const trendBg = item.trend === "up" ? "#f0fdf4" : item.trend === "down" ? "#fef2f2" : "#fffbeb";
              const trendLabel = item.trend === "up" ? "↑ Trending Up" : item.trend === "down" ? "↓ Trending Down" : "→ Stable";
              return (
                <div className="panel-card" key={item.title + idx}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <TrendingUp size={18} style={{ color: trendColor }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", flex: 1 }}>
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 10px",
                        borderRadius: 12,
                        background: trendBg,
                        color: trendColor,
                      }}
                    >
                      {trendLabel}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 12px" }}>
                    {item.description}
                  </p>
                  {/* Relevance bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                      <span>Relevance</span>
                      <span style={{ fontWeight: 700 }}>{item.relevance}/100</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${item.relevance}%`,
                          borderRadius: 3,
                          background: "#2563eb",
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <ScoreBasisNote basis={item.score_basis} label="How this relevance was reached" />
                  </div>
                </div>
              );
            })}
            {renderShowMore("competitors", marketSlice, "market signals")}
          </div>
        );
      }

      /* ── IMPACT ANALYSIS ── */
      case "impact": {
        const impact = parsedProposal?.impact || [];
        if (impact.length === 0) return emptyState("impact analysis");
        const impactSlice = discloseSlice(impact, SECTION_PAGE_SIZE, pagesShown.impact ?? 1);
        return (
          <div className="panel-grid panel-grid--3">
            {impactSlice.visible.map((item, idx) => (
              <div className="panel-card" key={item.title + idx}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <BadgeCheck size={18} style={{ color: "#7c3aed", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", flex: 1 }}>
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: "#f1f5f9",
                      color: "#475569",
                      fontWeight: 600,
                    }}
                  >
                    {item.category}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 12px" }}>
                  {item.description}
                </p>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                    <span>Impact</span>
                    <span style={{ fontWeight: 700 }}>{item.impact_score}/100</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${item.impact_score}%`,
                        borderRadius: 3,
                        background: "#7c3aed",
                      }}
                    />
                  </div>
                  <ScoreBasisNote basis={item.score_basis} label="How this impact score was reached" />
                </div>
              </div>
            ))}
            {renderShowMore("impact", impactSlice, "impact items")}
          </div>
        );
      }

      /* ── TECHNICAL ARCHITECTURE ── */
      case "architecture": {
        const features = parsedProposal?.features || [];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* The plan's own component graph — the authoritative architecture. */}
            {renderPlanDiagram({
              load: loadArchitectureGraph,
              title: "Architecture graph",
              plan,
              diagnostics,
              onGenerate: () => generatePlan(),
              generating: planGenerating,
            })}

            {/* Per-feature technical approach from the proposal itself. */}
            {features.length > 0 && (
              <div className="panel-grid panel-grid--2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {features.map((f, idx) => (
                  <div className="panel-card" key={f.title + idx}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "#eff6ff",
                          display: "grid",
                          placeItems: "center",
                          color: "#2563eb",
                          flexShrink: 0,
                        }}
                      >
                        <Code2 size={16} />
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{f.title}</div>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "1px 8px",
                            borderRadius: 10,
                            background: "#f1f5f9",
                            color: "#64748b",
                            fontWeight: 600,
                          }}
                        >
                          {f.area}
                        </span>
                      </div>
                      <span
                        className={`panel-badge panel-badge--${f.complexity === "High" ? "orange" : f.complexity === "Medium" ? "blue" : "green"}`}
                        style={{ flexShrink: 0 }}
                      >
                        {f.complexity}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Technical Approach
                      </span>
                      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "4px 0 0" }}>
                        {f.technical_approach}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      /* ── REQUIREMENT TRACEABILITY ── */
      case "traceability":
        return renderPlanDiagram({
          load: loadTraceabilityMatrix,
          title: "Requirement traceability",
          section: availability.traceability,
          plan,
          diagnostics,
        });

      /* ── WEEK BY WEEK ── */
      case "weeks":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {renderPlanDiagram({
              load: loadWeekDetail,
              title: "Week-by-week timeline",
              section: availability.weeks,
              plan,
              diagnostics,
              // The v1 phases, so a milestone expands into its weeks in place
              // without leaving the step (Requirement 3.4).
              phases: parsedProposal?.timeline,
            })}
            {/* Phase durations remain the only timeline a proposal without a
                weekly breakdown has, so they are never hidden behind the plan. */}
            {(!plan || !availability.weeks.available) && renderPhaseTimeline()}
          </div>
        );

      /* ── TASK SCHEDULE ── */
      case "schedule":
        return renderPlanDiagram({
          load: loadScheduleGantt,
          title: "Task schedule",
          plan,
          diagnostics,
          onGenerate: () => generatePlan(),
          generating: planGenerating,
        });

      /* ── ROLE CAPACITY ── */
      case "capacity":
        return renderPlanDiagram({
          load: loadCapacityHeatmap,
          title: "Role capacity",
          section: availability.capacity,
          plan,
          diagnostics,
        });

      /* ── REQUIRED ROLES ── */
      case "roles": {
        const effort = parsedProposal?.effort || [];
        if (effort.length === 0) return emptyState("required roles");
        return (
          <div className="panel-grid panel-grid--3">
            {effort.map((role, idx) => (
              <div className="panel-card" key={role.label + idx}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#f0fdf4",
                      display: "grid",
                      placeItems: "center",
                      color: "#16a34a",
                      flexShrink: 0,
                    }}
                  >
                    <Users size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{role.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{role.timeframe}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#2563eb",
                    }}
                  >
                    {role.percentage}%
                  </span>
                </div>

                {/* Effort bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${role.percentage}%`,
                        borderRadius: 4,
                        background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        );
      }

      default:
        return emptyState("this section");
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 className="panel-page-title">AI Project Proposal Generator</h1>
            <p className="panel-page-subtitle">
              Describe your idea and our AI will generate a complete, evidence-ready project proposal.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            <button
              type="button"
              className="panel-btn--ghost panel-btn"
              onClick={handleOpenDrafts}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <FolderOpen size={14} style={{ color: "#2563eb" }} />
              <span>Load saved draft</span>
            </button>

            {/* More Options Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="panel-btn--ghost panel-btn"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                style={{ padding: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="More Options"
              >
                <MoreHorizontal size={16} />
              </button>

              {showMoreMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                    zIndex: 1000,
                    width: 210,
                    padding: "6px 0",
                    animation: "briefTooltipFadeIn 0.2s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleExportProposal}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 14px",
                      background: "none",
                      border: "none",
                      fontSize: 13,
                      color: "#334155",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <Download size={14} style={{ color: "#2563eb" }} />
                    Export Markdown (.md)
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyBrief}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 14px",
                      background: "none",
                      border: "none",
                      fontSize: 13,
                      color: "#334155",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <Copy size={14} style={{ color: "#16a34a" }} />
                    {copyToast ? "Copied!" : "Copy Raw Brief"}
                  </button>

                  <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />

                  <button
                    type="button"
                    onClick={handleStartNew}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 14px",
                      background: "none",
                      border: "none",
                      fontSize: 13,
                      color: "#dc2626",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <RotateCcw size={14} />
                    Start New Proposal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal stepper — sequential, approval-gated */}
      <div className="panel-stepper">
        {proposalSteps.map((step, i) => {
          const approved = approvedSteps.includes(step.num);
          const unlocked = isStepUnlocked(step.num);
          const isActive = step.num === activeStep;
          return (
            <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
              <div
                className={`panel-step${isActive ? " panel-step--active" : approved ? " panel-step--done" : ""}`}
                onClick={() => {
                  // A step can only be opened once it is unlocked (previous approved).
                  if (unlocked) goToStep(step.num);
                }}
                style={{ cursor: unlocked ? "pointer" : "not-allowed", opacity: unlocked ? 1 : 0.45 }}
                title={unlocked ? undefined : "Approve the previous step to unlock this one"}
              >
                <span className="panel-step-num">
                  {approved ? <Check size={12} /> : unlocked ? step.num : <Lock size={11} />}
                </span>
                {step.label}
              </div>
              {i < proposalSteps.length - 1 && (
                <ArrowRight size={14} className="panel-step-arrow" />
              )}
            </div>
          );
        })}
      </div>

      {/* Sequential approval bar — the client approves each section to unlock the next */}
      <div
        className="panel-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: approvedSteps.includes(activeStep) ? "#f0fdf4" : "#eff6ff",
              color: approvedSteps.includes(activeStep) ? "#16a34a" : "#2563eb",
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {approvedSteps.includes(activeStep) ? <Check size={15} /> : activeStep}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              Step {activeStep} — {proposalSteps[activeStep - 1].label}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {!hasProposal
                ? "Generate a proposal to begin the approval flow."
                : approvedSteps.includes(activeStep)
                ? "Approved. You can move on to the next step."
                : activeStep === 1
                ? "The brief is captured — generate a proposal to approve it."
                : "Review this section, then approve to unlock the next step."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activeStep > 1 && (
            <button
              type="button"
              className="panel-btn--ghost panel-btn"
              onClick={() => goToStep(activeStep - 1)}
            >
              Back
            </button>
          )}
          {approvedSteps.includes(activeStep) ? (
            <span className="panel-badge panel-badge--green">
              <Check size={12} /> Approved
            </span>
          ) : activeStep === 1 ? (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Awaiting proposal generation</span>
          ) : (
            <button
              type="button"
              className="panel-btn"
              disabled={!hasProposal}
              onClick={() => {
                approveStep(activeStep);
                if (activeStep === 5) setDashboardTab("agreement-composer");
              }}
            >
              <Check size={14} /> {STEP_APPROVE_LABEL[activeStep]}
            </button>
          )}
        </div>
      </div>

      {/* Depth limited by the brief — the proposal explains its own thinness
          instead of looking complete (Requirement 1.3). */}
      {depthLimited && (
        <div
          role="note"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "12px 14px",
            marginBottom: 20,
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 13,
          }}
        >
          <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>This proposal is intentionally less detailed</div>
            <p style={{ margin: "2px 0 0", lineHeight: 1.6 }}>
              {depthReport.note ||
                (depthReport.limitReason === "brief_too_short"
                  ? "The brief was too short to support a fuller breakdown, so fewer items were produced rather than padding the proposal with generic entries."
                  : depthReport.limitReason === "degraded"
                  ? "The analysis ran in a degraded mode, so the result is deliberately limited and nothing was synthesised to fill it out."
                  : "Some sections came back shorter than the target, so they are reported as they are rather than padded.")}
            </p>
            {shortSections.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Which sections are short
                </summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                  {shortSections.map((entry) => (
                    <li key={entry.section}>
                      {entry.section}: {entry.actual} of {entry.target} targeted
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Step 1 — describe idea + AI summary + intelligence at a glance */}
      {activeStep === 1 && (
      <div className="panel-grid panel-grid--3">
        {/* Left: Describe idea */}
        <div className="panel-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            1. Describe your project idea
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
            Tell us what you want to build and why.
          </p>

          <textarea
            data-lenis-prevent="true"
            data-tour="idea-input"
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            rows={6}
            placeholder="Describe what you want to build and why. Then run guided discovery below to complete the brief."
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#0f172a",
              resize: "vertical",
              fontFamily: "inherit",
              marginBottom: 12,
              background: "#fff",
            }}
          />

          {/* Requirement Discovery Agent — Talent section only. Turns the idea
              above into a complete brief via adaptive Q&A, then triggers the
              existing brief-parse flow so the proposal can be generated. */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 14,
              marginBottom: 12,
              background: "#fbfdff",
            }}
          >
            <DiscoveryWizard
              initialRequest={ideaText}
              onBriefReady={(briefText) => {
                setIdeaText(briefText);
                runBriefParse(briefText);
              }}
            />
          </div>

          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
            Attach reference <span style={{ color: "#cbd5e1" }}>(optional)</span>
          </p>
          <div
            style={{
              border: "1.5px dashed #e2e8f0",
              borderRadius: 8,
              padding: "14px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
              marginBottom: 12,
            }}
          >
            <Paperclip size={14} style={{ display: "inline", marginRight: 4 }} />
            Drag files here or <span style={{ color: "#2563eb", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>browse</span>
          </div>

          <div style={{ textAlign: "right", fontSize: 11, color: "#cbd5e1", marginBottom: 12 }}>
            {ideaText.length} / 2000
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !parsedProposal}
            className="panel-btn"
            style={{ width: "100%" }}
          >
            {generating ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Generate proposal
              </>
            )}
          </button>
        </div>

        {/* Center: AI summary preview */}
        <div className="panel-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-card-header">
            <h2 className="panel-card-title">AI summary preview</h2>
            {isProposalGenerated && (
              <span className="panel-badge panel-badge--green">Generated</span>
            )}
          </div>

          {displaySummary.length > 0 && (isProposalGenerated || generating) ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div className="fixflow-custom-scroll" style={{ maxHeight: 250, paddingRight: 4, flex: 1 }}>
                {displaySummary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <Icon size={16} style={{ color: "#2563eb", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#64748b", minWidth: 120 }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                        {item.value}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="panel-link"
                style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}
                onClick={handleViewFullSummary}
              >
                View full summary <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 220,
                color: "#94a3b8",
                textAlign: "center",
                gap: 8,
              }}
            >
              <Sparkles size={28} />
              <span style={{ fontSize: 13 }}>
                Generate a proposal to see the AI summary.
              </span>
            </div>
          )}
        </div>

        {/* Right: Intelligence at a glance */}
        <div className="panel-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-card-header">
            <h2 className="panel-card-title">Intelligence at a glance</h2>
          </div>

          {displayIntelligence.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div className="fixflow-custom-scroll" style={{ maxHeight: 250, paddingRight: 4, flex: 1 }}>
                {displayIntelligence.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
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
                          background: item.color + "15",
                          display: "grid",
                          placeItems: "center",
                          color: item.color,
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={15} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                            {item.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 12,
                              background: item.color + "15",
                              color: item.color,
                            }}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          {item.value}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="panel-link"
                style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}
                onClick={handleViewFullIntelligence}
              >
                View full intelligence report <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#64748b", padding: "10px 0", textAlign: "center" }}>
              No risk insights. Generate a proposal to populate risks.
            </p>
          )}
        </div>
      </div>
      )}

      {/* Steps 2-4 — grouped detail views, shown only for the current step */}
      {activeStep >= 2 && activeStep <= 4 && (
      <div style={{ marginTop: 8 }} ref={tabsRef}>
        {/* Section navigation for this step. Selecting a section changes nothing
            but the section: no scrolling, no step change (Requirement 10.1). */}
        <div
          role="tablist"
          aria-label={`${proposalSteps[activeStep - 1].label} sections`}
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid #e2e8f0",
            marginBottom: 20,
            overflowX: "auto",
            maxWidth: "100%",
          }}
        >
          {stepTabs.map((tab, idx) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`proposal-section-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`proposal-section-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  if (node) sectionTabRefs.current.set(tab.id, node);
                  else sectionTabRefs.current.delete(tab.id);
                }}
                onClick={() => selectSection(tab.id)}
                onKeyDown={(event) => handleSectionKeyDown(event, idx, stepTabs)}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  borderBottom: selected ? "2px solid #2563eb" : "2px solid transparent",
                  background: "transparent",
                  color: selected ? "#2563eb" : "#64748b",
                  fontSize: 13,
                  fontWeight: selected ? 700 : 500,
                  cursor: "pointer",
                  transition: "color 150ms ease",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* A plan that failed to load is reported here while every other section
            of the step keeps rendering (Requirement 11.4). */}
        {planError && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 12px",
              marginBottom: 16,
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fee2e2",
              color: "#991b1b",
              fontSize: 13,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{planError}</div>
              <p style={{ margin: "2px 0 8px", color: "#b91c1c" }}>
                The proposal itself is unaffected — only the plan-driven diagrams are missing.
              </p>
              <button type="button" className="panel-btn panel-btn--ghost" onClick={() => reloadPlan()}>
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          </div>
        )}

        {/* Section content — renders based on activeTab */}
        <div
          role="tabpanel"
          id={`proposal-section-panel-${activeTab}`}
          aria-labelledby={`proposal-section-tab-${activeTab}`}
        >
          {renderTabContent()}
        </div>
      </div>
      )}

      {/* Step 5 — review & finalize (all prior steps must be approved) */}
      {activeStep === 5 && (
        <div className="panel-card" style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Review & finalize</h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px" }}>
            Each section below was approved in sequence. Finalizing sends this proposal to the Agreement step.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proposalSteps.slice(0, 4).map((s) => {
              const ok = approvedSteps.includes(s.num);
              return (
                <div
                  key={s.num}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "1px solid #f1f5f9",
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: ok ? "#f0fdf4" : "#fef2f2",
                      color: ok ? "#16a34a" : "#ef4444",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {ok ? <Check size={13} /> : <Lock size={11} />}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: ok ? "#16a34a" : "#94a3b8" }}>
                    {ok ? "Approved" : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>

          <hr className="panel-divider" />

          {/* What the client is committing to, end to end. Deferred like every
              other diagram so its chunk only loads when this step is viewed. */}
          <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>
            How this project moves from here
          </h4>
          <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 12px" }}>
            Every stage, who owns it, and which decisions gate it — including the ones that are not
            yours to make.
          </p>
          <DeferredViz
            load={loadProjectWorkflowMap}
            title="Project workflow"
            reserveHeight={280}
            workflow={workflowForMap}
            planStatus={planStatus}
            matchWorkflow={matchResults}
            milestones={milestones}
          />
        </div>
      )}

      {/* ── FULL SUMMARY MODAL ── */}
      {showSummaryModal && (
        <div className="fixflow-modal-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="fixflow-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fixflow-modal-header">
              <h3 className="fixflow-modal-title">
                <Sparkles size={20} style={{ color: "#2563eb" }} />
                Full AI Project Proposal Summary
              </h3>
              <button
                type="button"
                className="panel-btn--ghost"
                onClick={() => setShowSummaryModal(false)}
                style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fixflow-modal-body fixflow-custom-scroll">
              <div style={{ marginBottom: 20, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Project Executive Summary
                </h4>
                <p style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.6, margin: 0 }}>
                  {parsedProposal?.project_summary || "No parsed summary available."}
                </p>
              </div>

              {/* Scope Breakdown */}
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                Extracted Deliverables & Scope ({parsedProposal?.features?.length || 0})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {parsedProposal?.features?.map((f, i) => (
                  <div key={f.title + i} style={{ padding: 12, border: "1px solid #f1f5f9", borderRadius: 8, background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{f.title}</span>
                      <span className={`panel-badge panel-badge--${f.complexity === "High" ? "orange" : f.complexity === "Medium" ? "blue" : "green"}`}>
                        {f.complexity} Complexity
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 8px" }}>{f.description}</p>
                    <div style={{ fontSize: 12, color: "#64748b", background: "#f8fafc", padding: "6px 10px", borderRadius: 6 }}>
                      <strong>Technical Approach:</strong> {f.technical_approach}
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline Breakdown */}
              {parsedProposal?.timeline?.length > 0 && (
                <>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                    Phased Execution Roadmap
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {parsedProposal.timeline.map((phase, idx) => (
                      <div key={phase.phase + idx} style={{ padding: 12, border: "1px solid #f1f5f9", borderRadius: 8, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                          <span>Phase {idx + 1}: {phase.phase}</span>
                          <span style={{ color: "#2563eb" }}>{phase.duration}</span>
                        </div>
                        <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#475569" }}>
                          {phase.tasks.map((t, ti) => (
                            <li key={t + ti}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="fixflow-modal-footer">
              <button
                type="button"
                className="panel-btn--ghost panel-btn"
                onClick={() => setShowSummaryModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="panel-btn"
                onClick={() => {
                  setShowSummaryModal(false);
                  selectSection("scope");
                }}
              >
                View Scope Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL INTELLIGENCE REPORT MODAL ── */}
      {showIntelligenceModal && (
        <div className="fixflow-modal-overlay" onClick={() => setShowIntelligenceModal(false)}>
          <div className="fixflow-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fixflow-modal-header">
              <h3 className="fixflow-modal-title">
                <AlertTriangle size={20} style={{ color: "#f59e0b" }} />
                Full Intelligence & Risk Analysis Report
              </h3>
              <button
                type="button"
                className="panel-btn--ghost"
                onClick={() => setShowIntelligenceModal(false)}
                style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fixflow-modal-body fixflow-custom-scroll">
              {/* Risk Analysis Section */}
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                Identified Technical & Operational Risks ({parsedProposal?.risks?.length || 0})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {parsedProposal?.risks?.map((risk, idx) => {
                  const severityColor = risk.severity >= 70 ? "#ef4444" : risk.severity >= 40 ? "#f59e0b" : "#16a34a";
                  const severityBg = risk.severity >= 70 ? "#fef2f2" : risk.severity >= 40 ? "#fffbeb" : "#f0fdf4";
                  return (
                    <div key={risk.label + idx} style={{ padding: 14, border: "1px solid #f1f5f9", borderRadius: 10, background: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{risk.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 12, background: severityBg, color: severityColor }}>
                          Severity {risk.severity}/100
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Category: <strong>{risk.category}</strong></div>
                      <div style={{ background: "#f8fafc", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                        <strong style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommended Mitigation:</strong>
                        <p style={{ fontSize: 13, color: "#334155", margin: "4px 0 0", lineHeight: 1.5 }}>{risk.mitigation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Market Intelligence */}
              {parsedProposal?.market?.length > 0 && (
                <>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                    Market & Strategic Insights
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {parsedProposal.market.map((m, i) => (
                      <div key={m.title + i} style={{ padding: 12, border: "1px solid #f1f5f9", borderRadius: 8, background: "#fff" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{m.title}</div>
                        <p style={{ fontSize: 12, color: "#475569", margin: "4px 0" }}>{m.description}</p>
                        <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>Relevance Score: {m.relevance}/100</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="fixflow-modal-footer">
              <button
                type="button"
                className="panel-btn--ghost panel-btn"
                onClick={() => setShowIntelligenceModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="panel-btn"
                onClick={() => {
                  setShowIntelligenceModal(false);
                  selectSection("risks");
                }}
              >
                View Risk Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAVED DRAFTS SELECTION MODAL ── */}
      {showDraftsModal && (
        <div className="fixflow-modal-overlay" onClick={() => setShowDraftsModal(false)}>
          <div className="fixflow-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="fixflow-modal-header">
              <h3 className="fixflow-modal-title">
                <FolderOpen size={20} style={{ color: "#2563eb" }} />
                Saved Proposal Drafts & History
              </h3>
              <button
                type="button"
                className="panel-btn--ghost"
                onClick={() => setShowDraftsModal(false)}
                style={{ padding: 6, borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="fixflow-modal-body fixflow-custom-scroll" style={{ maxHeight: 420 }}>
              {draftList.length > 0 && (
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <Search
                    size={14}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search drafts by title, features, or summary..."
                    value={draftSearchQuery}
                    onChange={(e) => setDraftSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      paddingLeft: 30,
                      paddingRight: draftSearchQuery ? 28 : 10,
                      paddingTop: 8,
                      paddingBottom: 8,
                      fontSize: 13,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                  {draftSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDraftSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        display: "grid",
                        placeItems: "center",
                        padding: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {loadingDrafts ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: "#2563eb", marginBottom: 8 }} />
                  <div>Loading saved proposal drafts...</div>
                </div>
              ) : draftList.length > 0 ? (
                (() => {
                  const filteredDrafts = draftList.filter((draft) => {
                    if (!draftSearchQuery.trim()) return true;
                    const q = draftSearchQuery.toLowerCase().trim();
                    const title = (draft.title || "").toLowerCase();
                    const summary = (draft.proposal?.project_summary || "").toLowerCase();
                    return title.includes(q) || summary.includes(q);
                  });

                  if (filteredDrafts.length === 0) {
                    return (
                      <div style={{ textAlign: "center", padding: "30px 20px", color: "#64748b" }}>
                        <SearchX size={32} style={{ color: "#cbd5e1", marginBottom: 8 }} />
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                          No drafts match "{draftSearchQuery}"
                        </h4>
                        <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                          Try a different search keyword.
                        </p>
                        <button
                          type="button"
                          className="panel-btn--ghost panel-btn"
                          onClick={() => setDraftSearchQuery("")}
                          style={{ fontSize: 12 }}
                        >
                          Clear search
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {filteredDrafts.map((draft, idx) => (
                        <div
                          key={draft.proposalId || idx}
                          onClick={() => handleSelectDraft(draft)}
                          style={{
                            padding: 14,
                            border: draft.proposalId === parsedProposalId ? "2px solid #2563eb" : "1px solid #e2e8f0",
                            borderRadius: 10,
                            background: draft.proposalId === parsedProposalId ? "#eff6ff" : "#fff",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (draft.proposalId !== parsedProposalId) e.currentTarget.style.borderColor = "#cbd5e1";
                          }}
                          onMouseLeave={(e) => {
                            if (draft.proposalId !== parsedProposalId) e.currentTarget.style.borderColor = "#e2e8f0";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                              {draft.title || draft.proposal?.project_summary?.slice(0, 50) + "..." || `Draft #${idx + 1}`}
                            </span>
                            {draft.proposalId === parsedProposalId && (
                              <span className="panel-badge panel-badge--blue" style={{ fontSize: 10 }}>Active Workspace</span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: "#475569", margin: "0 0 8px", lineHeight: 1.5 }}>
                            {draft.proposal?.project_summary || "No description available"}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#64748b" }}>
                            <span>Created: {new Date(draft.createdAt || Date.now()).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{draft.proposal?.features?.length || 0} Features</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div style={{ textAlign: "center", padding: "30px 20px", color: "#64748b" }}>
                  <FileText size={36} style={{ color: "#cbd5e1", marginBottom: 8 }} />
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>No Saved Drafts Found</h4>
                  <p style={{ fontSize: 12, color: "#64748b", maxWidth: 280, margin: "0 auto" }}>
                    Submit a project brief to automatically save and parse your proposal draft.
                  </p>
                </div>
              )}
            </div>
            <div className="fixflow-modal-footer">
              <button
                type="button"
                className="panel-btn--ghost panel-btn"
                onClick={() => setShowDraftsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
