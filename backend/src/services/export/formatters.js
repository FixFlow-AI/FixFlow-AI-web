function buildMarkdownExport(data, options = {}) {
  const layout = options.layout || 'delivery';
  const includeRoadmap = options.includeRoadmap !== false;
  const includeBacklog = options.includeBacklog !== false;
  const includeNotifications = options.includeNotifications !== false;

  const sections = [
    `# Proposal`,
    '',
    `## Project Summary`,
    data.project_summary,
    '',
    `## Features`,
    ...data.features.flatMap((feature) => [
      `### ${feature.title}`,
      `- Confidence: ${feature.confidence_pct}%`,
      `- Complexity: ${feature.complexity}`,
      `- Area: ${feature.area}`,
      '',
      feature.description,
      '',
      `Technical approach: ${feature.technical_approach}`,
      '',
    ]),
    `## Risks`,
    ...data.risks.flatMap((risk) => [
      `### ${risk.label}`,
      `- Severity: ${risk.severity}`,
      `- Category: ${risk.category}`,
      `- Mitigation: ${risk.mitigation}`,
      '',
    ]),
    `## Effort`,
    ...data.effort.flatMap((effort) => [
      `### ${effort.label}`,
      `- Percentage: ${effort.percentage}%`,
      `- Timeframe: ${effort.timeframe}`,
      effort.description,
      '',
    ]),
  ];

  if (layout === 'delivery' && data.delivery_plan?.weeks?.length) {
    sections.push('## Weekly Plan', '');
    data.delivery_plan.weeks.forEach((week) => {
      sections.push(`### ${week.label}`, '');
      sections.push('Goals:');
      week.goals.forEach((goal) => sections.push(`- ${goal}`));
      sections.push('');
      sections.push('Tasks:');
      week.tasks.forEach((task) => sections.push(`- [${task.status}] ${task.title}`));
      sections.push('');
      sections.push('Deliverables:');
      week.deliverables.forEach((item) => sections.push(`- ${item}`));
      sections.push('');
      if (week.dependencies?.length) {
        sections.push('Dependencies:');
        week.dependencies.forEach((item) => sections.push(`- ${item}`));
        sections.push('');
      }
    });

    if (includeRoadmap && data.delivery_plan.roadmap?.length) {
      sections.push('## Roadmap', '');
      data.delivery_plan.roadmap.forEach((milestone) => {
        sections.push(`### ${milestone.title}`, `- Target week: ${milestone.targetWeek}`, `- Status: ${milestone.status}`, '');
      });
    }

    if (includeBacklog && data.delivery_plan.backlog?.length) {
      sections.push('## Backlog', '');
      data.delivery_plan.backlog.forEach((item) => {
        sections.push(`- ${item.title} (${item.reason})`);
      });
      sections.push('');
    }

    if (includeNotifications && data.delivery_plan.notificationDefaults) {
      sections.push('## Collaboration Notifications', '');
      sections.push(`- Enabled: ${data.delivery_plan.notificationDefaults.enabled ? 'Yes' : 'No'}`);
      sections.push(`- Channels: ${data.delivery_plan.notificationDefaults.channels.join(', ') || 'None'}`);
      sections.push(`- Events: ${data.delivery_plan.notificationDefaults.events.join(', ') || 'None'}`);
      sections.push('');
    }
  } else {
    sections.push(
      `## Timeline`,
      ...data.timeline.flatMap((phase) => [
        `### ${phase.phase} (${phase.duration})`,
        ...phase.tasks.map((task) => `- ${task}`),
        '',
      ])
    );
  }

  if (data.market?.length) {
    sections.push('## Market', '');
    data.market.forEach((item) => {
      sections.push(`### ${item.title}`, `- Trend: ${item.trend}`, `- Relevance: ${item.relevance}`, item.description, '');
    });
  }

  if (data.impact?.length) {
    sections.push('## Impact', '');
    data.impact.forEach((item) => {
      sections.push(
        `### ${item.title}`,
        `- Impact score: ${item.impact_score}`,
        `- Category: ${item.category}`,
        item.description,
        ''
      );
    });
  }

  return sections.join('\n').trim();
}

function sanitizeDownloadName(value) {
  return String(value || 'proposal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'proposal';
}

module.exports = { buildMarkdownExport, sanitizeDownloadName };
