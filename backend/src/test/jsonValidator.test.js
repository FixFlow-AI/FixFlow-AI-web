const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAndRepair } = require('../services/llm/jsonValidator');

const sampleProposal = {
  project_summary: 'A practical proposal covering discovery, build, and launch in a realistic sequence.',
  features: [
    {
      title: 'Discovery',
      description: 'Clarify requirements and delivery goals.',
      technical_approach: 'Run workshops and define implementation milestones.',
      complexity: 'Low',
      confidence: 'High',
      confidence_pct: 90,
      area: 'Planning',
    },
  ],
  risks: [
    {
      label: 'Changing requirements',
      severity: 60,
      mitigation: 'Lock sprint scope and revisit roadmap weekly.',
      category: 'Scope',
    },
  ],
  timeline: [
    {
      phase: 'Discovery',
      duration: '2 weeks',
      tasks: ['Stakeholder interviews'],
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
        sourcePhase: 'Discovery',
        goals: ['Lock discovery agenda'],
        tasks: [{ id: 'task-1', title: 'Stakeholder interviews', owner: 'team', status: 'planned', notify: true }],
        deliverables: ['Discovery notes'],
        dependencies: [],
      },
    ],
    roadmap: [],
    backlog: [],
    notificationDefaults: {
      enabled: true,
      channels: ['in_app', 'email'],
      events: ['invite', 'comment', 'approval', 'assignment', 'goal_completed', 'backlog_moved'],
    },
  },
  effort: [
    {
      label: 'Planning',
      percentage: 25,
      timeframe: '1-2 weeks',
      description: 'Discovery, backlog creation, and technical planning.',
    },
  ],
  market: [],
  impact: [],
};

test('validateAndRepair parses direct JSON', async () => {
  const parsed = await validateAndRepair(JSON.stringify(sampleProposal));
  assert.equal(parsed.project_summary, sampleProposal.project_summary);
  assert.equal(parsed.features.length, 1);
});

test('validateAndRepair strips markdown fences', async () => {
  const fenced = `\`\`\`json\n${JSON.stringify(sampleProposal, null, 2)}\n\`\`\``;
  const parsed = await validateAndRepair(fenced);
  assert.equal(parsed.risks[0].label, sampleProposal.risks[0].label);
});

test('validateAndRepair extracts JSON from surrounding text', async () => {
  const noisy = `Here is your proposal.\n${JSON.stringify(sampleProposal)}\nThank you.`;
  const parsed = await validateAndRepair(noisy);
  assert.equal(parsed.timeline[0].phase, 'Discovery');
  assert.equal(parsed.delivery_plan.weeks[0].label, 'Week 1');
});
