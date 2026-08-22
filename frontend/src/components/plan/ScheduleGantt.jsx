import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarRange, LayoutList, Table as TableIcon } from "lucide-react";
import {
  dependencyIssuesByTask,
  hasBlockingPlanError,
  indexPlan,
  sectionAvailability,
} from "../../lib/plan/selectors";
import { discloseSlice } from "../../lib/plan/disclosure";
import { TASK_STATUSES, describeState, mapLabel, resolveState } from "./encoding";
import DiagramLegend from "./DiagramLegend";
import EmptyDiagram from "./EmptyDiagram";
import DetailPanel from "./DetailPanel";

/**
 * The task schedule — weeks across, tasks down (Requirement 5).
 *
 * This is a semantic `<table>` rather than a drawn chart: the columns *are* the
 * plan's weeks, each task's bar *is* a `<td colSpan>` across the columns its
 * `startWeek`–`endWeek` span covers, and the row header is the task. A screen
 * reader therefore gets the same schedule the eye gets, and the "view as
 * table" fallback is the same data again in a flat listing.
 *
 * What this file is responsible for:
 *
 *   - **Positioning (Requirement 5.1).** One column per plan week, in
 *     ascending order, with `<th scope="col">` headers; one row per task with a
 *     `<th scope="row">` header, and the bar spanning the covered columns. A
 *     task whose span falls outside the plan's weeks is said so in words
 *     rather than being drawn somewhere convenient.
 *   - **Dependencies (Requirement 5.2).** Each row names the tasks it depends
 *     on, resolved to titles — an id that does not resolve is dropped, never
 *     printed at the reviewer. The late case (a dependency that finishes after
 *     its dependent starts) is **marked from the validator's own diagnostics**
 *     via `dependencyIssuesByTask`; the comparison is never re-made here.
 *   - **Selection (Requirement 5.3).** `Enter`/`Space` or a click opens the
 *     shared {@link DetailPanel} with `kind="task"`, which is where the owner
 *     role, estimate and its basis, acceptance criteria, required evidence and
 *     served scope module are described.
 *   - **Refusing to draw (Requirement 5.4).** When `hasBlockingPlanError`
 *     reports a dependency cycle, no bar is drawn at all: a cycle makes every
 *     span and any critical path meaningless, so the validator's findings are
 *     rendered as an error instead of a chart that would read as trustworthy.
 *   - **Critical path (Requirement 5.5).** Read **verbatim** from
 *     `diagnostics.criticalPathTaskIds`. Nothing about the longest chain is
 *     computed in the browser; the marked rows carry a `★` glyph, the words
 *     "Critical path" in their accessible name, and their own border and
 *     shading — never colour alone (Requirement 12.3).
 *   - **Large plans (Requirements 10.3, 12.6).** Above {@link MAX_GANTT_ROWS}
 *     tasks the week grid is not rendered: the flat table view takes over with
 *     a notice, and each workstream discloses its tasks through
 *     `discloseSlice`, so a long plan is paged rather than silently truncated —
 *     the hidden count is always on screen.
 *   - **Keyboard (Requirement 12.4).** One tab stop: exactly one task row
 *     carries `tabindex="0"` and the rest `tabindex="-1"`, the arrow keys rove
 *     that focus through the visible rows, `Home`/`End` jump, `Enter`/`Space`
 *     selects, and a single `aria-live="polite"` region announces the row.
 *   - **Containment (Requirement 12.5).** The scroller is this component's own
 *     box; `min-width` sits on the table only, so a 30-week plan scrolls here
 *     and never widens the page.
 *
 * @module components/plan/ScheduleGantt
 */

/**
 * Task count above which the week grid is replaced by the flat table view with
 * per-workstream progressive disclosure (Requirements 10.3, 12.6).
 * @type {number}
 */
export const MAX_GANTT_ROWS = 120;

/** Tasks revealed per disclosure step, per workstream (Requirement 10.3). */
export const WORKSTREAM_PAGE_SIZE = 10;

/**
 * Dependency diagnostic codes that mean "this dependency finishes after its
 * dependent starts" (Requirement 5.2). Both come from
 * `ai-service/app/features/timeline_validation.py`; `dependency_after_dependent`
 * is an error, `dependency_overlap` a warning.
 * @type {Set<string>}
 */
const LATE_DEPENDENCY_CODES = new Set(["dependency_after_dependent", "dependency_overlap"]);

/** Non-colour marker for a task on the validator's critical path. */
const CRITICAL_GLYPH = "★";

/** Non-colour marker for a task whose dependency lands late. */
const LATE_GLYPH = "⚠";

/** The words that carry the critical-path signal to assistive technology. */
const CRITICAL_WORD = "Critical path";

/** The words that carry the late-dependency signal. */
const LATE_WORD = "Late dependency";

/** Group label for tasks whose `workstreamId` does not resolve. */
const UNGROUPED_LABEL = "Not assigned to a workstream";

/** Keeps the provenance of the critical path on screen (Requirement 5.5). */
const PROVENANCE =
  "The critical path and every dependency warning here are reported by the server-side validator and shown exactly as received. Nothing is recalculated in your browser.";

/** Keys that rove the single tab stop, mapped to their step through the rows. */
const STEP_KEYS = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** @param {unknown} value @returns {value is Object} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {Object[]} */
function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** @param {unknown} value @returns {string} A trimmed string, or `''`. */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {unknown} value @returns {value is number} */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * A task's display title, falling back to its id so a row is never nameless.
 *
 * @param {Object} task A `PlanTask`.
 * @returns {string}
 */
export function taskTitle(task) {
  return text(task.title) || text(task.id) || "Untitled task";
}

/**
 * The plan's week numbers, ascending and de-duplicated — these are the columns.
 *
 * Read from `plan.weeks` only: the week grid is the plan's own calendar, so a
 * task span is positioned against it rather than inventing columns from the
 * spans themselves.
 *
 * @param {Object|null|undefined} plan An `ExecutionPlan`.
 * @returns {number[]}
 */
export function weekColumnsOf(plan) {
  const source = isRecord(plan) ? plan : {};
  const numbers = new Set();
  for (const week of records(source.weeks)) {
    if (isFiniteNumber(week.weekNumber)) numbers.add(week.weekNumber);
  }
  return [...numbers].sort((a, b) => a - b);
}

/**
 * Where a task's span sits in the column list.
 *
 * Positions are found by *containment* — the columns whose week number falls
 * inside `startWeek..endWeek` — so a plan with a discontinuous week list still
 * places the bar over the right columns, and a span that covers no planned week
 * yields `null` rather than being drawn at column zero.
 *
 * @param {Object} task A `PlanTask`.
 * @param {number[]} weekNumbers The column week numbers, ascending.
 * @returns {{first: number, last: number, span: number}|null}
 */
export function columnSpanOf(task, weekNumbers) {
  const { startWeek, endWeek } = task;
  if (!isFiniteNumber(startWeek) || !isFiniteNumber(endWeek)) return null;
  const from = Math.min(startWeek, endWeek);
  const to = Math.max(startWeek, endWeek);

  let first = -1;
  let last = -1;
  for (let i = 0; i < weekNumbers.length; i += 1) {
    const week = weekNumbers[i];
    if (week < from || week > to) continue;
    if (first === -1) first = i;
    last = i;
  }
  return first === -1 ? null : { first, last, span: last - first + 1 };
}

/**
 * A task's span in words, always honest about a missing or inverted span.
 *
 * @param {Object} task A `PlanTask`.
 * @returns {string}
 *
 * @example
 * spanWords({ startWeek: 2, endWeek: 4 }); // → 'Weeks 2 to 4'
 * spanWords({ startWeek: 3, endWeek: 3 }); // → 'Week 3'
 * spanWords({});                           // → 'No week span recorded'
 */
export function spanWords(task) {
  const { startWeek, endWeek } = task;
  if (!isFiniteNumber(startWeek) || !isFiniteNumber(endWeek)) return "No week span recorded";
  if (startWeek === endWeek) return `Week ${startWeek}`;
  if (endWeek < startWeek) return `Weeks ${startWeek} to ${endWeek} (ends before it starts)`;
  return `Weeks ${startWeek} to ${endWeek}`;
}

/**
 * A task's estimate, worded as an estimate rather than a commitment (R9.6).
 *
 * @param {Object} task A `PlanTask`.
 * @returns {string}
 */
function estimateWords(task) {
  return isFiniteNumber(task.estimateHours) ? `Estimate ${task.estimateHours}h` : "No estimate recorded";
}

/**
 * The dependency picture for one task, taken from the plan and the validator.
 *
 * @param {Object} task A `PlanTask`.
 * @param {Map<string, Object>} tasksById From `indexPlan`.
 * @param {Object[]} issues The task's dependency diagnostics, in report order.
 * @returns {{names: string[], late: boolean, messages: string[]}}
 */
export function dependencyInfoFor(task, tasksById, issues) {
  const ids = Array.isArray(task.dependencyTaskIds) ? task.dependencyTaskIds : [];
  const names = [];
  for (const id of ids) {
    if (typeof id !== "string" && typeof id !== "number") continue;
    // A dangling dependency is a validator error, not something to print raw.
    const dependency = tasksById.get(String(id));
    if (dependency) names.push(taskTitle(dependency));
  }

  const late = issues.filter((issue) => LATE_DEPENDENCY_CODES.has(issue.code));
  return {
    names,
    late: late.length > 0,
    messages: late.map((issue) => text(issue.message)).filter(Boolean),
  };
}

/**
 * The accessible name of a task row — every non-colour signal, as words.
 *
 * @param {Object} task A `PlanTask`.
 * @param {Object} info Output of {@link dependencyInfoFor}.
 * @param {boolean} onCriticalPath Whether the validator put this task on the path.
 * @param {string} workstreamName The group the row sits in.
 * @returns {string} Non-empty, and containing the status word.
 */
export function taskRowLabel(task, info, onCriticalPath, workstreamName) {
  const parts = [describeState(TASK_STATUSES, task.status, taskTitle(task))];
  parts.push(spanWords(task));
  parts.push(estimateWords(task));
  if (workstreamName) parts.push(workstreamName);
  if (onCriticalPath) parts.push(CRITICAL_WORD);
  if (info.names.length > 0) parts.push(`Depends on ${info.names.join(", ")}`);
  else parts.push("No dependencies");
  if (info.late) parts.push(`${LATE_WORD}: ${info.messages.join(" ") || "a dependency finishes after this task starts"}`);
  return `${parts.join(". ")}.`;
}

/**
 * Group tasks by workstream, in the plan's own workstream order, with the
 * unresolvable ones collected in a trailing group rather than dropped — a task
 * nobody filed under a workstream is still work somebody has to do.
 *
 * @param {Object[]} tasks The plan's tasks, in plan order.
 * @param {Map<string, Object>} workstreamsById From `indexPlan`.
 * @returns {{id: string, name: string, tasks: Object[]}[]} Non-empty groups only.
 */
export function groupTasksByWorkstream(tasks, workstreamsById) {
  /** @type {Map<string, {id: string, name: string, tasks: Object[]}>} */
  const groups = new Map();
  for (const [id, workstream] of workstreamsById) {
    groups.set(id, { id, name: text(workstream.name) || id, tasks: [] });
  }

  const ungrouped = { id: "\u0000ungrouped", name: UNGROUPED_LABEL, tasks: [] };
  for (const task of tasks) {
    const key = typeof task.workstreamId === "string" ? task.workstreamId : "";
    const group = key ? groups.get(key) : undefined;
    (group || ungrouped).tasks.push(task);
  }

  const ordered = [...groups.values()].filter((group) => group.tasks.length > 0);
  if (ungrouped.tasks.length > 0) ordered.push(ungrouped);
  return ordered;
}

/**
 * The validator findings the schedule shows instead of a chart when a
 * dependency cycle is present (Requirement 5.4).
 *
 * @param {Object} props
 * @param {Object[]} props.issues Every diagnostic issue, verbatim.
 * @returns {JSX.Element}
 */
function BlockingFindings({ issues }) {
  const cycles = issues.filter((issue) => issue.code === "dependency_cycle");
  const others = issues.filter(
    (issue) => issue.code !== "dependency_cycle" && (issue.severity === "error" || issue.severity === "warning"),
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div role="alert" className="panel-card" style={{ borderColor: "#fee2e2", background: "#fef2f2" }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 14.5,
            fontWeight: 700,
            margin: "0 0 6px",
            color: "#991b1b",
          }}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          Schedule not drawn: the tasks depend on each other in a circle
        </h3>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#7f1d1d" }}>
          The validator found a dependency cycle, which means no task in the loop can start first. Any
          bars, spans or critical path drawn from this plan would look credible and be wrong, so the
          findings are shown instead. Regenerating the plan resolves this.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#7f1d1d" }}>
          {cycles.map((issue, i) => (
            <li key={`cycle-${i}`} style={{ marginBottom: 4 }}>
              {text(issue.message) || "A dependency cycle was reported."}
              {text(issue.path) && (
                <span style={{ color: "#b91c1c" }}> ({text(issue.path)})</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {others.length > 0 && (
        <div className="panel-card">
          <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#334155" }}>
            Everything else the validator reported on this plan
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#475569" }}>
            {others.map((issue, i) => (
              <li key={`issue-${i}`} style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: issue.severity === "error" ? "#991b1b" : "#b45309" }}>
                  {issue.severity === "error" ? "Error" : "Warning"}
                </span>
                {": "}
                {text(issue.message) || text(issue.code) || "Unspecified finding."}
                {text(issue.suggestion) && (
                  <span style={{ color: "#64748b" }}> {text(issue.suggestion)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The row header shared by both views: the single focusable element per task,
 * carrying the roving tab stop and the row's whole accessible name.
 *
 * @param {Object} props
 * @returns {JSX.Element}
 */
function TaskRowHeader({
  task,
  info,
  onCriticalPath,
  workstreamName,
  isActive,
  isSelected,
  registerRef,
  onActivate,
  onFocus,
  showDependencies,
}) {
  const status = resolveState(TASK_STATUSES, task.status);
  return (
    <th scope="row" style={rowHeaderStyle(onCriticalPath, isSelected)}>
      <button
        type="button"
        ref={registerRef}
        data-testid="gantt-task-button"
        data-task-id={String(task.id)}
        data-critical-path={onCriticalPath ? "true" : "false"}
        data-late-dependency={info.late ? "true" : "false"}
        // Roving tabindex: the whole schedule is one tab stop (R12.4).
        tabIndex={isActive ? 0 : -1}
        aria-pressed={isSelected}
        aria-label={taskRowLabel(task, info, onCriticalPath, workstreamName)}
        onClick={onActivate}
        onFocus={onFocus}
        style={taskButtonStyle}
      >
        <span style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          {onCriticalPath && (
            <span aria-hidden="true" style={criticalBadgeStyle}>
              {CRITICAL_GLYPH} {CRITICAL_WORD}
            </span>
          )}
          <span style={{ fontWeight: 700, color: "#0f172a" }}>{taskTitle(task)}</span>
        </span>
        <span aria-hidden="true" style={{ display: "block", fontWeight: 400, color: "#64748b", fontSize: 11.5 }}>
          {status.glyph} {status.word} · {spanWords(task)} · {estimateWords(task)}
        </span>
        {showDependencies && (
          <span aria-hidden="true" style={{ display: "block", fontWeight: 400, fontSize: 11.5, color: "#64748b" }}>
            {info.names.length > 0 ? `Depends on: ${info.names.join(", ")}` : "No dependencies"}
            {info.late && (
              <span style={lateBadgeStyle}>
                {LATE_GLYPH} {LATE_WORD}
              </span>
            )}
          </span>
        )}
      </button>
    </th>
  );
}

/**
 * @param {Object} props
 * @param {Object|null|undefined} props.plan The `ExecutionPlan` — supplies the
 *   weeks (columns), the tasks (rows) and the workstreams (groups).
 * @param {Object|null|undefined} props.diagnostics The matching
 *   `PlanDiagnostics`, the only source of the critical path and of every
 *   dependency finding shown.
 * @param {() => void} [props.onGenerate] Offered by the empty state when there
 *   is no schedule to position yet.
 * @param {boolean} [props.generating] Disables that affordance.
 * @returns {JSX.Element}
 */
export function ScheduleGantt({ plan, diagnostics, onGenerate, generating = false }) {
  const tasks = useMemo(() => records(isRecord(plan) ? plan.tasks : null), [plan]);
  const weekNumbers = useMemo(() => weekColumnsOf(plan), [plan]);
  const index = useMemo(() => indexPlan(plan), [plan]);
  const issuesByTask = useMemo(() => dependencyIssuesByTask(diagnostics), [diagnostics]);
  const blocked = useMemo(() => hasBlockingPlanError(diagnostics), [diagnostics]);

  // Read verbatim — the browser never works out which tasks are critical (R5.5).
  const criticalPathIds = useMemo(() => {
    const list = isRecord(diagnostics) && Array.isArray(diagnostics.criticalPathTaskIds)
      ? diagnostics.criticalPathTaskIds
      : [];
    return new Set(list.filter((id) => typeof id === "string" || typeof id === "number").map(String));
  }, [diagnostics]);

  const groups = useMemo(() => groupTasksByWorkstream(tasks, index.workstreamsById), [tasks, index]);

  const exceedsCap = tasks.length > MAX_GANTT_ROWS;
  const [view, setView] = useState("chart");
  const [pagesShown, setPagesShown] = useState({});
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const showTable = exceedsCap || view === "table";

  // Progressive disclosure is what keeps an oversized plan honest: above the
  // cap each workstream shows a page at a time and always states the rest
  // (R10.3). Below the cap every row is already on screen.
  const disclosedGroups = useMemo(
    () =>
      groups.map((group) => {
        const slice = exceedsCap
          ? discloseSlice(group.tasks, WORKSTREAM_PAGE_SIZE, pagesShown[group.id] ?? 1)
          : { visible: group.tasks, remaining: 0, total: group.tasks.length, hasMore: false };
        return { ...group, ...slice };
      }),
    [groups, exceedsCap, pagesShown],
  );

  /** The rows the keyboard can reach: visible ones, in render order. */
  const visibleRows = useMemo(() => {
    const rows = [];
    for (const group of disclosedGroups) {
      for (const task of group.visible) {
        const id = String(task.id);
        rows.push({ id, task, groupName: group.name });
      }
    }
    return rows;
  }, [disclosedGroups]);

  const rowIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const buttonRefs = useRef(new Map());
  // Focus follows the roving position only after a key moved it, so mounting
  // the schedule never steals focus from wherever the reader actually is.
  const pendingFocus = useRef(null);

  const activeIndex = Math.max(0, rowIds.indexOf(activeTaskId));
  const activeId = rowIds.length > 0 ? rowIds[activeIndex] : null;

  // The single tab stop must always point at a live row, so a plan change or a
  // disclosure step can never leave the schedule unreachable by keyboard.
  useEffect(() => {
    if (rowIds.length === 0) {
      if (activeTaskId !== null) setActiveTaskId(null);
      return;
    }
    if (activeTaskId === null || !rowIds.includes(activeTaskId)) setActiveTaskId(rowIds[0]);
  }, [rowIds, activeTaskId]);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    const element = buttonRefs.current.get(target);
    if (element && typeof element.focus === "function") element.focus();
  }, [activeTaskId]);

  // A selection keyed on a task that is gone would describe the wrong work.
  useEffect(() => {
    if (selectedTaskId !== null && !index.tasksById.has(selectedTaskId)) setSelectedTaskId(null);
  }, [index, selectedTaskId]);

  const registerRef = useCallback(
    (id) => (element) => {
      if (element) buttonRefs.current.set(id, element);
      else buttonRefs.current.delete(id);
    },
    [],
  );

  const moveTo = useCallback(
    (targetIndex) => {
      const count = rowIds.length;
      if (count === 0) return;
      const id = rowIds[((targetIndex % count) + count) % count];
      pendingFocus.current = id;
      setActiveTaskId(id);
      setFocusedTaskId(id);
      // A repeat of the same id leaves `activeTaskId` unchanged, so the focus
      // effect would not fire — move focus here as well.
      const element = buttonRefs.current.get(id);
      if (element && typeof element.focus === "function") element.focus();
    },
    [rowIds],
  );

  const onKeyDown = useCallback(
    (event) => {
      if (event.key in STEP_KEYS) {
        moveTo(activeIndex + STEP_KEYS[event.key]);
      } else if (event.key === "Home") {
        moveTo(0);
      } else if (event.key === "End") {
        moveTo(rowIds.length - 1);
      } else {
        // Enter and Space are left to the row buttons' native activation, and
        // every other key to the browser, so page scrolling still works.
        return;
      }
      event.preventDefault();
    },
    [activeIndex, moveTo, rowIds.length],
  );

  const onRowActivate = useCallback(
    (id) => () => {
      setActiveTaskId(id);
      setFocusedTaskId(id);
      setSelectedTaskId(id);
    },
    [],
  );

  const onRowFocus = useCallback(
    (id) => () => {
      setActiveTaskId(id);
      setFocusedTaskId(id);
    },
    [],
  );

  const discloseMore = useCallback((groupId) => {
    setPagesShown((current) => ({ ...current, [groupId]: (current[groupId] ?? 1) + 1 }));
  }, []);

  const infoFor = useCallback(
    (task) => dependencyInfoFor(task, index.tasksById, issuesByTask.get(String(task.id)) ?? []),
    [index, issuesByTask],
  );

  // Requirement 5.4: the cycle case never reaches a chart. Checked before the
  // empty state so the reason a reviewer sees is the real blocker.
  if (blocked) {
    return <BlockingFindings issues={isRecord(diagnostics) ? records(diagnostics.issues) : []} />;
  }

  if (tasks.length === 0 || weekNumbers.length === 0) {
    const availability = sectionAvailability(plan, diagnostics);
    return (
      <EmptyDiagram
        title="No schedule to show yet"
        icon={CalendarRange}
        reason={
          tasks.length === 0
            ? availability.schedule
            : "This plan has tasks but no weekly breakdown, so there are no weeks to position them across."
        }
        action={
          typeof onGenerate === "function"
            ? {
                label: generating ? "Generating…" : "Generate detailed plan",
                onClick: onGenerate,
                disabled: generating,
              }
            : undefined
        }
      />
    );
  }

  const selectedTask = selectedTaskId ? index.tasksById.get(selectedTaskId) ?? null : null;
  const announcedRow = visibleRows.find((row) => row.id === (selectedTaskId || focusedTaskId));
  const announced = announcedRow
    ? `${selectedTaskId === announcedRow.id ? "Selected" : "Focused"}: ${taskRowLabel(
        announcedRow.task,
        infoFor(announcedRow.task),
        criticalPathIds.has(announcedRow.id),
        announcedRow.groupName,
      )}`
    : "";

  const criticalCount = tasks.reduce((count, task) => (criticalPathIds.has(String(task.id)) ? count + 1 : count), 0);
  const hiddenCount = disclosedGroups.reduce((sum, group) => sum + group.remaining, 0);
  const columnCount = showTable ? 8 : weekNumbers.length + 1;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13.5, color: "#334155", flex: "1 1 260px", minWidth: 0 }}>
          {`${tasks.length} task${tasks.length === 1 ? "" : "s"} across ${weekNumbers.length} week${
            weekNumbers.length === 1 ? "" : "s"
          }`}
          {criticalCount > 0
            ? ` · ${criticalCount} on the critical path`
            : " · the validator reported no critical path"}
          {hiddenCount > 0 ? ` · ${hiddenCount} not shown yet` : ""}
        </p>
        {!exceedsCap && (
          <button
            type="button"
            className="panel-btn panel-btn--ghost"
            onClick={() => setView(view === "table" ? "chart" : "table")}
            aria-pressed={view === "table"}
            style={{ flexShrink: 0 }}
          >
            {view === "table" ? <CalendarRange size={14} /> : <TableIcon size={14} />}
            {view === "table" ? " View as schedule" : " View as table"}
          </button>
        )}
      </div>

      {exceedsCap && (
        <p role="note" style={noticeStyle}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>
            {`This plan has ${tasks.length} tasks, more than the ${MAX_GANTT_ROWS} a readable week grid can hold, so it is listed as a table instead. Each workstream shows ${WORKSTREAM_PAGE_SIZE} tasks at a time and states how many are still hidden — nothing is dropped.`}
          </span>
        </p>
      )}

      {/* One polite region for the whole schedule (Requirement 12.4). */}
      <p
        aria-live="polite"
        data-testid="gantt-live-region"
        style={{ margin: 0, fontSize: 12.5, minHeight: 18, color: "#475569" }}
      >
        {announced}
      </p>

      {/* Requirement 12.5: this box is the scroller; `min-width` is on the
          table only, so a long plan never widens the page. */}
      <div className="panel-card" style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table
          onKeyDown={onKeyDown}
          data-testid={showTable ? "gantt-table-view" : "gantt-chart-view"}
          style={{
            borderCollapse: "separate",
            borderSpacing: showTable ? 0 : 3,
            fontSize: 12.5,
            textAlign: "left",
            width: showTable ? "100%" : undefined,
            minWidth: showTable ? 760 : 260 + weekNumbers.length * 92,
          }}
        >
          <caption style={captionStyle}>
            {showTable
              ? "Every task with its week span, dependencies and critical-path marking. Move between tasks with the arrow keys, then press Enter to open one."
              : "Task schedule by week. Each bar spans the weeks its task covers. Move between tasks with the arrow keys, then press Enter to open one."}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...headerCellBase, minWidth: 220 }}>
                Task
              </th>
              {showTable ? (
                <>
                  <th scope="col" style={headerCellBase}>Workstream</th>
                  <th scope="col" style={headerCellBase}>Owner role</th>
                  <th scope="col" style={headerCellBase}>Weeks</th>
                  <th scope="col" style={headerCellBase}>{mapLabel(TASK_STATUSES)}</th>
                  <th scope="col" style={headerCellBase}>Depends on</th>
                  <th scope="col" style={headerCellBase}>Dependency timing</th>
                  <th scope="col" style={headerCellBase}>Critical path</th>
                </>
              ) : (
                weekNumbers.map((weekNumber) => (
                  <th key={weekNumber} scope="col" style={{ ...headerCellBase, textAlign: "center" }}>
                    Week {weekNumber}
                  </th>
                ))
              )}
            </tr>
          </thead>

          {disclosedGroups.map((group) => (
            <tbody key={group.id}>
              <tr>
                <th scope="colgroup" colSpan={columnCount} style={groupHeaderStyle}>
                  {group.name}
                  <span style={{ fontWeight: 400, color: "#64748b" }}>
                    {` — ${group.total} task${group.total === 1 ? "" : "s"}`}
                    {group.remaining > 0 ? `, ${group.remaining} not shown yet` : ""}
                  </span>
                </th>
              </tr>

              {group.visible.map((task) => {
                const id = String(task.id);
                const info = infoFor(task);
                const onCriticalPath = criticalPathIds.has(id);
                const isSelected = selectedTaskId === id;
                const header = (
                  <TaskRowHeader
                    task={task}
                    info={info}
                    onCriticalPath={onCriticalPath}
                    workstreamName={group.name}
                    isActive={id === activeId}
                    isSelected={isSelected}
                    registerRef={registerRef(id)}
                    onActivate={onRowActivate(id)}
                    onFocus={onRowFocus(id)}
                    showDependencies={!showTable}
                  />
                );

                if (showTable) {
                  const status = resolveState(TASK_STATUSES, task.status);
                  const owner = index.rolesById.get(String(task.ownerRoleId));
                  return (
                    <tr key={id} style={isSelected ? { background: "#eff6ff" } : undefined}>
                      {header}
                      <td style={tdStyle}>{group.name}</td>
                      <td style={tdStyle}>{(owner && text(owner.roleName)) || "Not specified"}</td>
                      <td style={tdStyle}>
                        {spanWords(task)}
                        <span style={{ display: "block", color: "#94a3b8" }}>{estimateWords(task)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span aria-hidden="true">{status.glyph} </span>
                        {status.word}
                      </td>
                      <td style={tdStyle}>{info.names.length > 0 ? info.names.join(", ") : "Nothing"}</td>
                      <td style={tdStyle}>
                        {info.late ? (
                          <span style={{ color: "#b45309", fontWeight: 600 }}>
                            <span aria-hidden="true">{LATE_GLYPH} </span>
                            {LATE_WORD}
                            <span style={{ display: "block", fontWeight: 400, color: "#64748b" }}>
                              {info.messages.join(" ")}
                            </span>
                          </span>
                        ) : (
                          "In sequence"
                        )}
                      </td>
                      <td style={tdStyle}>
                        {onCriticalPath ? (
                          <span style={{ color: "#991b1b", fontWeight: 600 }}>
                            <span aria-hidden="true">{CRITICAL_GLYPH} </span>
                            {CRITICAL_WORD}
                          </span>
                        ) : (
                          "Off path"
                        )}
                      </td>
                    </tr>
                  );
                }

                const position = columnSpanOf(task, weekNumbers);
                const status = resolveState(TASK_STATUSES, task.status);
                return (
                  <tr key={id}>
                    {header}
                    {position === null ? (
                      <td colSpan={weekNumbers.length} style={{ ...tdStyle, color: "#b45309" }}>
                        {`${spanWords(task)} — outside the weeks this plan covers, so it is not positioned.`}
                      </td>
                    ) : (
                      <>
                        {weekNumbers.slice(0, position.first).map((weekNumber) => (
                          <td key={`before-${weekNumber}`} style={emptyCellStyle} />
                        ))}
                        <td colSpan={position.span} style={{ padding: 0 }}>
                          <div
                            data-testid="gantt-bar"
                            style={barStyle(status, onCriticalPath, info.late, isSelected)}
                          >
                            <span aria-hidden="true">{status.glyph}</span>
                            <span style={{ fontWeight: 700 }}>{status.word}</span>
                            <span style={{ color: "#475569" }}>{spanWords(task)}</span>
                            {onCriticalPath && (
                              <span aria-hidden="true" style={criticalBadgeStyle}>
                                {CRITICAL_GLYPH} {CRITICAL_WORD}
                              </span>
                            )}
                            {info.late && (
                              <span aria-hidden="true" style={lateBadgeStyle} title={info.messages.join(" ")}>
                                {LATE_GLYPH} {LATE_WORD}
                              </span>
                            )}
                          </div>
                        </td>
                        {weekNumbers.slice(position.last + 1).map((weekNumber) => (
                          <td key={`after-${weekNumber}`} style={emptyCellStyle} />
                        ))}
                      </>
                    )}
                  </tr>
                );
              })}

              {group.hasMore && (
                <tr>
                  <td colSpan={columnCount} style={{ ...tdStyle, paddingTop: 8, paddingBottom: 10 }}>
                    <button
                      type="button"
                      className="panel-btn panel-btn--ghost"
                      onClick={() => discloseMore(group.id)}
                    >
                      <LayoutList size={14} />
                      {` Show ${Math.min(WORKSTREAM_PAGE_SIZE, group.remaining)} more of ${group.remaining} remaining in ${group.name}`}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
        Tab into the schedule, then use the arrow keys to move between tasks and Enter to open one.{" "}
        <span aria-hidden="true">{CRITICAL_GLYPH}</span> marks a task on the critical path;{" "}
        <span aria-hidden="true">{LATE_GLYPH}</span> marks a task whose dependency finishes after it
        starts.
      </p>
      <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>{PROVENANCE}</p>

      <DiagramLegend map={TASK_STATUSES} title="What each task state means" />

      {selectedTask && (
        <DetailPanel kind="task" item={selectedTask} plan={plan} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
}

// Styles reuse the palette of `sections/dashboard/ExecutionPlanPanel.jsx`, with
// colour always an *additional* channel behind the glyph and the word.
const captionStyle = {
  captionSide: "top",
  textAlign: "left",
  fontSize: 12,
  color: "#64748b",
  padding: "0 0 8px",
  maxWidth: 640,
};

const headerCellBase = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#94a3b8",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  padding: "6px 9px",
  whiteSpace: "nowrap",
  textAlign: "left",
};

const groupHeaderStyle = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#334155",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: "6px 9px",
};

const tdStyle = {
  padding: "7px 9px",
  borderBottom: "1px solid #f1f5f9",
  color: "#475569",
  verticalAlign: "top",
};

const emptyCellStyle = {
  borderBottom: "1px solid #f1f5f9",
  background: "#fbfdff",
  minWidth: 84,
};

const taskButtonStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 8px",
  border: "none",
  background: "none",
  font: "inherit",
  fontSize: 12.5,
  lineHeight: 1.35,
  cursor: "pointer",
  borderRadius: 6,
};

const criticalBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "1px 6px",
  borderRadius: 999,
  fontSize: 10.5,
  fontWeight: 700,
  background: "#fef2f2",
  border: "1px solid #fee2e2",
  color: "#991b1b",
  whiteSpace: "nowrap",
};

const lateBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  marginLeft: 6,
  padding: "1px 6px",
  borderRadius: 999,
  fontSize: 10.5,
  fontWeight: 700,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#b45309",
  whiteSpace: "nowrap",
};

const noticeStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  margin: 0,
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 13,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#b45309",
};

/**
 * A task row's header cell. A critical-path row is set apart by a left rule and
 * a tint *in addition to* the `★` glyph and the words in its accessible name,
 * so the path survives monochrome and a screen reader (Requirements 5.5, 12.3).
 *
 * @param {boolean} onCriticalPath
 * @param {boolean} isSelected
 * @returns {Object} Inline style.
 */
function rowHeaderStyle(onCriticalPath, isSelected) {
  return {
    padding: 0,
    textAlign: "left",
    verticalAlign: "top",
    minWidth: 220,
    background: isSelected ? "#eff6ff" : onCriticalPath ? "#fffafa" : "transparent",
    borderLeft: onCriticalPath ? "3px solid #991b1b" : "3px solid transparent",
    borderBottom: "1px solid #f1f5f9",
    outline: isSelected ? "2px solid #0f172a" : "none",
    outlineOffset: isSelected ? -2 : 0,
  };
}

/**
 * One task's bar. Its span is the `colSpan` of the cell it sits in — the bar
 * itself only has to be legible, so the state's glyph and word ride inside it
 * and colour is never the sole channel.
 *
 * @param {{bg: string, border: string, color: string}} status Resolved encoding.
 * @param {boolean} onCriticalPath
 * @param {boolean} late
 * @param {boolean} isSelected
 * @returns {Object} Inline style.
 */
function barStyle(status, onCriticalPath, late, isSelected) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    padding: "6px 9px",
    fontSize: 11.5,
    lineHeight: 1.3,
    borderRadius: 6,
    background: status.bg,
    color: status.color,
    border: `${onCriticalPath ? 2 : 1}px ${late ? "dashed" : "solid"} ${
      onCriticalPath ? "#991b1b" : status.border
    }`,
    outline: isSelected ? "2px solid #0f172a" : "none",
    outlineOffset: isSelected ? 1 : 0,
  };
}

export default ScheduleGantt;
