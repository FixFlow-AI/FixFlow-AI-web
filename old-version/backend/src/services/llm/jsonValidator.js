const { z } = require('zod');

const FeatureSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  technical_approach: z.string().min(1),
  complexity: z.enum(['High', 'Medium', 'Low']),
  confidence: z.enum(['High', 'Medium', 'Low']),
  confidence_pct: z.coerce.number().min(0).max(100),
  area: z.string().min(1),
});

const RiskSchema = z.object({
  label: z.string().min(1),
  severity: z.coerce.number().min(0).max(100),
  mitigation: z.string().min(1),
  category: z.string().min(1),
});

const TimelineSchema = z.object({
  phase: z.string().min(1),
  duration: z.string().min(1),
  tasks: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string()).default([]),
});

const DeliveryTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  owner: z.enum(['team', 'client', 'shared']),
  status: z.enum(['planned', 'done', 'backlog']),
  notify: z.boolean(),
});

const DeliveryWeekSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  startWeek: z.coerce.number().int().min(1),
  endWeek: z.coerce.number().int().min(1),
  sourcePhase: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  tasks: z.array(DeliveryTaskSchema).default([]),
  deliverables: z.array(z.string().min(1)).default([]),
  dependencies: z.array(z.string()).default([]),
});

const DeliveryRoadmapSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  targetWeek: z.coerce.number().int().min(1),
  sourceWeekIds: z.array(z.string().min(1)).default([]),
  status: z.enum(['planned', 'done']).default('planned'),
});

const DeliveryBacklogSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sourceWeekId: z.string().min(1).nullable().default(null),
  reason: z.enum(['timeline_overflow', 'future_enhancement', 'dependency_blocked']).default('future_enhancement'),
  status: z.enum(['backlog']).default('backlog'),
});

const NotificationDefaultsSchema = z.object({
  enabled: z.boolean().default(true),
  channels: z.array(z.enum(['in_app', 'email'])).default(['in_app', 'email']),
  events: z
    .array(z.enum(['invite', 'comment', 'approval', 'assignment', 'goal_completed', 'backlog_moved']))
    .default(['invite', 'comment', 'approval', 'assignment', 'goal_completed', 'backlog_moved']),
});

const DeliveryPlanSchema = z.object({
  mode: z.literal('weekly').default('weekly'),
  generatedFrom: z.enum(['llm', 'derived']).default('llm'),
  weeks: z.array(DeliveryWeekSchema).min(1),
  roadmap: z.array(DeliveryRoadmapSchema).default([]),
  backlog: z.array(DeliveryBacklogSchema).default([]),
  notificationDefaults: NotificationDefaultsSchema.default({
    enabled: true,
    channels: ['in_app', 'email'],
    events: ['invite', 'comment', 'approval', 'assignment', 'goal_completed', 'backlog_moved'],
  }),
});

const EffortSchema = z.object({
  label: z.string().min(1),
  percentage: z.coerce.number().min(0).max(100),
  timeframe: z.string().min(1),
  description: z.string().min(1),
});

const MarketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  trend: z.enum(['up', 'down', 'stable']),
  relevance: z.coerce.number().min(0).max(100),
});

const ImpactSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  impact_score: z.coerce.number().min(0).max(100),
  category: z.string().min(1),
});

const ProposalSchema = z.object({
  project_summary: z.string().min(10),
  features: z.array(FeatureSchema).min(1),
  risks: z.array(RiskSchema).min(1),
  timeline: z.array(TimelineSchema).min(1),
  delivery_plan: DeliveryPlanSchema.optional(),
  effort: z.array(EffortSchema).min(1),
  market: z.array(MarketSchema).default([]),
  impact: z.array(ImpactSchema).default([]),
});

function stripCodeFences(rawText) {
  return rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJsonObject(rawText) {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return '';
  }

  return rawText.slice(start, end + 1);
}

function tryParse(candidate) {
  if (!candidate) {
    return null;
  }

  const data = JSON.parse(candidate);
  return ProposalSchema.parse(data);
}

async function validateAndRepair(rawText) {
  const attempts = [
    rawText,
    stripCodeFences(rawText),
    extractJsonObject(rawText),
  ];

  for (const candidate of attempts) {
    try {
      return tryParse(candidate);
    } catch (_error) {
      // Try the next repair strategy.
    }
  }

  throw new Error(
    'JSON_REPAIR_FAILED: All repair strategies were exhausted. Raw output could not be parsed as valid proposal JSON.'
  );
}

module.exports = {
  ProposalSchema,
  DeliveryPlanSchema,
  validateAndRepair,
  stripCodeFences,
  extractJsonObject,
};
