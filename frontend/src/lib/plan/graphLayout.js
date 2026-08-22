/**
 * Pure, deterministic layered layout for the proposal architecture diagram.
 *
 * The layout is a small Sugiyama-style pipeline:
 *   1. resolve components/edges (unresolvable endpoints are dropped),
 *   2. classify back-edges with a DFS so cycles never break layering,
 *   3. longest-path layering over the remaining acyclic edges,
 *   4. barycentre ordering inside each layer with a stable `id` tie-break,
 *   5. coordinate + polyline assignment.
 *
 * Every step orders its work by `id` (then input index) so the same input always
 * produces byte-identical output — snapshots and property tests stay reproducible.
 *
 * No React, no DOM, no I/O: this module is safe to call from a `useMemo`.
 *
 * Requirements: 4.1 (render components/edges as a directed graph), 12.6 (never
 * lay out a graph above the node cap).
 */

/**
 * Hard ceiling on component count. Above this the caller renders the table view
 * and the layout is never computed (Requirement 12.6).
 * @type {number}
 */
export const MAX_GRAPH_NODES = 60;

/** Edge kinds the diagram knows how to encode. */
const EDGE_KINDS = ["sync", "async", "data", "event"];

/** Fallback kind for a missing or unrecognised `edge.kind`. */
const DEFAULT_EDGE_KIND = "sync";

/** Number of barycentre sweeps (down+up counts as one). Fixed → deterministic. */
const BARYCENTRE_SWEEPS = 4;

/**
 * @typedef {Object} LayoutOptions
 * @property {number} [nodeWidth=180]  Box width in user units.
 * @property {number} [nodeHeight=72]  Box height in user units.
 * @property {number} [layerGap=88]    Horizontal gap between layers.
 * @property {number} [nodeGap=28]     Vertical gap between boxes in a layer.
 * @property {number} [padding=24]     Canvas padding on all sides.
 */

/** @type {Required<LayoutOptions>} */
const DEFAULT_OPTIONS = {
  nodeWidth: 180,
  nodeHeight: 72,
  layerGap: 88,
  nodeGap: 28,
  padding: 24,
};

/**
 * @typedef {Object} LayoutNode
 * @property {string} id     Component id.
 * @property {number} layer  0-based layer index (left to right).
 * @property {number} order  0-based position inside the layer (top to bottom).
 * @property {number} x      Top-left x of the box.
 * @property {number} y      Top-left y of the box.
 * @property {number} w      Box width.
 * @property {number} h      Box height.
 */

/**
 * @typedef {Object} LayoutEdge
 * @property {string} from   Source component id (always resolves to a node).
 * @property {string} to     Target component id (always resolves to a node).
 * @property {'sync'|'async'|'data'|'event'} kind Normalised edge kind.
 * @property {string|null} label Optional edge label, `null` when absent.
 * @property {{x:number,y:number}[]} points Polyline from source to target.
 * @property {boolean} isBack True when the edge runs backwards (part of a cycle).
 */

/**
 * @typedef {Object} GraphLayout
 * @property {LayoutNode[]} nodes   One node per resolvable component, ordered by (layer, order).
 * @property {LayoutEdge[]} edges   Only edges whose both endpoints resolved.
 * @property {number} width         Canvas width (0 when there is nothing to draw).
 * @property {number} height        Canvas height (0 when there is nothing to draw).
 * @property {string[][]} layers    Layer index → ordered node ids. `layers.length` is the layer count.
 * @property {boolean} exceedsCap   True when the cap was exceeded and no layout was computed.
 * @property {number} nodeCount     Number of distinct components seen (reported even above the cap).
 */

/** Stable string compare that does not depend on host locale. @returns {number} */
function compareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** @returns {boolean} */
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Distinct components in input order, keyed by id. Entries without a usable id
 * are dropped; the first occurrence of a duplicate id wins.
 * @param {unknown} components
 * @returns {{id: string, index: number}[]}
 */
function resolveComponents(components) {
  if (!Array.isArray(components)) return [];
  /** @type {{id: string, index: number}[]} */
  const resolved = [];
  const seen = new Set();
  for (const component of components) {
    const id = component && component.id;
    if (!isNonEmptyString(id) || seen.has(id)) continue;
    seen.add(id);
    resolved.push({ id, index: resolved.length });
  }
  return resolved;
}

/**
 * Edges whose endpoints both resolve to a known component, in input order.
 * @param {unknown} edges
 * @param {Set<string>} knownIds
 * @returns {{from: string, to: string, kind: string, label: string|null, index: number}[]}
 */
function resolveEdges(edges, knownIds) {
  if (!Array.isArray(edges)) return [];
  const resolved = [];
  for (const edge of edges) {
    if (!edge) continue;
    const from = edge.fromComponentId;
    const to = edge.toComponentId;
    if (!isNonEmptyString(from) || !isNonEmptyString(to)) continue;
    if (!knownIds.has(from) || !knownIds.has(to)) continue;
    resolved.push({
      from,
      to,
      kind: EDGE_KINDS.includes(edge.kind) ? edge.kind : DEFAULT_EDGE_KIND,
      label: isNonEmptyString(edge.label) ? edge.label : null,
      index: resolved.length,
    });
  }
  return resolved;
}

/**
 * Mark every edge that closes a cycle (including self-loops) as a back-edge, so
 * the remaining edge set is acyclic. Iterative DFS visiting nodes and outgoing
 * edges in a fixed order.
 * @param {string[]} ids Node ids in deterministic order.
 * @param {{from: string, to: string}[]} edges
 * @returns {boolean[]} `isBack[i]` for `edges[i]`.
 */
function markBackEdges(ids, edges) {
  /** @type {Map<string, number[]>} outgoing edge indices, deterministic order */
  const outgoing = new Map(ids.map((id) => [id, []]));
  edges.forEach((edge, i) => outgoing.get(edge.from).push(i));
  for (const list of outgoing.values()) {
    list.sort((a, b) => compareIds(edges[a].to, edges[b].to) || a - b);
  }

  const isBack = edges.map(() => false);
  const VISITING = 1;
  const DONE = 2;
  /** @type {Map<string, number>} */
  const state = new Map();

  for (const root of ids) {
    if (state.get(root)) continue;
    // Explicit stack of {id, cursor} frames — recursion would risk deep graphs.
    const stack = [{ id: root, cursor: 0 }];
    state.set(root, VISITING);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const list = outgoing.get(frame.id);
      if (frame.cursor >= list.length) {
        state.set(frame.id, DONE);
        stack.pop();
        continue;
      }
      const edgeIndex = list[frame.cursor];
      frame.cursor += 1;
      const next = edges[edgeIndex].to;
      const nextState = state.get(next);
      if (nextState === VISITING) {
        isBack[edgeIndex] = true; // closes a cycle (self-loops land here too)
      } else if (nextState !== DONE) {
        state.set(next, VISITING);
        stack.push({ id: next, cursor: 0 });
      }
    }
  }
  return isBack;
}

/**
 * Longest-path layering: `layer(v) = 0` when v has no forward predecessor,
 * otherwise `1 + max(layer(pred))`. Guarantees `layer(from) < layer(to)` for
 * every forward edge.
 * @param {string[]} ids
 * @param {{from: string, to: string}[]} forwardEdges
 * @returns {Map<string, number>}
 */
function assignLayers(ids, forwardEdges) {
  /** @type {Map<string, number>} */
  const layer = new Map(ids.map((id) => [id, 0]));
  /** @type {Map<string, string[]>} */
  const successors = new Map(ids.map((id) => [id, []]));
  /** @type {Map<string, number>} */
  const inDegree = new Map(ids.map((id) => [id, 0]));

  for (const edge of forwardEdges) {
    successors.get(edge.from).push(edge.to);
    inDegree.set(edge.to, inDegree.get(edge.to) + 1);
  }

  // Kahn's algorithm over a deterministic ready set (ids are pre-sorted).
  let ready = ids.filter((id) => inDegree.get(id) === 0);
  let processed = 0;
  while (ready.length > 0) {
    /** @type {string[]} */
    const next = [];
    for (const id of ready) {
      processed += 1;
      for (const target of successors.get(id)) {
        const candidate = layer.get(id) + 1;
        if (candidate > layer.get(target)) layer.set(target, candidate);
        const remaining = inDegree.get(target) - 1;
        inDegree.set(target, remaining);
        if (remaining === 0) next.push(target);
      }
    }
    next.sort(compareIds);
    ready = next;
  }

  // Defensive: back-edge removal makes the graph acyclic, so this cannot trip.
  // If it ever did, the leftovers keep their layer 0 rather than crashing.
  if (processed !== ids.length) {
    for (const edge of forwardEdges) {
      const candidate = layer.get(edge.from) + 1;
      if (candidate > layer.get(edge.to)) layer.set(edge.to, candidate);
    }
  }
  return layer;
}

/**
 * Barycentre ordering inside each layer. Nodes without neighbours in the sweep
 * direction hold their current slot; ties fall back to input index then `id`, so
 * the result is fully determined by the input.
 * @param {{id: string, index: number}[][]} byLayer Nodes grouped by layer, pre-sorted.
 * @param {{from: string, to: string}[]} forwardEdges
 * @returns {void} mutates the arrays in `byLayer` into their final order
 */
function orderLayers(byLayer, forwardEdges) {
  /** @type {Map<string, string[]>} */
  const preds = new Map();
  /** @type {Map<string, string[]>} */
  const succs = new Map();
  const seenPairs = new Set();
  for (const edge of forwardEdges) {
    const pair = `${edge.from}\u0000${edge.to}`;
    if (seenPairs.has(pair)) continue; // parallel edges must not skew the mean
    seenPairs.add(pair);
    if (!preds.has(edge.to)) preds.set(edge.to, []);
    if (!succs.has(edge.from)) succs.set(edge.from, []);
    preds.get(edge.to).push(edge.from);
    succs.get(edge.from).push(edge.to);
  }

  /** @type {Map<string, number>} current slot of each node inside its layer */
  const slot = new Map();
  const refreshSlots = () => {
    for (const layerNodes of byLayer) {
      layerNodes.forEach((node, i) => slot.set(node.id, i));
    }
  };
  refreshSlots();

  /** @param {Map<string, string[]>} neighbours */
  const sweep = (layerNodes, neighbours) => {
    const barycentre = new Map();
    for (const node of layerNodes) {
      const list = neighbours.get(node.id);
      if (!list || list.length === 0) {
        barycentre.set(node.id, slot.get(node.id));
        continue;
      }
      let total = 0;
      for (const other of list) total += slot.get(other);
      barycentre.set(node.id, total / list.length);
    }
    layerNodes.sort(
      (a, b) =>
        barycentre.get(a.id) - barycentre.get(b.id) ||
        a.index - b.index ||
        compareIds(a.id, b.id)
    );
  };

  for (let pass = 0; pass < BARYCENTRE_SWEEPS; pass += 1) {
    for (let i = 1; i < byLayer.length; i += 1) sweep(byLayer[i], preds);
    refreshSlots();
    for (let i = byLayer.length - 2; i >= 0; i -= 1) sweep(byLayer[i], succs);
    refreshSlots();
  }
}

/**
 * Lay out an architecture graph for SVG rendering.
 *
 * Above `MAX_GRAPH_NODES` distinct components the function returns immediately
 * with `exceedsCap: true` and no geometry, so the caller can fall back to the
 * table view without paying for a synchronous layout pass (Requirement 12.6).
 *
 * @param {Array<{id: string}>} components `ArchitectureComponent[]`; only `id` is read.
 * @param {Array<{fromComponentId: string, toComponentId: string, kind?: string|null, label?: string|null}>} edges
 *   `ArchitectureEdge[]`. An edge is emitted only when both endpoints resolve to a component.
 * @param {LayoutOptions} [opts] Geometry overrides.
 * @returns {GraphLayout}
 */
export function layoutArchitectureGraph(components, edges, opts) {
  const resolvedComponents = resolveComponents(components);
  const nodeCount = resolvedComponents.length;

  const empty = {
    nodes: [],
    edges: [],
    width: 0,
    height: 0,
    layers: [],
    nodeCount,
  };

  if (nodeCount > MAX_GRAPH_NODES) {
    return { ...empty, exceedsCap: true };
  }
  if (nodeCount === 0) {
    return { ...empty, exceedsCap: false };
  }

  const { nodeWidth, nodeHeight, layerGap, nodeGap, padding } = {
    ...DEFAULT_OPTIONS,
    ...(opts || {}),
  };

  const knownIds = new Set(resolvedComponents.map((c) => c.id));
  const resolvedEdges = resolveEdges(edges, knownIds);

  // Deterministic node iteration order for every graph traversal below.
  const sortedIds = resolvedComponents.map((c) => c.id).slice().sort(compareIds);

  const isBack = markBackEdges(sortedIds, resolvedEdges);
  const forwardEdges = resolvedEdges.filter((_, i) => !isBack[i]);

  const layerOf = assignLayers(sortedIds, forwardEdges);

  const layerCount = resolvedComponents.reduce(
    (max, c) => Math.max(max, layerOf.get(c.id) + 1),
    0
  );
  /** @type {{id: string, index: number}[][]} */
  const byLayer = Array.from({ length: layerCount }, () => []);
  for (const component of resolvedComponents) {
    byLayer[layerOf.get(component.id)].push(component);
  }
  for (const layerNodes of byLayer) {
    layerNodes.sort((a, b) => a.index - b.index || compareIds(a.id, b.id));
  }

  orderLayers(byLayer, forwardEdges);

  const rows = byLayer.reduce((max, layerNodes) => Math.max(max, layerNodes.length), 0);
  const rowStride = nodeHeight + nodeGap;
  const colStride = nodeWidth + layerGap;
  const width = padding * 2 + layerCount * nodeWidth + (layerCount - 1) * layerGap;
  const height = padding * 2 + rows * nodeHeight + (rows - 1) * nodeGap;

  /** @type {LayoutNode[]} */
  const nodes = [];
  /** @type {Map<string, LayoutNode>} */
  const nodeById = new Map();
  byLayer.forEach((layerNodes, layer) => {
    // Centre short layers against the tallest one so the graph reads evenly.
    const offset = ((rows - layerNodes.length) * rowStride) / 2;
    layerNodes.forEach((component, order) => {
      const node = {
        id: component.id,
        layer,
        order,
        x: Math.round(padding + layer * colStride),
        y: Math.round(padding + offset + order * rowStride),
        w: nodeWidth,
        h: nodeHeight,
      };
      nodes.push(node);
      nodeById.set(node.id, node);
    });
  });

  /** @type {string[][]} */
  const layers = byLayer.map((layerNodes) => layerNodes.map((c) => c.id));

  const laidOutEdges = resolvedEdges.map((edge, i) => {
    const source = nodeById.get(edge.from);
    const target = nodeById.get(edge.to);
    return {
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      label: edge.label,
      isBack: isBack[i],
      points: isBack[i]
        ? backEdgePoints(source, target, nodeGap)
        : forwardEdgePoints(source, target),
    };
  });

  return {
    nodes,
    edges: laidOutEdges,
    width,
    height,
    layers,
    exceedsCap: false,
    nodeCount,
  };
}

/**
 * Elbow polyline from the right edge of `source` to the left edge of `target`.
 * @param {LayoutNode} source
 * @param {LayoutNode} target
 * @returns {{x: number, y: number}[]}
 */
function forwardEdgePoints(source, target) {
  const startX = source.x + source.w;
  const startY = Math.round(source.y + source.h / 2);
  const endX = target.x;
  const endY = Math.round(target.y + target.h / 2);
  const midX = Math.round((startX + endX) / 2);
  return [
    { x: startX, y: startY },
    { x: midX, y: startY },
    { x: midX, y: endY },
    { x: endX, y: endY },
  ];
}

/**
 * Polyline for a cycle-closing edge: leaves the left edge of `source`, routes
 * above the two boxes, and arrives at the right edge of `target`. Self-loops use
 * the same path and read as a loop over the box.
 * @param {LayoutNode} source
 * @param {LayoutNode} target
 * @param {number} nodeGap
 * @returns {{x: number, y: number}[]}
 */
function backEdgePoints(source, target, nodeGap) {
  const startX = source.x;
  const startY = Math.round(source.y + source.h / 2);
  const endX = target.x + target.w;
  const endY = Math.round(target.y + target.h / 2);
  const detourY = Math.max(4, Math.round(Math.min(source.y, target.y) - nodeGap / 2));
  return [
    { x: startX, y: startY },
    { x: Math.round(startX - nodeGap / 2), y: startY },
    { x: Math.round(startX - nodeGap / 2), y: detourY },
    { x: Math.round(endX + nodeGap / 2), y: detourY },
    { x: Math.round(endX + nodeGap / 2), y: endY },
    { x: endX, y: endY },
  ];
}
