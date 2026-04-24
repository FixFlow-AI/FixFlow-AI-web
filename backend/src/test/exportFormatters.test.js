const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/proplytics-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || '1234567890abcdef1234567890abcdef';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'abcdef1234567890abcdef1234567890';

const { buildMarkdownExport, sanitizeDownloadName } = require('../services/export/formatters');
const { buildHTMLTemplate } = require('../services/export/pdfExport');

const proposalFixture = {
  project_summary: 'A concise project summary for export verification.',
  features: [
    {
      title: 'Core Platform',
      description: 'Deliver the core application workflows.',
      technical_approach: 'Use modular services and reusable UI components.',
      confidence_pct: 84,
      complexity: 'Medium',
      area: 'Engineering',
    },
  ],
  risks: [
    {
      label: 'Integration drift',
      severity: 58,
      mitigation: 'Validate APIs early.',
      category: 'Integration',
    },
  ],
  timeline: [
    {
      phase: 'Implementation',
      duration: '6 weeks',
      tasks: ['Build core flows'],
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
        sourcePhase: 'Implementation',
        goals: ['Lock scope'],
        tasks: [{ id: 'task-1', title: 'Build core flows', owner: 'team', status: 'planned', notify: true }],
        deliverables: ['Build package'],
        dependencies: [],
      },
    ],
    roadmap: [
      {
        id: 'roadmap-1',
        title: 'Implementation milestone',
        targetWeek: 1,
        sourceWeekIds: ['week-1'],
        status: 'planned',
      },
    ],
    backlog: [
      {
        id: 'backlog-1',
        title: 'Stretch item',
        sourceWeekId: 'week-1',
        reason: 'timeline_overflow',
        status: 'backlog',
      },
    ],
    notificationDefaults: {
      enabled: true,
      channels: ['in_app', 'email'],
      events: ['invite', 'comment'],
    },
  },
  effort: [
    {
      label: 'Build',
      percentage: 60,
      timeframe: '4-6 weeks',
      description: 'Core engineering delivery.',
    },
  ],
  market: [],
  impact: [],
};

test('buildMarkdownExport renders major headings', () => {
  const markdown = buildMarkdownExport(proposalFixture, { layout: 'delivery' });

  assert.match(markdown, /^# Proposal/m);
  assert.match(markdown, /## Features/);
  assert.match(markdown, /Core Platform/);
  assert.match(markdown, /## Weekly Plan/);
  assert.match(markdown, /## Backlog/);
});

test('sanitizeDownloadName creates a filesystem-safe slug', () => {
  assert.equal(sanitizeDownloadName('Proposal: Mobile App Revamp!'), 'proposal-mobile-app-revamp');
});

test('buildHTMLTemplate escapes inserted HTML', () => {
  const html = buildHTMLTemplate({
    ...proposalFixture,
    project_summary: '<script>alert(1)</script>',
  }, { layout: 'delivery' });

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /Structured Delivery Report/);
});
