/**
 * Pure projection layer for the execution plan (no React, no DOM, no I/O).
 *
 * This module is the trust boundary on the client: **it performs no arithmetic
 * on any server figure.** Hours, capacity percentages, coverage counts, states
 * and the critical path are all computed by the deterministic validator in
 * `ai-service/app/features/timeline_validation.py`; here they are only grouped,
 * indexed, filtered and looked up (Requirements 6.5, 7.3).
 *
 * Two rules follow from that:
 *   - server objects (`CapacityCell`, `ScopeCoverage`, `DiagnosticIssue`, …) are
 *     carried through **verbatim**, by reference, never rebuilt or rounded;
 *   - an identifier that does not resolve is **dropped**, never rendered as
 *     `undefined` (the validator reports it as a `dangling_ref` error).
 *
 * Every function tolerates `null`, `undefined` and malformed input, because a
 * proposal persisted before this feature has no plan and no diagnostics at all
 * (Requirements 11.1, 11.4).
 *
 * @module lib/plan/selectors
 */

/** Diagnostic code the week-content rule emits for an empty week. */
const EMPTY_WEEK_CODE = 'empty_week';

/** Diagnostic code that makes the schedule unsafe to draw (Requirement 5.4). */
const DEPENDENCY_CYCLE_CODE = 'dependency_cycle';

/** Prefix shared by every task-dependency diagnostic code. */
const DEPENDENCY_CODE_PREFIX = 'dependency_';

/** Separator for composite capacity keys — not a legal character in plan ids. */
const KEY_SEPARATOR = '\u241f';

/** Sections that can each be independently empty (Requirements 10.5, 11.4). */
export const PLAN_SECTIONS = [
  'scope',
  'architecture',
  'weeks',
  'schedule',
  'capacity',
  'traceability',
  'workflow',
];

/** Reason shown for every section when there is no plan at all. */
const NO_PLAN_REASON = 'No execution plan has been generated for this proposal yet.';

/** Reason shown when a diagnostics-backed section has no validator output. */
const NO_DIAGNOSTICS_REASON =
  'The server-side validator has not produced diagnostics for this plan yet.';

/**
 * @typedef {Object} PlanIndex
 * @property {Map<string, Object>} tasksById              Tasks keyed by `id`.
 * @property {Map<string, Object>} weeksById              Weeks keyed by `id`.
 * @property {Map<string, Object>} weeksByNumber          Weeks keyed by `weekNumber` (as written).
 * @property {Map<string, Object>} modulesById            Scope modules keyed by `id`.
 * @property {Map<string, Object>} requirementsById       Requirements keyed by `id`.
 * @property {Map<string, Object>} workstreamsById        Workstreams keyed by `id`.
 * @property {Map<string, Object>} rolesById              `teamCapacity` entries keyed by `roleId`.
 * @property {Map<string, Object>} deliverablesById       Deliverables keyed by `id`.
 * @property {Map<string, Object>} checkpointsById        Checkpoints keyed by `id`.
 * @property {Map<string, Object>} componentsById         Architecture components keyed by `id`.
 * @property {Map<string, Object>} assumptionsById        Planning assumptions keyed by `id`.
 * @property {Map<string, Object>} questionsById          Open questions keyed by `id`.
 * @property {Map<string, Object>} risksById              Risk links keyed by `id`.
 * @property {Map<string, Object[]>} blockingQuestionsByRequirementId Blocking open
 *   questions grouped by each requirement id they name (Requirement 7.5).
 * @property {Object[]} weeksInOrder                      Weeks in ascending `weekNumber` order.
 */

/**
 * @typedef {Object} WeekRollup
 * @property {Object} week            The `PlanWeek` verbatim — number, label and objective included.
 * @property {Object[]} tasks         Resolvable tasks named by `week.taskIds`, in that order.
 * @property {Object[]} deliverables  Resolvable deliverables named by `week.deliverableIds`.
 * @property {Object[]} checkpoints   Resolvable checkpoints named by `week.checkpointIds`.
 * @property {Object[]} clientActions The week's embedded client actions, verbatim.
 * @property {Object[]} blockingClientActions Client actions with `required === true` (Requirement 3.5).
 * @property {boolean} isGap          True exactly when diagnostics carry an `empty_week` issue for this week.
 * @property {Object|null} gapIssue   That `empty_week` issue, or `null`.
 */

/**
 * @typedef {Object} CapacityMatrix
 * @property {Object[]} roles                   `teamCapacity` entries, verbatim, in plan order.
 * @property {number[]} weekNumbers             Ascending week numbers spanned by the grid.
 * @property {Object.<string, Object>} cells    Supplied `CapacityCell` objects keyed by role+week.
 * @property {(roleId: string, weekNumber: number) => (Object|null)} cell
 *   Lookup for one grid position; `null` when the validator supplied no cell there.
 */

/**
 * @typedef {Object} TraceabilityRow
 * @property {Object} requirement          The `Requirement` verbatim (its `source` backs Requirement 7.4).
 * @property {Object|null} coverage        The matching `ScopeCoverage` record, or `null` when absent.
 * @property {Object[]} modules           Resolvable scope modules named by the coverage record.
 * @property {Object[]} tasks             Resolvable tasks named by the coverage record.
 * @property {Object[]} checkpoints       Resolvable checkpoints named by the coverage record.
 * @property {Object[]} blockingQuestions Blocking open questions that name this requirement.
 */

/**
 * @typedef {Object} SectionState
 * @property {boolean} available    Whether the section has the data it needs to render.
 * @property {string|null} reason   Why it cannot render; `null` when it can.
 */

// ── internal helpers ───────────────────────────────────────────────────────

/** @param {unknown} value @returns {value is Object} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Treat anything that is not an array as an empty list, and drop non-record
 * entries so a malformed payload cannot reach a component.
 *
 * @param {unknown} value
 * @returns {Object[]}
 */
function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** @param {unknown} value @returns {boolean} */
function isUsableKey(value) {
  return typeof value === 'string' ? value.length > 0 : typeof value === 'number' && Number.isFinite(value);
}

/**
 * Index records by one key field. The first occurrence of a duplicate key wins,
 * so the index is deterministic; duplicates are reported by the validator as
 * `duplicate_id` errors rather than resolved here.
 *
 * @param {unknown} list
 * @param {string} keyField
 * @returns {Map<string, Object>}
 */
function indexBy(list, keyField) {
  const map = new Map();
  for (const item of records(list)) {
    const key = item[keyField];
    if (!isUsableKey(key)) continue;
    const stringKey = String(key);
    if (!map.has(stringKey)) map.set(stringKey, item);
  }
  return map;
}

/**
 * Map identifiers to entities, dropping every id that does not resolve.
 * Order and repetition of the id list are preserved.
 *
 * @param {unknown} ids
 * @param {Map<string, Object>} map
 * @returns {Object[]}
 */
function resolveAll(ids, map) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  for (const id of ids) {
    if (!isUsableKey(id)) continue;
    const found = map.get(String(id));
    if (found !== undefined) out.push(found);
  }
  return out;
}

/** @param {unknown} diagnostics @returns {Object[]} Diagnostic issues, or `[]`. */
function issuesOf(diagnostics) {
  return isRecord(diagnostics) ? records(diagnostics.issues) : [];
}

/**
 * The id a task-scoped diagnostic path refers to (`tasks.<id>.field` → `<id>`).
 *
 * @param {unknown} path
 * @returns {string|null}
 */
function taskIdFromPath(path) {
  if (typeof path !== 'string' || !path.startsWith('tasks.')) return null;
  let rest = path.slice('tasks.'.length);
  const dot = rest.indexOf('.');
  if (dot !== -1) rest = rest.slice(0, dot);
  return rest.length > 0 ? rest : null;
}

/**
 * Ascending order by `weekNumber`, with a stable fallback on input position so
 * weeks with a missing or non-numeric number keep their original sequence at
 * the end instead of disappearing.
 *
 * @param {unknown} weeks
 * @returns {Object[]}
 */
function weeksAscending(weeks) {
  return records(weeks)
    .map((week, index) => ({ week, index }))
    .sort((a, b) => {
      const an = typeof a.week.weekNumber === 'number' && Number.isFinite(a.week.weekNumber)
        ? a.week.weekNumber
        : Number.POSITIVE_INFINITY;
      const bn = typeof b.week.weekNumber === 'number' && Number.isFinite(b.week.weekNumber)
        ? b.week.weekNumber
        : Number.POSITIVE_INFINITY;
      if (an !== bn) return an - bn;
      return a.index - b.index;
    })
    .map((entry) => entry.week);
}

/** @param {boolean} available @param {string|null} reason @returns {SectionState} */
function section(available, reason) {
  return { available, reason: available ? null : reason };
}

// ── public API ─────────────────────────────────────────────────────────────

/**
 * Composite key used by {@link CapacityMatrix.cells}. Week numbers are keyed by
 * their string form so `3` and `'3'` address the same grid position.
 *
 * @param {string|number} roleId
 * @param {string|number} weekNumber
 * @returns {string}
 */
export function capacityCellKey(roleId, weekNumber) {
  return `${String(roleId)}${KEY_SEPARATOR}${String(weekNumber)}`;
}

/**
 * Build every id → entity index a plan surface needs, in one pass.
 *
 * Safe on `null`/`undefined`/malformed input: each index is simply empty.
 *
 * @param {Object|null|undefined} plan An `ExecutionPlan`.
 * @returns {PlanIndex}
 */
export function indexPlan(plan) {
  const source = isRecord(plan) ? plan : {};
  const architecture = isRecord(source.architecture) ? source.architecture : {};

  const blockingQuestionsByRequirementId = new Map();
  for (const question of records(source.openQuestions)) {
    if (question.blocking !== true) continue;
    for (const requirementId of Array.isArray(question.relatedRequirementIds) ? question.relatedRequirementIds : []) {
      if (!isUsableKey(requirementId)) continue;
      const key = String(requirementId);
      const bucket = blockingQuestionsByRequirementId.get(key);
      if (bucket) bucket.push(question);
      else blockingQuestionsByRequirementId.set(key, [question]);
    }
  }

  return {
    tasksById: indexBy(source.tasks, 'id'),
    weeksById: indexBy(source.weeks, 'id'),
    weeksByNumber: indexBy(source.weeks, 'weekNumber'),
    modulesById: indexBy(source.scopeModules, 'id'),
    requirementsById: indexBy(source.requirements, 'id'),
    workstreamsById: indexBy(source.workstreams, 'id'),
    rolesById: indexBy(source.teamCapacity, 'roleId'),
    deliverablesById: indexBy(source.deliverables, 'id'),
    checkpointsById: indexBy(source.checkpoints, 'id'),
    componentsById: indexBy(architecture.components, 'id'),
    assumptionsById: indexBy(source.planningAssumptions, 'id'),
    questionsById: indexBy(source.openQuestions, 'id'),
    risksById: indexBy(source.risks, 'id'),
    blockingQuestionsByRequirementId,
    weeksInOrder: weeksAscending(source.weeks),
  };
}

/**
 * Group each week's work for the week-by-week timeline (Requirements 3.1–3.3, 3.5).
 *
 * One rollup per plan week, in ascending week order. Ids that do not resolve are
 * dropped; the gap flag is read from the validator's own `empty_week` issue
 * rather than re-deciding what "empty" means in the browser.
 *
 * @param {Object|null|undefined} plan An `ExecutionPlan`.
 * @param {Object|null|undefined} diagnostics The matching `PlanDiagnostics`.
 * @returns {WeekRollup[]}
 */
export function buildWeekRollups(plan, diagnostics) {
  const index = indexPlan(plan);

  // `empty_week` issues carry `path = "weeks.<week id>"`; accept the week number
  // too so an older diagnostics record still lights up the right week.
  const gapIssueByWeekKey = new Map();
  for (const issue of issuesOf(diagnostics)) {
    if (issue.code !== EMPTY_WEEK_CODE || typeof issue.path !== 'string') continue;
    if (!issue.path.startsWith('weeks.')) continue;
    const key = issue.path.slice('weeks.'.length);
    if (key.length > 0 && !gapIssueByWeekKey.has(key)) gapIssueByWeekKey.set(key, issue);
  }

  return index.weeksInOrder.map((week) => {
    const clientActions = records(week.clientActions);
    const gapIssue =
      (isUsableKey(week.id) ? gapIssueByWeekKey.get(String(week.id)) : undefined) ??
      (isUsableKey(week.weekNumber) ? gapIssueByWeekKey.get(String(week.weekNumber)) : undefined) ??
      null;

    return {
      week,
      tasks: resolveAll(week.taskIds, index.tasksById),
      deliverables: resolveAll(week.deliverableIds, index.deliverablesById),
      checkpoints: resolveAll(week.checkpointIds, index.checkpointsById),
      clientActions,
      blockingClientActions: clientActions.filter((action) => action.required === true),
      isGap: gapIssue !== null,
      gapIssue,
    };
  });
}

/**
 * Arrange the validator's capacity cells into a roles × weeks grid
 * (Requirements 6.1, 6.3, 6.5).
 *
 * Cells are the server's own `CapacityCell` objects, by reference: utilisation,
 * state and hours are never recomputed, and a position the validator did not
 * report reads as `null` rather than an implied zero.
 *
 * @param {Object|null|undefined} plan An `ExecutionPlan`.
 * @param {Object|null|undefined} diagnostics The matching `PlanDiagnostics`.
 * @returns {CapacityMatrix}
 */
export function buildCapacityMatrix(plan, diagnostics) {
  const source = isRecord(plan) ? plan : {};
  const roles = records(source.teamCapacity).filter((role) => isUsableKey(role.roleId));
  const suppliedCells = isRecord(diagnostics) ? records(diagnostics.capacity) : [];

  /** @type {Object.<string, Object>} */
  const cells = Object.create(null);
  const weekNumbers = new Set();

  for (const week of records(source.weeks)) {
    if (typeof week.weekNumber === 'number' && Number.isFinite(week.weekNumber)) {
      weekNumbers.add(week.weekNumber);
    }
  }

  for (const cell of suppliedCells) {
    if (!isUsableKey(cell.roleId) || !isUsableKey(cell.weekNumber)) continue;
    const key = capacityCellKey(cell.roleId, cell.weekNumber);
    // First cell wins: duplicates are a validator-level defect, not ours to merge.
    if (!(key in cells)) cells[key] = cell;
    const asNumber = Number(cell.weekNumber);
    if (Number.isFinite(asNumber)) weekNumbers.add(asNumber);
  }

  return {
    roles,
    weekNumbers: [...weekNumbers].sort((a, b) => a - b),
    cells,
    cell(roleId, weekNumber) {
      if (!isUsableKey(roleId) || !isUsableKey(weekNumber)) return null;
      const found = cells[capacityCellKey(roleId, weekNumber)];
      return found === undefined ? null : found;
    },
  };
}

/**
 * The tasks behind one capacity cell — attribution, not arithmetic
 * (Requirement 6.4).
 *
 * A task contributes to `(roleId, weekNumber)` when it is owned by that role and
 * its `startWeek..endWeek` span contains that week. Hours are not summed here;
 * the cell already carries the validator's figure.
 *
 * @param {Object|null|undefined} plan An `ExecutionPlan`.
 * @param {string|number} roleId
 * @param {number} weekNumber
 * @returns {Object[]} Tasks in plan order.
 */
export function tasksForCapacityCell(plan, roleId, weekNumber) {
  const source = isRecord(plan) ? plan : {};
  if (!isUsableKey(roleId) || typeof weekNumber !== 'number' || !Number.isFinite(weekNumber)) return [];
  const role = String(roleId);

  return records(source.tasks).filter((task) => {
    if (!isUsableKey(task.ownerRoleId) || String(task.ownerRoleId) !== role) return false;
    const { startWeek, endWeek } = task;
    if (typeof startWeek !== 'number' || typeof endWeek !== 'number') return false;
    return startWeek <= weekNumber && weekNumber <= endWeek;
  });
}

/**
 * One traceability row per requirement, drawn from the validator's
 * `scopeCoverage` records (Requirements 7.1, 7.2, 7.4, 7.5).
 *
 * The covered/total counts a view displays come from
 * `diagnostics.coveredRequirementCount` / `totalRequirementCount` — they are
 * deliberately not derived from these rows (Requirement 7.3).
 *
 * @param {Object|null|undefined} plan An `ExecutionPlan`.
 * @param {Object|null|undefined} diagnostics The matching `PlanDiagnostics`.
 * @returns {TraceabilityRow[]}
 */
export function buildTraceabilityRows(plan, diagnostics) {
  const source = isRecord(plan) ? plan : {};
  const index = indexPlan(plan);
  const coverageByRequirementId = isRecord(diagnostics)
    ? indexBy(diagnostics.scopeCoverage, 'requirementId')
    : new Map();

  return records(source.requirements)
    .filter((requirement) => isUsableKey(requirement.id))
    .map((requirement) => {
      const key = String(requirement.id);
      const coverage = coverageByRequirementId.get(key) ?? null;

      return {
        requirement,
        coverage,
        modules: coverage ? resolveAll(coverage.moduleIds, index.modulesById) : [],
        tasks: coverage ? resolveAll(coverage.taskIds, index.tasksById) : [],
        checkpoints: coverage ? resolveAll(coverage.checkpointIds, index.checkpointsById) : [],
        blockingQuestions: index.blockingQuestionsByRequirementId.get(key) ?? [],
      };
    });
}

/**
 * Dependency diagnostics grouped by the task they were reported against, so the
 * schedule can mark a task without scanning the issue list per row
 * (Requirement 5.2).
 *
 * @param {Object|null|undefined} diagnostics A `PlanDiagnostics`.
 * @returns {Map<string, Object[]>} Task id → its dependency issues, in report order.
 */
export function dependencyIssuesByTask(diagnostics) {
  const byTask = new Map();

  for (const issue of issuesOf(diagnostics)) {
    if (typeof issue.code !== 'string' || !issue.code.startsWith(DEPENDENCY_CODE_PREFIX)) continue;
    const taskId = taskIdFromPath(issue.path);
    if (taskId === null) continue;
    const bucket = byTask.get(taskId);
    if (bucket) bucket.push(issue);
    else byTask.set(taskId, [issue]);
  }

  return byTask;
}

/**
 * Whether the schedule must refuse to draw (Requirement 5.4).
 *
 * A dependency cycle makes any span or critical-path rendering misleading, so
 * the view shows the validator's findings instead of a chart.
 *
 * @param {Object|null|undefined} diagnostics A `PlanDiagnostics`.
 * @returns {boolean}
 */
export function hasBlockingPlanError(diagnostics) {
  return issuesOf(diagnostics).some((issue) => issue.code === DEPENDENCY_CYCLE_CODE);
}

/**
 * Per-section readiness backing `EmptyDiagram` (Requirements 10.5, 11.4).
 *
 * A section is unavailable only when the data it renders is genuinely absent,
 * and always with a sentence explaining why — a missing section never becomes a
 * blank container, and one missing section never hides its siblings.
 *
 * @param {Object|null|undefined} plan An `ExecutionPlan`.
 * @param {Object|null|undefined} diagnostics The matching `PlanDiagnostics`.
 * @returns {{scope: SectionState, architecture: SectionState, weeks: SectionState,
 *   schedule: SectionState, capacity: SectionState, traceability: SectionState,
 *   workflow: SectionState}}
 */
export function sectionAvailability(plan, diagnostics) {
  if (!isRecord(plan)) {
    const missing = section(false, NO_PLAN_REASON);
    return {
      scope: missing,
      architecture: missing,
      weeks: missing,
      schedule: missing,
      capacity: missing,
      traceability: missing,
      workflow: missing,
    };
  }

  const hasDiagnostics = isRecord(diagnostics);
  const architecture = isRecord(plan.architecture) ? plan.architecture : null;
  const components = architecture ? records(architecture.components) : [];
  const roles = records(plan.teamCapacity);
  const capacityCells = hasDiagnostics ? records(diagnostics.capacity) : [];
  const requirements = records(plan.requirements);
  const coverage = hasDiagnostics ? records(diagnostics.scopeCoverage) : [];

  return {
    scope: section(
      records(plan.scopeModules).length > 0,
      'This plan has no scope modules, so there is nothing to break down yet.',
    ),
    architecture: section(
      components.length > 0,
      architecture === null
        ? 'This plan has no architecture section yet.'
        : 'The architecture section lists no components to draw.',
    ),
    weeks: section(
      records(plan.weeks).length > 0,
      'This plan has no weekly breakdown, so there are no weeks to show.',
    ),
    schedule: section(
      records(plan.tasks).length > 0,
      'This plan has no tasks, so there is no schedule to position.',
    ),
    capacity: section(
      hasDiagnostics && capacityCells.length > 0 && roles.length > 0,
      !hasDiagnostics
        ? NO_DIAGNOSTICS_REASON
        : roles.length === 0
          ? 'This plan declares no team roles, so capacity cannot be shown per role.'
          : 'The validator reported no capacity figures for this plan.',
    ),
    traceability: section(
      hasDiagnostics && requirements.length > 0 && coverage.length > 0,
      requirements.length === 0
        ? 'This plan lists no requirements to trace.'
        : !hasDiagnostics
          ? NO_DIAGNOSTICS_REASON
          : 'The validator reported no coverage records for this plan.',
    ),
    // The lifecycle map is derived from the project's own workflow state, not
    // from plan content, so it renders whenever a plan exists at all.
    workflow: section(true, NO_PLAN_REASON),
  };
}
