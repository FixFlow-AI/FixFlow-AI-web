import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GaugeCircle } from "lucide-react";
import { buildCapacityMatrix, sectionAvailability, tasksForCapacityCell } from "../../lib/plan/selectors";
import { CAPACITY_STATES, describeState, resolveState } from "./encoding";
import { DiagramLegend } from "./DiagramLegend";
import { EmptyDiagram } from "./EmptyDiagram";

/**
 * The role × week capacity matrix (Requirement 6).
 *
 * This is a **display surface for the server's own figures and nothing else**.
 * `plannedHours`, `capacityHours`, `utilizationPct` and `state` all arrive on
 * the validator's `CapacityCell` objects, are carried here by reference through
 * `buildCapacityMatrix`, and are printed exactly as reported. No total, no
 * percentage, no ratio and no state is derived in the browser
 * (Requirement 6.5), which is why:
 *
 *   - a grid position the validator did not report reads **Unknown** with no
 *     figures at all, never `0%` and never an empty cell (Requirement 6.3);
 *   - a reported cell whose `utilizationPct` is `null` shows its hours but no
 *     percentage — the number is simply not known, and inventing one from
 *     `plannedHours / capacityHours` is exactly the fabricated precision the
 *     platform's trust position forbids;
 *   - selecting a cell lists the tasks *attributed* to that role-week by
 *     `tasksForCapacityCell`, and deliberately does not sum their estimates
 *     (Requirement 6.4) — the cell already carries the authoritative figure.
 *
 * `over` and `warning` are marked by the `encoding.js` glyph **and** word, so
 * the state survives monochrome, colour blindness and a screen reader
 * (Requirements 6.2, 12.3); the accompanying `DiagramLegend` spells the four
 * states out in full.
 *
 * Keyboard model matches the other plan diagrams (Requirement 12.4): the grid
 * is a single tab stop with a roving `tabindex` over the cells, arrow keys and
 * `Home`/`End` move, `Enter`/`Space` select, and one `aria-live="polite"`
 * region announces the selection.
 *
 * @module components/plan/CapacityHeatmap
 */

/** Wording for a role-week the validator reported no cell for (R6.3). */
const NOT_REPORTED = "No capacity figure reported for this role and week.";

/** Sentence keeping the provenance of every number on screen (R6.5). */
const PROVENANCE =
  "Every figure here is reported by the server-side validator and shown exactly as received. Nothing is recalculated in your browser.";

/** @param {unknown} value @returns {value is number} */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The hours/percentage line for a cell, verbatim.
 *
 * Every field is optional on the server contract, so each one is printed only
 * when it is actually present — an absent figure becomes silence, never a zero.
 *
 * @param {Object|null} cell A `CapacityCell`, or `null` for an unreported position.
 * @returns {string} A sentence fragment, or `''` when the cell carries no figures.
 *
 * @example
 * cellFigures({ plannedHours: 30, capacityHours: 24, utilizationPct: 125 });
 * // → '30h planned of 24h capacity · 125% utilisation'
 * cellFigures({ plannedHours: 12 });          // → '12h planned · capacity not declared'
 * cellFigures(null);                          // → ''
 */
export function cellFigures(cell) {
  if (!cell || typeof cell !== "object") return "";

  const parts = [];
  if (isFiniteNumber(cell.plannedHours)) {
    parts.push(
      isFiniteNumber(cell.capacityHours)
        ? `${cell.plannedHours}h planned of ${cell.capacityHours}h capacity`
        : `${cell.plannedHours}h planned · capacity not declared`,
    );
  } else if (isFiniteNumber(cell.capacityHours)) {
    parts.push(`${cell.capacityHours}h capacity`);
  }

  // Printed only when the validator supplied it. Never derived from the hours.
  if (isFiniteNumber(cell.utilizationPct)) parts.push(`${cell.utilizationPct}% utilisation`);

  return parts.join(" · ");
}

/**
 * The full accessible name of one grid position: subject, state word, figures.
 *
 * @param {string} roleName Display name of the role.
 * @param {number} weekNumber The week the column stands for.
 * @param {Object|null} cell The `CapacityCell`, or `null` when unreported.
 * @returns {string} Non-empty, and always containing the state's word.
 */
export function cellLabel(roleName, weekNumber, cell) {
  const subject = `${roleName}, week ${weekNumber}`;
  // An unreported position has no state field at all; `resolveState` maps that
  // to the `unknown` entry rather than to `ok`.
  const base = describeState(CAPACITY_STATES, cell ? cell.state : undefined, subject);
  const figures = cell ? cellFigures(cell) : NOT_REPORTED;
  return figures ? `${base}. ${figures}` : base;
}

/**
 * @param {Object} props
 * @param {Object|null|undefined} props.plan The `ExecutionPlan` — supplies
 *   `teamCapacity` (the rows), `weeks` (the columns) and `tasks` (attribution).
 * @param {Object|null|undefined} props.diagnostics The matching
 *   `PlanDiagnostics`, whose `capacity[]` supplies every figure shown.
 * @param {(task: Object) => void} [props.onSelectTask] Optional: makes each
 *   contributing task activatable, so a host surface can open its details.
 * @returns {JSX.Element}
 */
export function CapacityHeatmap({ plan, diagnostics, onSelectTask }) {
  const matrix = useMemo(() => buildCapacityMatrix(plan, diagnostics), [plan, diagnostics]);
  const availability = useMemo(() => sectionAvailability(plan, diagnostics).capacity, [plan, diagnostics]);

  const { roles, weekNumbers } = matrix;

  /** @type {[{row: number, col: number}, Function]} Roving focus position. */
  const [active, setActive] = useState({ row: 0, col: 0 });
  /** @type {[{roleId: string, weekNumber: number}|null, Function]} */
  const [selected, setSelected] = useState(null);

  const cellRefs = useRef(new Map());
  // Focus follows the roving position only after a key moved it, so mounting
  // the diagram never steals focus from wherever the reader actually is.
  const pendingFocus = useRef(false);
  const renderedMatrix = useRef(matrix);

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    cellRefs.current.get(positionKey(active.row, active.col))?.focus();
  }, [active]);

  // A new plan invalidates both positions: index-based coordinates and a
  // selection keyed on the old grid would otherwise point at the wrong cell.
  useEffect(() => {
    if (renderedMatrix.current === matrix) return;
    renderedMatrix.current = matrix;
    setActive({ row: 0, col: 0 });
    setSelected(null);
  }, [matrix]);

  const rowCount = roles.length;
  const colCount = weekNumbers.length;

  const moveTo = useCallback(
    (row, col) => {
      if (row < 0 || col < 0 || row >= rowCount || col >= colCount) return;
      pendingFocus.current = true;
      setActive({ row, col });
    },
    [rowCount, colCount],
  );

  const onKeyDown = useCallback(
    (event) => {
      const { row, col } = active;
      switch (event.key) {
        case "ArrowRight":
          moveTo(row, col + 1);
          break;
        case "ArrowLeft":
          moveTo(row, col - 1);
          break;
        case "ArrowDown":
          moveTo(row + 1, col);
          break;
        case "ArrowUp":
          moveTo(row - 1, col);
          break;
        case "Home":
          moveTo(row, 0);
          break;
        case "End":
          moveTo(row, colCount - 1);
          break;
        default:
          return;
      }
      // Only reached for a handled key, so ordinary page scrolling and the
      // buttons' native Enter/Space activation are left alone.
      event.preventDefault();
    },
    [active, moveTo, colCount],
  );

  if (!availability.available || rowCount === 0 || colCount === 0) {
    return (
      <EmptyDiagram
        icon={GaugeCircle}
        title="No capacity figures yet"
        reason={
          availability.available
            ? "The validator reported no role-week grid for this plan, so capacity cannot be shown."
            : availability
        }
      />
    );
  }

  const selectedRole = selected ? roles.find((role) => String(role.roleId) === selected.roleId) : null;
  const selectedCell = selected ? matrix.cell(selected.roleId, selected.weekNumber) : null;
  const contributingTasks = selected ? tasksForCapacityCell(plan, selected.roleId, selected.weekNumber) : [];
  const selectionSentence = selected
    ? cellLabel(roleLabel(selectedRole, selected.roleId), selected.weekNumber, selectedCell)
    : "";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* The scroller is this container; `min-width` sits on the table only, so
          a long plan scrolls here and never widens the page (R12.5). */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table
          onKeyDown={onKeyDown}
          style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 12.5, minWidth: 120 + colCount * 104 }}
        >
          <caption style={captionStyle}>
            Capacity by role and week. Each cell shows the validator’s state, planned hours, declared
            capacity and utilisation. Move between cells with the arrow keys, then press Enter to list
            the tasks behind a cell.
          </caption>
          <thead>
            <tr>
              <th scope="col" style={cornerStyle}>
                Role
              </th>
              {weekNumbers.map((weekNumber) => (
                <th key={weekNumber} scope="col" style={columnHeaderStyle}>
                  Week {weekNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role, row) => {
              const roleId = String(role.roleId);
              const name = roleLabel(role, roleId);
              return (
                <tr key={roleId}>
                  <th scope="row" style={rowHeaderStyle}>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{name}</span>
                    <span style={{ display: "block", fontWeight: 400, color: "#64748b", fontSize: 11.5 }}>
                      {isFiniteNumber(role.hoursPerWeek)
                        ? `${role.hoursPerWeek}h per week declared`
                        : "Weekly hours not declared"}
                    </span>
                  </th>
                  {weekNumbers.map((weekNumber, col) => {
                    const cell = matrix.cell(roleId, weekNumber);
                    const state = resolveState(CAPACITY_STATES, cell ? cell.state : undefined);
                    const figures = cell ? cellFigures(cell) : "";
                    const isSelected =
                      selected !== null && selected.roleId === roleId && selected.weekNumber === weekNumber;

                    return (
                      <td key={weekNumber} style={{ padding: 0 }}>
                        <button
                          type="button"
                          ref={(node) => {
                            const key = positionKey(row, col);
                            if (node) cellRefs.current.set(key, node);
                            else cellRefs.current.delete(key);
                          }}
                          // Roving tabindex: the grid is one tab stop (R12.4).
                          tabIndex={active.row === row && active.col === col ? 0 : -1}
                          aria-pressed={isSelected}
                          aria-label={cellLabel(name, weekNumber, cell)}
                          onClick={() => {
                            setActive({ row, col });
                            setSelected({ roleId, weekNumber });
                          }}
                          onFocus={() => setActive({ row, col })}
                          style={cellButtonStyle(state, isSelected)}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                            {/* Glyph is decorative; the word beside it carries
                                the meaning, so state never rides on colour. */}
                            <span aria-hidden="true">{state.glyph}</span>
                            {state.word}
                          </span>
                          <span aria-hidden="true" style={{ color: "#475569", fontSize: 11, lineHeight: 1.35 }}>
                            {figures || "Not reported"}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>{PROVENANCE}</p>

      {/* One polite region per diagram announces the current selection. */}
      <div aria-live="polite" className="panel-card" style={{ padding: 12 }}>
        {selected === null ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Select a cell to see which tasks put hours into that role’s week.
          </p>
        ) : (
          <>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
              {selectionSentence}
            </h4>
            {contributingTasks.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: "#64748b" }}>
                No task in this plan is owned by this role across this week.
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "#64748b" }}>
                  Tasks contributing hours to this role in this week:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#334155" }}>
                  {contributingTasks.map((task) => (
                    <li key={String(task.id)} style={{ marginBottom: 3 }}>
                      {typeof onSelectTask === "function" ? (
                        <button type="button" className="panel-btn panel-btn--ghost" style={taskLinkStyle} onClick={() => onSelectTask(task)}>
                          {taskTitle(task)}
                        </button>
                      ) : (
                        taskTitle(task)
                      )}
                      <span style={{ color: "#64748b" }}>
                        {" "}
                        — weeks {task.startWeek} to {task.endWeek}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      <DiagramLegend map={CAPACITY_STATES} title="What each cell state means" />
    </div>
  );
}

/**
 * Key for the DOM-node map holding the roving-focus targets. Purely local to
 * this component — grid coordinates, not plan identifiers.
 *
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
function positionKey(row, col) {
  return `${row}:${col}`;
}

/**
 * A role's display name, falling back to its id so a row is never nameless.
 *
 * @param {Object|null|undefined} role A `TeamCapacity` entry.
 * @param {string} roleId Its id, used when `roleName` is missing.
 * @returns {string}
 */
function roleLabel(role, roleId) {
  const name = role && typeof role.roleName === "string" ? role.roleName.trim() : "";
  return name || roleId;
}

/**
 * A task's title, falling back to its id.
 *
 * @param {Object} task A `PlanTask`.
 * @returns {string}
 */
function taskTitle(task) {
  const title = typeof task.title === "string" ? task.title.trim() : "";
  return title || String(task.id);
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
  fontSize: 11.5,
  fontWeight: 700,
  color: "#334155",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: "6px 9px",
  whiteSpace: "nowrap",
};

const cornerStyle = { ...headerCellBase, textAlign: "left" };
const columnHeaderStyle = { ...headerCellBase, textAlign: "center" };
const rowHeaderStyle = { ...headerCellBase, textAlign: "left", whiteSpace: "normal", minWidth: 130 };

const taskLinkStyle = {
  padding: 0,
  border: "none",
  background: "none",
  font: "inherit",
  color: "#1e40af",
  textDecoration: "underline",
  cursor: "pointer",
};

/**
 * One cell's button styling. Selection is shown with an outline as well as a
 * shade, and `:focus-visible` is left to the browser's own ring plus this
 * outline so focus stays visible (Requirement 12.4).
 *
 * @param {{bg: string, border: string, color: string}} state The resolved encoding.
 * @param {boolean} isSelected
 * @returns {Object} Inline style.
 */
function cellButtonStyle(state, isSelected) {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    width: "100%",
    minWidth: 96,
    textAlign: "left",
    padding: "7px 9px",
    fontSize: 12,
    lineHeight: 1.3,
    cursor: "pointer",
    background: state.bg,
    color: state.color,
    border: `1px solid ${state.border}`,
    borderRadius: 6,
    outline: isSelected ? "2px solid #0f172a" : "none",
    outlineOffset: isSelected ? 1 : 0,
  };
}

export default CapacityHeatmap;
