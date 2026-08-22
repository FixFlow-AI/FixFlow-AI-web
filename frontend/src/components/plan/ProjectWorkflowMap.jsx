import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route } from "lucide-react";
import { deriveLifecycle } from "../../lib/plan/lifecycle";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { LIFECYCLE_STATES, describeState, resolveState } from "./encoding";
import { DiagramLegend } from "./DiagramLegend";
import { EmptyDiagram } from "./EmptyDiagram";

/**
 * The project lifecycle walk, from brief to released funds (Requirement 8).
 *
 * Every stage, its order, its state and its gate come from `deriveLifecycle`
 * in `lib/plan/lifecycle.js`, which reads them off the project's own persisted
 * state. This component decides nothing about progress: `state` is printed
 * **verbatim**, so a stage the project has not reached shows as `Upcoming` or
 * `Waiting` and can never be dressed up as complete (Requirement 8.6).
 *
 * The gates are the point of the whole view. A stage carrying
 * `gate: { holder, rule }` renders that holder on the stage itself and the
 * rule in full when the stage is opened — which is how a client sees, before
 * approving anything, that hiring waits on the freelancer's own acceptance and
 * that a payout can only follow their own acceptance (Requirement 8.3).
 *
 * State is shown as the `encoding.js` glyph **and** word, never as colour
 * alone, with the accompanying `DiagramLegend` spelling all four states out
 * (Requirements 8.1, 12.3).
 *
 * Keyboard model matches the other plan diagrams (Requirements 8.5, 12.4): the
 * track is a single tab stop with a roving `tabindex` over the stages, arrow
 * keys and `Home`/`End` move, `Enter`/`Space` select, and the open stage is
 * announced through one `aria-live="polite"` region. Opening follows focus, so
 * arrow traversal alone both reaches and selects every stage.
 *
 * Motion is entirely optional (Requirement 8.4): `usePrefersReducedMotion()`
 * gates the only transition in the component, and because the transition is
 * *omitted* rather than set to `none`, a reduced-motion reader gets instant
 * state changes with every control still working.
 *
 * @module components/plan/ProjectWorkflowMap
 */

/**
 * The only motion in the diagram — the stage chip settling into its new state.
 * Applied solely when the reader has not asked for reduced motion.
 * @type {string}
 */
const CHIP_TRANSITION = "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease";

/** Sentence keeping the provenance of the walk on screen. */
const PROVENANCE =
  "This walk is read from your project's own recorded state — the proposal builder, the plan status, the hiring workflow and the escrow milestones. A stage is only marked done when that state proves it.";

/**
 * The accessible name of one stage: where it sits in the walk, its label, its
 * state word, and who holds its decision.
 *
 * Built through `describeState` so the state's word always reaches assistive
 * technology rather than riding on the glyph or the colour (Requirement 12.3).
 *
 * @param {Object} stage A `LifecycleStage` from `deriveLifecycle`.
 * @param {number} index Zero-based position in the walk.
 * @param {number} total How many stages the walk has.
 * @returns {string} Non-empty, and always containing the state's word.
 *
 * @example
 * stageLabel({ label: 'Freelancer accepts', state: 'blocked', gate: { holder: 'Freelancer' } }, 5, 11);
 * // → 'Stage 6 of 11, Freelancer accepts: Stage Waiting. Decision held by Freelancer.'
 */
export function stageLabel(stage, index, total) {
  const subject = `Stage ${index + 1} of ${total}, ${stage.label}`;
  const base = describeState(LIFECYCLE_STATES, stage.state, subject);
  return stage.gate ? `${base}. Decision held by ${stage.gate.holder}.` : base;
}

/**
 * @param {Object} props
 * @param {Object|null|undefined} [props.workflow] Proposal builder progress
 *   (`{activeStep, approvedSteps}`), as persisted by the proposal workflow.
 * @param {string|null|undefined} [props.planStatus] `draft | in_review | approved | superseded`.
 * @param {Object|null|undefined} [props.matchWorkflow] The client hiring
 *   workflow, including its audit trail — the evidence for the consent gate.
 * @param {Array<Object>|null|undefined} [props.milestones] Escrow milestones.
 * @returns {JSX.Element}
 */
export function ProjectWorkflowMap({ workflow, planStatus, matchWorkflow, milestones }) {
  const lifecycle = useMemo(
    () => deriveLifecycle({ workflow, planStatus, matchWorkflow, milestones }),
    [workflow, planStatus, matchWorkflow, milestones],
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const { stages, currentStageId } = lifecycle;
  const total = stages.length;
  // `deriveLifecycle` always names a current stage; the guard is only for a
  // defensively empty walk, which falls through to the empty state below.
  const currentIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.id === currentStageId),
  );

  // The open stage doubles as the roving-focus position: opening follows focus,
  // so arrow traversal alone reaches, opens and announces every stage. It
  // starts on the stage the project actually occupies (Requirement 8.1).
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  const chipRefs = useRef(new Map());
  // Focus follows the roving position only after a key moved it, so mounting
  // the diagram never steals focus from wherever the reader actually is.
  const pendingFocus = useRef(false);
  const renderedLifecycle = useRef(lifecycle);

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    chipRefs.current.get(activeIndex)?.focus();
  }, [activeIndex]);

  // Fresh project state means a fresh walk: an index-based position would
  // otherwise leave the reader parked on a stage that has since moved on.
  useEffect(() => {
    if (renderedLifecycle.current === lifecycle) return;
    renderedLifecycle.current = lifecycle;
    setActiveIndex(currentIndex);
  }, [lifecycle, currentIndex]);

  const moveTo = useCallback(
    (index) => {
      if (index < 0 || index >= total) return;
      pendingFocus.current = true;
      setActiveIndex(index);
    },
    [total],
  );

  const onKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          moveTo(activeIndex + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          moveTo(activeIndex - 1);
          break;
        case "Home":
          moveTo(0);
          break;
        case "End":
          moveTo(total - 1);
          break;
        default:
          // Enter and Space are left to the buttons' own activation, and every
          // other key to the page, so scrolling and typing are untouched.
          return;
      }
      event.preventDefault();
    },
    [activeIndex, moveTo, total],
  );

  if (total === 0) {
    return (
      <EmptyDiagram
        icon={Route}
        title="No project workflow to show yet"
        reason="The project lifecycle could not be read from this project's state."
      />
    );
  }

  const openStage = stages[Math.min(activeIndex, total - 1)];
  const openIndex = Math.min(activeIndex, total - 1);
  const openState = resolveState(LIFECYCLE_STATES, openStage.state);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p id="plan-workflow-hint" style={hintStyle}>
        How your project moves from brief to released funds. Your project is at{" "}
        <strong style={{ color: "#0f172a" }}>{stages[currentIndex].label}</strong>. Move between stages
        with the arrow keys, then press Enter to read what a stage involves and who has to act.
      </p>

      {/* The scroller is this container; `min-width` sits on the track only, so
          a long walk scrolls here and never widens the page (R12.5). */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <ol
          onKeyDown={onKeyDown}
          aria-describedby="plan-workflow-hint"
          style={{ ...trackStyle, minWidth: total * 176 }}
        >
          {stages.map((stage, index) => {
            const state = resolveState(LIFECYCLE_STATES, stage.state);
            const isOpen = index === openIndex;
            const isCurrent = stage.id === currentStageId;

            return (
              <li key={stage.id} style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
                {index > 0 && (
                  <span aria-hidden="true" style={connectorStyle}>
                    →
                  </span>
                )}
                <button
                  type="button"
                  ref={(node) => {
                    if (node) chipRefs.current.set(index, node);
                    else chipRefs.current.delete(index);
                  }}
                  // Roving tabindex: the whole walk is one tab stop (R12.4).
                  tabIndex={isOpen ? 0 : -1}
                  aria-pressed={isOpen}
                  // Marks the stage the project occupies, not the open one (R8.1).
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={stageLabel(stage, index, total)}
                  onClick={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  style={chipStyle(state, isOpen, !prefersReducedMotion)}
                >
                  <span style={chipMetaStyle}>Stage {index + 1}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{stage.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                    {/* Glyph is decorative; the word beside it carries the
                        meaning, so state never rides on colour (R12.3). */}
                    <span aria-hidden="true">{state.glyph}</span>
                    {state.word}
                  </span>
                  {isCurrent && (
                    <span aria-hidden="true" style={chipMetaStyle}>
                      Your project is here
                    </span>
                  )}
                  {stage.gate && (
                    <span aria-hidden="true" style={chipGateStyle}>
                      Decision: {stage.gate.holder}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* One polite region per diagram announces the stage now open (R8.5). */}
      <div aria-live="polite" className="panel-card" style={{ padding: 12 }}>
        <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 2px", color: "#0f172a" }}>
          {stageLabel(openStage, openIndex, total)}
        </h4>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b" }}>{openState.description}</p>

        <dl style={detailListStyle}>
          <dt style={detailTermStyle}>What happens</dt>
          <dd style={detailValueStyle}>{openStage.what}</dd>
          <dt style={detailTermStyle}>Who is responsible</dt>
          <dd style={detailValueStyle}>{openStage.owner}</dd>
          <dt style={detailTermStyle}>What advances it</dt>
          <dd style={detailValueStyle}>{openStage.advancedBy}</dd>
        </dl>

        {/* A gated stage says who holds the decision, and the rule that
            enforces it, prominently rather than as a footnote (R8.3). */}
        {openStage.gate ? (
          <div style={gateCardStyle}>
            <span style={gateHeadingStyle}>Decision gate — held by {openStage.gate.holder}</span>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#334155", lineHeight: 1.45 }}>
              {openStage.gate.rule}
            </p>
          </div>
        ) : (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#64748b" }}>
            No single decision gates this stage — it advances as soon as the action above is taken.
          </p>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>{PROVENANCE}</p>

      <DiagramLegend map={LIFECYCLE_STATES} title="What each stage state means" />
    </div>
  );
}

// Styles reuse the palette of `sections/dashboard/ExecutionPlanPanel.jsx`, with
// colour always an *additional* channel behind the glyph and the word.
const hintStyle = {
  margin: 0,
  fontSize: 12,
  color: "#64748b",
  maxWidth: 640,
  lineHeight: 1.45,
};

const trackStyle = {
  display: "flex",
  alignItems: "stretch",
  gap: 6,
  listStyle: "none",
  margin: 0,
  padding: "2px 0",
};

const connectorStyle = {
  display: "flex",
  alignItems: "center",
  color: "#cbd5e1",
  fontSize: 13,
  flexShrink: 0,
};

const chipMetaStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#94a3b8",
};

const chipGateStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "#b45309",
};

const detailListStyle = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "4px 12px",
  fontSize: 12.5,
  alignItems: "baseline",
};

const detailTermStyle = { fontWeight: 700, color: "#334155", whiteSpace: "nowrap" };
const detailValueStyle = { margin: 0, color: "#475569", lineHeight: 1.45 };

const gateCardStyle = {
  marginTop: 10,
  padding: "9px 11px",
  borderRadius: 6,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderLeft: "3px solid #b45309",
};

const gateHeadingStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#b45309",
};

/**
 * One stage chip's styling.
 *
 * The open chip is marked with an outline as well as a shade, and
 * `:focus-visible` is left to the browser's own ring plus that outline so
 * focus stays visible (Requirement 12.4).
 *
 * @param {{bg: string, border: string, color: string}} state The resolved encoding.
 * @param {boolean} isOpen Whether this chip is the open (and focusable) one.
 * @param {boolean} animated Whether motion is allowed. When `false` the
 *   `transition` property is left off entirely rather than set to `none`, so a
 *   reduced-motion reader has no transition applied at all (Requirement 8.4).
 * @returns {Object} Inline style.
 */
function chipStyle(state, isOpen, animated) {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 3,
    flex: "0 0 auto",
    width: 164,
    minHeight: 96,
    textAlign: "left",
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: 1.3,
    cursor: "pointer",
    background: state.bg,
    color: state.color,
    border: `1px solid ${state.border}`,
    borderRadius: 8,
    outline: isOpen ? "2px solid #0f172a" : "none",
    outlineOffset: isOpen ? 1 : 0,
    ...(animated ? { transition: CHIP_TRANSITION } : null),
  };
}

export default ProjectWorkflowMap;
