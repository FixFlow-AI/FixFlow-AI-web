/**
 * Presentation encoding for every stateful element in the plan diagrams
 * (pure data — no React, no DOM).
 *
 * This module is the **single source of truth for how state is shown**. It
 * exists so that no diagram can ever communicate meaning with colour alone
 * (Requirements 4.2, 6.2, 12.3): every state in every map carries
 *
 *   - a **non-colour channel** — a glyph, or for graph edges a stroke pattern
 *     plus an arrowhead shape — that is *unique within its map*, and
 *   - a **non-empty word** that a component puts into the accessible name, so
 *     the same state is readable as text by a screen reader, in the "view as
 *     table" fallback, and by anyone who cannot separate the hues.
 *
 * Colour (`tone`, `color`, `bg`, `border`) is carried too, reusing the palette
 * already used by `sections/dashboard/ExecutionPlanPanel.jsx` so the new
 * diagrams look native — but it is always an *additional* channel, never the
 * only one.
 *
 * The state keys are not invented here; they mirror the server contract:
 *   - `ArchitectureEdge.kind`, `CapacityCell.state`, `TaskStatus`,
 *     `CheckpointStatus`, `PlanRiskLink.status` and `Requirement.source` in
 *     `ai-service/app/schemas/execution_plan.py`;
 *   - `ScopeCoverage.covered` (plus "no record at all") for coverage state;
 *   - `LifecycleStage.state` in `frontend/src/lib/plan/lifecycle.js`.
 *
 * Invariants guaranteed for every exported map (Property 10):
 *   - `channel` is unique across the map's entries (injective non-colour
 *     encoding);
 *   - `word` is a non-empty string for every entry;
 *   - every entry is frozen, so a component cannot corrupt the encoding for
 *     the rest of the page.
 *
 * @module components/plan/encoding
 */

/**
 * One state's full presentation.
 *
 * @typedef {Object} StateEncoding
 * @property {string} key The state value as it arrives from the server.
 * @property {string} word Short human word for the state. Never empty — this
 *   is what goes into the accessible name.
 * @property {string} glyph Text glyph shown alongside the word.
 * @property {string} channel The non-colour channel, unique within the map.
 *   Equal to `glyph` unless the map overrides it (edges combine stroke pattern
 *   and arrowhead shape).
 * @property {string} description One sentence explaining what the state means,
 *   for legends and inspector panels.
 * @property {'ok'|'warn'|'error'|'info'|'muted'} tone Pill tone, matching
 *   `ExecutionPlanPanel.jsx`.
 * @property {string} color Foreground colour (additional channel only).
 * @property {string} bg Background colour (additional channel only).
 * @property {string} border Border colour (additional channel only).
 */

/**
 * Edge encodings additionally carry the SVG stroke and marker channel.
 *
 * @typedef {StateEncoding & {
 *   strokeDasharray: string,
 *   markerShape: 'filled-arrow'|'open-arrow'|'diamond'|'hollow-arrow',
 *   markerId: string
 * }} EdgeEncoding
 */

/** Palette lifted from `ExecutionPlanPanel.jsx` so the diagrams look native. */
const TONES = Object.freeze({
  ok: Object.freeze({ tone: 'ok', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' }),
  warn: Object.freeze({ tone: 'warn', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }),
  error: Object.freeze({ tone: 'error', color: '#991b1b', bg: '#fef2f2', border: '#fee2e2' }),
  info: Object.freeze({ tone: 'info', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' }),
  muted: Object.freeze({ tone: 'muted', color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' }),
});

/** Last-resort entry, used only if {@link resolveState} is handed a foreign map. */
const UNRECOGNISED = Object.freeze({
  key: 'unknown',
  word: 'Unknown',
  glyph: '?',
  channel: '?',
  description: 'This state is not recognised.',
  ...TONES.muted,
});

/** Fallback entry per map, for a state value the server has not taught us. */
const FALLBACKS = new WeakMap();

/** Human name per map, used when a component builds an accessible name. */
const MAP_LABELS = new WeakMap();

/**
 * Build a frozen presentation map, defaulting `channel` to the glyph and
 * splicing in the tone palette.
 *
 * @param {string} label Human name of the dimension (e.g. `'Capacity'`).
 * @param {Object<string, Object>} entries Raw entries keyed by state value.
 * @param {string} fallbackKey Key used when a state value is unrecognised.
 * @returns {Object<string, StateEncoding>} Frozen map.
 */
function definePresentation(label, entries, fallbackKey) {
  const map = Object.freeze(
    Object.fromEntries(
      Object.entries(entries).map(([key, entry]) => [
        key,
        Object.freeze({
          key,
          channel: entry.channel ?? entry.glyph,
          ...TONES[entry.tone],
          ...entry,
        }),
      ]),
    ),
  );
  MAP_LABELS.set(map, label);
  FALLBACKS.set(map, map[fallbackKey]);
  return map;
}

/**
 * Architecture edge kinds (Requirement 4.2).
 *
 * The non-colour channel is the **stroke pattern plus the arrowhead shape**,
 * so the four kinds stay apart in a monochrome print, and each also has a
 * glyph for the legend and the table view.
 *
 * @type {Object<string, EdgeEncoding>}
 */
export const EDGE_KINDS = definePresentation(
  'Edge kind',
  {
    sync: {
      word: 'Synchronous',
      glyph: '▶',
      strokeDasharray: 'none',
      markerShape: 'filled-arrow',
      markerId: 'plan-edge-marker-sync',
      channel: 'none|filled-arrow',
      description: 'A blocking call — the caller waits for the response.',
      tone: 'info',
    },
    async: {
      word: 'Asynchronous',
      glyph: '▷',
      strokeDasharray: '6 4',
      markerShape: 'open-arrow',
      markerId: 'plan-edge-marker-async',
      channel: '6 4|open-arrow',
      description: 'A non-blocking call — the caller continues without waiting.',
      tone: 'warn',
    },
    data: {
      word: 'Data flow',
      glyph: '◆',
      strokeDasharray: '2 3',
      markerShape: 'diamond',
      markerId: 'plan-edge-marker-data',
      channel: '2 3|diamond',
      description: 'Data moves between the two components without a direct call.',
      tone: 'muted',
    },
    event: {
      word: 'Event',
      glyph: '▻',
      strokeDasharray: '8 3 2 3',
      markerShape: 'hollow-arrow',
      markerId: 'plan-edge-marker-event',
      channel: '8 3 2 3|hollow-arrow',
      description: 'The source publishes an event the target reacts to.',
      tone: 'ok',
    },
  },
  'sync',
);

/**
 * Capacity cell states (Requirement 6.2, 6.3).
 *
 * Rendered as `▲ Over / ● Near / ○ OK / ? Unknown` — the glyph *and* the word
 * are always shown, and a role-week the validator could not size reads as
 * unknown rather than an implied zero.
 *
 * @type {Object<string, StateEncoding>}
 */
export const CAPACITY_STATES = definePresentation(
  'Capacity',
  {
    over: {
      word: 'Over',
      glyph: '▲',
      description: 'Planned hours exceed this role’s capacity for the week.',
      tone: 'error',
    },
    warning: {
      word: 'Near',
      glyph: '●',
      description: 'Planned hours are close to this role’s capacity for the week.',
      tone: 'warn',
    },
    ok: {
      word: 'OK',
      glyph: '○',
      description: 'Planned hours sit comfortably inside this role’s capacity.',
      tone: 'ok',
    },
    unknown: {
      word: 'Unknown',
      glyph: '?',
      description: 'No capacity was declared for this role and week, so utilisation is not known.',
      tone: 'muted',
    },
  },
  'unknown',
);

/**
 * Task statuses, mirroring `TaskStatus` in the plan schema.
 *
 * @type {Object<string, StateEncoding>}
 */
export const TASK_STATUSES = definePresentation(
  'Task status',
  {
    planned: { word: 'Planned', glyph: '□', description: 'Scheduled but not started.', tone: 'info' },
    in_progress: { word: 'In progress', glyph: '◐', description: 'Being worked on now.', tone: 'warn' },
    blocked: { word: 'Blocked', glyph: '✕', description: 'Cannot proceed until something else clears.', tone: 'error' },
    done: { word: 'Done', glyph: '✓', description: 'Completed and accepted.', tone: 'ok' },
    backlog: { word: 'Backlog', glyph: '⋯', description: 'Identified but not yet scheduled into a week.', tone: 'muted' },
  },
  'planned',
);

/**
 * Checkpoint statuses, mirroring `CheckpointStatus` in the plan schema.
 *
 * @type {Object<string, StateEncoding>}
 */
export const CHECKPOINT_STATUSES = definePresentation(
  'Checkpoint status',
  {
    planned: { word: 'Planned', glyph: '□', description: 'Scheduled for a future week.', tone: 'info' },
    ready_for_review: {
      word: 'Ready for review',
      glyph: '◐',
      description: 'Waiting on the reviewer named by the checkpoint.',
      tone: 'warn',
    },
    approved: { word: 'Approved', glyph: '✓', description: 'Signed off by the reviewer.', tone: 'ok' },
    changes_requested: {
      word: 'Changes requested',
      glyph: '↺',
      description: 'The reviewer sent it back for revision.',
      tone: 'error',
    },
  },
  'planned',
);

/**
 * Risk link statuses, mirroring `PlanRiskLink.status` in the plan schema.
 *
 * @type {Object<string, StateEncoding>}
 */
export const RISK_STATUSES = definePresentation(
  'Risk status',
  {
    open: { word: 'Open', glyph: '▲', description: 'No mitigation is attached to this risk yet.', tone: 'error' },
    mitigated: {
      word: 'Mitigated',
      glyph: '✓',
      description: 'Planned work or a checkpoint addresses this risk.',
      tone: 'ok',
    },
    accepted: {
      word: 'Accepted',
      glyph: '≡',
      description: 'The risk is knowingly carried without mitigation.',
      tone: 'muted',
    },
  },
  'open',
);

/**
 * Requirement coverage states (Requirements 7.1, 7.2).
 *
 * `unknown` is the honest answer when the validator produced no
 * `scopeCoverage` record for a requirement at all — it is neither covered nor
 * proven uncovered.
 *
 * @type {Object<string, StateEncoding>}
 */
export const COVERAGE_STATES = definePresentation(
  'Coverage',
  {
    covered: {
      word: 'Covered',
      glyph: '✓',
      description: 'Planned work satisfies this requirement.',
      tone: 'ok',
    },
    uncovered: {
      word: 'Uncovered',
      glyph: '✕',
      description: 'No planned task covers this requirement.',
      tone: 'warn',
    },
    unknown: {
      word: 'Not assessed',
      glyph: '?',
      description: 'The validator reported no coverage record for this requirement.',
      tone: 'muted',
    },
  },
  'unknown',
);

/**
 * Requirement sources (Requirement 7.4), so inferred scope is distinguishable
 * from what the client actually stated.
 *
 * @type {Object<string, StateEncoding>}
 */
export const REQUIREMENT_SOURCES = definePresentation(
  'Source',
  {
    brief: { word: 'From brief', glyph: '❝', description: 'Stated in the brief you wrote.', tone: 'info' },
    discovery: {
      word: 'From discovery',
      glyph: '◇',
      description: 'Came from a discovery answer you gave.',
      tone: 'info',
    },
    client: { word: 'From you', glyph: '✎', description: 'Added by you directly on the plan.', tone: 'ok' },
    inferred: {
      word: 'Inferred',
      glyph: '≈',
      description: 'Inferred by FixFlowAI as an assumption, not stated by you.',
      tone: 'warn',
    },
  },
  'inferred',
);

/**
 * Lifecycle stage states, mirroring `LifecycleStage.state` in
 * `lib/plan/lifecycle.js` (Requirements 8.1, 8.6).
 *
 * @type {Object<string, StateEncoding>}
 */
export const LIFECYCLE_STATES = definePresentation(
  'Stage',
  {
    done: { word: 'Done', glyph: '✓', description: 'This stage is complete.', tone: 'ok' },
    current: { word: 'Current', glyph: '▶', description: 'The project sits here right now.', tone: 'info' },
    blocked: {
      word: 'Waiting',
      glyph: '⏸',
      description: 'Held until the person who holds the decision acts.',
      tone: 'warn',
    },
    upcoming: { word: 'Upcoming', glyph: '○', description: 'Not reached yet.', tone: 'muted' },
  },
  'upcoming',
);

/**
 * Every presentation map, keyed by the dimension it encodes. Legends and the
 * encoding property test iterate this so a new map cannot be added without
 * inheriting the same guarantees.
 *
 * @type {Object<string, Object<string, StateEncoding>>}
 */
export const PRESENTATION_MAPS = Object.freeze({
  edgeKind: EDGE_KINDS,
  capacity: CAPACITY_STATES,
  taskStatus: TASK_STATUSES,
  checkpointStatus: CHECKPOINT_STATUSES,
  riskStatus: RISK_STATUSES,
  coverage: COVERAGE_STATES,
  requirementSource: REQUIREMENT_SOURCES,
  lifecycle: LIFECYCLE_STATES,
});

/**
 * The human name of a dimension, e.g. `'Capacity'` for {@link CAPACITY_STATES}.
 *
 * @param {Object<string, StateEncoding>} map One of the exported maps.
 * @returns {string} The label, or `'State'` for an unknown map.
 */
export function mapLabel(map) {
  return MAP_LABELS.get(map) ?? 'State';
}

/**
 * Look up a state, never returning `undefined`.
 *
 * An unrecognised or missing state value resolves to the map's declared
 * fallback (the `unknown` entry where one exists), so a diagram degrades to
 * "we don't know" instead of rendering a blank or crashing on a value a newer
 * server introduced.
 *
 * @param {Object<string, StateEncoding>} map One of the exported maps.
 * @param {unknown} key The state value from the server.
 * @returns {StateEncoding}
 *
 * @example
 * resolveState(CAPACITY_STATES, 'over').glyph;   // '▲'
 * resolveState(CAPACITY_STATES, 'nonsense').word; // 'Unknown'
 */
export function resolveState(map, key) {
  const entry = typeof key === 'string' ? map[key] : undefined;
  return entry ?? FALLBACKS.get(map) ?? UNRECOGNISED;
}

/**
 * Build the accessible name for a stateful element.
 *
 * Components MUST use this rather than assembling their own string, because it
 * is what guarantees the state's word reaches assistive technology — the glyph
 * alone is decorative and colour alone is not an encoding at all
 * (Requirement 12.3).
 *
 * @param {Object<string, StateEncoding>} map One of the exported maps.
 * @param {unknown} key The state value from the server.
 * @param {string} [subject] What the state belongs to, e.g. `'Backend, week 3'`.
 * @returns {string} A non-empty accessible name containing the state's word.
 *
 * @example
 * describeState(CAPACITY_STATES, 'over', 'Backend, week 3');
 * // → 'Backend, week 3: Capacity Over'
 * describeState(LIFECYCLE_STATES, 'blocked');
 * // → 'Stage Waiting'
 */
export function describeState(map, key, subject) {
  const { word } = resolveState(map, key);
  const dimension = `${mapLabel(map)} ${word}`;
  const prefix = typeof subject === 'string' ? subject.trim() : '';
  return prefix ? `${prefix}: ${dimension}` : dimension;
}

/**
 * The coverage state of a requirement, from the validator's own record.
 *
 * Absent record ≠ uncovered: the validator simply did not report on it, so it
 * resolves to `unknown` rather than accusing the plan of a gap.
 *
 * @param {{covered?: unknown}|null|undefined} coverage A `ScopeCoverage` record.
 * @returns {'covered'|'uncovered'|'unknown'}
 */
export function coverageStateFor(coverage) {
  if (!coverage || typeof coverage !== 'object' || typeof coverage.covered !== 'boolean') return 'unknown';
  return coverage.covered ? 'covered' : 'uncovered';
}
