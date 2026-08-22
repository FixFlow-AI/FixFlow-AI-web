import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Boxes, Network, Table as TableIcon } from "lucide-react";
import { MAX_GRAPH_NODES, layoutArchitectureGraph } from "../../lib/plan/graphLayout";
import { indexPlan, sectionAvailability } from "../../lib/plan/selectors";
import { EDGE_KINDS, describeState, resolveState } from "./encoding";
import DiagramLegend from "./DiagramLegend";
import EmptyDiagram from "./EmptyDiagram";
import DetailPanel from "./DetailPanel";

/**
 * The proposed architecture, drawn as a directed graph.
 *
 * The component is a **projection only** — `lib/plan/graphLayout.js` decides
 * every coordinate and `components/plan/encoding.js` decides every visual
 * encoding, so nothing about meaning is invented here.
 *
 * What this file is responsible for:
 *
 *   - **The graph (Requirement 4.1).** `layoutArchitectureGraph` output is
 *     rendered as SVG: one box per component, one polyline per edge.
 *   - **Edge kinds without colour (Requirements 4.2, 12.3).** Each kind draws
 *     with its own `strokeDasharray` *and* its own arrowhead `markerShape`,
 *     declared once in `<defs>` under the kind's `markerId`. The
 *     {@link DiagramLegend} spells the same four kinds out as words, and the
 *     table view spells them out again in text.
 *   - **Selection (Requirement 4.3).** `Enter`/`Space` (or a click) opens the
 *     shared {@link DetailPanel} with `kind="component"`, which is where
 *     responsibility, served modules, interfaces, data boundary and failure
 *     impact are described.
 *   - **Open decisions (Requirement 4.4).** A component with a non-empty
 *     `openDecisions` gets a `▲` badge with its count in the diagram, the
 *     count in its accessible name, and a filled column in the table view —
 *     three non-colour channels.
 *   - **Empty state (Requirement 4.5).** No architecture, or an architecture
 *     with no components, renders {@link EmptyDiagram} with the reason from
 *     `sectionAvailability` and the caller's `onGenerate` affordance.
 *   - **One tab stop (Requirement 12.4).** The whole graph is a single tab
 *     stop: exactly one node carries `tabindex="0"`, every other node carries
 *     `tabindex="-1"`, and the arrow keys rove that focus deterministically
 *     through the layout's own node order — so N presses of one arrow key
 *     visit all N nodes exactly once and land back where they started. The
 *     focused node draws an explicit focus ring, because an SVG `<g>` gets no
 *     default one.
 *   - **Containment (Requirement 12.5).** The canvas scrolls inside its own
 *     box; the SVG's intrinsic width lives on the SVG, never on an ancestor,
 *     so a wide graph never makes the page scroll sideways.
 *   - **Large plans (Requirement 12.6).** Above `MAX_GRAPH_NODES` components
 *     the layout is **not invoked at all**: the table view renders with a
 *     notice explaining why.
 *
 * A single `aria-live="polite"` region reports the focused or selected
 * component, so keyboard traversal is audible without a second announcer
 * competing with it.
 *
 * @module components/plan/ArchitectureGraph
 */

/** Arrowhead geometry per `markerShape`, drawn in a 10×10 marker viewport. */
const MARKER_SHAPES = {
  "filled-arrow": { d: "M0 0 L9 4.5 L0 9 Z", filled: true },
  "open-arrow": { d: "M0 0 L9 4.5 L0 9", filled: false },
  diamond: { d: "M0 4.5 L4.5 0 L9 4.5 L4.5 9 Z", filled: true },
  "hollow-arrow": { d: "M0 0 L9 4.5 L0 9 Z", filled: false },
};

/** Keys that move the roving focus, mapped to their step through node order. */
const STEP_KEYS = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Approximate characters that fit on one line, per font size, inside a node. */
const CHARS_PER_LINE = { name: 22, detail: 28 };

/** Shared empty node list, so the table view keeps stable memo identities. */
const NO_NODES = Object.freeze([]);

/** @param {unknown} value @returns {value is Object} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {Object[]} */
function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** @param {unknown} value @returns {string[]} The non-empty trimmed strings. */
function strings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Distinct component ids, counted without laying anything out — this is what
 * decides whether the layout may be invoked at all (Requirement 12.6).
 *
 * @param {Object[]} components
 * @returns {number}
 */
function distinctComponentCount(components) {
  const seen = new Set();
  for (const component of components) {
    const id = component.id;
    if (typeof id === "string" && id.length > 0) seen.add(id);
  }
  return seen.size;
}

/**
 * Shorten to fit a node box, keeping the ellipsis inside the width budget.
 *
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
function truncate(value, max) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/**
 * Break a sentence into at most `lines` truncated lines on word boundaries.
 *
 * @param {string} value
 * @param {number} perLine
 * @param {number} lines
 * @returns {string[]}
 */
function wrap(value, perLine, lines) {
  if (!value) return [];
  const words = value.split(/\s+/);
  const out = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= perLine) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    current = word;
    if (out.length === lines) break;
  }
  if (current && out.length < lines) out.push(current);
  const clipped = out.slice(0, lines);
  if (clipped.length === lines && value.length > clipped.join(" ").length) {
    clipped[lines - 1] = truncate(`${clipped[lines - 1]}…`, perLine);
  }
  return clipped.map((line) => truncate(line, perLine));
}

/**
 * The one sentence the live region reads for a component.
 *
 * @param {Object} component
 * @param {{layer: number, order: number}|null} node
 * @param {number} layerCount
 * @param {boolean} selected
 * @returns {string}
 */
function announce(component, node, layerCount, selected) {
  const name = text(component.name) || text(component.id) || "Component";
  const parts = [`${selected ? "Selected" : "Focused"}: ${name}`];
  if (node && layerCount > 0) parts.push(`layer ${node.layer + 1} of ${layerCount}`);
  const open = strings(component.openDecisions).length;
  if (open > 0) parts.push(`${open} open ${open === 1 ? "decision" : "decisions"}`);
  return `${parts.join(", ")}.`;
}

/**
 * The accessible name of a node, carrying every non-colour signal as words.
 *
 * @param {Object} component
 * @param {{layer: number, order: number}} node
 * @param {number} layerCount
 * @param {number} degree How many edges touch this component.
 * @returns {string}
 */
function nodeLabel(component, node, layerCount, degree) {
  const name = text(component.name) || text(component.id) || "Component";
  const parts = [name];
  const responsibility = text(component.responsibility);
  if (responsibility) parts.push(responsibility);
  parts.push(`Layer ${node.layer + 1} of ${layerCount}`);
  parts.push(`${degree} ${degree === 1 ? "connection" : "connections"}`);
  const open = strings(component.openDecisions).length;
  parts.push(open > 0 ? `Carries ${open} open ${open === 1 ? "decision" : "decisions"}` : "No open decisions");
  return `${parts.join(". ")}.`;
}

/**
 * The `<marker>` definitions, one per edge kind, keyed by the kind's own
 * `markerId` so an edge can reference it with `marker-end`.
 *
 * @returns {JSX.Element}
 */
function EdgeMarkers() {
  return (
    <defs>
      {Object.values(EDGE_KINDS).map((kind) => {
        const shape = MARKER_SHAPES[kind.markerShape] || MARKER_SHAPES["filled-arrow"];
        return (
          <marker
            key={kind.markerId}
            id={kind.markerId}
            markerWidth={10}
            markerHeight={10}
            refX={9}
            refY={4.5}
            orient="auto"
            markerUnits="userSpaceOnUse"
            data-marker-shape={kind.markerShape}
          >
            <path
              d={shape.d}
              fill={shape.filled ? kind.color : "#ffffff"}
              stroke={kind.color}
              strokeWidth={1.2}
            />
          </marker>
        );
      })}
    </defs>
  );
}

/**
 * One component box.
 *
 * @param {Object} props
 * @returns {JSX.Element}
 */
function GraphNode({
  node,
  component,
  layerCount,
  degree,
  isActive,
  isFocused,
  isSelected,
  registerRef,
  onActivate,
  onFocus,
  onKeyDown,
}) {
  const name = text(component.name) || text(component.id) || "Component";
  const detail = wrap(text(component.responsibility), CHARS_PER_LINE.detail, 2);
  const openDecisions = strings(component.openDecisions);
  const label = nodeLabel(component, node, layerCount, degree);

  return (
    <g
      ref={registerRef}
      data-testid="architecture-node"
      data-node-id={node.id}
      data-open-decisions={openDecisions.length}
      role="button"
      aria-label={label}
      aria-pressed={isSelected}
      tabIndex={isActive ? 0 : -1}
      onKeyDown={onKeyDown}
      onClick={onActivate}
      onFocus={onFocus}
      style={{ cursor: "pointer", outline: "none" }}
    >
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={8}
        fill={isSelected ? "#eff6ff" : "#ffffff"}
        stroke={isSelected ? "#2563eb" : "#cbd5e1"}
        strokeWidth={isSelected ? 2 : 1}
      />
      {/* SVG groups get no default focus ring, so the graph draws its own. */}
      {isFocused && (
        <rect
          data-testid="architecture-focus-ring"
          x={node.x - 4}
          y={node.y - 4}
          width={node.w + 8}
          height={node.h + 8}
          rx={11}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth={2}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}
      <text
        x={node.x + 10}
        y={node.y + 21}
        fontSize={12.5}
        fontWeight={700}
        fill="#0f172a"
        aria-hidden="true"
      >
        {truncate(name, CHARS_PER_LINE.name)}
      </text>
      {detail.map((line, i) => (
        <text
          key={`${node.id}-detail-${i}`}
          x={node.x + 10}
          y={node.y + 37 + i * 13}
          fontSize={10.5}
          fill="#64748b"
          aria-hidden="true"
        >
          {line}
        </text>
      ))}
      {openDecisions.length > 0 && (
        <text
          x={node.x + node.w - 10}
          y={node.y + node.h - 8}
          textAnchor="end"
          fontSize={10.5}
          fontWeight={700}
          fill="#b45309"
          aria-hidden="true"
        >
          {`▲ ${openDecisions.length} open`}
        </text>
      )}
    </g>
  );
}

/**
 * The same components and edges as a semantic table — the accessible
 * equivalent of the diagram, and the only view above the node cap.
 *
 * @param {Object} props
 * @returns {JSX.Element}
 */
function ArchitectureTable({ components, edges, moduleNameOf, onSelect }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-card" style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table style={tableStyle}>
          <caption style={captionStyle}>
            Architecture components, their responsibilities, and their open decisions
          </caption>
          <thead>
            <tr>
              <th scope="col" style={thStyle}>Component</th>
              <th scope="col" style={thStyle}>Responsibility</th>
              <th scope="col" style={thStyle}>Scope modules served</th>
              <th scope="col" style={thStyle}>Interfaces</th>
              <th scope="col" style={thStyle}>Data boundary</th>
              <th scope="col" style={thStyle}>Failure impact</th>
              <th scope="col" style={thStyle}>Open decisions</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component, i) => {
              const id = text(component.id);
              const name = text(component.name) || id || "Unnamed component";
              const openDecisions = strings(component.openDecisions);
              const modules = strings(component.moduleIds).map((moduleId) => moduleNameOf(moduleId)).filter(Boolean);
              const interfaces = strings(component.interfaces);
              return (
                <tr key={`${id}-${i}`}>
                  <th scope="row" style={{ ...tdStyle, fontWeight: 700, color: "#0f172a" }}>
                    {id ? (
                      <button
                        type="button"
                        className="panel-btn panel-btn--ghost"
                        style={{ fontSize: 12.5, padding: "3px 8px" }}
                        onClick={() => onSelect(id)}
                      >
                        {name}
                      </button>
                    ) : (
                      name
                    )}
                  </th>
                  <td style={tdStyle}>{text(component.responsibility) || "Not specified"}</td>
                  <td style={tdStyle}>{modules.length > 0 ? modules.join(", ") : "Not specified"}</td>
                  <td style={tdStyle}>{interfaces.length > 0 ? interfaces.join(", ") : "Not specified"}</td>
                  <td style={tdStyle}>{text(component.dataBoundary) || "Not specified"}</td>
                  <td style={tdStyle}>{text(component.failureImpact) || "Not specified"}</td>
                  <td style={tdStyle}>
                    {openDecisions.length > 0 ? (
                      <span style={{ color: "#b45309", fontWeight: 600 }}>
                        <span aria-hidden="true">▲ </span>
                        {`${openDecisions.length} open: ${openDecisions.join("; ")}`}
                      </span>
                    ) : (
                      "None"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel-card" style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table style={tableStyle}>
          <caption style={captionStyle}>
            Connections between components, with each kind spelled out
          </caption>
          <thead>
            <tr>
              <th scope="col" style={thStyle}>From</th>
              <th scope="col" style={thStyle}>To</th>
              <th scope="col" style={thStyle}>Kind</th>
              <th scope="col" style={thStyle}>What it means</th>
              <th scope="col" style={thStyle}>Label</th>
            </tr>
          </thead>
          <tbody>
            {edges.length === 0 ? (
              <tr>
                <td style={tdStyle} colSpan={5}>
                  No connections are recorded between these components.
                </td>
              </tr>
            ) : (
              edges.map((edge, i) => {
                const kind = resolveState(EDGE_KINDS, edge.kind);
                return (
                  <tr key={`${edge.from}-${edge.to}-${i}`}>
                    <td style={tdStyle}>{edge.fromName}</td>
                    <td style={tdStyle}>{edge.toName}</td>
                    <td style={tdStyle}>
                      <span aria-hidden="true">{kind.glyph} </span>
                      {kind.word}
                    </td>
                    <td style={tdStyle}>{kind.description}</td>
                    <td style={tdStyle}>{edge.label || "Not specified"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Object|null|undefined} props.plan The `ExecutionPlan`.
 * @param {Object|null|undefined} [props.diagnostics] The matching `PlanDiagnostics`,
 *   used only for the empty-state reason.
 * @param {() => void} [props.onGenerate] Offered by the empty state when the
 *   plan has no architecture to draw (Requirement 4.5).
 * @param {boolean} [props.generating] Disables the generate affordance.
 * @returns {JSX.Element}
 */
export function ArchitectureGraph({ plan, diagnostics, onGenerate, generating = false }) {
  const architecture = isRecord(plan) && isRecord(plan.architecture) ? plan.architecture : null;
  const components = useMemo(() => records(architecture && architecture.components), [architecture]);
  const rawEdges = useMemo(() => records(architecture && architecture.edges), [architecture]);

  const index = useMemo(() => indexPlan(plan), [plan]);
  const componentsById = useMemo(() => {
    const map = new Map();
    for (const component of components) {
      const id = text(component.id);
      if (id && !map.has(id)) map.set(id, component);
    }
    return map;
  }, [components]);

  // Requirement 12.6: above the cap the layout is never invoked. The distinct
  // count is all that is needed to make that call.
  const nodeCount = useMemo(() => distinctComponentCount(components), [components]);
  const exceedsCap = nodeCount > MAX_GRAPH_NODES;

  const [view, setView] = useState("diagram");
  const [activeId, setActiveId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const nodeRefs = useRef(new Map());

  const showTable = exceedsCap || view === "table";

  const layout = useMemo(() => {
    if (exceedsCap || showTable) return null;
    return layoutArchitectureGraph(components, rawEdges);
  }, [exceedsCap, showTable, components, rawEdges]);

  // Components without a usable id cannot be laid out; rather than show an
  // empty canvas the table view describes them instead.
  const drawable = layout !== null && layout.nodes.length > 0;

  /** Display name for a component id, falling back to the raw id. */
  const nameOfComponent = useCallback(
    (id) => {
      const component = componentsById.get(id);
      return (component && text(component.name)) || id;
    },
    [componentsById],
  );

  /** Display name for a scope module id; empty when it does not resolve. */
  const moduleNameOf = useCallback(
    (id) => {
      const module = index.modulesById.get(String(id));
      return module ? text(module.name) : "";
    },
    [index],
  );

  // Table rows mirror the diagram: only edges whose endpoints both resolve, in
  // the plan's own order, so the two views never disagree.
  const tableEdges = useMemo(
    () =>
      rawEdges
        .filter(
          (edge) =>
            componentsById.has(text(edge.fromComponentId)) &&
            componentsById.has(text(edge.toComponentId)),
        )
        .map((edge) => ({
          from: text(edge.fromComponentId),
          to: text(edge.toComponentId),
          fromName: nameOfComponent(text(edge.fromComponentId)),
          toName: nameOfComponent(text(edge.toComponentId)),
          kind: edge.kind,
          label: text(edge.label),
        })),
    [rawEdges, componentsById, nameOfComponent],
  );

  const degreeById = useMemo(() => {
    const map = new Map();
    const bump = (id) => map.set(id, (map.get(id) || 0) + 1);
    for (const edge of tableEdges) {
      bump(edge.from);
      if (edge.to !== edge.from) bump(edge.to);
    }
    return map;
  }, [tableEdges]);

  // A stable empty array keeps the memo/effect identities steady in the table
  // view, where there is no layout to read nodes from.
  const nodes = layout ? layout.nodes : NO_NODES;
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);

  // The roving tab stop always exists and always points at a live node, so a
  // plan change can never leave the graph unreachable by keyboard (R12.4).
  const activeIndex = Math.max(0, nodeIds.indexOf(activeId));
  const activeNodeId = nodeIds.length > 0 ? nodeIds[activeIndex] : null;

  useEffect(() => {
    if (nodeIds.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId === null || !nodeIds.includes(activeId)) setActiveId(nodeIds[0]);
  }, [nodeIds, activeId]);

  useEffect(() => {
    if (selectedId !== null && !componentsById.has(selectedId)) setSelectedId(null);
  }, [componentsById, selectedId]);

  const registerRef = useCallback((id) => (element) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  }, []);

  /** Move the single tab stop `step` places through the layout's node order. */
  const moveFocus = useCallback(
    (step) => {
      const count = nodeIds.length;
      if (count === 0) return;
      const next = nodeIds[(activeIndex + step + count) % count];
      setActiveId(next);
      setFocusedId(next);
      const element = nodeRefs.current.get(next);
      if (element && typeof element.focus === "function") element.focus();
    },
    [nodeIds, activeIndex],
  );

  const jumpTo = useCallback(
    (targetIndex) => {
      const id = nodeIds[targetIndex];
      if (!id) return;
      setActiveId(id);
      setFocusedId(id);
      const element = nodeRefs.current.get(id);
      if (element && typeof element.focus === "function") element.focus();
    },
    [nodeIds],
  );

  const onNodeKeyDown = useCallback(
    (id) => (event) => {
      if (event.key in STEP_KEYS) {
        event.preventDefault();
        event.stopPropagation();
        moveFocus(STEP_KEYS[event.key]);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        jumpTo(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        jumpTo(nodeIds.length - 1);
        return;
      }
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setSelectedId(id);
      }
    },
    [moveFocus, jumpTo, nodeIds.length],
  );

  const onNodeActivate = useCallback(
    (id) => () => {
      setActiveId(id);
      setFocusedId(id);
      setSelectedId(id);
    },
    [],
  );

  const onNodeFocus = useCallback((id) => () => {
    setActiveId(id);
    setFocusedId(id);
  }, []);

  // Requirement 4.5: no architecture, or an architecture nobody filled in.
  if (components.length === 0) {
    const availability = sectionAvailability(plan, diagnostics);
    return (
      <EmptyDiagram
        title="No architecture to draw yet"
        icon={Boxes}
        reason={availability.architecture}
        action={
          typeof onGenerate === "function"
            ? {
                label: generating ? "Generating…" : "Generate architecture",
                onClick: onGenerate,
                disabled: generating,
              }
            : undefined
        }
      />
    );
  }

  const layerCount = layout ? layout.layers.length : 0;
  const selectedComponent = selectedId ? componentsById.get(selectedId) : null;
  const announced = (() => {
    const id = selectedId || focusedId;
    if (!id) return "";
    const component = componentsById.get(id);
    if (!component) return "";
    const node = nodes.find((candidate) => candidate.id === id) || null;
    return announce(component, node, layerCount, id === selectedId);
  })();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="panel-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13.5, color: "#334155", flex: "1 1 260px", minWidth: 0 }}>
          {text(architecture && architecture.summary) ||
            `${nodeCount} component${nodeCount === 1 ? "" : "s"} and ${tableEdges.length} connection${
              tableEdges.length === 1 ? "" : "s"
            }.`}
        </p>
        {!exceedsCap && (
          <button
            type="button"
            className="panel-btn panel-btn--ghost"
            onClick={() => setView(view === "table" ? "diagram" : "table")}
            aria-pressed={view === "table"}
            style={{ flexShrink: 0 }}
          >
            {view === "table" ? <Network size={14} /> : <TableIcon size={14} />}
            {view === "table" ? " View as diagram" : " View as table"}
          </button>
        )}
      </div>

      {exceedsCap && (
        <p
          role="note"
          style={{
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
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>
            {`This architecture has ${nodeCount} components, more than the ${MAX_GRAPH_NODES} a readable diagram can hold, so it is shown as a table instead. Every component and connection is listed below.`}
          </span>
        </p>
      )}

      {/* One live region for the whole graph (Requirement 12.4). */}
      <p
        aria-live="polite"
        data-testid="architecture-live-region"
        style={{ margin: 0, fontSize: 12.5, minHeight: 18, color: "#475569" }}
      >
        {announced}
      </p>

      {!drawable ? (
        <ArchitectureTable
          components={components}
          edges={tableEdges}
          moduleNameOf={moduleNameOf}
          onSelect={setSelectedId}
        />
      ) : (
        <>
          {/* Requirement 12.5: this box is the scroller; the width lives on the SVG. */}
          <div
            className="panel-card"
            data-testid="architecture-canvas"
            style={{ overflowX: "auto", maxWidth: "100%", padding: 8 }}
          >
            <svg
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="group"
              aria-label={`Architecture diagram: ${nodeCount} components, ${tableEdges.length} connections`}
              style={{ display: "block" }}
            >
              <EdgeMarkers />
              {layout.edges.map((edge, i) => {
                const kind = resolveState(EDGE_KINDS, edge.kind);
                const points = edge.points.map((point) => `${point.x},${point.y}`).join(" ");
                return (
                  <g key={`${edge.from}-${edge.to}-${i}`} data-edge-kind={kind.key}>
                    {/* `describeState` is what puts the kind's word into the
                        edge's accessible name (Requirement 12.3). */}
                    <title>
                      {`${describeState(
                        EDGE_KINDS,
                        edge.kind,
                        `${nameOfComponent(edge.from)} → ${nameOfComponent(edge.to)}`,
                      )}${edge.label ? ` — ${edge.label}` : ""}${
                        edge.isBack ? " (returns to an earlier component)" : ""
                      }`}
                    </title>
                    <polyline
                      points={points}
                      fill="none"
                      stroke={kind.color}
                      strokeWidth={1.6}
                      strokeDasharray={kind.strokeDasharray}
                      markerEnd={`url(#${kind.markerId})`}
                      opacity={edge.isBack ? 0.75 : 1}
                    />
                  </g>
                );
              })}
              {nodes.map((node) => {
                const component = componentsById.get(node.id);
                if (!component) return null;
                return (
                  <GraphNode
                    key={node.id}
                    node={node}
                    component={component}
                    layerCount={layerCount}
                    degree={degreeById.get(node.id) || 0}
                    isActive={node.id === activeNodeId}
                    isFocused={node.id === focusedId}
                    isSelected={node.id === selectedId}
                    registerRef={registerRef(node.id)}
                    onActivate={onNodeActivate(node.id)}
                    onFocus={onNodeFocus(node.id)}
                    onKeyDown={onNodeKeyDown(node.id)}
                  />
                );
              })}
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
            Tab into the diagram, then use the arrow keys to move between components and Enter to
            open one. <span aria-hidden="true">▲</span> marks a component with open design
            decisions.
          </p>
          <DiagramLegend map={EDGE_KINDS} title="How to read the connections" />
        </>
      )}

      {selectedComponent && (
        <DetailPanel
          kind="component"
          item={selectedComponent}
          plan={plan}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

// Table styling mirrors the panel conventions in `ExecutionPlanPanel.jsx`.
const tableStyle = {
  width: "100%",
  minWidth: 640,
  borderCollapse: "collapse",
  fontSize: 12.5,
  textAlign: "left",
};

const captionStyle = {
  captionSide: "top",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
  paddingBottom: 8,
};

const thStyle = {
  padding: "6px 8px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#94a3b8",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "7px 8px",
  borderBottom: "1px solid #f1f5f9",
  color: "#475569",
  verticalAlign: "top",
};

export default ArchitectureGraph;
