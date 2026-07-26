import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutList, Boxes, CalendarRange, GaugeCircle, ClipboardCheck, RefreshCw,
  AlertTriangle, ShieldCheck, Clock, History, Pencil, X, CheckCircle2, Lock, Unlock,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";

/**
 * AI-008 — Deep proposal plan (v2 execution plan).
 *
 * Renders the decision-ready plan (scope modules, architecture, week-by-week
 * timeline, capacity/coverage/risk, checkpoints), lets a client edit fields via
 * an inspector (validated, conflict-safe PATCH), shows deterministic diagnostics,
 * and supports revision restore + approve/reopen. Planning is isolated from
 * escrow — nothing here touches payment state.
 */

const uuid = () =>
  (crypto?.randomUUID?.() || `op-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const STATUS_META = {
  draft: { label: "Draft", bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af" },
  in_review: { label: "In review", bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
  approved: { label: "Approved", bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
  superseded: { label: "Superseded", bg: "#f1f5f9", border: "#e2e8f0", color: "#475569" },
};

function Bar({ value, max, color = "#2563eb", track = "#e2e8f0", label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        role="img"
        aria-label={label || `${value} of ${max}`}
        style={{ flex: 1, height: 8, background: track, borderRadius: 999, overflow: "hidden" }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      {label && <span style={{ fontSize: 12, color: "#64748b", minWidth: 92, textAlign: "right" }}>{label}</span>}
    </div>
  );
}

function Pill({ tone = "info", children }) {
  const tones = {
    ok: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    warn: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
    error: { bg: "#fef2f2", border: "#fee2e2", color: "#991b1b" },
    info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af" },
    muted: { bg: "#f1f5f9", border: "#e2e8f0", color: "#475569" },
  };
  const s = tones[tone] || tones.info;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {children}
    </span>
  );
}

const TABS = [
  { id: "scope", label: "Scope", icon: LayoutList },
  { id: "architecture", label: "Architecture", icon: Boxes },
  { id: "timeline", label: "Timeline", icon: CalendarRange },
  { id: "capacity", label: "Capacity & Risk", icon: GaugeCircle },
  { id: "review", label: "Review", icon: ClipboardCheck },
];

export function ExecutionPlanPanel() {
  const { parsedProposalId } = useLandingStore();
  const [plan, setPlan] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("scope");
  const [revisions, setRevisions] = useState([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [inspector, setInspector] = useState(null); // { kind, id }
  const abortRef = useRef(null);

  const applyResult = (res) => {
    if (res.plan) setPlan(res.plan);
    if (typeof res.currentRevision === "number") setRevision(res.currentRevision);
    if (res.status) setStatus(res.status);
    if (res.diagnostics) setDiagnostics(res.diagnostics);
  };

  const load = () => {
    if (!parsedProposalId) {
      setLoading(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    api
      .getExecutionPlan(parsedProposalId, ac.signal)
      .then((res) => {
        setPlan(res.plan);
        setDiagnostics(res.diagnostics);
        setRevision(res.currentRevision);
        setStatus(res.status);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setPlan(null); // not generated yet
        } else if (err.name !== "AbortError") {
          setError(err instanceof ApiError ? err.message : "Could not load the plan.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedProposalId]);

  const generate = async (scope = "all", confirmOverwrite = false) => {
    setBusy("generate");
    setError("");
    setNotice("");
    try {
      const res = await api.generateExecutionPlan(parsedProposalId, { scope, confirmOverwrite });
      applyResult(res);
      setNotice(scope === "all" ? "Detailed plan generated." : `Regenerated ${scope}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Generation failed.");
    } finally {
      setBusy("");
    }
  };

  // Submit a set of JSON Patch operations for the current plan.
  const submitPatch = async (operations, summary) => {
    setError("");
    setNotice("");
    try {
      const res = await api.patchExecutionPlan(parsedProposalId, {
        baseRevision: revision,
        operationId: uuid(),
        operations,
        summary,
      });
      applyResult(res);
      setNotice(res.merged ? "Saved (merged with a concurrent edit)." : "Saved.");
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("This plan changed elsewhere. Reloading the latest revision.");
        load();
      } else if (err instanceof ApiError && err.status === 422) {
        setError(err.message || "That edit would make the plan invalid.");
      } else {
        setError(err instanceof ApiError ? err.message : "Save failed.");
      }
      return false;
    }
  };

  const openRevisions = async () => {
    setShowRevisions(true);
    try {
      const res = await api.listPlanRevisions(parsedProposalId);
      setRevisions(res.revisions || []);
    } catch {
      setRevisions([]);
    }
  };

  const restore = async (rev) => {
    setBusy(`restore-${rev}`);
    try {
      const res = await api.restorePlanRevision(parsedProposalId, rev, {
        baseRevision: revision,
        operationId: uuid(),
      });
      applyResult(res);
      setNotice(`Restored revision ${rev} as a new revision.`);
      setShowRevisions(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Restore failed.");
    } finally {
      setBusy("");
    }
  };

  const approve = async () => {
    setBusy("approve");
    setError("");
    try {
      const res = await api.approveExecutionPlan(parsedProposalId, revision);
      setStatus(res.status);
      setNotice(`Plan approved at revision ${res.approvedRevision}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approve failed.");
    } finally {
      setBusy("");
    }
  };

  const reopen = async () => {
    setBusy("reopen");
    try {
      const res = await api.reopenExecutionPlan(parsedProposalId);
      setStatus(res.status);
      setNotice("Plan reopened for editing.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reopen failed.");
    } finally {
      setBusy("");
    }
  };

  if (!parsedProposalId) {
    return (
      <div className="panel-page-header">
        <h1 className="panel-page-title">Project plan</h1>
        <p className="panel-page-subtitle">Create or open a proposal first, then generate its detailed plan.</p>
      </div>
    );
  }

  const readonly = status === "approved";

  return (
    <div>
      <div className="panel-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="panel-page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarRange size={22} style={{ color: "#2563eb" }} /> Project plan
            </h1>
            <p className="panel-page-subtitle">
              A decision-ready, editable execution plan. Numbers are computed deterministically, not guessed.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {plan && <Pill tone="muted">Rev {revision}</Pill>}
            {plan && (
              <span style={{ ...pillBox(STATUS_META[status]) }}>{STATUS_META[status]?.label || status}</span>
            )}
            <button type="button" className="panel-btn panel-btn--ghost" onClick={load} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
            {plan && (
              <button type="button" className="panel-btn panel-btn--ghost" onClick={openRevisions}>
                <History size={14} /> History
              </button>
            )}
          </div>
        </div>
      </div>

      {notice && <Banner tone="ok">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {plan?.degraded && (
        <Banner tone="warn">
          AI details were unavailable — this is a minimal placeholder plan. Regenerate once the AI service is reachable.
        </Banner>
      )}

      {loading ? (
        <p style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Loading plan…</p>
      ) : !plan ? (
        <div className="panel-card" style={{ textAlign: "center", padding: 32 }}>
          <Boxes size={28} style={{ color: "#94a3b8", marginBottom: 8 }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>No detailed plan yet</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
            Generate a scope, architecture, and week-by-week plan from this proposal.
          </p>
          <button type="button" className="panel-btn" onClick={() => generate("all")} disabled={busy === "generate"}>
            {busy === "generate" ? "Generating…" : "Generate detailed plan"}
          </button>
        </div>
      ) : (
        <>
          {diagnostics && <ReadinessStrip diagnostics={diagnostics} />}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0" }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="panel-btn panel-btn--ghost"
                  style={active ? { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e40af" } : undefined}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === "scope" && <ScopeTab plan={plan} diagnostics={diagnostics} onEdit={readonly ? null : setInspector} />}
          {tab === "architecture" && (
            <ArchitectureTab plan={plan} onRegenerate={readonly ? null : () => generate("architecture")} busy={busy === "generate"} />
          )}
          {tab === "timeline" && <TimelineTab plan={plan} onEdit={readonly ? null : setInspector} onRegenerate={readonly ? null : () => generate("timeline")} busy={busy === "generate"} />}
          {tab === "capacity" && <CapacityTab plan={plan} diagnostics={diagnostics} />}
          {tab === "review" && (
            <ReviewTab
              plan={plan}
              diagnostics={diagnostics}
              status={status}
              revision={revision}
              onApprove={approve}
              onReopen={reopen}
              busy={busy}
            />
          )}
        </>
      )}

      {inspector && (
        <Inspector
          inspector={inspector}
          plan={plan}
          onClose={() => setInspector(null)}
          onSubmit={submitPatch}
        />
      )}

      {showRevisions && (
        <RevisionDrawer
          revisions={revisions}
          currentRevision={revision}
          onRestore={restore}
          onClose={() => setShowRevisions(false)}
          busy={busy}
        />
      )}
    </div>
  );
}

function pillBox(meta) {
  const s = meta || STATUS_META.draft;
  return {
    display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: s.bg, border: `1px solid ${s.border}`, color: s.color,
  };
}

function Banner({ tone, children }) {
  const tones = {
    ok: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", Icon: ShieldCheck },
    warn: { bg: "#fffbeb", border: "#fde68a", color: "#b45309", Icon: AlertTriangle },
    error: { bg: "#fef2f2", border: "#fee2e2", color: "#991b1b", Icon: AlertTriangle },
  };
  const s = tones[tone] || tones.ok;
  const Icon = s.Icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      <Icon size={16} /> {children}
    </div>
  );
}

function ReadinessStrip({ diagnostics }) {
  const cov = `${diagnostics.coveredRequirementCount}/${diagnostics.totalRequirementCount}`;
  const cards = [
    { label: "Requirements covered", value: cov, tone: diagnostics.coveredRequirementCount === diagnostics.totalRequirementCount ? "ok" : "warn" },
    { label: "Weeks", value: String(diagnostics.weekCount), tone: "info" },
    { label: "Tasks", value: String(diagnostics.taskCount), tone: "info" },
    { label: "Errors", value: String(diagnostics.errorCount), tone: diagnostics.errorCount ? "error" : "ok" },
    { label: "Warnings", value: String(diagnostics.warningCount), tone: diagnostics.warningCount ? "warn" : "ok" },
    { label: "Blocking questions", value: String(diagnostics.unresolvedQuestionCount), tone: diagnostics.unresolvedQuestionCount ? "warn" : "ok" },
  ];
  return (
    <div className="panel-grid panel-grid--3" style={{ gap: 10 }}>
      {cards.map((c) => (
        <div key={c.label} className="panel-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>{c.label}</span>
          <Pill tone={c.tone}>{c.value}</Pill>
        </div>
      ))}
    </div>
  );
}

function ScopeTab({ plan, diagnostics, onEdit }) {
  const coverage = diagnostics?.scopeCoverage || [];
  const reqById = Object.fromEntries((plan.requirements || []).map((r) => [r.id, r]));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Requirement coverage</h3>
        {coverage.length === 0 && <p style={{ fontSize: 13, color: "#64748b" }}>No requirements recorded.</p>}
        {coverage.map((c) => (
          <div key={c.requirementId} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
              <span style={{ color: "#334155" }}>{reqById[c.requirementId]?.statement || c.requirementId}</span>
              <Pill tone={c.covered ? "ok" : "warn"}>{c.covered ? "Covered" : "Uncovered"}</Pill>
            </div>
            <Bar value={c.taskIds.length} max={Math.max(1, c.taskIds.length)} color={c.covered ? "#16a34a" : "#f59e0b"} label={`${c.taskIds.length} task(s)`} />
          </div>
        ))}
      </div>

      {(plan.scopeModules || []).map((m) => (
        <div key={m.id} className="panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 2px" }}>{m.name}</h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{m.businessObjective}</p>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Pill tone="muted">{m.complexity}</Pill>
              {onEdit && (
                <button type="button" className="panel-btn panel-btn--ghost" style={{ fontSize: 12 }} onClick={() => onEdit({ kind: "module", id: m.id })}>
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <strong style={{ color: "#334155" }}>Acceptance criteria</strong>
            <ul style={{ margin: "4px 0 8px 18px", color: "#475569" }}>
              {m.acceptanceCriteria.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
            {m.outOfScope?.length > 0 && (
              <p style={{ margin: 0, color: "#94a3b8" }}><strong>Out of scope:</strong> {m.outOfScope.join("; ")}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchitectureTab({ plan, onRegenerate, busy }) {
  const arch = plan.architecture;
  if (!arch) {
    return (
      <div className="panel-card" style={{ textAlign: "center", padding: 24 }}>
        <p style={{ color: "#64748b", fontSize: 14 }}>No architecture in this plan.</p>
        {onRegenerate && (
          <button type="button" className="panel-btn" onClick={onRegenerate} disabled={busy}>Generate architecture</button>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 14, color: "#334155" }}>{arch.summary}</p>
        {onRegenerate && (
          <button type="button" className="panel-btn panel-btn--ghost" onClick={onRegenerate} disabled={busy} style={{ flexShrink: 0 }}>
            <RefreshCw size={14} /> Regenerate
          </button>
        )}
      </div>
      <div className="panel-grid panel-grid--2">
        {arch.components.map((c) => (
          <div key={c.id} className="panel-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{c.name}</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>{c.responsibility}</p>
            <dl style={{ fontSize: 12.5, color: "#475569", margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <dt style={{ fontWeight: 600 }}>Data</dt><dd style={{ margin: 0 }}>{c.dataBoundary}</dd>
              <dt style={{ fontWeight: 600 }}>Interfaces</dt><dd style={{ margin: 0 }}>{c.interfaces.join(", ")}</dd>
              <dt style={{ fontWeight: 600 }}>Failure</dt><dd style={{ margin: 0 }}>{c.errorHandling}</dd>
              {c.scaling && (<><dt style={{ fontWeight: 600 }}>Scaling</dt><dd style={{ margin: 0 }}>{c.scaling}</dd></>)}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineTab({ plan, onEdit, onRegenerate, busy }) {
  const tasksById = Object.fromEntries((plan.tasks || []).map((t) => [t.id, t]));
  const cpById = Object.fromEntries((plan.checkpoints || []).map((c) => [c.id, c]));
  const delById = Object.fromEntries((plan.deliverables || []).map((d) => [d.id, d]));
  const roleName = (id) => (plan.teamCapacity || []).find((r) => r.roleId === id)?.roleName || id;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {onRegenerate && (
          <button type="button" className="panel-btn panel-btn--ghost" onClick={onRegenerate} disabled={busy}>
            <RefreshCw size={14} /> Regenerate timeline
          </button>
        )}
      </div>
      {(plan.weeks || []).map((w) => (
        <div key={w.id} className="panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              {w.label} <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 13 }}>— {w.objective}</span>
            </h3>
            {onEdit && (
              <button type="button" className="panel-btn panel-btn--ghost" style={{ fontSize: 12 }} onClick={() => onEdit({ kind: "week", id: w.id })}>
                <Pencil size={12} /> Edit
              </button>
            )}
          </div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {w.taskIds.map((tid) => {
              const t = tasksById[tid];
              if (!t) return null;
              return (
                <div key={tid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.title}</div>
                    <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      {roleName(t.ownerRoleId)} · {t.estimateHours}h · wk {t.startWeek}–{t.endWeek}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Pill tone={t.status === "done" ? "ok" : t.status === "blocked" ? "error" : "muted"}>{t.status}</Pill>
                    {onEdit && (
                      <button type="button" className="panel-btn panel-btn--ghost" style={{ fontSize: 11 }} onClick={() => onEdit({ kind: "task", id: t.id })}>
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {w.deliverableIds?.length > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#475569" }}>
              <strong>Deliverables:</strong> {w.deliverableIds.map((d) => delById[d]?.title || d).join(", ")}
            </p>
          )}
          {w.checkpointIds?.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {w.checkpointIds.map((cid) => {
                const cp = cpById[cid];
                if (!cp) return null;
                return <Pill key={cid} tone={cp.blocking ? "warn" : "info"}><ClipboardCheck size={11} /> {cp.title}</Pill>;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CapacityTab({ plan, diagnostics }) {
  const capacity = diagnostics?.capacity || [];
  const roleName = (id) => (plan.teamCapacity || []).find((r) => r.roleId === id)?.roleName || id;
  const risks = plan.risks || [];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Capacity vs demand (per role / week)</h3>
        {capacity.length === 0 && <p style={{ fontSize: 13, color: "#64748b" }}>No scheduled work yet.</p>}
        {capacity.map((c, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
              <span style={{ color: "#334155" }}>{roleName(c.roleId)} · week {c.weekNumber}</span>
              <span style={{ color: c.state === "over" ? "#991b1b" : c.state === "warning" ? "#b45309" : "#64748b" }}>
                {c.plannedHours}h planned{c.capacityHours != null ? ` / ${c.capacityHours}h capacity` : " / capacity unknown"}
              </span>
            </div>
            <Bar
              value={c.plannedHours}
              max={c.capacityHours || c.plannedHours || 1}
              color={c.state === "over" ? "#dc2626" : c.state === "warning" ? "#f59e0b" : "#16a34a"}
              label={c.utilizationPct != null ? `${c.utilizationPct}%` : "—"}
            />
          </div>
        ))}
      </div>

      <div className="panel-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Risks by severity</h3>
        {risks.length === 0 && <p style={{ fontSize: 13, color: "#64748b" }}>No risks recorded.</p>}
        {risks.map((r) => (
          <div key={r.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
              <span style={{ color: "#334155" }}>{r.label}</span>
              <Pill tone={r.status === "mitigated" ? "ok" : r.severity >= 70 ? "error" : "warn"}>
                {r.status === "mitigated" ? "Mitigated" : `Severity ${r.severity}`}
              </Pill>
            </div>
            <Bar value={r.severity} max={100} color={r.severity >= 70 ? "#dc2626" : r.severity >= 50 ? "#f59e0b" : "#64748b"} label={`${r.severity}/100`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewTab({ plan, diagnostics, status, revision, onApprove, onReopen, busy }) {
  const errors = (diagnostics?.issues || []).filter((i) => i.severity === "error");
  const warnings = (diagnostics?.issues || []).filter((i) => i.severity === "warning");
  const blockingQuestions = (plan.openQuestions || []).filter((q) => q.blocking);
  const canApprove = errors.length === 0 && blockingQuestions.length === 0 && status !== "approved";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-card">
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>Approval pack — revision {revision}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Pill tone={errors.length ? "error" : "ok"}>{errors.length} error(s)</Pill>
          <Pill tone={warnings.length ? "warn" : "ok"}>{warnings.length} warning(s)</Pill>
          <Pill tone={blockingQuestions.length ? "warn" : "ok"}>{blockingQuestions.length} blocking question(s)</Pill>
          <Pill tone="info">{diagnostics?.coveredRequirementCount}/{diagnostics?.totalRequirementCount} requirements covered</Pill>
        </div>
        {status === "approved" ? (
          <button type="button" className="panel-btn panel-btn--ghost" onClick={onReopen} disabled={busy === "reopen"}>
            <Unlock size={14} /> Reopen for editing
          </button>
        ) : (
          <button type="button" className="panel-btn" onClick={onApprove} disabled={!canApprove || busy === "approve"} title={!canApprove ? "Resolve errors and blocking questions first" : undefined}>
            <Lock size={14} /> {busy === "approve" ? "Approving…" : "Approve this revision"}
          </button>
        )}
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
          Approval freezes the plan for review. It never changes any funded escrow milestone.
        </p>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="panel-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Validator findings</h3>
          {[...errors, ...warnings].map((i, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "start", padding: "6px 0", borderTop: idx ? "1px solid #f1f5f9" : "none" }}>
              {i.severity === "error" ? <AlertTriangle size={14} style={{ color: "#dc2626", marginTop: 2 }} /> : <Clock size={14} style={{ color: "#f59e0b", marginTop: 2 }} />}
              <div>
                <div style={{ fontSize: 13, color: "#334155" }}>{i.message}</div>
                {i.suggestion && <div style={{ fontSize: 12, color: "#94a3b8" }}>{i.suggestion}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inspector: edit a task / week / module field, then PATCH ──

function Inspector({ inspector, plan, onClose, onSubmit }) {
  const { kind, id } = inspector;
  const [saving, setSaving] = useState(false);

  const entity = useMemo(() => {
    if (kind === "task") return (plan.tasks || []).find((t) => t.id === id);
    if (kind === "week") return (plan.weeks || []).find((w) => w.id === id);
    if (kind === "module") return (plan.scopeModules || []).find((m) => m.id === id);
    return null;
  }, [kind, id, plan]);

  const index = useMemo(() => {
    if (kind === "task") return (plan.tasks || []).findIndex((t) => t.id === id);
    if (kind === "week") return (plan.weeks || []).findIndex((w) => w.id === id);
    if (kind === "module") return (plan.scopeModules || []).findIndex((m) => m.id === id);
    return -1;
  }, [kind, id, plan]);

  const [form, setForm] = useState(() => initialForm(kind, entity));
  if (!entity || index < 0) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const ops = buildOps(kind, index, entity, form);
    if (ops.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    const ok = await onSubmit(ops, `Edited ${kind}`);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div role="dialog" aria-modal="true" style={drawerBackdrop} onClick={onClose}>
      <div style={drawerPanel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, textTransform: "capitalize" }}>Edit {kind}</h3>
          <button type="button" onClick={onClose} className="panel-btn panel-btn--ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {kind === "task" && (
            <>
              <Field label="Title"><input value={form.title} onChange={(e) => set("title", e.target.value)} style={inputStyle} /></Field>
              <Field label="Estimate (hours)">
                <input type="number" min="1" value={form.estimateHours} onChange={(e) => set("estimateHours", e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Owner role">
                <select value={form.ownerRoleId} onChange={(e) => set("ownerRoleId", e.target.value)} style={inputStyle}>
                  {(plan.teamCapacity || []).map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
                  {["planned", "in_progress", "blocked", "done", "backlog"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </>
          )}
          {kind === "week" && (
            <>
              <Field label="Label"><input value={form.label} onChange={(e) => set("label", e.target.value)} style={inputStyle} /></Field>
              <Field label="Objective"><textarea value={form.objective} onChange={(e) => set("objective", e.target.value)} style={{ ...inputStyle, minHeight: 70 }} /></Field>
            </>
          )}
          {kind === "module" && (
            <>
              <Field label="Name"><input value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} /></Field>
              <Field label="Business objective"><textarea value={form.businessObjective} onChange={(e) => set("businessObjective", e.target.value)} style={{ ...inputStyle, minHeight: 70 }} /></Field>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" className="panel-btn panel-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="panel-btn" onClick={save} disabled={saving}>
            <CheckCircle2 size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function initialForm(kind, entity) {
  if (!entity) return {};
  if (kind === "task") return { title: entity.title, estimateHours: entity.estimateHours, ownerRoleId: entity.ownerRoleId, status: entity.status };
  if (kind === "week") return { label: entity.label, objective: entity.objective };
  if (kind === "module") return { name: entity.name, businessObjective: entity.businessObjective };
  return {};
}

function buildOps(kind, index, entity, form) {
  const ops = [];
  const base = kind === "task" ? `/tasks/${index}` : kind === "week" ? `/weeks/${index}` : `/scopeModules/${index}`;
  const push = (field, value) => {
    if (value !== entity[field]) ops.push({ op: "replace", path: `${base}/${field}`, value });
  };
  if (kind === "task") {
    push("title", form.title);
    const hrs = Number(form.estimateHours);
    if (Number.isFinite(hrs) && hrs !== entity.estimateHours) ops.push({ op: "replace", path: `${base}/estimateHours`, value: hrs });
    push("ownerRoleId", form.ownerRoleId);
    push("status", form.status);
  } else if (kind === "week") {
    push("label", form.label);
    push("objective", form.objective);
  } else if (kind === "module") {
    push("name", form.name);
    push("businessObjective", form.businessObjective);
  }
  return ops;
}

function RevisionDrawer({ revisions, currentRevision, onRestore, onClose, busy }) {
  return (
    <div role="dialog" aria-modal="true" style={drawerBackdrop} onClick={onClose}>
      <div style={drawerPanel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Revision history</h3>
          <button type="button" onClick={onClose} className="panel-btn panel-btn--ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>
        {revisions.length === 0 ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>No edits recorded yet. Revision 0 is the generated baseline.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {revisions.slice().reverse().map((r) => (
              <div key={r.revision} style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>Rev {r.revision}{r.revision === currentRevision ? " (current)" : ""}</strong>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {r.errorCount > 0 && <Pill tone="error">{r.errorCount} err</Pill>}
                    {r.warningCount > 0 && <Pill tone="warn">{r.warningCount} warn</Pill>}
                    {r.revision !== currentRevision && (
                      <button type="button" className="panel-btn panel-btn--ghost" style={{ fontSize: 12 }} disabled={busy === `restore-${r.revision}`} onClick={() => onRestore(r.revision)}>
                        Restore
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{r.summary} · {r.actorRole} · {new Date(r.occurredAt).toLocaleString()}</div>
                <div style={{ fontSize: 10.5, color: "#cbd5e1", fontFamily: "monospace", marginTop: 2 }}>#{(r.entryHash || "").slice(0, 16)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
const drawerBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 };
const drawerPanel = { width: "min(440px, 100%)", height: "100%", background: "#fff", padding: 20, overflowY: "auto", boxShadow: "-8px 0 24px rgba(0,0,0,0.12)" };
