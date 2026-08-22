import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { buildTraceabilityRows, sectionAvailability } from "../../lib/plan/selectors";
import { COVERAGE_STATES, REQUIREMENT_SOURCES, coverageStateFor, describeState, mapLabel, resolveState } from "./encoding";
import { discloseSlice } from "../../lib/plan/disclosure";
import { DiagramLegend } from "./DiagramLegend";
import { EmptyDiagram } from "./EmptyDiagram";

/**
 * The requirement traceability matrix (Requirement 7).
 *
 * One semantic `<table>` row per requirement, linking it to the scope modules,
 * tasks and checkpoints that satisfy it — always by **name or title**, never by
 * the raw identifier the server joins on (Requirement 7.1). `buildTraceabilityRows`
 * has already resolved those ids into entities and dropped the dangling ones, so
 * nothing here can render an `undefined`.
 *
 * Three deliberate choices, all of them about not overstating what is known:
 *
 *   - **Coverage comes from the validator's own record.** `coverageStateFor`
 *     maps a missing `scopeCoverage` entry to *Not assessed* rather than to
 *     uncovered: an absent record means the validator did not report on the
 *     requirement, which is not the same accusation as "the plan misses it".
 *     A record that says `covered: false` *is* flagged, with the
 *     `COVERAGE_STATES` glyph **and** word (Requirements 7.2, 12.3).
 *   - **The covered/total counts are the diagnostics' own** —
 *     `coveredRequirementCount` and `totalRequirementCount` are printed verbatim
 *     and never recounted from the rows on screen (Requirement 7.3). If the two
 *     ever disagree, the server's figure is the one that governs the plan, and a
 *     browser-side recount would only hide that disagreement.
 *   - **Every requirement shows its `source`** through `REQUIREMENT_SOURCES`, so
 *     scope FixFlowAI *inferred* is visibly separate from scope the client
 *     stated (Requirements 7.4, 12.3) — glyph plus word, never colour alone.
 *
 * Blocking open questions are shown against the requirements they name, on the
 * same row, so an unanswered decision is read next to the scope it holds up
 * rather than in a separate list (Requirement 7.5).
 *
 * Keyboard model matches the other plan diagrams (Requirement 12.4): the table
 * is a single tab stop with a roving `tabindex` over the requirement row
 * headers, `ArrowUp`/`ArrowDown`/`Home`/`End` move, `Enter`/`Space` select, and
 * one `aria-live="polite"` region announces the selected requirement. Long link
 * lists are disclosed through `discloseSlice`, which always reports how many
 * items remain, so nothing is silently truncated (Requirement 10.3).
 *
 * @module components/plan/TraceabilityMatrix
 */

/** Links listed inside a table cell before the rest are summarised as a count. */
const CELL_ITEM_LIMIT = 3;

/** Links revealed per "show more" step in the selected-requirement region. */
const DETAIL_PAGE_SIZE = 5;

/** Shown wherever a requirement has no link of a given kind. */
const NO_LINK = "None";

/** Keeps the provenance of the two counts on screen (R7.3). */
const PROVENANCE =
  "The covered and total counts are reported by the server-side validator and shown exactly as received. Nothing is recounted in your browser.";

/**
 * The covered/total counts, taken verbatim from the diagnostics.
 *
 * Deliberately does **not** fall back to counting the rows: a count the
 * validator did not report reads as "not reported", because inventing one in
 * the browser is exactly the fabricated figure Requirement 7.3 guards against.
 *
 * @param {{coveredRequirementCount?: unknown, totalRequirementCount?: unknown}|null|undefined} diagnostics
 * @returns {{covered: string, total: string, text: string, complete: boolean}}
 *   `complete` is true only when both counts are known numbers and equal.
 *
 * @example
 * coverageCounts({ coveredRequirementCount: 3, totalRequirementCount: 5 }).text;
 * // → '3 / 5'
 * coverageCounts({}).text; // → 'not reported / not reported'
 */
export function coverageCounts(diagnostics) {
  const source = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  const covered = source.coveredRequirementCount;
  const total = source.totalRequirementCount;
  const known = isFiniteNumber(covered) && isFiniteNumber(total);

  return {
    covered: countText(covered),
    total: countText(total),
    text: `${countText(covered)} / ${countText(total)}`,
    complete: known && covered === total,
  };
}

/**
 * The accessible name of one requirement row: subject, coverage word, source word.
 *
 * Built through `describeState` so both state words reach assistive technology
 * (Requirement 12.3).
 *
 * @param {Object} row A `TraceabilityRow`.
 * @returns {string} Non-empty, containing the coverage word and the source word.
 */
export function requirementRowLabel(row) {
  const requirement = row && typeof row.requirement === "object" && row.requirement ? row.requirement : {};
  const subject = requirementStatement(requirement);
  const coverage = describeState(COVERAGE_STATES, coverageStateFor(row ? row.coverage : null), subject);
  const source = describeState(REQUIREMENT_SOURCES, requirement.source);
  const blocking = row && Array.isArray(row.blockingQuestions) ? row.blockingQuestions.length : 0;
  const held = blocking > 0 ? `. ${blocking} blocking open question${blocking === 1 ? "" : "s"}` : "";
  return `${coverage}. ${source}${held}`;
}

/**
 * @param {Object} props
 * @param {Object|null|undefined} props.plan The `ExecutionPlan` — supplies
 *   `requirements` (the rows) plus the modules, tasks, checkpoints and open
 *   questions the rows link to.
 * @param {Object|null|undefined} props.diagnostics The matching `PlanDiagnostics`,
 *   whose `scopeCoverage` decides coverage and whose own counts are displayed.
 * @param {(task: Object) => void} [props.onSelectTask] Optional: makes each
 *   linked task activatable, so a host surface can open its details.
 * @returns {JSX.Element}
 */
export function TraceabilityMatrix({ plan, diagnostics, onSelectTask }) {
  const rows = useMemo(() => buildTraceabilityRows(plan, diagnostics), [plan, diagnostics]);
  const availability = useMemo(() => sectionAvailability(plan, diagnostics).traceability, [plan, diagnostics]);
  const counts = useMemo(() => coverageCounts(diagnostics), [diagnostics]);

  /** @type {[number, Function]} Roving focus position within the row headers. */
  const [active, setActive] = useState(0);
  /** @type {[string|null, Function]} Selected requirement id. */
  const [selectedId, setSelectedId] = useState(null);
  /** @type {[number, Function]} Disclosure steps opened in the selection region. */
  const [pagesShown, setPagesShown] = useState(1);

  const rowRefs = useRef(new Map());
  // Focus follows the roving position only after a key moved it, so mounting
  // the matrix never steals focus from wherever the reader actually is.
  const pendingFocus = useRef(false);
  const renderedRows = useRef(rows);

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    rowRefs.current.get(active)?.focus();
  }, [active]);

  // A new plan invalidates both positions: an index-based cursor and a
  // selection keyed on the old requirement set would point at the wrong row.
  useEffect(() => {
    if (renderedRows.current === rows) return;
    renderedRows.current = rows;
    setActive(0);
    setSelectedId(null);
    setPagesShown(1);
  }, [rows]);

  const rowCount = rows.length;

  const moveTo = useCallback(
    (index) => {
      if (index < 0 || index >= rowCount) return;
      pendingFocus.current = true;
      setActive(index);
    },
    [rowCount],
  );

  const onKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case "ArrowDown":
          moveTo(active + 1);
          break;
        case "ArrowUp":
          moveTo(active - 1);
          break;
        case "Home":
          moveTo(0);
          break;
        case "End":
          moveTo(rowCount - 1);
          break;
        default:
          return;
      }
      // Only reached for a handled key, so ordinary page scrolling and the
      // buttons' native Enter/Space activation are left alone.
      event.preventDefault();
    },
    [active, moveTo, rowCount],
  );

  const select = useCallback((requirementId) => {
    setSelectedId(requirementId);
    setPagesShown(1);
  }, []);

  if (!availability.available || rowCount === 0) {
    return (
      <EmptyDiagram
        icon={ListChecks}
        title="Nothing to trace yet"
        reason={
          availability.available
            ? "This plan lists no requirements, so there is nothing to trace to planned work."
            : availability
        }
      />
    );
  }

  const selectedRow = selectedId === null ? null : rows.find((row) => requirementId(row) === selectedId) ?? null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={countsRowStyle}>
        <span style={countsPillStyle(counts.complete)}>
          <span aria-hidden="true">{resolveState(COVERAGE_STATES, counts.complete ? "covered" : "uncovered").glyph}</span>
          {/* The validator's own figures, printed verbatim (R7.3). */}
          Requirements covered: {counts.text}
        </span>
      </div>

      {/* The scroller is this container; `min-width` sits on the table only, so
          a wide matrix scrolls here and never widens the page (R12.5). */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table onKeyDown={onKeyDown} style={tableStyle}>
          <caption style={captionStyle}>
            Every requirement in this plan against the scope modules, tasks and checkpoints that
            satisfy it, with its source and any blocking open question. Move between requirements
            with the up and down arrow keys, then press Enter to see all of a requirement’s links.
          </caption>
          <thead>
            <tr>
              <th scope="col" style={cornerStyle}>
                Requirement
              </th>
              <th scope="col" style={columnHeaderStyle}>
                {mapLabel(COVERAGE_STATES)}
              </th>
              <th scope="col" style={columnHeaderStyle}>
                Scope modules
              </th>
              <th scope="col" style={columnHeaderStyle}>
                Tasks
              </th>
              <th scope="col" style={columnHeaderStyle}>
                Checkpoints
              </th>
              <th scope="col" style={columnHeaderStyle}>
                Blocking questions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const id = requirementId(row);
              const requirement = row.requirement ?? {};
              const coverage = resolveState(COVERAGE_STATES, coverageStateFor(row.coverage));
              const source = resolveState(REQUIREMENT_SOURCES, requirement.source);
              const isSelected = selectedId === id;

              return (
                <tr key={id} style={isSelected ? { background: "#f8fafc" } : undefined}>
                  <th scope="row" style={rowHeaderStyle}>
                    <button
                      type="button"
                      ref={(node) => {
                        if (node) rowRefs.current.set(index, node);
                        else rowRefs.current.delete(index);
                      }}
                      // Roving tabindex: the matrix is one tab stop (R12.4).
                      tabIndex={active === index ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-label={requirementRowLabel(row)}
                      onClick={() => {
                        setActive(index);
                        select(id);
                      }}
                      onFocus={() => setActive(index)}
                      style={rowButtonStyle(isSelected)}
                    >
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{requirementStatement(requirement)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 400 }}>
                        {/* Source as glyph *and* word, so inferred scope is
                            distinguishable without relying on colour (R7.4). */}
                        <span style={sourcePillStyle(source)}>
                          <span aria-hidden="true">{source.glyph}</span>
                          {source.word}
                        </span>
                        <span style={{ color: "#94a3b8", fontSize: 11 }}>
                          {priorityText(requirement.priority)} · {id}
                        </span>
                      </span>
                    </button>
                  </th>

                  <td style={cellStyle}>
                    <span style={coveragePillStyle(coverage)}>
                      <span aria-hidden="true">{coverage.glyph}</span>
                      {coverage.word}
                    </span>
                  </td>

                  <td style={cellStyle}>
                    <CellList items={row.modules} render={moduleName} />
                  </td>
                  <td style={cellStyle}>
                    <CellList items={row.tasks} render={taskTitle} />
                  </td>
                  <td style={cellStyle}>
                    <CellList items={row.checkpoints} render={checkpointTitle} />
                  </td>
                  <td style={cellStyle}>
                    <CellList items={row.blockingQuestions} render={questionText} emptyText="None blocking" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>{PROVENANCE}</p>

      {/* One polite region per diagram announces the current selection. */}
      <div aria-live="polite" className="panel-card" style={{ padding: 12 }}>
        {selectedRow === null ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Select a requirement to see everything linked to it, and anything blocking it.
          </p>
        ) : (
          <SelectedRequirement
            row={selectedRow}
            pagesShown={pagesShown}
            onShowMore={() => setPagesShown((pages) => pages + 1)}
            onSelectTask={onSelectTask}
          />
        )}
      </div>

      <DiagramLegend
        maps={[COVERAGE_STATES, REQUIREMENT_SOURCES]}
        title="What each coverage state and requirement source means"
      />
    </div>
  );
}

/**
 * A cell's linked entities, by name, with any overflow stated as a count rather
 * than dropped silently (R10.3). Purely textual — the table stays a single tab
 * stop, and the full list is available in the selection region below it.
 *
 * @param {Object} props
 * @param {Object[]} props.items Resolved entities from the traceability row.
 * @param {(item: Object) => string} props.render Entity → display name.
 * @param {string} [props.emptyText] Wording when the row has no such link.
 * @returns {JSX.Element}
 */
function CellList({ items, render, emptyText = NO_LINK }) {
  const slice = discloseSlice(items, CELL_ITEM_LIMIT, 1);

  if (slice.total === 0) {
    return <span style={{ color: "#94a3b8" }}>{emptyText}</span>;
  }

  return (
    <>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 2 }}>
        {slice.visible.map((item, index) => (
          <li key={entityKey(item, index)}>{render(item)}</li>
        ))}
      </ul>
      {slice.remaining > 0 && (
        <span style={{ display: "block", marginTop: 3, color: "#64748b", fontSize: 11.5 }}>
          {slice.remaining} more — select this requirement to see {slice.total} in total.
        </span>
      )}
    </>
  );
}

/**
 * The selected requirement in full: its statement, coverage, source, every
 * linked entity, and each blocking question with the reason it holds the
 * requirement up (R7.5).
 *
 * @param {Object} props
 * @param {Object} props.row The selected `TraceabilityRow`.
 * @param {number} props.pagesShown Disclosure steps opened so far.
 * @param {() => void} props.onShowMore Reveals the next page of links.
 * @param {(task: Object) => void} [props.onSelectTask]
 * @returns {JSX.Element}
 */
function SelectedRequirement({ row, pagesShown, onShowMore, onSelectTask }) {
  const requirement = row.requirement ?? {};
  const coverage = resolveState(COVERAGE_STATES, coverageStateFor(row.coverage));
  const source = resolveState(REQUIREMENT_SOURCES, requirement.source);

  const modules = discloseSlice(row.modules, DETAIL_PAGE_SIZE, pagesShown);
  const tasks = discloseSlice(row.tasks, DETAIL_PAGE_SIZE, pagesShown);
  const checkpoints = discloseSlice(row.checkpoints, DETAIL_PAGE_SIZE, pagesShown);
  const hasMore = modules.hasMore || tasks.hasMore || checkpoints.hasMore;

  return (
    <>
      <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
        {requirementStatement(requirement)}
      </h4>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>
        {/* Both words repeated here, so the live announcement carries the state. */}
        <span aria-hidden="true">{coverage.glyph} </span>
        {coverage.word} — {coverage.description} <span aria-hidden="true">{source.glyph} </span>
        {source.word} — {source.description}
      </p>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <DetailList title="Scope modules" slice={modules} render={moduleName} />
        <DetailList
          title="Tasks"
          slice={tasks}
          render={taskTitle}
          onActivate={typeof onSelectTask === "function" ? onSelectTask : undefined}
        />
        <DetailList title="Checkpoints" slice={checkpoints} render={checkpointTitle} />
      </div>

      {hasMore && (
        <button type="button" className="panel-btn panel-btn--ghost" style={{ marginTop: 8 }} onClick={onShowMore}>
          Show more linked items
        </button>
      )}

      {row.blockingQuestions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h5 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 4px", color: "#b45309" }}>
            {row.blockingQuestions.length} blocking open question
            {row.blockingQuestions.length === 1 ? "" : "s"} on this requirement
          </h5>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#334155" }}>
            {row.blockingQuestions.map((question, index) => (
              <li key={entityKey(question, index)} style={{ marginBottom: 3 }}>
                {questionText(question)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * One titled list inside the selection region, with its hidden-item count.
 *
 * @param {Object} props
 * @param {string} props.title Heading for the list.
 * @param {{visible: Object[], remaining: number, total: number}} props.slice From `discloseSlice`.
 * @param {(item: Object) => string} props.render Entity → display name.
 * @param {(item: Object) => void} [props.onActivate] Makes each item a button.
 * @returns {JSX.Element}
 */
function DetailList({ title, slice, render, onActivate }) {
  return (
    <div>
      <span style={detailTitleStyle}>
        {title} ({slice.total})
      </span>
      {slice.total === 0 ? (
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#94a3b8" }}>{NO_LINK}</p>
      ) : (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#334155", display: "grid", gap: 2 }}>
          {slice.visible.map((item, index) => (
            <li key={entityKey(item, index)}>
              {onActivate ? (
                <button type="button" className="panel-btn panel-btn--ghost" style={linkStyle} onClick={() => onActivate(item)}>
                  {render(item)}
                </button>
              ) : (
                render(item)
              )}
            </li>
          ))}
          {slice.remaining > 0 && (
            <li style={{ listStyle: "none", marginLeft: -14, color: "#64748b", fontSize: 11.5 }}>
              {slice.remaining} not shown yet.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** @param {unknown} value @returns {value is number} */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * A count as text, verbatim when the validator reported it.
 *
 * @param {unknown} value
 * @returns {string}
 */
function countText(value) {
  return isFiniteNumber(value) ? String(value) : "not reported";
}

/**
 * A row's requirement id as a string key.
 *
 * `buildTraceabilityRows` has already dropped requirements without a usable id,
 * so this is always non-empty for a rendered row.
 *
 * @param {Object} row A `TraceabilityRow`.
 * @returns {string}
 */
function requirementId(row) {
  return String(row.requirement.id);
}

/**
 * A requirement's statement, falling back to its id so a row is never nameless.
 *
 * @param {Object} requirement A `Requirement`.
 * @returns {string}
 */
function requirementStatement(requirement) {
  const statement = typeof requirement.statement === "string" ? requirement.statement.trim() : "";
  return statement || String(requirement.id ?? "Unnamed requirement");
}

/**
 * The requirement's priority in words. Absent priority is stated rather than
 * assumed, since the schema's default belongs to the server, not the view.
 *
 * @param {unknown} priority `'must' | 'should' | 'could'` on the contract.
 * @returns {string}
 */
function priorityText(priority) {
  if (priority === "must") return "Must have";
  if (priority === "should") return "Should have";
  if (priority === "could") return "Could have";
  return "Priority not stated";
}

/** @param {Object} module A `ScopeModule`. @returns {string} */
function moduleName(module) {
  const name = typeof module.name === "string" ? module.name.trim() : "";
  return name || String(module.id);
}

/** @param {Object} task A `PlanTask`. @returns {string} */
function taskTitle(task) {
  const title = typeof task.title === "string" ? task.title.trim() : "";
  return title || String(task.id);
}

/** @param {Object} checkpoint A `Checkpoint`. @returns {string} */
function checkpointTitle(checkpoint) {
  const title = typeof checkpoint.title === "string" ? checkpoint.title.trim() : "";
  return title || String(checkpoint.id);
}

/** @param {Object} question An `OpenQuestion`. @returns {string} */
function questionText(question) {
  const text = typeof question.question === "string" ? question.question.trim() : "";
  return text || String(question.id);
}

/**
 * A stable React key for a linked entity, falling back to its position when the
 * entity carries no usable id.
 *
 * @param {Object} item
 * @param {number} index
 * @returns {string}
 */
function entityKey(item, index) {
  const id = item && (typeof item.id === "string" || typeof item.id === "number") ? String(item.id) : "";
  return id || `index-${index}`;
}

// Styles reuse the palette of `sections/dashboard/ExecutionPlanPanel.jsx`, with
// colour always an *additional* channel behind the glyph and the word.
const captionStyle = {
  captionSide: "top",
  textAlign: "left",
  fontSize: 12,
  color: "#64748b",
  padding: "0 0 8px",
  maxWidth: 680,
};

const tableStyle = {
  borderCollapse: "separate",
  borderSpacing: 3,
  fontSize: 12.5,
  minWidth: 880,
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

const cornerStyle = { ...headerCellBase, textAlign: "left", minWidth: 240 };
const columnHeaderStyle = { ...headerCellBase, textAlign: "left" };
const rowHeaderStyle = {
  ...headerCellBase,
  textAlign: "left",
  whiteSpace: "normal",
  background: "#ffffff",
  padding: 0,
  minWidth: 240,
  maxWidth: 320,
  verticalAlign: "top",
};

const cellStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: "7px 9px",
  verticalAlign: "top",
  color: "#334155",
  lineHeight: 1.4,
};

const countsRowStyle = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };

const detailTitleStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#94a3b8",
};

const linkStyle = {
  padding: 0,
  border: "none",
  background: "none",
  font: "inherit",
  color: "#1e40af",
  textDecoration: "underline",
  cursor: "pointer",
  textAlign: "left",
};

/**
 * The covered/total pill. The glyph and the word-bearing text carry the
 * meaning; the tone is only reinforcement.
 *
 * @param {boolean} complete Whether the validator's own counts are equal.
 * @returns {Object} Inline style.
 */
function countsPillStyle(complete) {
  const state = resolveState(COVERAGE_STATES, complete ? "covered" : "uncovered");
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 999,
    background: state.bg,
    color: state.color,
    border: `1px solid ${state.border}`,
  };
}

/**
 * @param {{bg: string, border: string, color: string}} state Resolved coverage encoding.
 * @returns {Object} Inline style.
 */
function coveragePillStyle(state) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    background: state.bg,
    color: state.color,
    border: `1px solid ${state.border}`,
  };
}

/**
 * @param {{bg: string, border: string, color: string}} state Resolved source encoding.
 * @returns {Object} Inline style.
 */
function sourcePillStyle(state) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    background: state.bg,
    color: state.color,
    border: `1px solid ${state.border}`,
  };
}

/**
 * One requirement row header's button styling. Selection is shown with an
 * outline as well as a shade, and `:focus-visible` is left to the browser's own
 * ring plus this outline so focus stays visible (Requirement 12.4).
 *
 * @param {boolean} isSelected
 * @returns {Object} Inline style.
 */
function rowButtonStyle(isSelected) {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "100%",
    textAlign: "left",
    padding: "7px 9px",
    fontSize: 12.5,
    lineHeight: 1.35,
    cursor: "pointer",
    background: isSelected ? "#f1f5f9" : "transparent",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    outline: isSelected ? "2px solid #0f172a" : "none",
    outlineOffset: isSelected ? 1 : 0,
  };
}

export default TraceabilityMatrix;
