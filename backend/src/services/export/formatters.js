function buildMarkdownExport(data) {
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
    `## Timeline`,
    ...data.timeline.flatMap((phase) => [
      `### ${phase.phase} (${phase.duration})`,
      ...phase.tasks.map((task) => `- ${task}`),
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
