import { useCallback, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { buildWeekRollups, sectionAvailability } from "../../lib/plan/selectors";
import { DEFAULT_PAGE_SIZE, discloseSlice } from "../../lib/plan/disclosure";
import { CHECKPOINT_STATUSES, TASK_STATUSES, describeState, resolveState } from "./encoding";
import { DiagramLegend } from "./DiagramLegend";
import { EmptyDiagram } from "./EmptyDiagram";

/**
 * The week-by-week timeline (Requirement 3).
 *
 * Three commitments shape this component.
 *
 * **1. It is a vertical sequence, always** (Requirement 3.6). There is no wide
 * canvas and no fixed-width grid to clip: every week is a full-width block that
 * reflows, so the narrow-viewport layout *is* the layout. Nothing here needs
 * horizontal scrolling to be read, which is why — unlike `ScheduleGantt` or
 * `CapacityHeatmap` — this file has no `overflow-x` scroller at all.
 *
 * **2. Nothing about a week is decided in the browser.** Number, label,
 * objective, task/deliverable/checkpoint membership and client actions are all
 * printed from the plan verbatim, and the gap flag is the validator's own
 * `empty_week` diagnostic carried through `buildWeekRollups` — this component
 * never re-decides what "empty" means (Requirement 3.3).
 *
 * **3. Expanding a phase changes nothing outside this component**
 * (Requirement 3.4). Phase disclosure is plain local state: no navigation, no
 * router, no callback, no step or approval prop is touched, so a reviewer who
 * opens a phase stays exactly where they were in the proposal stepper.
 *
 * A blocking client action is marked with a glyph *and* the word "Blocking"
 * (Requirement 3.5), and every task/checkpoint status comes from `encoding.js`,
 * so no state in this view rides on colour alone (Requirement 12.3). Long lists
 * inside a week disclose progressively through `discloseSlice`, always showing
 * how many items remain rather than truncating in silence (Requirement 10.3).
 *
 * @module components/plan/WeekDetail
 */

/** Glyph + word for a blocking obligation — never colour alone (R3.5). */
const BLOCKING = Object.freeze({ glyph: "⛔", word: "Blocking" });

/** Glyph + word for a week the validator flagged as empty (R3.3). */
const GAP = Object.freeze({ glyph: "⚠", word: "Gap" });

/** Shown when the validator flagged a gap but supplied no message of its own. */
const GAP_FALLBACK =
  "This week has no task, deliverable, checkpoint or client action, so nothing moves forward in it.";

/** How a phase's constituent weeks were determined, in plain words (R3.4). */
const BASIS_SENTENCES = Object.freeze({
  tasks: "These weeks are the ones scheduling the tasks this phase names.",
  duration: "These weeks follow from the phase order and the duration this phase states.",
  none:
    "This phase names no task that appears in the weekly plan, and its duration is not stated in weeks, " +
    "so it cannot be tied to specific weeks without guessing.",
});

/** @param {unknown} value @returns {value is Object} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {string} Trimmed string, or `''`. */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalised form used to match a phase's declared task title against a plan
 * task title. Case and inner whitespace are ignored; nothing else is inferred.
 *
 * @param {unknown} value
 * @returns {string} `''` when there is nothing to match on.
 */
function matchKey(value) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

/**
 * The number of weeks a `TimelinePhase.duration` states, or `null`.
 *
 * Deliberately strict: only a duration that actually says *weeks* is read as a
 * week count, so "2 sprints" or "3 months" yields `null` and the phase reports
 * that it cannot be mapped rather than being mapped wrongly. A range takes its
 * upper bound ("2-3 weeks" → 3).
 *
 * @param {unknown} duration
 * @returns {number|null} A positive integer, or `null` when unreadable.
 *
 * @example
 * parseWeekCount('3 weeks');    // → 3
 * parseWeekCount('2-3 weeks');  // → 3
 * parseWeekCount('3 months');   // → null
 */
export function parseWeekCount(duration) {
  const value = text(duration).toLowerCase();
  if (!value.includes("week")) return null;
  const numbers = value.match(/\d+(?:\.\d+)?/g);
  if (!numbers) return null;
  const count = Math.ceil(Number(numbers[numbers.length - 1]));
  return Number.isFinite(count) && count >= 1 ? count : null;
}

/**
 * Work out which weeks each v1 `timeline` phase covers (Requirement 3.4).
 *
 * Two readings of the phase's *own* words, in order of directness — and no
 * third guess:
 *
 *   1. `tasks` — the phase names task titles that appear in the weekly plan, so
 *      its weeks are simply the weeks scheduling those tasks. Exact (modulo
 *      case and whitespace) matching only; a near-miss is not a match.
 *   2. `duration` — every phase states a duration in weeks, so the phases lay
 *      end to end across the plan's weeks in the order given.
 *
 * When neither applies the phase reports `basis: 'none'` and carries no weeks,
 * because an unmappable phase must say so rather than borrow a neighbour's.
 *
 * @param {unknown} phases The v1 proposal's `timeline` array.
 * @param {{key: string, rollup: Object}[]} entries Week entries in ascending order.
 * @returns {{phase: Object, weeks: {key: string, rollup: Object}[], basis: 'tasks'|'duration'|'none'}[]}
 */
export function mapPhasesToWeeks(phases, entries) {
  const list = Array.isArray(phases) ? phases.filter(isRecord) : [];
  if (list.length === 0 || entries.length === 0) return [];

  /** Task title → the week entries that schedule a task with that title. */
  const entriesByTaskTitle = new Map();
  for (const entry of entries) {
    for (const task of entry.rollup.tasks) {
      const key = matchKey(task.title);
      if (!key) continue;
      const bucket = entriesByTaskTitle.get(key);
      if (bucket) bucket.push(entry);
      else entriesByTaskTitle.set(key, [entry]);
    }
  }

  // Duration slices are laid out for every phase up front, so a phase resolved
  // by task match does not shift the ordinal position of the phases after it.
  const durations = list.map((phase) => parseWeekCount(phase.duration));
  const slices = [];
  if (durations.every((count) => count !== null)) {
    let cursor = 0;
    for (const count of durations) {
      const start = Math.min(cursor, entries.length);
      slices.push(entries.slice(start, Math.min(cursor + count, entries.length)));
      cursor += count;
    }
  }

  return list.map((phase, index) => {
    const matched = [];
    const seen = new Set();
    for (const title of Array.isArray(phase.tasks) ? phase.tasks : []) {
      for (const entry of entriesByTaskTitle.get(matchKey(title)) ?? []) {
        if (seen.has(entry.key)) continue;
        seen.add(entry.key);
        matched.push(entry);
      }
    }
    if (matched.length > 0) return { phase, weeks: matched, basis: "tasks" };

    const slice = slices[index] ?? [];
    if (slice.length > 0) return { phase, weeks: slice, basis: "duration" };

    return { phase, weeks: [], basis: "none" };
  });
}

/**
 * @param {Object} props
 * @param {Object|null|undefined} props.plan The `ExecutionPlan` — supplies
 *   `weeks`, and the tasks/deliverables/checkpoints they name.
 * @param {Object|null|undefined} props.diagnostics The matching
 *   `PlanDiagnostics`, whose `empty_week` issues flag the gaps.
 * @param {Object[]} [props.phases] Optional v1 `timeline` array. When given, a
 *   phase overview is rendered whose rows expand in place into their weeks.
 * @param {(task: Object) => void} [props.onSelectTask] Optional: makes each task
 *   activatable so a host surface can open its details.
 * @returns {JSX.Element}
 */
export function WeekDetail({ plan, diagnostics, phases, onSelectTask }) {
  const rollups = useMemo(() => buildWeekRollups(plan, diagnostics), [plan, diagnostics]);
  const availability = useMemo(() => sectionAvailability(plan, diagnostics).weeks, [plan, diagnostics]);

  // A week's identity for React keys and local state. `id`/`weekNumber` are
  // optional in practice, so the input position is the last resort.
  const entries = useMemo(
    () =>
      rollups.map((rollup, index) => ({
        key: `${text(rollup.week.id) || (typeof rollup.week.weekNumber === "number" ? `n${rollup.week.weekNumber}` : "")}#${index}`,
        rollup,
      })),
    [rollups],
  );

  const phaseRows = useMemo(() => mapPhasesToWeeks(phases, entries), [phases, entries]);

  /** @type {[Object<string, number>, Function]} `list key` → pages disclosed. */
  const [pagesShown, setPagesShown] = useState({});
  /** @type {[Object<string, boolean>, Function]} `phase key` → expanded. */
  const [expandedPhases, setExpandedPhases] = useState({});
  /** @type {[string, Function]} Latest change, announced politely. */
  const [announcement, setAnnouncement] = useState("");

  const showMore = useCallback((listKey, label, weekLabel) => {
    setPagesShown((current) => ({ ...current, [listKey]: (current[listKey] ?? 1) + 1 }));
    setAnnouncement(`More ${label.toLowerCase()} shown for ${weekLabel}.`);
  }, []);

  // Local state only: no navigation and no callback, so the reviewer's step and
  // approval state are untouched by opening a phase (Requirement 3.4).
  const togglePhase = useCallback((phaseKey, phaseName, weekCount) => {
    setExpandedPhases((current) => {
      const next = !current[phaseKey];
      setAnnouncement(
        next
          ? `${phaseName} expanded, showing ${weekCount} ${weekCount === 1 ? "week" : "weeks"}.`
          : `${phaseName} collapsed.`,
      );
      return { ...current, [phaseKey]: next };
    });
  }, []);

  if (!availability.available || entries.length === 0) {
    return (
      <EmptyDiagram
        icon={CalendarRange}
        title="No weekly breakdown yet"
        reason={
          availability.available
            ? "This plan has no weekly breakdown, so there are no weeks to show."
            : availability
        }
      />
    );
  }

  return (
    // `data-layout` records the invariant this view is built on: the sequence is
    // vertical at every width, so there is no narrow-screen variant to swap in.
    <div data-testid="week-detail" data-layout="vertical" style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "#64748b", maxWidth: 640 }}>
        Every week below names its objective and what it produces, in order. Weeks the validator found
        empty are marked as gaps, and anything needed from you is called out — blocking items first.
      </p>

      {phaseRows.length > 0 && (
        <PhaseOverview
          rows={phaseRows}
          expanded={expandedPhases}
          onToggle={togglePhase}
        />
      )}

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, minWidth: 0 }}>
        {entries.map(({ key, rollup }) => (
          <li key={key} style={{ minWidth: 0 }}>
            <WeekCard
              entryKey={key}
              rollup={rollup}
              pagesShown={pagesShown}
              onShowMore={showMore}
              onSelectTask={onSelectTask}
            />
          </li>
        ))}
      </ol>

      {/* One polite region for the whole view, matching the other diagrams. */}
      <p
        aria-live="polite"
        data-testid="week-detail-live-region"
        style={{ margin: 0, fontSize: 12.5, minHeight: 18, color: "#475569" }}
      >
        {announcement}
      </p>

      <DiagramLegend maps={[TASK_STATUSES, CHECKPOINT_STATUSES]} title="What each status means" />
    </div>
  );
}

/**
 * The phase/milestone overview, whose rows expand in place (Requirement 3.4).
 *
 * The full week sequence below stays rendered either way — the phases are an
 * additional way in, never a wrapper that hides week granularity (R3.1).
 *
 * @param {Object} props
 * @param {{phase: Object, weeks: {key: string, rollup: Object}[], basis: string}[]} props.rows
 * @param {Object<string, boolean>} props.expanded
 * @param {(phaseKey: string, phaseName: string, weekCount: number) => void} props.onToggle
 * @returns {JSX.Element}
 */
function PhaseOverview({ rows, expanded, onToggle }) {
  return (
    <div className="panel-card" style={{ padding: 12, minWidth: 0 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 2px", color: "#0f172a" }}>Phases</h4>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
        Open a phase to see the weeks it covers. You stay on this step — nothing is approved or
        navigated by expanding.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {rows.map(({ phase, weeks, basis }, index) => {
          const phaseKey = `${text(phase.phase) || "phase"}#${index}`;
          const phaseName = text(phase.phase) || `Phase ${index + 1}`;
          const duration = text(phase.duration);
          const isOpen = Boolean(expanded[phaseKey]);
          const regionId = `week-detail-phase-${index}`;
          const dependencies = (Array.isArray(phase.dependencies) ? phase.dependencies : [])
            .map(text)
            .filter(Boolean);

          return (
            <li key={phaseKey} style={{ minWidth: 0 }}>
              <button
                type="button"
                data-testid="week-detail-phase"
                className="panel-btn panel-btn--ghost"
                aria-expanded={isOpen}
                aria-controls={regionId}
                onClick={() => onToggle(phaseKey, phaseName, weeks.length)}
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  gap: 8,
                  textAlign: "left",
                  flexWrap: "wrap",
                  fontSize: 12.5,
                }}
              >
                <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                <span style={{ fontWeight: 700 }}>{phaseName}</span>
                {duration && <span style={{ color: "#64748b", fontWeight: 400 }}>{duration}</span>}
                <span style={{ color: "#64748b", fontWeight: 400 }}>
                  {weeks.length === 0
                    ? "· weeks not mapped"
                    : `· ${weeks.length} ${weeks.length === 1 ? "week" : "weeks"}`}
                </span>
              </button>

              <div id={regionId} hidden={!isOpen} style={{ padding: "6px 0 2px 18px", minWidth: 0 }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "#64748b" }}>
                  {BASIS_SENTENCES[basis]}
                </p>
                {weeks.length > 0 && (
                  <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                    {weeks.map(({ key, rollup }) => (
                      <li key={key} style={{ fontSize: 12.5, color: "#334155", minWidth: 0 }}>
                        <span style={{ fontWeight: 700 }}>{weekHeading(rollup.week)}</span>
                        {text(rollup.week.objective) && (
                          <span style={{ color: "#64748b" }}> — {text(rollup.week.objective)}</span>
                        )}
                        <WeekBadges rollup={rollup} />
                      </li>
                    ))}
                  </ol>
                )}
                {dependencies.length > 0 && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                    Depends on: {dependencies.join(", ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One week, in full (Requirements 3.1, 3.2, 3.3, 3.5).
 *
 * @param {Object} props
 * @param {string} props.entryKey Stable key for this week's disclosure state.
 * @param {Object} props.rollup A `WeekRollup` from `buildWeekRollups`.
 * @param {Object<string, number>} props.pagesShown
 * @param {(listKey: string, label: string, weekLabel: string) => void} props.onShowMore
 * @param {(task: Object) => void} [props.onSelectTask]
 * @returns {JSX.Element}
 */
function WeekCard({ entryKey, rollup, pagesShown, onShowMore, onSelectTask }) {
  const { week, tasks, deliverables, checkpoints, clientActions, blockingClientActions, isGap, gapIssue } = rollup;
  const heading = weekHeading(week);
  const blockingIds = new Set(blockingClientActions.map((action) => String(action.id)));

  /** Shared props for every disclosed list in this card. */
  const listProps = (name, label, items) => ({
    label,
    items,
    pagesShown: pagesShown[`${entryKey}:${name}`] ?? 1,
    onShowMore: () => onShowMore(`${entryKey}:${name}`, label, heading),
  });

  return (
    <section
      data-testid="week-detail-week"
      data-week-number={typeof week.weekNumber === "number" ? week.weekNumber : undefined}
      data-gap={isGap ? "true" : "false"}
      aria-label={heading}
      className="panel-card"
      style={{
        padding: 12,
        minWidth: 0,
        // Colour is an extra channel only; the "Gap" badge below carries the meaning.
        borderColor: isGap ? "#fde68a" : undefined,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
        <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: "#0f172a" }}>{heading}</h4>
        <WeekBadges rollup={rollup} />
      </div>

      {text(week.objective) && (
        <p style={{ margin: "5px 0 0", fontSize: 13, color: "#334155", overflowWrap: "anywhere" }}>
          {text(week.objective)}
        </p>
      )}

      {/* Read straight from the validator's own `empty_week` issue (R3.3). */}
      {isGap && (
        <p
          style={{
            margin: "8px 0 0",
            padding: "7px 9px",
            borderRadius: 6,
            fontSize: 12.5,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#b45309",
            overflowWrap: "anywhere",
          }}
        >
          <span style={{ fontWeight: 700 }}>
            <span aria-hidden="true">{GAP.glyph}</span> {GAP.word}:
          </span>{" "}
          {text(gapIssue && gapIssue.message) || GAP_FALLBACK}
        </p>
      )}

      <div style={{ display: "grid", gap: 8, marginTop: 10, minWidth: 0 }}>
        <DisclosedList
          {...listProps("tasks", "Tasks", tasks)}
          emptyText="No task is scheduled in this week."
          renderItem={(task) => (
            <>
              {typeof onSelectTask === "function" ? (
                <button type="button" style={linkButtonStyle} onClick={() => onSelectTask(task)}>
                  {text(task.title) || String(task.id)}
                </button>
              ) : (
                <span style={{ fontWeight: 600, color: "#334155" }}>{text(task.title) || String(task.id)}</span>
              )}{" "}
              <StatePill map={TASK_STATUSES} value={task.status} subject={text(task.title)} />
            </>
          )}
        />

        <DisclosedList
          {...listProps("deliverables", "Deliverables due", deliverables)}
          emptyText="Nothing is due in this week."
          renderItem={(deliverable) => (
            <span style={{ color: "#334155" }}>{text(deliverable.title) || String(deliverable.id)}</span>
          )}
        />

        <DisclosedList
          {...listProps("checkpoints", "Checkpoints", checkpoints)}
          emptyText="No checkpoint falls in this week."
          renderItem={(checkpoint) => (
            <>
              <span style={{ fontWeight: 600, color: "#334155" }}>
                {text(checkpoint.title) || String(checkpoint.id)}
              </span>{" "}
              <StatePill
                map={CHECKPOINT_STATUSES}
                value={checkpoint.status}
                subject={text(checkpoint.title)}
              />
              {checkpoint.blocking === true && <BlockingTag />}
            </>
          )}
        />

        <DisclosedList
          {...listProps("clientActions", "Your actions", clientActions)}
          emptyText="Nothing is needed from you in this week."
          renderItem={(action) => (
            <>
              <span style={{ color: "#334155", overflowWrap: "anywhere" }}>{text(action.description)}</span>
              {/* Blocking status is taken from the rollup's own filtered list. */}
              {blockingIds.has(String(action.id)) && <BlockingTag />}
            </>
          )}
        />
      </div>
    </section>
  );
}

/**
 * The at-a-glance counts beside a week's heading, including the blocking count
 * so a client obligation is visible before the week is read (R3.5).
 *
 * @param {{rollup: Object}} props
 * @returns {JSX.Element}
 */
function WeekBadges({ rollup }) {
  const blocking = rollup.blockingClientActions.length;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, fontSize: 11.5 }}>
      {rollup.isGap && (
        <span className="panel-badge panel-badge--orange">
          <span aria-hidden="true">{GAP.glyph}</span> {GAP.word}
        </span>
      )}
      {blocking > 0 && (
        <span className="panel-badge panel-badge--red">
          <span aria-hidden="true">{BLOCKING.glyph}</span> {BLOCKING.word}: {blocking} from you
        </span>
      )}
      <span className="panel-badge panel-badge--gray">
        {rollup.tasks.length} {rollup.tasks.length === 1 ? "task" : "tasks"}
      </span>
      <span className="panel-badge panel-badge--gray">
        {rollup.deliverables.length} due
      </span>
      <span className="panel-badge panel-badge--gray">
        {rollup.checkpoints.length} {rollup.checkpoints.length === 1 ? "checkpoint" : "checkpoints"}
      </span>
    </span>
  );
}

/**
 * A progressively disclosed sub-list of a week (Requirement 10.3).
 *
 * The hidden count is always on screen, so a long list is visibly partial
 * rather than quietly cut short.
 *
 * @param {Object} props
 * @param {string} props.label Section heading, e.g. `'Tasks'`.
 * @param {Object[]} props.items
 * @param {number} props.pagesShown
 * @param {() => void} props.onShowMore
 * @param {(item: Object) => import('react').ReactNode} props.renderItem
 * @param {string} props.emptyText Sentence shown when the list is empty.
 * @returns {JSX.Element}
 */
function DisclosedList({ label, items, pagesShown, onShowMore, renderItem, emptyText }) {
  const { visible, remaining, total } = discloseSlice(items, DEFAULT_PAGE_SIZE, pagesShown);

  return (
    <div style={{ minWidth: 0 }}>
      <span className="panel-label" style={{ color: "#94a3b8" }}>
        {label}
      </span>
      {total === 0 ? (
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#94a3b8" }}>{emptyText}</p>
      ) : (
        <>
          <ul style={{ listStyle: "disc", margin: "3px 0 0", paddingLeft: 18, fontSize: 12.5, minWidth: 0 }}>
            {visible.map((item, index) => (
              <li key={`${String(item.id ?? index)}`} style={{ marginBottom: 3, minWidth: 0 }}>
                {renderItem(item)}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p style={{ margin: "4px 0 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <button type="button" className="panel-btn panel-btn--ghost" style={{ fontSize: 12 }} onClick={onShowMore}>
                Show {remaining} more
              </button>
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                Showing {visible.length} of {total}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A status pill: the glyph is decorative, the word beside it carries the
 * meaning, and `describeState` supplies the fuller phrase as the title.
 *
 * @param {Object} props
 * @param {Object<string, Object>} props.map A presentation map from `encoding.js`.
 * @param {unknown} props.value The server's state value.
 * @param {string} [props.subject] What the state belongs to.
 * @returns {JSX.Element}
 */
function StatePill({ map, value, subject }) {
  const state = resolveState(map, value);
  return (
    <span
      title={describeState(map, value, subject)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 6px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: state.bg,
        border: `1px solid ${state.border}`,
        color: state.color,
      }}
    >
      <span aria-hidden="true">{state.glyph}</span>
      {state.word}
    </span>
  );
}

/**
 * The blocking marker — glyph plus the word, so it survives monochrome, colour
 * blindness and a screen reader (Requirement 3.5).
 *
 * @returns {JSX.Element}
 */
function BlockingTag() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginLeft: 6,
        padding: "1px 6px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: "#fef2f2",
        border: "1px solid #fee2e2",
        color: "#991b1b",
      }}
    >
      <span aria-hidden="true">{BLOCKING.glyph}</span>
      {BLOCKING.word}
    </span>
  );
}

/**
 * A week's heading, verbatim from the plan (Requirement 3.1). Falls back to the
 * number alone, then to the label alone, so a week is never nameless.
 *
 * @param {Object} week A `PlanWeek`.
 * @returns {string} Non-empty.
 */
function weekHeading(week) {
  const number = typeof week.weekNumber === "number" && Number.isFinite(week.weekNumber) ? week.weekNumber : null;
  const label = text(week.label);
  if (number === null) return label || text(week.id) || "Week";
  return label ? `Week ${number} · ${label}` : `Week ${number}`;
}

/** A task title rendered as an activatable link, matching `CapacityHeatmap`. */
const linkButtonStyle = {
  padding: 0,
  border: "none",
  background: "none",
  font: "inherit",
  fontWeight: 600,
  color: "#1e40af",
  textDecoration: "underline",
  cursor: "pointer",
};

export default WeekDetail;
