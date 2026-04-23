const OUTPUT_SCHEMA = {
  project_summary: 'string (2-4 sentences)',
  features: [
    {
      title: 'string',
      description: 'string',
      technical_approach: 'string',
      complexity: 'High | Medium | Low',
      confidence: 'High | Medium | Low',
      confidence_pct: 'number 0-100',
      area: 'string',
    },
  ],
  risks: [
    {
      label: 'string',
      severity: 'number 0-100',
      mitigation: 'string',
      category: 'string',
    },
  ],
  timeline: [
    {
      phase: 'string',
      duration: 'string',
      tasks: ['string'],
      dependencies: ['string'],
    },
  ],
  effort: [
    {
      label: 'string',
      percentage: 'number 0-100',
      timeframe: 'string',
      description: 'string',
    },
  ],
  market: [
    {
      title: 'string',
      description: 'string',
      trend: 'up | down | stable',
      relevance: 'number 0-100',
    },
  ],
  impact: [
    {
      title: 'string',
      description: 'string',
      impact_score: 'number 0-100',
      category: 'string',
    },
  ],
};

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    project_summary: {
      type: 'string',
      description: 'A concise 2-4 sentence summary of the recommended project approach.',
    },
    features: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          technical_approach: { type: 'string' },
          complexity: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          confidence_pct: { type: 'number', minimum: 0, maximum: 100 },
          area: { type: 'string' },
        },
        required: [
          'title',
          'description',
          'technical_approach',
          'complexity',
          'confidence',
          'confidence_pct',
          'area',
        ],
      },
    },
    risks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          severity: { type: 'number', minimum: 0, maximum: 100 },
          mitigation: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['label', 'severity', 'mitigation', 'category'],
      },
    },
    timeline: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          phase: { type: 'string' },
          duration: { type: 'string' },
          tasks: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['phase', 'duration', 'tasks', 'dependencies'],
      },
    },
    effort: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          percentage: { type: 'number', minimum: 0, maximum: 100 },
          timeframe: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['label', 'percentage', 'timeframe', 'description'],
      },
    },
    market: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          trend: { type: 'string', enum: ['up', 'down', 'stable'] },
          relevance: { type: 'number', minimum: 0, maximum: 100 },
        },
        required: ['title', 'description', 'trend', 'relevance'],
      },
    },
    impact: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          impact_score: { type: 'number', minimum: 0, maximum: 100 },
          category: { type: 'string' },
        },
        required: ['title', 'description', 'impact_score', 'category'],
      },
    },
  },
  required: ['project_summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact'],
};

const SYSTEM_PROMPT = `You are an elite senior technical consultant and solution architect.
You analyze client project briefs and produce comprehensive, structured project proposals.

RULES:
1. Output ONLY valid JSON with double-quoted keys and strings.
2. Follow the exact schema provided below and keep the top-level key order unchanged.
3. Assess each feature honestly and use realistic confidence percentages.
4. Identify real risks and clear mitigations.
5. Provide practical timelines and effort breakdowns.
6. If the brief is vague, still provide your best assessment but lower confidence scores.
7. Do not include markdown, commentary, or code fences.`;

function normalizeBriefText(briefText) {
  const text = String(briefText || '').trim();

  if (text.length > 150000) {
    return `${text.slice(0, 150000)}\n[TRUNCATED]`;
  }

  return text;
}

function buildPrompt(briefText) {
  const normalizedBrief = normalizeBriefText(briefText);

  return {
    system: `${SYSTEM_PROMPT}\n\nOUTPUT SCHEMA (strict):\n${JSON.stringify(OUTPUT_SCHEMA, null, 2)}`,
    user: `Analyze the following client brief and generate a structured proposal:\n\n${normalizedBrief}`,
  };
}

module.exports = {
  buildPrompt,
  normalizeBriefText,
  SYSTEM_PROMPT,
  OUTPUT_SCHEMA,
  RESPONSE_JSON_SCHEMA,
};
