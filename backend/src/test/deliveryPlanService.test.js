const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveDeliveryPlan,
  ensureDeliveryPlan,
  applyPlanningOperation,
} = require('../services/proposal/deliveryPlanService');

test('deriveDeliveryPlan turns timeline phases into weekly buckets and overflow backlog', () => {
  const proposal = {
    timeline: [
      {
        phase: 'Foundation',
        duration: '1 week',
        tasks: ['Kickoff', 'Architecture', 'Backlog shaping', 'Stretch task'],
        dependencies: ['Stakeholder access'],
      },
    ],
  };

  const plan = deriveDeliveryPlan(proposal);

  assert.equal(plan.weeks.length, 1);
  assert.equal(plan.weeks[0].label, 'Week 1');
  assert.equal(plan.weeks[0].tasks.length, 3);
  assert.equal(plan.backlog.length, 1);
  assert.equal(plan.backlog[0].reason, 'timeline_overflow');
  assert.equal(plan.roadmap.length, 1);
});

test('ensureDeliveryPlan preserves supplied delivery plan metadata', () => {
  const payload = ensureDeliveryPlan({
    timeline: [
      {
        phase: 'Launch',
        duration: '2 weeks',
        tasks: ['QA'],
        dependencies: [],
      },
    ],
    delivery_plan: {
      mode: 'weekly',
      generatedFrom: 'llm',
      weeks: [
        {
          id: 'week-1',
          label: 'Week 1',
          startWeek: 1,
          endWeek: 1,
          sourcePhase: 'Launch',
          goals: ['QA sign-off'],
          tasks: [{ id: 'task-1', title: 'QA', owner: 'team', status: 'planned', notify: true }],
          deliverables: ['Release candidate'],
          dependencies: [],
        },
      ],
      roadmap: [],
      backlog: [],
      notificationDefaults: {
        enabled: true,
        channels: ['in_app'],
        events: ['approval'],
      },
    },
  });

  assert.equal(payload.delivery_plan.generatedFrom, 'llm');
  assert.deepEqual(payload.delivery_plan.notificationDefaults.channels, ['in_app']);
});

test('applyPlanningOperation updates tasks and emits completion/backlog events', () => {
  const base = ensureDeliveryPlan({
    timeline: [
      {
        phase: 'Implementation',
        duration: '1 week',
        tasks: ['Build core flow', 'Validate'],
        dependencies: [],
      },
    ],
  });

  const firstTask = base.delivery_plan.weeks[0].tasks[0];
  const secondTask = base.delivery_plan.weeks[0].tasks[1];

  const firstUpdate = applyPlanningOperation(base, {
    action: 'set_task_status',
    weekId: base.delivery_plan.weeks[0].id,
    taskId: firstTask.id,
    status: 'done',
  });
  assert.equal(firstUpdate.event, null);

  const secondUpdate = applyPlanningOperation(firstUpdate.proposalJSON, {
    action: 'set_task_status',
    weekId: firstUpdate.proposalJSON.delivery_plan.weeks[0].id,
    taskId: secondTask.id,
    status: 'done',
  });
  assert.equal(secondUpdate.event.type, 'goal_completed');

  const backlogMove = applyPlanningOperation(secondUpdate.proposalJSON, {
    action: 'move_task_to_backlog',
    weekId: secondUpdate.proposalJSON.delivery_plan.weeks[0].id,
    taskId: secondUpdate.proposalJSON.delivery_plan.weeks[0].tasks[0].id,
  });
  assert.equal(backlogMove.event.type, 'backlog_moved');
  assert.equal(backlogMove.proposalJSON.delivery_plan.backlog.length, 1);
});
