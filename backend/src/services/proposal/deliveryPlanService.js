const { randomUUID } = require('crypto');
const {
  cloneDefaultNotificationPreferences,
  normalizeNotificationPreferences,
} = require('../notifications/notificationPreferences');

const BACKLOG_REASONS = ['timeline_overflow', 'future_enhancement', 'dependency_blocked'];
const TASK_OWNERS = ['team', 'client', 'shared'];
const TASK_STATUSES = ['planned', 'done', 'backlog'];
const ROADMAP_STATUSES = ['planned', 'done'];

function sanitizeText(value, fallback = '') {
  const normalized = String(value || fallback).trim();
  return normalized || fallback;
}

function uniqueStrings(values = [], max = Infinity) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => sanitizeText(value)).filter(Boolean))].slice(0, max);
}

function makeId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function estimateWeeks(duration = '') {
  const normalized = String(duration || '').trim().toLowerCase();
  const values = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 1;

  if (/month/.test(normalized)) {
    return Math.max(1, Math.round(average * 4));
  }

  if (/day/.test(normalized)) {
    return Math.max(1, Math.ceil(average / 5));
  }

  return Math.max(1, Math.round(average));
}

function normalizeTask(task, index = 0) {
  if (typeof task === 'string') {
    return {
      id: makeId(`task-${index + 1}`),
      title: sanitizeText(task, `Task ${index + 1}`),
      owner: 'team',
      status: 'planned',
      notify: true,
    };
  }

  return {
    id: sanitizeText(task?.id, makeId(`task-${index + 1}`)),
    title: sanitizeText(task?.title, `Task ${index + 1}`),
    owner: TASK_OWNERS.includes(task?.owner) ? task.owner : 'team',
    status: TASK_STATUSES.includes(task?.status) ? task.status : 'planned',
    notify: typeof task?.notify === 'boolean' ? task.notify : true,
  };
}

function normalizeWeek(week, index = 0) {
  const startWeek = Number.isFinite(Number(week?.startWeek)) ? Number(week.startWeek) : index + 1;
  const endWeek = Number.isFinite(Number(week?.endWeek)) ? Number(week.endWeek) : startWeek;

  return {
    id: sanitizeText(week?.id, makeId(`week-${index + 1}`)),
    label: sanitizeText(week?.label, `Week ${startWeek}`),
    startWeek,
    endWeek,
    sourcePhase: sanitizeText(week?.sourcePhase, 'Delivery'),
    goals: uniqueStrings(week?.goals, 2),
    tasks: (Array.isArray(week?.tasks) ? week.tasks : []).map(normalizeTask),
    deliverables: uniqueStrings(week?.deliverables, 3),
    dependencies: uniqueStrings(week?.dependencies),
  };
}

function normalizeRoadmapItem(item, index = 0) {
  return {
    id: sanitizeText(item?.id, makeId(`roadmap-${index + 1}`)),
    title: sanitizeText(item?.title, `Milestone ${index + 1}`),
    targetWeek: Number.isFinite(Number(item?.targetWeek)) ? Number(item.targetWeek) : index + 1,
    sourceWeekIds: uniqueStrings(item?.sourceWeekIds),
    status: ROADMAP_STATUSES.includes(item?.status) ? item.status : 'planned',
  };
}

function normalizeBacklogItem(item, index = 0) {
  return {
    id: sanitizeText(item?.id, makeId(`backlog-${index + 1}`)),
    title: sanitizeText(item?.title, `Backlog item ${index + 1}`),
    sourceWeekId: sanitizeText(item?.sourceWeekId, '') || null,
    reason: BACKLOG_REASONS.includes(item?.reason) ? item.reason : 'future_enhancement',
    status: 'backlog',
  };
}

function createWeekGoals(phaseName, scheduledTasks = []) {
  return uniqueStrings([
    `Align ${phaseName.toLowerCase()} goals and approvals`,
    ...scheduledTasks.slice(0, 1).map((task) => `Complete ${task}`),
  ], 2);
}

function deriveDeliveryPlan(payload = {}) {
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  const defaultNotifications = normalizeNotificationPreferences(payload.delivery_plan?.notificationDefaults);

  if (!timeline.length) {
    return {
      mode: 'weekly',
      generatedFrom: 'derived',
      weeks: [],
      roadmap: [],
      backlog: [],
      notificationDefaults: defaultNotifications,
    };
  }

  let currentWeek = 1;
  const weeks = [];
  const roadmap = [];
  const backlog = [];

  timeline.forEach((phase, phaseIndex) => {
    const phaseName = sanitizeText(phase?.phase, `Phase ${phaseIndex + 1}`);
    const phaseTasks = uniqueStrings(phase?.tasks);
    const phaseDependencies = uniqueStrings(phase?.dependencies);
    const weekCount = estimateWeeks(phase?.duration);
    const capacity = Math.max(1, weekCount) * 3;
    const scheduledTasks = phaseTasks.slice(0, capacity);
    const overflowTasks = phaseTasks.slice(capacity);
    const weekIds = [];

    for (let weekOffset = 0; weekOffset < weekCount; weekOffset += 1) {
      const weekNumber = currentWeek + weekOffset;
      const taskChunk = scheduledTasks.slice(weekOffset * 3, weekOffset * 3 + 3);
      const weekId = makeId(`week-${weekNumber}`);
      weekIds.push(weekId);

      weeks.push({
        id: weekId,
        label: `Week ${weekNumber}`,
        startWeek: weekNumber,
        endWeek: weekNumber,
        sourcePhase: phaseName,
        goals: createWeekGoals(phaseName, taskChunk),
        tasks: taskChunk.map((taskTitle, taskIndex) => normalizeTask({
          id: makeId(`task-${weekNumber}-${taskIndex + 1}`),
          title: taskTitle,
          owner: weekOffset === 0 ? 'shared' : 'team',
          status: 'planned',
          notify: true,
        })),
        deliverables: uniqueStrings([
          taskChunk[taskChunk.length - 1] ? `${taskChunk[taskChunk.length - 1]} ready` : '',
          weekOffset === weekCount - 1 ? `${phaseName} milestone ready for review` : `${phaseName} weekly package complete`,
        ], 2),
        dependencies: phaseDependencies,
      });
    }

    overflowTasks.forEach((taskTitle) => {
      backlog.push({
        id: makeId('backlog'),
        title: taskTitle,
        sourceWeekId: weekIds[weekIds.length - 1] || null,
        reason: 'timeline_overflow',
        status: 'backlog',
      });
    });

    roadmap.push({
      id: makeId('roadmap'),
      title: `${phaseName} milestone`,
      targetWeek: currentWeek + weekCount - 1,
      sourceWeekIds: weekIds,
      status: 'planned',
    });

    currentWeek += weekCount;
  });

  return {
    mode: 'weekly',
    generatedFrom: 'derived',
    weeks,
    roadmap,
    backlog,
    notificationDefaults: defaultNotifications,
  };
}

function normalizeDeliveryPlan(payload = {}) {
  const deliveryPlan = payload?.delivery_plan;

  if (!deliveryPlan || typeof deliveryPlan !== 'object') {
    return deriveDeliveryPlan(payload);
  }

  const normalizedWeeks = (Array.isArray(deliveryPlan.weeks) ? deliveryPlan.weeks : []).map(normalizeWeek);
  const normalizedRoadmap = (Array.isArray(deliveryPlan.roadmap) ? deliveryPlan.roadmap : []).map(normalizeRoadmapItem);
  const normalizedBacklog = (Array.isArray(deliveryPlan.backlog) ? deliveryPlan.backlog : []).map(normalizeBacklogItem);

  if (!normalizedWeeks.length) {
    return deriveDeliveryPlan(payload);
  }

  return {
    mode: 'weekly',
    generatedFrom: deliveryPlan.generatedFrom === 'llm' ? 'llm' : 'derived',
    weeks: normalizedWeeks,
    roadmap: normalizedRoadmap,
    backlog: normalizedBacklog,
    notificationDefaults: normalizeNotificationPreferences(deliveryPlan.notificationDefaults),
  };
}

function ensureDeliveryPlan(payload = {}) {
  const normalizedPlan = normalizeDeliveryPlan(payload);

  return {
    ...payload,
    delivery_plan: normalizedPlan,
  };
}

function cloneDeliveryPlan(deliveryPlan = {}) {
  return JSON.parse(JSON.stringify({
    mode: 'weekly',
    generatedFrom: deliveryPlan.generatedFrom || 'derived',
    weeks: deliveryPlan.weeks || [],
    roadmap: deliveryPlan.roadmap || [],
    backlog: deliveryPlan.backlog || [],
    notificationDefaults: deliveryPlan.notificationDefaults || cloneDefaultNotificationPreferences(),
  }));
}

function getWeek(plan, weekId) {
  return plan.weeks.find((week) => week.id === weekId);
}

function getTask(week, taskId) {
  return week?.tasks.find((task) => task.id === taskId);
}

function applyPlanningOperation(payload = {}, operation = {}) {
  const proposalWithPlan = ensureDeliveryPlan(payload);
  const nextPayload = {
    ...proposalWithPlan,
    delivery_plan: cloneDeliveryPlan(proposalWithPlan.delivery_plan),
  };
  const plan = nextPayload.delivery_plan;
  const result = { proposalJSON: nextPayload, event: null };

  switch (operation.action) {
    case 'set_task_status': {
      const week = getWeek(plan, operation.weekId);
      const task = getTask(week, operation.taskId);

      if (!week || !task) {
        throw new Error('Planning task not found.');
      }

      const hadIncompleteTasks = week.tasks.some((item) => item.status !== 'done');
      task.status = TASK_STATUSES.includes(operation.status) ? operation.status : 'planned';

      if (task.status === 'backlog') {
        plan.backlog.push({
          id: makeId('backlog'),
          title: task.title,
          sourceWeekId: week.id,
          reason: 'timeline_overflow',
          status: 'backlog',
        });
        week.tasks = week.tasks.filter((item) => item.id !== task.id);
        result.event = {
          type: 'backlog_moved',
          title: task.title,
          weekLabel: week.label,
        };
        break;
      }

      const isNowComplete = week.tasks.length > 0 && week.tasks.every((item) => item.status === 'done');
      if (hadIncompleteTasks && isNowComplete) {
        result.event = {
          type: 'goal_completed',
          weekLabel: week.label,
          goals: [...week.goals],
        };
      }
      break;
    }
    case 'move_task_to_backlog': {
      const week = getWeek(plan, operation.weekId);
      const task = getTask(week, operation.taskId);

      if (!week || !task) {
        throw new Error('Planning task not found.');
      }

      plan.backlog.push({
        id: makeId('backlog'),
        title: task.title,
        sourceWeekId: week.id,
        reason: BACKLOG_REASONS.includes(operation.reason) ? operation.reason : 'timeline_overflow',
        status: 'backlog',
      });
      week.tasks = week.tasks.filter((item) => item.id !== task.id);
      result.event = {
        type: 'backlog_moved',
        title: task.title,
        weekLabel: week.label,
      };
      break;
    }
    case 'restore_backlog_item': {
      const week = getWeek(plan, operation.weekId);
      const backlogIndex = plan.backlog.findIndex((item) => item.id === operation.backlogItemId);

      if (!week || backlogIndex === -1) {
        throw new Error('Backlog item not found.');
      }

      const [item] = plan.backlog.splice(backlogIndex, 1);
      week.tasks.push(normalizeTask({
        id: makeId('task-restored'),
        title: item.title,
        owner: 'team',
        status: 'planned',
        notify: true,
      }));
      week.deliverables = uniqueStrings([...week.deliverables, `${item.title} restored to active delivery`], 3);
      break;
    }
    case 'update_goals': {
      const week = getWeek(plan, operation.weekId);
      if (!week) {
        throw new Error('Planning week not found.');
      }
      week.goals = uniqueStrings(operation.goals, 2);
      break;
    }
    case 'update_notifications': {
      plan.notificationDefaults = normalizeNotificationPreferences(operation.notificationDefaults);
      break;
    }
    default:
      throw new Error('Unsupported planning action.');
  }

  return result;
}

module.exports = {
  BACKLOG_REASONS,
  TASK_OWNERS,
  TASK_STATUSES,
  ROADMAP_STATUSES,
  estimateWeeks,
  deriveDeliveryPlan,
  normalizeDeliveryPlan,
  ensureDeliveryPlan,
  applyPlanningOperation,
};
