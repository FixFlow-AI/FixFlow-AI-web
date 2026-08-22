import { useEffect, useId, useMemo, useRef } from "react";
import { X, Boxes, ClipboardCheck, AlertTriangle } from "lucide-react";
import { indexPlan } from "../../lib/plan/selectors";
import { TASK_STATUSES, describeState, resolveState } from "./encoding";

/**
 * The shared selection inspector for every plan diagram.
 *
 * `ArchitectureGraph` and `ScheduleGantt` both select into this one panel, so a
 * component and a task are described with the same vocabulary, the same
 * keyboard behaviour, and the same honesty about missing data:
 *
 *   - a selected **component** shows its responsibility, the scope modules it
 *     serves (resolved names, never raw ids), its interfaces, its data
 *     boundary, its failure impact, and whether it carries open decisions
 *     (Requirements 4.3, 4.4);
 *   - a selected **task** shows its owner role (resolved role name), its
 *     estimate, its acceptance criteria, its required evidence, and the scope
 *     module it serves (Requirement 5.3);
 *   - an estimate is always worded **as an estimate**, with its
 *     `estimateBasis` shown alongside the figure, never as a precise
 *     commitment (Requirement 9.6).
 *
 * Every optional field that is absent renders the explicit words
 * "Not specified" rather than an empty line, a dash, or `undefined` — a blank
 * row would read as "nothing here" when the truth is "nobody said".
 *
 * The panel is opened by keyboard selection from a diagram, so it takes focus
 * on mount, hands focus back to the element that opened it on unmount, and
 * closes on `Escape`.
 *
 * Ids are resolved through `indexPlan`, which drops identifiers that do not
 * resolve; an unresolvable reference therefore reads as "Not specified" rather
 * than leaking an id at the user.
 *
 * @module components/plan/DetailPanel
 */

/** The one phrase used for every absent optional field. */
export const NOT_SPECIFIED = "Not specified";

/** Sentence that keeps an estimate from being read as a commitment (R9.6). */
export const ESTIMATE_CAVEAT = "An estimate, not a fixed commitment.";

/** @param {unknown} value @returns {value is Object} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A trimmed non-empty string, or {@link NOT_SPECIFIED}.
 *
 * @param {unknown} value
 * @returns {string}
 */
function textOr(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : NOT_SPECIFIED;
}

/**
 * The non-empty strings of a list, or `null` when there are none — callers use
 * `null` to decide between a `<ul>` and the "Not specified" wording.
 *
 * @param {unknown} value
 * @returns {string[]|null}
 */
function listOr(value) {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
  return items.length > 0 ? items : null;
}

/**
 * Resolve ids to display names, dropping every id that does not resolve.
 *
 * @param {unknown} ids
 * @param {Map<string, Object>} map One of the `indexPlan` lookups.
 * @param {string} nameField Field on the entity holding its display name.
 * @returns {string[]|null} Names in the given order, or `null` when none resolve.
 */
function namesOf(ids, map, nameField) {
  if (!Array.isArray(ids)) return null;
  const names = [];
  for (const id of ids) {
    if (typeof id !== "string" && typeof id !== "number") continue;
    const entity = map.get(String(id));
    const name = entity ? entity[nameField] : undefined;
    if (typeof name === "string" && name.trim().length > 0) names.push(name.trim());
  }
  return names.length > 0 ? names : null;
}

/**
 * Resolve a single id to a display name.
 *
 * @param {unknown} id
 * @param {Map<string, Object>} map
 * @param {string} nameField
 * @returns {string} The name, or {@link NOT_SPECIFIED}.
 */
function nameOf(id, map, nameField) {
  if (typeof id !== "string" && typeof id !== "number") return NOT_SPECIFIED;
  const entity = map.get(String(id));
  return textOr(entity ? entity[nameField] : undefined);
}

/**
 * Word a task's estimate as an estimate (Requirement 9.6).
 *
 * The basis travels with the figure whenever the plan carries one, and the
 * figure stays labelled "Estimate" even when it does not, so the number is
 * never presented as a commitment.
 *
 * @param {{estimateHours?: unknown, estimateBasis?: unknown}|null|undefined} task
 * @returns {{text: string, basis: string}}
 *
 * @example
 * formatEstimate({ estimateHours: 16, estimateBasis: 'Medium complexity → 16h baseline' }).text;
 * // → 'Estimate: 16h — Medium complexity → 16h baseline'
 * formatEstimate({ estimateHours: 16 }).text;   // → 'Estimate: 16h'
 * formatEstimate({}).text;                      // → 'Not specified'
 */
export function formatEstimate(task) {
  const hours = isRecord(task) ? task.estimateHours : undefined;
  const basis = textOr(isRecord(task) ? task.estimateBasis : undefined);
  if (typeof hours !== "number" || !Number.isFinite(hours)) {
    return { text: NOT_SPECIFIED, basis };
  }
  const figure = `Estimate: ${hours}h`;
  return { text: basis === NOT_SPECIFIED ? figure : `${figure} — ${basis}`, basis };
}

/** One labelled row. `value` is a string; `items` renders a list instead. */
function Detail({ label, value, items }) {
  return (
    <>
      <dt style={detailTermStyle}>{label}</dt>
      <dd style={detailValueStyle}>
        {items ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {items.map((item, i) => (
              <li key={`${item}-${i}`} style={{ marginBottom: 2 }}>
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <span style={value === NOT_SPECIFIED ? absentStyle : undefined}>{value}</span>
        )}
      </dd>
    </>
  );
}

/**
 * Render the selected component or task.
 *
 * @param {Object} props
 * @param {'component'|'task'} props.kind What `item` is.
 * @param {Object|null|undefined} props.item The selected `ArchitectureComponent`
 *   or `PlanTask`, verbatim from the plan.
 * @param {Object|null|undefined} props.plan The `ExecutionPlan`, used only to
 *   resolve ids to names.
 * @param {() => void} [props.onClose] Called on `Escape`, on the close button,
 *   and on a backdrop click.
 * @returns {JSX.Element|null} `null` when there is nothing selected to describe.
 */
export function DetailPanel({ kind, item, plan, onClose }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  const index = useMemo(() => indexPlan(plan), [plan]);

  // Take focus, then hand it back to whatever the diagram had focused, because
  // this panel is normally opened with Enter/Space from a graph node.
  useEffect(() => {
    openerRef.current = typeof document !== "undefined" ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function" && opener.isConnected) opener.focus();
    };
  }, []);

  // Escape closes, from anywhere — the selection may still be logically "in"
  // the diagram behind the panel.
  useEffect(() => {
    if (typeof onClose !== "function") return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!isRecord(item) || (kind !== "component" && kind !== "task")) return null;

  const isComponent = kind === "component";
  const heading = textOr(isComponent ? item.name : item.title);
  const kindLabel = isComponent ? "Architecture component" : "Task";
  const openDecisions = isComponent ? listOr(item.openDecisions) : null;
  const status = isComponent ? null : resolveState(TASK_STATUSES, item.status);
  const estimate = isComponent ? null : formatEstimate(item);

  return (
    <div style={backdropStyle} onClick={typeof onClose === "function" ? onClose : undefined}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={panelStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={eyebrowStyle}>
              {isComponent ? <Boxes size={12} /> : <ClipboardCheck size={12} />} {kindLabel}
            </p>
            <h3 id={titleId} style={{ fontSize: 16, fontWeight: 700, margin: "2px 0 0" }}>
              {heading}
            </h3>
          </div>
          {typeof onClose === "function" && (
            <button
              type="button"
              onClick={onClose}
              className="panel-btn panel-btn--ghost"
              style={{ padding: 6, flexShrink: 0 }}
              aria-label={`Close ${kindLabel.toLowerCase()} details`}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 14px" }}>
          {status && (
            <span style={pillStyle(status)} aria-label={describeState(TASK_STATUSES, item.status, heading)}>
              <span aria-hidden="true">{status.glyph}</span> {status.word}
            </span>
          )}
          {isComponent && openDecisions && (
            <span style={pillStyle({ bg: "#fffbeb", border: "#fde68a", color: "#b45309" })}>
              <AlertTriangle size={11} aria-hidden="true" /> Carries open decisions
            </span>
          )}
        </div>

        <dl style={detailListStyle}>
          {isComponent ? (
            <>
              <Detail label="Responsibility" value={textOr(item.responsibility)} />
              <Detail label="Scope modules served" items={namesOf(item.moduleIds, index.modulesById, "name")} value={NOT_SPECIFIED} />
              <Detail label="Interfaces" items={listOr(item.interfaces)} value={NOT_SPECIFIED} />
              <Detail label="Data boundary" value={textOr(item.dataBoundary)} />
              <Detail label="Failure impact" value={textOr(item.failureImpact)} />
              <Detail label="Open decisions" items={openDecisions} value={NOT_SPECIFIED} />
            </>
          ) : (
            <>
              <Detail label="What it covers" value={textOr(item.description)} />
              <Detail label="Owner role" value={nameOf(item.ownerRoleId, index.rolesById, "roleName")} />
              <Detail label="Estimate" value={estimate.text} />
              <Detail label="Estimate basis" value={estimate.basis} />
              <Detail label="Acceptance criteria" items={listOr(item.acceptanceCriteria)} value={NOT_SPECIFIED} />
              <Detail label="Required evidence" items={listOr(item.evidenceRequired)} value={NOT_SPECIFIED} />
              <Detail label="Scope module served" value={nameOf(item.moduleId, index.modulesById, "name")} />
            </>
          )}
        </dl>

        {!isComponent && (
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "12px 0 0" }}>{ESTIMATE_CAVEAT}</p>
        )}
      </div>
    </div>
  );
}

// Styles mirror the drawer already used by `sections/dashboard/ExecutionPlanPanel.jsx`
// so the inspector looks native wherever a diagram opens it.
const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.35)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 50,
};

const panelStyle = {
  width: "min(440px, 100%)",
  height: "100%",
  background: "#fff",
  padding: 20,
  overflowY: "auto",
  boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
};

const eyebrowStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#94a3b8",
};

const detailListStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "8px 12px",
  margin: 0,
  fontSize: 13,
};

const detailTermStyle = { fontWeight: 600, color: "#334155" };
const detailValueStyle = { margin: 0, color: "#475569", minWidth: 0 };
const absentStyle = { color: "#94a3b8", fontStyle: "italic" };

/** @param {{bg: string, border: string, color: string}} tone */
function pillStyle(tone) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: tone.bg,
    border: `1px solid ${tone.border}`,
    color: tone.color,
  };
}

export default DetailPanel;
